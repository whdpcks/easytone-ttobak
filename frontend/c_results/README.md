# C 결과 타일 화면

React + Vite에서 사용할 독립 화면 컴포넌트입니다. A의 라우팅·헤더·음성·인증 API 코드를 수정하지 않습니다.

```jsx
import DocumentResultPage from './c_results/DocumentResultPage.jsx';

<DocumentResultPage
  documentId={documentId}
  loadDocument={async (id, { signal }) => {
    // A의 API client는 JSON을 그대로 반환합니다.
    return api.get(`/documents/${id}`, { signal });
  }}
  onOpenDetail={(id, tileKey) => {
    // D가 결정한 상세 화면 route와 매핑하세요.
    navigate(`/detail/${id}/${tileKey}`);
  }}
  announce={announceWithAUseVoice}
  header={<SharedHeader />}
/>
```

`loadDocument`는 부모 컴포넌트에서 `useCallback`으로 고정해 주세요.
자주 새 함수가 만들어지면 화면의 `useEffect`가 다시 호출될 수 있습니다.

`announceWithAUseVoice`는 A의 음성 기능에서 실제로 재생을 담당하는 함수를 넘겨주세요.
이 화면은 독립적으로 TTS를 만들지 않습니다.

누르는 카드의 `tileKey`: `summary`, `datetime`, `place`, `items`,
`cautions`, `contact`, `category`입니다. 세부 화면은 전부 D가 담당합니다.

카드는 없는 값(`null`, 빈 배열, 빈 문자열)을 자동으로 숨깁니다.

간단한 의존성 없는 로직 테스트:

```bash
node --test frontend/c_results/resultTiles.test.mjs
```
