# 또박 B 촬영 API 연결

프로젝트 루트에서 실행합니다. 기존 `--app-dir backend/b_capture` 명령도 지원합니다.

```sh
python -m pip install -r backend/b_capture/requirements.txt
python -m uvicorn b_capture.dev_app:app --app-dir backend --reload
```

명세를 작성할 때 실행 서버의 `/docs` 또는 `/openapi.json`을 참고합니다.

- `POST /documents`는 빈 본문 또는 JSON의 선택 필드 `client_document_id`를 받습니다. 같은 UUID로 재시도하면 같은 문서 번호를 반환합니다.
- `POST /documents/{id}/pages`는 multipart의 `file`, 선택 필드 `client_page_id`를 받습니다. 같은 사진 UUID와 같은 파일을 재전송하면 장 수를 늘리지 않습니다. 응답의 `page_number`가 촬영 순서입니다.
- `POST /documents/{id}/finish`는 사진이 있어야 성공합니다. `202`와 `queued`, `page_count`, `analysis_connected`를 반환합니다. 촬영 종료 후 새 사진은 `409`로 거절합니다.
- `GET /documents/{id}/status`는 C의 `ocr`, `ai`, `saving` 형식을 사용합니다. 분석 시작 대기 중에는 `processing`, `step: null`, `done: false`입니다.

기본 실행은 한 명이 로컬에서 테스트하는 `local-dev` 사용자입니다. DB는 `~/.ttobak-b-dev/ttobak.db`, 사진은 그 아래 `uploads`에 저장합니다. `TTOBAK_DATA_DIR`과 `TTOBAK_DB_PATH`로 경로를 지정할 수 있습니다.

## C 분석 연결

C의 모듈을 합친 뒤 분석 실행 함수와 상태 조회 함수를 함께 주입합니다.

```python
from b_capture.dev_app import create_app
from c_analysis.analysis import SolarDocumentAnalyzer
from c_analysis.ocr import UpstageDocumentParser
from c_analysis.pipeline import analyze_document
from c_analysis.storage import SQLiteAnalysisStore

analysis_store = SQLiteAnalysisStore("data/ttobak.db")

def analyze(document_id, image_paths):
    analyze_document(
        document_id,
        image_paths=image_paths,
        parser=UpstageDocumentParser(),
        analyzer=SolarDocumentAnalyzer(),
        store=analysis_store,
    )

app = create_app(
    db_path="data/ttobak.db",
    analyze=analyze,
    analysis_status=analysis_store.status,
)
```

분석 함수에는 DB에 기록된 서버 사진 경로를 촬영 순서대로 넘깁니다. 일반적인 중복 finish는 하나의 작업만 실행합니다. 실패한 실행과 10분 넘게 응답하지 않는 실행은 finish로 재요청할 수 있으므로 C의 함수는 중복 실행을 방지해야 합니다. 현재 C의 `analyze_document`가 이 동작을 제공합니다. C가 연결되기 전에도 finish 요청과 사진 기록은 DB에 남습니다.

## A의 공통 앱 연결

`create_capture_router(store, require_owner=...)`에 로그인한 사용자 번호(`users.id`)를 반환하는 함수를 전달합니다. 문서 주인은 `documents.user_id`에 저장되어 A의 `require_document_owner`가 그대로 검사합니다. C의 조회 라우터를 함께 사용할 때는 B 라우터에 `include_status=False`를 지정해 상태 주소 중복을 피합니다. 문서 분석 결과 `GET /documents/{id}`는 C가 제공합니다.

## 검증

```sh
PYTHONPATH=backend python -m unittest discover -s backend/b_capture/tests -v
```

실제 계정이나 외부 AI API 호출 없이 임시 DB와 테스트 사진으로 검증합니다.
