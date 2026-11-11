# C 모듈 연결 가이드

현재 C 모듈은 **다른 팀원의 코드를 수정하지 않고** 독립적으로 구현했습니다.

## 환경

- Python 3.11 이상, FastAPI (라우터에만 필요).
- `UPSTAGE_API_KEY`: Upstage Console에서 발급한 키. `.env` 등 비공개 환경에만 저장합니다.
- 외부 API: Document Parse (`document-parse`, `auto`) 및 Solar (`solar-pro4`).
- C가 사용할 **팀 공통 SQLite DB 파일**의 경로를 A/B와 일치시켜 `SQLiteAnalysisStore(path)`에 전달해야 합니다.
- 분석 결과는 `c_document_analyses` 테이블에만 기록합니다. B의 `documents`/`pages`는 수정하지 않습니다.

## A 담당자가 앱에 연결할 때 (참고 예시; 직접 수정하지 않음)

```python
from c_analysis.storage import SQLiteAnalysisStore
from c_analysis.router import create_analysis_router

store = SQLiteAnalysisStore("data/ttobak.db")
# require_document_owner는 인증과 document_id별 소유권을 검사해야 합니다.
app.include_router(create_analysis_router(store, authorize_document_dependency=require_document_owner))
```

사용자별 문서 접근 제한은 A의 인증 코드와 B의 문서 소유권 데이터가 확정되어야 합니다.
`require_document_owner`는 인증뿐 아니라 문서 조회 시 소유권까지 검사하도록 연동해야 하며,
**소유권 검사 전에는 공개 서버에 이 라우터를 연결하면 안 됩니다.**

## B 담당자가 finish에서 호출할 때 (참고 예시; 직접 수정하지 않음)

```python
from c_analysis.analysis import SolarDocumentAnalyzer
from c_analysis.ocr import UpstageDocumentParser
from c_analysis.pipeline import analyze_document

background_tasks.add_task(
    analyze_document,
    document_id,
    image_paths=server_owned_page_paths,  # B가 조회한 서버 내부 사진 경로 목록
    parser=UpstageDocumentParser(),
    analyzer=SolarDocumentAnalyzer(),
    store=store,
)
```

중복으로 `finish`가 들어와도 한 번만 처리합니다. 실패한 문서를 재분석하려면
`store.start`를 따로 호출하지 말고 **OCR부터 다시 실행**하도록 다음과 같이 등록합니다.

```python
background_tasks.add_task(
    analyze_document,
    document_id,
    image_paths=server_owned_page_paths,
    parser=UpstageDocumentParser(),
    analyzer=SolarDocumentAnalyzer(),
    store=store,
    retry_failed=True,
)
```

재시도 요청은 A/B의 사용자 인증·문서 소유권 검사 및 저장된 사진 경로 확인 후
실행해야 합니다. 이미 `processing` 또는 `completed`인 문서는 재시작하지 않습니다.

## B가 요청할 진행 상태

`GET /documents/12/status`

```json
{"id":12,"status":"processing","step":"ai","done":false,"error":null}
```

분석 완료면 `status=completed, done=true, step=null`, 실패면
`status=failed, done=true, step=null, error=<사용자 안내문>`입니다.

## D가 읽는 결과

`GET /documents/12` → `contracts/document-result.schema.json` 형식의 JSON입니다.
처리 중 조회 시 409, 분석 기록이 없다면 404를 반환합니다.
`created_at`은 C의 분석일입니다. B의 보관일과 혼동하지 않도록 결과 화면에도 '분석일'로 표기합니다.

## 테스트

```bash
PYTHONPATH=backend python -m unittest discover -s backend/tests -v
```

단위 테스트는 실제 계정/API 호출 없이 동작합니다. 실서버 전에는 실제
Upstage 키와 테스트용 **비실명·비민감** 문서 3장으로 OCR 및 LLM 품질을 점검해야 합니다.

## 중요한 보안 경계

- 인증·권한 검사와 문서 소유권 검사는 A/B의 책임이지만, **API 공개 전 반드시 연결해야 합니다.**
- C는 사용자 사진의 파일 업로드, 자동촬영, 파일 삭제를 처리하지 않습니다.
- 이름·주소·연락처 등 민감한 정보가 실제 문서에 들어갈 수 있습니다. 현 단계에서
  사용자가 제외한 개인정보 마스킹 기능은 구현하지 않았습니다.
- OCR 원문은 C의 DB에 별도로 저장하지 않으며, API 오류에 원문과 키를 넣지 않습니다.
