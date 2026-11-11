# 또박 C 담당 연동 계약 v1

이 디렉터리는 팀원 A/B/D가 코드에 손대지 않고 합의할 수 있는 **데이터 형식**만 담습니다.
샘플 3개는 UI를 먼저 만들기 위한 **목업**이며 실제 AI 결과 또는 시연 자동 대체 데이터가 아닙니다.

## B → C

- B는 문서를 만들고 사진을 저장한 뒤 `finish` 처리에서 C의 `analyze(document_id)`를 실행합니다.
- C는 B가 전달하는 문서 ID와 사진 경로를 사용합니다. **촬영/자동촬영/업로드는 C가 구현하지 않습니다.**

## C → B

- `GET /documents/{id}/status` → `document-status.schema.json`
- `status`: `processing`, `completed`, `failed`
- `step`: 진행 중이면 `ocr`, `ai`, `saving` 중 하나, 끝나면 `null`
- `done`: `completed`와 `failed`에서 `true`; B는 오류 화면도 표시할 수 있습니다.
- `error`: 실패했을 때 사용자에게 보여줄 안전한 설명. API 키나 OCR 원문은 노출하지 않습니다.
- B의 `capturing` 상태는 **B의 문서 생성·촬영 영역**이며 C가 분석을 시작하기 전에는 이 API의 조회 대상이 아닙니다.

## C → D/A

- `GET /documents/{id}` → `document-result.schema.json`
- 분석 완료 후 결과의 `summary`, `datetime`, `place`, `items`, `cautions`, `contact`를 사용합니다.
- `null` 값은 정보 없음이며, 화면에서는 해당 타일을 숨깁니다.
- `datetime.check`가 `true`면 날짜가 원문과 일치하는지 확인을 요청합니다.
- 여러 날짜가 있으면 AI가 마감일을 우선 선택하고, C 검증기는 원문의 명시적 마감일과 대조합니다.
  서로 다르면 날짜를 교정하면서 `datetime.check=true`와 주의사항을 남깁니다.
- `created_at`은 C 분석 결과를 만든 날짜입니다. B의 문서 촬영·보관 날짜와 다른 개념입니다.
- 화면 글자 크기·음성·공통 헤더는 **A의 컴포넌트**를 사용하도록 C 화면은 독립적으로 둡니다.
- D의 보관함/검색/상세화면은 C가 구현하거나 변경하지 않습니다.

## 이번 범위에서 제외

- 문서 자동촬영(B 담당), 개인정보 마스킹, 원문 근거 줄 번호, 30자 문장 강제 제한.
- 시연용 결과 자동 치환, 20초 이내 처리 강제, PR 생성/병합 및 다른 담당자의 코드 수정.
