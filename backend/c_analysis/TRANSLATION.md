# C 결과 조회 시 번역 API — D 연동 계약

- **기존** \`GET /documents/{document_id}\`: 한국어 원본 분석 결과(변경 없음).
- **추가** \`GET /documents/{document_id}/translation?lang=vi\`: 선택 언어 번역 결과. \`lang=ko\` 또는 생략 시 원본 그대로 반환.
- Vite 프론트 API 클라이언트(A)는 \`/api\` 접두사를 붙이므로 D에서는 다음과 같이 호출합니다.
- 인증: **반드시** \`Authorization: Bearer {token}\`. 기존 A의 API 클라이언트를 사용하면 자동 첨부됩니다.
- 지원 언어: \`ko,en,zh,ja,vi,th,id,fil,km,my,hi,ne\` (A 설정과 동일).
- 번역 시 동일 JSON 구조를 유지합니다: \`id,status,title,sender,category,created_at,summary,datetime,place,items,cautions,contact\`. 원본 필드명/타입은 바뀌지 않습니다.
- \`category\`는 D의 \`CAT_CONFIG\` 식별자로 쓰이므로 한국어 키 그대로 유지합니다. 카테고리 *보이는 라벨*과 카드 제목/버튼 문구는 D가 A의 i18n 설정으로 번역하세요.
- 원본 날짜(\`datetime.date\`, \`datetime.time\`), \`datetime.check\`, 연락처 번호, 주소, 발행일, 작성자/기관명 등 식별 정보는 그대로 보존합니다. 설명성 문장(\`title\`, \`summary\`, 날짜/장소 설명, 준비물, 주의사항)만 번역합니다.
- 동일 문서와 언어에 대해서는 SQLite 캐시 결과를 재사용합니다. **촬영이나 OCR을 재호출하지 않습니다.** 원본 내용이 변경되면 캐시를 무효화합니다.
- 번역에는 C가 이미 쓰는 \`UPSTAGE_API_KEY\`만 필요합니다. API 키는 백엔드에만 저장합니다.

## D 구현 예시

\`\`\`jsx
import { api } from '../api/client';
import { useSettings } from '../common/SettingsContext';

const { lang } = useSettings();
const doc = await api.get(\`/documents/\${docId}/translation?lang=\${encodeURIComponent(lang)}\`);
// 기존 Result/Detail UI 컴포넌트에 doc 그대로 사용
\`\`\`

D의 \`Result.jsx\`, \`Detail.jsx\`에서 \`lang\` 변경 시 다시 API 호출하고, 로딩 및 오류 상태를 표시하면 됩니다.
- 401: 로그인 확인 / 404: 내 문서가 아님 또는 문서 없음
- 409: 분석 중·변경 중 / 422: 지원하지 않는 언어 / 503: Upstage 연결 실패 또는 번역 안전성 검사 실패
- 오류 시 번역 실패를 숨기지 말고 재시도를 안내하며, 원본 한국어를 표시하는 경우 **한국어 원문이라는 표시**를 하세요.

### 확인 필요
실제 Upstage 번역 호출 및 D 화면 통합은 팀원 PC의 실제 API 키로 E2E 시연이 필요합니다. D 화면 자체는 이 C PR에서 변경하지 않았습니다.
