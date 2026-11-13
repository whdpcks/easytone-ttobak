"""
D 담당 — GET /search?q=검색어  → [{id, reason, doc}]

전략:
  1. LLM(Upstage Solar — UPSTAGE_API_KEY, 없으면 OPENAI_API_KEY)에 [id, 제목, 카테고리, 요약] 목록을 주고
     관련 문서와 이유를 JSON으로 받음
  2. 키워드가 그대로 들어간 문서는 LLM 결과와 합쳐 빠지지 않게 함
  3. LLM 호출 실패 시 플랜 B: 카테고리 동의어 사전으로 키워드 검색
"""
import os, json, re, logging
from fastapi import APIRouter, Depends
from common.auth import get_current_user
from database import completed_documents, with_cached_translations
from openai import OpenAI

router = APIRouter(prefix="/search", tags=["search"])
log = logging.getLogger("uvicorn.error")

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
        text = (d["title"] + " " + " ".join(d["summary"])).lower()
        if any(h.lower() in text for h in hints) or q_norm.lower() in text:
            reason = "검색어와 관련된 내용이 있어요."
            results.append({"id": d["id"], "reason": reason, "doc": d})

    return results


UPSTAGE_BASE_URL = "https://api.upstage.ai/v1"
UPSTAGE_MODEL = "solar-pro4"  # C(c_analysis/analysis.py)와 같은 모델


def llm_config() -> tuple[str, str, str] | None:
    """(키, 주소, 모델). 팀 공통 UPSTAGE_API_KEY를 먼저 쓰고, 없으면 OpenAI 키를 씀."""
    if key := os.getenv("UPSTAGE_API_KEY"):
        return key, UPSTAGE_BASE_URL, os.getenv("LLM_MODEL", UPSTAGE_MODEL)
    if key := os.getenv("OPENAI_API_KEY"):
        return key, "https://api.openai.com/v1", os.getenv("LLM_MODEL", "gpt-4o-mini")
    return None


# 이유(reason)를 쓸 언어 — D는 한·영·일·중만 지원 (그 외 언어는 영어로)
REASON_LANG = {"ko": "Korean", "en": "English", "ja": "Japanese", "zh": "Simplified Chinese"}


def llm_search(q: str, doc_list: list[dict], lang: str = "ko") -> list[dict]:
    """LLM에 목록을 주고 관련 문서와 이유를 받음"""
    config = llm_config()
    if not config:
        raise ValueError("No LLM API key")
    api_key, base_url, model = config

    client = OpenAI(api_key=api_key, base_url=base_url, timeout=20, max_retries=1)

    summary_list = json.dumps(
        [{"id": d["id"], "title": d["title"],
          "category": d["category"],
          "summary": " ".join(d.get("summary") or [])}
         for d in doc_list],
        ensure_ascii=False
    )

    reason_lang = REASON_LANG.get(lang, "Korean")
    prompt = f"""다음은 사용자 문서 목록입니다:
{summary_list}

사용자 검색어: "{q}"
(검색어는 한국어가 아닐 수도 있고, 사투리나 쉬운 말일 수도 있어요. 뜻으로 판단하세요.)

사용자가 이 검색어로 찾으려는 문서를 골라 아래 형식으로만 답하세요:
[
  {{"id": 1, "reason": "한 줄 이유 ({reason_lang}, 아주 짧고 쉬운 말)"}},
  ...
]
- 문서의 주제가 검색어의 뜻과 맞을 때만 고르세요.
- "날", "안내"처럼 낱말 하나가 겹친다고 고르지 마세요. 억지로 연결하지 마세요.
- 맞는 문서가 없으면 빈 배열 []을 반환하세요.
- IMPORTANT: write every "reason" in {reason_lang} only."""

    resp = client.chat.completions.create(
        model=model,
        messages=[
            {"role": "system", "content": f"You search the user's documents. Reply with JSON only. "
                                          f"Every \"reason\" value must be written in {reason_lang}, never in another language."},
            {"role": "user", "content": prompt},
        ],
        temperature=0,
        max_tokens=800,
    )
    raw = (resp.choices[0].message.content or "").strip()
    # JSON 추출
    m = re.search(r"\[.*\]", raw, re.DOTALL)
    if not m:
        return []
    results = []
    for r in json.loads(m.group()):
        try:  # LLM이 id를 "9001"처럼 글자로 줄 때도 있음
            results.append({"id": int(r["id"]), "reason": str(r.get("reason") or "")})
        except (KeyError, TypeError, ValueError):
            continue
    return results


@router.get("")
def search(q: str, lang: str = "ko", user: dict = Depends(get_current_user)):
    """AI 검색 — 내 문서 중에서 [{id, reason, doc}], doc은 C의 결과 JSON 그대로.
    lang: 이유를 그 언어로 쓰고, C가 번역해 둔 문서는 번역본으로 돌려줌"""
    lang = lang if lang in REASON_LANG else "en"
    doc_list = completed_documents(user["id"])

    if not doc_list:
        return []

    # 1. LLM 시도
    try:
        llm_results = llm_search(q, doc_list, lang)
    except Exception as exc:  # AI가 안 되면 키워드 검색만 사용
        log.warning("AI 검색 실패, 키워드 검색만 사용: %s: %s", type(exc).__name__, exc)
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
            # 키워드 검색 이유는 한국어 문장이라 다른 언어에서는 비움
            merged[r["id"]] = r if lang == "ko" else {**r, "reason": ""}

    results = list(merged.values())
    # 번역해 둔 문서는 번역본으로 (검색은 한국어 원본 기준, 보여주기만 번역)
    translated = with_cached_translations([r["doc"] for r in results], lang)
    return [{**r, "doc": d} for r, d in zip(results, translated)]
