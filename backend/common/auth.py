"""로그인·회원가입·내 정보 API와 인증 의존성 (A 담당).

- 인증번호는 시연용으로 "000000" 고정입니다. 실제 문자 발송은 하지 않습니다.
- 토큰은 서버 DB(auth_tokens)에 저장하는 무작위 문자열입니다. 앱은 Authorization: Bearer <token>으로 보냅니다.

다른 담당자가 쓰는 것:
    from common.auth import get_current_user, require_document_owner

    @router.post("/documents")
    def create(user = Depends(get_current_user)): ...   # user["id"]로 소유자 저장
"""
from __future__ import annotations

import re
import secrets
import sqlite3
from typing import Literal

from fastapi import APIRouter, Depends, Header, HTTPException, status
from pydantic import BaseModel, Field, field_validator

from .db import connect, utc_now

DEMO_CODE = "000000"
LANGUAGES = ("ko", "en", "zh", "vi")
FONT_SCALES = (1.0, 1.25, 1.5)

router = APIRouter(tags=["auth"])


# ── 입력 형식 ──────────────────────────────────────────────

def normalize_phone(raw: str) -> str:
    digits = re.sub(r"\D", "", raw or "")
    if not re.fullmatch(r"01\d{8,9}", digits):
        raise ValueError("전화번호를 다시 확인해 주세요.")
    return digits


class LoginIn(BaseModel):
    phone: str
    code: str

    @field_validator("phone")
    @classmethod
    def _phone(cls, v: str) -> str:
        return normalize_phone(v)


class SignupIn(BaseModel):
    name: str = Field(min_length=1, max_length=30)
    phone: str
    language: Literal["ko", "en", "zh", "vi"] = "ko"
    font_scale: float = 1.0

    @field_validator("phone")
    @classmethod
    def _phone(cls, v: str) -> str:
        return normalize_phone(v)

    @field_validator("name")
    @classmethod
    def _name(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("이름을 넣어 주세요.")
        return v

    @field_validator("font_scale")
    @classmethod
    def _scale(cls, v: float) -> float:
        if v not in FONT_SCALES:
            raise ValueError("글씨 크기는 1, 1.25, 1.5 중 하나예요.")
        return v


class MePatch(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=30)
    language: Literal["ko", "en", "zh", "vi"] | None = None
    font_scale: float | None = None
    voice_rate: float | None = Field(default=None, ge=0.5, le=1.5)

    @field_validator("font_scale")
    @classmethod
    def _scale(cls, v: float | None) -> float | None:
        if v is not None and v not in FONT_SCALES:
            raise ValueError("글씨 크기는 1, 1.25, 1.5 중 하나예요.")
        return v


# ── 공통 함수 ──────────────────────────────────────────────

def _public(row: sqlite3.Row) -> dict:
    return {
        "id": row["id"],
        "name": row["name"],
        "phone": row["phone"],
        "language": row["language"],
        "font_scale": row["font_scale"],
        "voice_rate": row["voice_rate"],
    }


def _issue_token(conn: sqlite3.Connection, user_id: int) -> str:
    token = secrets.token_urlsafe(32)
    conn.execute(
        "INSERT INTO auth_tokens (token, user_id, created_at) VALUES (?, ?, ?)",
        (token, user_id, utc_now()),
    )
    return token


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
            row = conn.execute(
                "SELECT user_id FROM documents WHERE id = ?", (document_id,)
            ).fetchone()
        except sqlite3.OperationalError:
            row = None  # documents 테이블(B)이 아직 없으면 아무 문서도 열 수 없음
    if row is None or row["user_id"] != user["id"]:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "문서를 찾을 수 없어요.")
    return user


# ── API ───────────────────────────────────────────────────

@router.post("/auth/login")
def login(body: LoginIn):
    if body.code.strip() != DEMO_CODE:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "인증번호가 맞지 않아요.")
    with connect() as conn:
        row = conn.execute("SELECT * FROM users WHERE phone = ?", (body.phone,)).fetchone()
        if row is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "가입하지 않은 번호예요. 회원가입을 해 주세요.")
        token = _issue_token(conn, row["id"])
    return {"token": token, "user": _public(row)}


@router.post("/auth/signup", status_code=status.HTTP_201_CREATED)
def signup(body: SignupIn):
    with connect() as conn:
        try:
            cur = conn.execute(
                "INSERT INTO users (name, phone, language, font_scale, created_at) VALUES (?, ?, ?, ?, ?)",
                (body.name, body.phone, body.language, body.font_scale, utc_now()),
            )
        except sqlite3.IntegrityError:
            raise HTTPException(status.HTTP_409_CONFLICT, "이미 가입한 번호예요. 로그인해 주세요.")
        row = conn.execute("SELECT * FROM users WHERE id = ?", (cur.lastrowid,)).fetchone()
        token = _issue_token(conn, row["id"])
    return {"token": token, "user": _public(row)}


@router.post("/auth/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(authorization: str | None = Header(default=None)):
    token = _bearer(authorization)
    with connect() as conn:
        conn.execute("DELETE FROM auth_tokens WHERE token = ?", (token,))


@router.get("/me")
def get_me(user: dict = Depends(get_current_user)):
    return user


@router.patch("/me")
def patch_me(body: MePatch, user: dict = Depends(get_current_user)):
    changes = body.model_dump(exclude_none=True)
    if changes:
        cols = ", ".join(f"{k} = ?" for k in changes)
        with connect() as conn:
            conn.execute(f"UPDATE users SET {cols} WHERE id = ?", (*changes.values(), user["id"]))
            row = conn.execute("SELECT * FROM users WHERE id = ?", (user["id"],)).fetchone()
        return _public(row)
    return user
