"""로그인·회원가입·내 정보·가족 API와 인증 의존성 (A 담당).

흐름
    1) POST /auth/send-code {phone, purpose}  → 6자리 인증번호 발급 (3분 유효, 5번 틀리면 다시 받기)
    2) POST /auth/login  {phone, code}        → {token, user}
       POST /auth/signup {name, phone, code, language, font_scale, voice_rate} → {token, user}

문자 발송: TTOBAK_SMS_MODE=demo(기본)이면 실제 문자를 보내지 않고 응답에 demo_code를 넣어
앱이 "문자 알림"처럼 보여줍니다. 실제 발송 업체를 붙일 때는 common/sms.py 만 바꾸면 됩니다.

다른 담당자가 쓰는 것:
    from common.auth import get_current_user, require_document_owner
    def create(user = Depends(get_current_user)): ...   # user["id"]로 소유자 저장
"""
from __future__ import annotations

import hashlib
import hmac
import os
import re
import secrets
import sqlite3
import time
from typing import Literal

from fastapi import APIRouter, Depends, Header, HTTPException, status
from pydantic import BaseModel, Field, field_validator

from . import sms
from .db import DEMO_USER, connect, utc_now

LANGUAGES = ("ko", "en", "zh", "ja", "vi", "th", "id", "fil", "km", "my", "hi", "ne")
Language = Literal["ko", "en", "zh", "ja", "vi", "th", "id", "fil", "km", "my", "hi", "ne"]
FONT_SCALES = (1.0, 1.25, 1.5)
RELATIONS = ("딸", "아들", "배우자", "손주", "며느리", "사위", "형제자매", "보호자", "기타")

CODE_TTL = 180          # 인증번호 유효 시간(초)
RESEND_GAP = 20         # 다시 받기 최소 간격(초)
MAX_ATTEMPTS = 5

router = APIRouter(tags=["auth"])


# ── 입력 형식 ──────────────────────────────────────────────

def normalize_phone(raw: str) -> str:
    digits = re.sub(r"\D", "", raw or "")
    if not re.fullmatch(r"01\d{8,9}", digits):
        raise ValueError("전화번호를 다시 확인해 주세요.")
    return digits


def _check_scale(v):
    if v is not None and v not in FONT_SCALES:
        raise ValueError("글씨 크기는 1, 1.25, 1.5 중 하나예요.")
    return v


class PhoneIn(BaseModel):
    phone: str

    @field_validator("phone")
    @classmethod
    def _phone(cls, v: str) -> str:
        return normalize_phone(v)


class SendCodeIn(PhoneIn):
    purpose: Literal["login", "signup"] = "login"


class LoginIn(PhoneIn):
    code: str


class SignupIn(PhoneIn):
    name: str = Field(min_length=1, max_length=30)
    code: str
    language: Language = "ko"
    font_scale: float = 1.0
    voice_rate: float = Field(default=0.92, ge=0.5, le=1.5)

    @field_validator("name")
    @classmethod
    def _name(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("이름을 넣어 주세요.")
        return v

    @field_validator("font_scale")
    @classmethod
    def _scale(cls, v):
        return _check_scale(v)


class MePatch(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=30)
    language: Language | None = None
    font_scale: float | None = None
    voice_rate: float | None = Field(default=None, ge=0.5, le=1.5)

    @field_validator("font_scale")
    @classmethod
    def _scale(cls, v):
        return _check_scale(v)


class FamilyIn(PhoneIn):
    relation: Literal[RELATIONS] = "딸"  # type: ignore[valid-type]
    name: str = Field(min_length=1, max_length=30)


# ── 공통 함수 ──────────────────────────────────────────────

def _public(row: sqlite3.Row) -> dict:
    return {k: row[k] for k in ("id", "name", "phone", "language", "font_scale", "voice_rate")}


def _hash(phone: str, code: str) -> str:
    return hashlib.sha256(f"{phone}:{code}".encode()).hexdigest()


def _issue_token(conn: sqlite3.Connection, user_id: int) -> str:
    token = secrets.token_urlsafe(32)
    conn.execute(
        "INSERT INTO auth_tokens (token, user_id, created_at) VALUES (?, ?, ?)",
        (token, user_id, utc_now()),
    )
    return token


def _verify_code(conn: sqlite3.Connection, phone: str, code: str) -> None:
    """맞으면 인증번호를 지우고, 틀리면 400."""
    row = conn.execute("SELECT * FROM phone_codes WHERE phone = ?", (phone,)).fetchone()
    if row is None:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "인증번호를 먼저 받아 주세요.")
    if time.time() > row["expires_at"]:
        conn.execute("DELETE FROM phone_codes WHERE phone = ?", (phone,))
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "인증번호 시간이 지났어요. 다시 받아 주세요.")
    if row["attempts"] >= MAX_ATTEMPTS:
        raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS, "여러 번 틀렸어요. 인증번호를 다시 받아 주세요.")
    if not hmac.compare_digest(row["code_hash"], _hash(phone, (code or "").strip())):
        conn.execute("UPDATE phone_codes SET attempts = attempts + 1 WHERE phone = ?", (phone,))
        conn.commit()  # 틀린 횟수는 오류가 나도 남겨야 함
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "인증번호가 맞지 않아요.")
    conn.execute("DELETE FROM phone_codes WHERE phone = ?", (phone,))


def _bearer(authorization: str | None) -> str:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "로그인이 필요해요.")
    return authorization[7:].strip()


def get_current_user(authorization: str | None = Header(default=None)) -> dict:
    """토큰을 확인하고 사용자 정보를 돌려줍니다. 없거나 틀리면 401."""
    token = _bearer(authorization)
    with connect() as conn:
        row = conn.execute(
            "SELECT u.* FROM auth_tokens t JOIN users u ON u.id = t.user_id WHERE t.token = ?",
            (token,),
        ).fetchone()
    if row is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "다시 로그인해 주세요.")
    return _public(row)


def require_document_owner(document_id: int, user: dict = Depends(get_current_user)) -> dict:
    """C의 결과·상태 라우터에 넘기는 소유권 검사.

    B의 documents 테이블에 user_id 열이 있어야 합니다.
    남의 문서이거나 아직 없는 문서는 둘 다 404로 답해 존재 여부를 숨깁니다.
    """
    with connect() as conn:
        try:
            row = conn.execute("SELECT user_id FROM documents WHERE id = ?", (document_id,)).fetchone()
        except sqlite3.OperationalError:
            row = None  # documents 테이블(B)이 아직 없으면 아무 문서도 열 수 없음
    if row is None or row["user_id"] != user["id"]:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "문서를 찾을 수 없어요.")
    return user


# ── 인증 API ───────────────────────────────────────────────

@router.post("/auth/send-code")
def send_code(body: SendCodeIn):
    with connect() as conn:
        exists = conn.execute("SELECT 1 FROM users WHERE phone = ?", (body.phone,)).fetchone()
        if body.purpose == "login" and not exists:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "가입하지 않은 번호예요. 회원가입을 해 주세요.")
        if body.purpose == "signup" and exists:
            raise HTTPException(status.HTTP_409_CONFLICT, "이미 가입한 번호예요. 로그인해 주세요.")

        prev = conn.execute("SELECT sent_at FROM phone_codes WHERE phone = ?", (body.phone,)).fetchone()
        now = time.time()
        if prev and now - prev["sent_at"] < RESEND_GAP:
            wait = int(RESEND_GAP - (now - prev["sent_at"])) + 1
            raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS, f"{wait}초 뒤에 다시 받을 수 있어요.")

        code = os.getenv("TTOBAK_FIXED_CODE") or f"{secrets.randbelow(1_000_000):06d}"
        conn.execute(
            "INSERT OR REPLACE INTO phone_codes (phone, code_hash, expires_at, attempts, sent_at) "
            "VALUES (?, ?, ?, 0, ?)",
            (body.phone, _hash(body.phone, code), now + CODE_TTL, now),
        )

    result = sms.send_code(body.phone, code)
    res = {"expires_in": CODE_TTL, "resend_in": RESEND_GAP}
    if result.demo:
        res["demo_code"] = code  # 데모 모드에서만: 앱이 가짜 문자 알림으로 보여줌
    return res


@router.post("/auth/login")
def login(body: LoginIn):
    with connect() as conn:
        row = conn.execute("SELECT * FROM users WHERE phone = ?", (body.phone,)).fetchone()
        if row is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "가입하지 않은 번호예요. 회원가입을 해 주세요.")
        _verify_code(conn, body.phone, body.code)
        token = _issue_token(conn, row["id"])
    return {"token": token, "user": _public(row)}


@router.post("/auth/signup", status_code=status.HTTP_201_CREATED)
def signup(body: SignupIn):
    with connect() as conn:
        if conn.execute("SELECT 1 FROM users WHERE phone = ?", (body.phone,)).fetchone():
            raise HTTPException(status.HTTP_409_CONFLICT, "이미 가입한 번호예요. 로그인해 주세요.")
        _verify_code(conn, body.phone, body.code)
        cur = conn.execute(
            "INSERT INTO users (name, phone, language, font_scale, voice_rate, created_at) "
            "VALUES (?, ?, ?, ?, ?, ?)",
            (body.name, body.phone, body.language, body.font_scale, body.voice_rate, utc_now()),
        )
        row = conn.execute("SELECT * FROM users WHERE id = ?", (cur.lastrowid,)).fetchone()
        token = _issue_token(conn, row["id"])
    return {"token": token, "user": _public(row)}


@router.post("/auth/demo-login")
def demo_login():
    """시연용 '체험하기'. 실제 배포에서는 TTOBAK_DEMO_LOGIN=0 으로 끕니다."""
    if os.getenv("TTOBAK_DEMO_LOGIN", "1") != "1":
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Not Found")
    with connect() as conn:
        row = conn.execute("SELECT * FROM users WHERE phone = ?", (DEMO_USER["phone"],)).fetchone()
        if row is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "시연용 계정이 없어요.")
        token = _issue_token(conn, row["id"])
    return {"token": token, "user": _public(row)}


@router.post("/auth/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(authorization: str | None = Header(default=None)):
    token = _bearer(authorization)
    with connect() as conn:
        conn.execute("DELETE FROM auth_tokens WHERE token = ?", (token,))


# ── 내 정보 ────────────────────────────────────────────────

@router.get("/me")
def get_me(user: dict = Depends(get_current_user)):
    return user


@router.patch("/me")
def patch_me(body: MePatch, user: dict = Depends(get_current_user)):
    changes = body.model_dump(exclude_none=True)
    if not changes:
        return user
    cols = ", ".join(f"{k} = ?" for k in changes)
    with connect() as conn:
        conn.execute(f"UPDATE users SET {cols} WHERE id = ?", (*changes.values(), user["id"]))
        row = conn.execute("SELECT * FROM users WHERE id = ?", (user["id"],)).fetchone()
    return _public(row)


# ── 가족과 함께 보기 ───────────────────────────────────────

def _family(row: sqlite3.Row) -> dict:
    return {k: row[k] for k in ("id", "relation", "name", "phone")}


@router.get("/me/family")
def list_family(user: dict = Depends(get_current_user)):
    with connect() as conn:
        rows = conn.execute(
            "SELECT * FROM family_members WHERE user_id = ? ORDER BY id", (user["id"],)
        ).fetchall()
    return [_family(r) for r in rows]


@router.post("/me/family", status_code=status.HTTP_201_CREATED)
def add_family(body: FamilyIn, user: dict = Depends(get_current_user)):
    with connect() as conn:
        count = conn.execute(
            "SELECT COUNT(*) FROM family_members WHERE user_id = ?", (user["id"],)
        ).fetchone()[0]
        if count >= 5:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "가족은 5명까지 넣을 수 있어요.")
        cur = conn.execute(
            "INSERT INTO family_members (user_id, relation, name, phone, created_at) VALUES (?, ?, ?, ?, ?)",
            (user["id"], body.relation, body.name.strip(), body.phone, utc_now()),
        )
        row = conn.execute("SELECT * FROM family_members WHERE id = ?", (cur.lastrowid,)).fetchone()
    return _family(row)


@router.delete("/me/family/{member_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_family(member_id: int, user: dict = Depends(get_current_user)):
    with connect() as conn:
        cur = conn.execute(
            "DELETE FROM family_members WHERE id = ? AND user_id = ?", (member_id, user["id"])
        )
    if cur.rowcount == 0:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "가족 정보를 찾을 수 없어요.")
