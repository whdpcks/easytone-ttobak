# A · B · C 통합 가이드

공통 진입점 `backend/main.py`가 다음을 연결합니다.

- **A 인증**: Bearer 토큰과 `auth.require_document_owner`로 분석 결과의 소유권을 검사합니다.
- **B 촬영**: `POST /documents` → `POST /documents/{id}/pages` → `POST /documents/{id}/finish`로 문서를 수집합니다.
- **C 분석**: B의 `finish`가 `create_capture_analysis_handler(analysis_store)`를 백그라운드로 호출해 OCR과 AI를 실행합니다.
- **B/C 상태**: `GET /documents/{id}/status`가 B의 진행 상태와 C의 분석 상태를 하나로 돌려줍니다.
- **C 결과**: `GET /documents/{id}`는 분석 완료 JSON을 반환하고, 프론트 `/result/:docId`가 이를 표시합니다.

사용자별 소유권 검사는 A/B의 공통 DB에 저장된 문서 소유자를 기준으로 합니다. B의 `documents`와 `pages`는 C가 직접 변경하지 않고, 분석 결과는 별도 `c_document_analyses` 테이블에 저장합니다. A/B/C는 모두 `TTOBAK_DB_PATH`가 가리키는 동일한 SQLite 파일을 사용해야 합니다.

## 실행 환경

- Python 3.11 이상과 백엔드 의존성을 설치합니다.
- `UPSTAGE_API_KEY`를 비공개 환경 변수로 설정합니다. Git에 올리지 마세요.
- C는 Upstage Document Parse와 Solar API를 사용합니다. 실서비스 API 문서와 모델별 응답은 별도로 확인해야 합니다.
- 테스트용 데이터는 실명·연락처 등 민감 정보를 넣지 않은 문서로 준비합니다.
- API 키가 빠졌거나 분석에 실패하면 `status=failed`, `done=true`와 사용자용 오류 메시지를 반환합니다. 연결 실패를 무한 `processing`으로 숨기지 않습니다.

## 재시도 주의

B가 `claim_analysis` 실행권을 획득한 경우에만 C의 콜백이 동작합니다. 사용자는 B의 `finish`를 다시 호출해 재시도할 수 있지만, B의 현재 정책상 실패 직후에는 새 작업을 즉시 획득하지 못할 수 있습니다(재실행 간격은 B 저장소 로직 참조). 자동 재시도/큐 복구 기능은 별도 구현입니다.

## 화면 연결

`frontend/src/App.jsx`의 `/result/:docId`가 `AnalysisResult.jsx`를 렌더링합니다. 이 화면은 A의 `api.get`으로 `GET /documents/{id}`를 요청하고 A의 `Header`와 음성 읽기 기능을 사용합니다.

결과의 상세 타일은 `/detail/:docId/:type`으로 이동합니다. **D 상세 화면은 아직 공통 앱에 연결되지 않아 임시 안내 화면으로 표시**됩니다. D와 최종 결과 JSON을 맞추는 작업은 추후 필요합니다.

## 검증

```bash
PYTHONPATH=backend python -m unittest discover -s backend/tests -q
PYTHONPATH=backend python -m unittest discover -s backend/b_capture/tests -q
node --test frontend/c_results/resultTiles.test.mjs
cd frontend && npm ci && npm run build
```

Python 통합 테스트는 가짜 OCR·AI 결과를 주입하므로 실제 계정과 API 사용료 없이 인증 → 촬영 → 분석 → 결과 조회를 검증할 수 있습니다. 실서버에는 실제 Upstage 키로 별도 검증이 필요합니다.
통합 테스트에는 개인정보가 없는 `backend/tests/fixtures/sample_application_notice.png` 가상 안내문을 업로드하며,
해당 문서는 `generate_sample_notice.py`로 재생성할 수 있습니다. 신청 시작일(11월 20일)과
마감일(11월 30일)을 다르게 표기해 날짜 오류도 점검합니다.

## 보안/기능 경계

- C는 촬영, 자동 촬영, 업로드, 삭제를 수행하지 않습니다.
- 사용자가 이번 범위에서 제외한 개인정보 마스킹 기능은 없습니다.
- OCR 원문은 C의 DB에 별도로 저장하지 않으며 API 오류에 원문이나 키를 포함하지 않습니다.
- 문서에서 여러 날짜가 추출될 때 신청 시작일과 마감일을 혼동하지 않는지 추가 품질 검증이 필요합니다.
