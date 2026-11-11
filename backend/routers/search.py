"""
D 담당 — GET /search?q=검색어  → [{id, reason, doc}]

전략:
  1. LLM(Solar/GPT)에 [id, 제목, 카테고리, 요약] 목록을 주고
     관련 문서와 이유를 JSON으로 받음
  2. 키워드가 그대로 들어간 문서는 LLM 결과와 합쳐 빠지지 않게 함
  3. LLM 호출 실패 시 플랜 B: 카테고리 동의어 사전으로 키워드 검색
"""
import os, json, re
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from database import get_db
from models import Document
from openai import OpenAI

router = APIRouter(prefix="/search", tags=["search"])

# ── 플랜 B 동의어 사전 ──────────────────────────────
SYNONYMS: dict[str, list[str]] = {
    "일하는거":  ["일·직장", "근로", "근무", "월급", "급여", "계약", "알바", "출근"],
    "일":       ["일·직장"],
    "일하":     ["일·직장"],
    "월급":     ["일·직장"],
    "알바":     ["일·직장"],
    "돈 내는거": ["돈·요금", "납부", "청구", "요금", "고지서"],
    "돈":       ["돈·요금"],
    "요금":     ["돈·요금"],
    "고지서":   ["돈·요금"],
    "병원":     ["병원·건강", "건강", "검진", "의사", "진료"],
    "건강":     ["병원·건강"],
    "검진":     ["병원·건강"],
    "손주 학교": ["학교·아이", "가정통신문", "체험학습", "소풍"],
    "학교":     ["학교·아이"],
    "아이":     ["학교·아이"],
    "복지":     ["나라·복지"],
    "연금":     ["나라·복지"],
    "비자":     ["비자·체류"],
    "체류":     ["비자·체류"],
    "외국인":   ["비자·체류"],
}


def keyword_search(q: str, docs: list[dict]) -> list[dict]:
    """플랜 B — 키워드 & 동의어 단순 매칭"""
    q_norm = q.replace(" ", "")
    hints = set()
    for key, vals in SYNONYMS.items():
        if key.replace(" ", "") in q_norm or q_norm in key.replace(" ", ""):
            hints.update(vals)

    results = []
    for d in docs:
        # 카테고리 직접 매칭
        if d["category"] in hints:
            reason = f"'{d['category']}' 관련 문서예요."
            results.append({"id": d["id"], "reason": reason, "doc": d})
            continue
        # 제목·요약 키워드 매칭
        text = (d.get("title", "") + " " + " ".join(d.get("summary") or [])).lower()
        if any(h.lower() in text for h in hints) or q_norm.lower() in text:
            reason = "검색어와 관련된 내용이 있어요."
            results.append({"id": d["id"], "reason": reason, "doc": d})

    return results


def llm_search(q: str, doc_list: list[dict]) -> list[dict]:
    """LLM에 목록을 주고 관련 문서와 이유를 받음"""
    api_key = os.getenv("OPENAI_API_KEY") or os.getenv("SOLAR_API_KEY")
    base_url = os.getenv("SOLAR_BASE_URL", "https://api.openai.com/v1")
    model    = os.getenv("LLM_MODEL", "gpt-4o-mini")

    if not api_key:
        raise ValueError("No LLM API key")

    client = OpenAI(api_key=api_key, base_url=base_url)

    summary_list = json.dumps(
        [{"id": d["id"], "title": d["title"],
          "category": d["category"],
          "summary": (d.get("summary") or [""])[0]}
         for d in doc_list],
        ensure_ascii=False
    )

    prompt = f"""다음은 사용자 문서 목록입니다:
{summary_list}

사용자 검색어: "{q}"

검색어와 의미적으로 관련 있는 문서를 모두 찾아 아래 형식으로만 답하세요:
[
  {{"id": 1, "reason": "한 줄 이유 (한국어, 15자 이내)"}},
  ...
]
관련 없으면 빈 배열 []을 반환하세요."""

    resp = client.chat.completions.create(
        model=model,
        messages=[{"role": "user", "content": prompt}],
        temperature=0,
        max_tokens=400,
    )
    raw = resp.choices[0].message.content.strip()
    # JSON 추출
    m = re.search(r"\[.*\]", raw, re.DOTALL)
    if not m:
        return []
    return json.loads(m.group())


@router.get("")
def search(q: str, db: Session = Depends(get_db)):
    """AI 검색 — [{id, reason, doc}]"""
    docs_orm = db.query(Document).filter(Document.status == "done").all()
    doc_list = []
    for d in docs_orm:
        entry = {"id": d.id, "title": d.title, "sender": d.sender,
                 "category": d.category,
                 "created_at": d.created_at.isoformat() if d.created_at else None}
        entry.update(d.fields_dict)
        doc_list.append(entry)

    if not doc_list:
        return []

    # 1. LLM 시도
    try:
        llm_results = llm_search(q, doc_list)
    except Exception:
        llm_results = []

    # 2. 키워드 직접 매칭 (LLM이 빠뜨린 것 보완)
    kw_results = keyword_search(q, doc_list)
    kw_ids = {r["id"] for r in kw_results}

    # 3. 합치기 — doc 객체 첨부
    id_to_doc = {d["id"]: d for d in doc_list}
    merged: dict[int, dict] = {}

    for r in llm_results:
        rid = r["id"]
        if rid in id_to_doc:
            merged[rid] = {"id": rid, "reason": r.get("reason", ""), "doc": id_to_doc[rid]}
    for r in kw_results:
        if r["id"] not in merged:
            merged[r["id"]] = r

    return list(merged.values())
