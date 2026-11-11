# 또박 팀 공유 — 공통 기반 · 시연 서버 · 협업 규칙

> 작성: A(강하늘) · 2026-11-12
> 레포: https://github.com/whdpcks/easytone-ttobak

---

## 1. 지금 상태

| PR | 내용 | 상태 |
|---|---|---|
| [#2](https://github.com/whdpcks/easytone-ttobak/pull/2) | **공통 기반** (헤더·글씨·음성·자막·번역) + 시작·로그인·회원가입·홈·내 정보 + 인증·음성 API | 리뷰 대기 |
| [#3](https://github.com/whdpcks/easytone-ttobak/pull/3) | **ngrok 시연 배포** 스크립트 + PR 템플릿 | 리뷰 대기 (#2 위에 쌓은 PR) |

**머지 순서:** #2 → #3 → 나머지 담당(B·C·D) PR.

- #2가 main에 들어간 다음, 각자 자기 브랜치에 main을 합치세요(`git merge origin/main`).
- 공통 부품이 #2에 있어서, 먼저 들어가야 다른 화면에서 쓸 수 있어요.

---

## 2. 협업 규칙

- **main에 직접 푸시하지 않습니다.** 항상 브랜치를 만들고 PR로 합칩니다.
- **브랜치 이름:** `feat/담당-기능`. 예: `feat/b-camera`, `feat/c-result-ui`, `feat/d-archive`
- **PR 양식:** PR을 열면 템플릿이 자동으로 채워집니다. 칸은 아래 5개입니다.
  - 개요
  - 작업배경 및 목적
  - 주요변경사항
  - 스크린샷: 휴대폰 크기(390px)로 캡처
  - 리뷰포인트
- **남의 파일:** 고치기 전에 단톡에 먼저 말하기
- **30분 규칙:** 30분 넘게 막히면 바로 공유하고 플랜 B로 바꾸기

---

## 3. 내 컴퓨터에서 실행

```bash
git clone https://github.com/whdpcks/easytone-ttobak.git
cd easytone-ttobak

# 한 번에 켜기 (ngrok 없이 내 컴퓨터만)
./scripts/demo.sh --local                                   # Mac / Linux / Git Bash
powershell -ExecutionPolicy Bypass -File scripts\demo.ps1 -Local   # Windows
```

→ http://localhost:5173

개발할 때는 서버를 따로 켜면 고친 내용이 바로 보여요.

```bash
# 터미널 1 — 백엔드
cd backend
python -m venv .venv && source .venv/bin/activate      # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env                                    # UPSTAGE_API_KEY 채우기
uvicorn main:app --reload --port 8000

# 터미널 2 — 프론트
cd frontend
npm ci
npm run dev                                             # /api → localhost:8000 으로 자동 연결
```

- **시연 계정:** `010-1234-5678` → 인증번호 받기 → 화면 위 **문자 알림**을 누르면 자동 로그인
  - 시연 계정에는 가족 "딸 김미영"이 들어 있어요.
- **백엔드 테스트:** `cd backend && python -m unittest discover -s tests -v`

---

## 4. 시연 서버 (ngrok)

휴대폰 카메라는 **HTTPS 주소에서만** 켜져요. 그래서 노트북에 서버를 켜고, ngrok으로 HTTPS 고정 주소를 붙여요.

### 처음 한 번 (각자)

1. **ngrok 설치**
   - Mac: `brew install ngrok`
   - Windows: `winget install ngrok.ngrok`
2. **팀 키 등록:** `ngrok config add-authtoken <팀 키>`
   - 팀 키: `__________________` ← 여기에 붙여넣기 (외부에 공유 금지)
3. **주소 파일 만들기:** 레포 맨 위에서 `cp .env.ngrok.example .env.ngrok` 실행 후 아래처럼 바꾸기
   ```
   NGROK_DOMAIN=__________________.ngrok-free.app
   ```
4. **API 키:** `backend/.env`에 `UPSTAGE_API_KEY` 넣기 (C·D 기능용)

### 켜기 / 끄기

```bash
./scripts/demo.sh                                       # Mac / Linux / Git Bash
powershell -ExecutionPolicy Bypass -File scripts\demo.ps1   # Windows
```

- 휴대폰에서 `https://<팀 주소>`를 열고, **처음 한 번 "Visit Site"** 를 눌러요. ngrok 무료 요금제의 안내 화면이에요.
- 끄기: `Ctrl + C` (백엔드, 프론트, ngrok이 한꺼번에 꺼져요)

### 꼭 알아둘 것

| 항목 | 내용 |
|---|---|
| 한 번에 한 명 | 같은 주소는 한 사람만 켤 수 있어요. 누가 켜 둔 상태에서 켜면 오류가 나요. |
| 데이터는 켠 사람 노트북에 | 가입 정보, 사진, 분석 결과가 켠 사람 노트북에 저장돼요. 시연 노트북을 한 대 정해 두고, 시연 데이터도 그 노트북에서 만들어요. |
| 무료 한도 | 한 달에 전송량 1GB, 요청 2만 건, 동시에 3개까지. 해커톤에는 충분해요. |
| 시연 노트북 | 절전 끄기, 충전기 연결, 와이파이 확인. 예비로 핫스팟도 준비해요. |

---

## 5. 공통 기반 사용법 (프론트)

모든 화면은 아래 틀을 따라 주세요. 그래야 글씨 크기, 소리 버튼, 자막, 번역이 자동으로 적용돼요.

```jsx
import Header, { HeaderButton } from '../common/Header';
import useVoice from '../hooks/useVoice';
import { useT } from '../common/i18n';
import { useUI } from '../common/UIContext';
import { api } from '../api/client';

export default function MyScreen() {
  const t = useT();
  const voiceText = t('archive.voice');          // 화면에 들어오면 자동으로 읽을 문장
  const { speak } = useVoice(voiceText);         // 들어오면 읽고, 나가면 멈춤
  const { toast, confirm } = useUI();

  return (
    <div className="app">                        {/* 카메라처럼 어두운 화면은 "app dark" */}
      <Header left="back" title={t('archive.title')} voiceText={voiceText}
              right={<HeaderButton icon="user" label={t('hdr.me')} onClick={...} />} />
      <main className="body">
        ...
      </main>
    </div>
  );
}
```

| 쓰고 싶은 것 | 사용법 | 파일 |
|---|---|---|
| 화면 자동 음성 | `useVoice(문장)`: 들어오면 읽고, 나가면 멈춤 | `hooks/useVoice.js` |
| 원할 때 읽기 | `const { speak, stop } = useVoice(); speak('…')` | 〃 |
| 헤더 | `<Header left="back" \| "close" \| "home" \| "none" title voiceText right />`. 제목은 자동으로 화면 정가운데에 놓여요. | `common/Header.jsx` |
| 토스트 | `toast('저장했어요')`: 2.2초 동안 보여주고 소리로도 읽음 | `common/UIContext.jsx` |
| 확인 창 | `const ok = await confirm({ title, message, okText, cancelText, danger: true })` | 〃 |
| 아래에서 올라오는 창 | `<Sheet locked onDismiss={…}>…</Sheet>` (B 장 수 알림창) | `common/Sheet.jsx` |
| 로그인 사용자와 설정 | `const { user, lang, scale, rate } = useSettings()` | `common/SettingsContext.jsx` |
| 서버 호출 | `api.get / post / patch / del / upload(path, { file })`: 토큰 자동 첨부 | `api/client.js` |
| 번역 | `const t = useT(); t('키', { 변수 })` | `common/i18n.js` |
| 아이콘 | `<Icon name="camera" />` (camera, box, user, speaker, search, mic, cal, pin, bag, alert, phone, tag, doc, check, chev, back, x, globe …) | `utils/icons.jsx` |

### 스타일 (`styles/common.css`에 이미 있음)

- **버튼:** `btn primary`(남색), `btn red`(빨강), `btn line`(흰 바탕 테두리), `btn ghost`(밑줄)
- **입력:** `field` (`label` + `input`), `card`, `chip`, `sub`(회색 글씨), `h1.h`(큰 제목)
- **색:** `--paper` `--ink` `--red` `--hl`(형광 노랑) `--rule`
- **글씨 크기는 `em`으로 써 주세요.** `px`로 쓰면 글씨 크기 버튼을 눌러도 안 커져요.
- **터치 크기:** 버튼은 최소 56px

### 번역 넣는 법

`common/i18n.js`에서 각 언어 묶음에 키를 추가해요. **한국어(`ko`)와 영어(`en`)만 넣어도 동작해요.** 다른 언어는 비어 있으면 영어로 보여줘요.

```js
// ko 묶음
'archive.title': '보관함', 'archive.voice': '보관함이에요. 찾고 싶은 종이를 말해 주세요.',
// en 묶음
'archive.title': 'My papers', 'archive.voice': 'This is My papers. Tell me what you are looking for.',
```

---

## 6. 백엔드 공통

- **실행 위치:** `backend` 폴더 (`uvicorn main:app`). 모듈 import는 `from common.auth import …`, `from c_analysis…`, `from routers…` 형태예요.
- **DB:** SQLite 파일 하나를 팀이 같이 써요. 경로는 `TTOBAK_DB_PATH`이고 기본값은 `data/ttobak.db`예요.
- **로그인 사용자:** `user = Depends(get_current_user)` → `user["id"]`, `user["language"]` 등
- **문서 주인 검사:** `Depends(require_document_owner)`. B의 `documents.user_id`로 검사해요.

### A가 만든 API

| API | 설명 |
|---|---|
| `POST /auth/send-code` `{phone, purpose: login\|signup}` | 6자리 인증번호, 3분 유효, 20초 재전송 간격, 5번 틀리면 다시 받기. 데모 모드면 `demo_code`가 함께 와요. |
| `POST /auth/login` `{phone, code}` | → `{token, user}` |
| `POST /auth/signup` `{name, phone, code, language, font_scale, voice_rate}` | → `{token, user}` |
| `POST /auth/logout` | 토큰을 지워요 |
| `GET /me` · `PATCH /me` | 내 정보, 설정 바꾸기 |
| `GET·POST /me/family` · `DELETE /me/family/{id}` | 가족과 함께 보기 (최대 5명) |
| `GET /tts?text=&lang=&rate=` | 엠마 목소리 mp3를 만들어 주고, 서버에 저장해 둬요 |

### 환경변수 (`backend/.env`)

| 이름 | 설명 |
|---|---|
| `UPSTAGE_API_KEY` | 문서 읽기와 LLM (C·D) |
| `TTOBAK_DB_PATH` | 기본값 `data/ttobak.db` |
| `TTOBAK_CORS_ORIGINS` | 비우면 전부 허용 (개발용) |
| `TTOBAK_SEED_DEMO` | 시연 계정 자동 생성 (기본값 1) |
| `TTOBAK_SMS_MODE` | `demo`: 실제 문자 대신 앱에 문자 알림 표시 |

---

## 7. 담당별 부탁

### B (촬영 · 업로드 · 로딩 · 도장)

- [ ] `documents` 테이블에 **`user_id` 열**을 넣어 주세요.
  - `POST /documents`에서 `user = Depends(get_current_user)`로 받아 저장하면 돼요.
  - 이게 없으면 C의 결과 API에서 모든 문서가 404예요.
- [ ] 라우터를 `backend/main.py`의 "B" 자리에 연결해 주세요.
- [ ] 화면 경로를 맞춰 주세요: `/camera`, `/loading/:docId` (`App.jsx`의 ComingSoon 줄을 바꾸기)
- [ ] **X 버튼 "버릴까요?"** 는 `confirm({...danger:true})`, **장 수 알림창**은 `<Sheet locked>`를 쓰면 돼요.
- [ ] 촬영 안내 애니메이션을 봤는지는 `localStorage['ttobak-camera-intro-seen'] = '1'`에 저장해 주세요.
  - 내 정보의 "촬영 안내 다시 보기"가 이 값을 지워요. 키 이름은 `STORAGE.cameraIntroSeen`에 있어요.
- [ ] 카메라 화면은 `<div className="app dark">` + `<Header left="close" onLeft={…} />`로 만들어 주세요.

### C (AI 분석 · 결과 화면)

- [ ] 결과·상태 라우터는 `main.py`에 **이미 연결해 뒀어요.** `c_analysis` 모듈만 main에 들어오면 자동으로 붙어요.
- [ ] 결과 화면에 넘길 값:
  - `announce={speak}`
  - `header={<Header …/>}`
  - `loadDocument={(id, {signal}) => api.get(\`/documents/${id}\`, {signal})}`
- [ ] 화면 경로: `/result/:docId`
- [ ] **사용자 언어로 결과 보여주기:** 분석 프롬프트에 `user.language`(ko, en, zh, ja, vi, th, id, fil, km, my, hi, ne)를 넘기면 외국인 시연이 가능해요.

### D (보관함 · 검색 · 상세)

- [ ] #2를 머지한 뒤 **충돌 정리**가 필요해요.
  - `App.jsx`: 내 라우팅에 D 화면 줄만 바꾸기
  - `main.py`: D 라우터는 이미 연결돼 있으니 내 쪽 유지
  - `hooks/useVoice.js`: 내 쪽 유지. 기존 `speak/stop` 호출이 그대로 동작해요.
  - `index.css`: 공통 스타일은 `styles/common.css`로 옮겼으니 보관함·상세 전용 스타일만 남기기
- [ ] 보관함 헤더는 `<Header right={<HeaderButton icon="user" label={t('hdr.me')} onClick={() => navigate('/me')} />} />`로 쓰면 돼요.
- [ ] 홈의 "찍어둔 종이 N개"는 D의 `GET /documents`가 들어오면 자동으로 표시돼요.
- [ ] 화면 경로: `/archive`, `/detail/:docId/:type`

---

## 8. 정해진 것

| 항목 | 결정 |
|---|---|
| 목소리 | **엠마**(Microsoft 다국어 신경망 목소리), 12개 언어 모두 같은 목소리 |
| 빠르기 | 한국어: 천천히 1.05 / **보통 1.25** / 빠르게 1.45배. 외국어: 같은 설정 ÷ 1.25 (보통 = 1배) |
| 사용할 말 (12개) | 한국어, English, 中文, 日本語, Tiếng Việt, ภาษาไทย, Bahasa Indonesia, Filipino, ភាសាខ្មែរ, မြန်မာ, हिन्दी, नेपाली. 바꾸면 화면과 목소리가 바로 바뀌어요. |
| 문자 인증 | 해커톤에서는 **데모 모드**로, 실제 문자 대신 화면 위에 문자 알림을 띄워요. 발표에서 "실서비스는 문자 발송 업체 연동"이라고 말하기. |
| 회원가입 | 한 화면: 사용할 말 → 글씨 크기 → 목소리 빠르기 → 이름 → 전화번호 인증 |
| 글씨 크기 | 보통 · 크게 · 아주 크게 (100 / 125 / 150%) |
| 시연 서버 | 노트북 + ngrok 고정 주소 (팀 계정 1개 공유) |
| 디자인 | 프로토타입 기준. 종이색 `#FAFAF6`, 남색 `#161B2E`, 빨강 `#D62839`, 형광 노랑 `#FFE047` |

---

## 9. 시연 전 체크리스트

- [ ] 시연 노트북 정하기 → 그 노트북에서 `./scripts/demo.sh`
- [ ] 시연 휴대폰으로 팀 주소 열기 → Visit Site → 홈 화면에 추가
- [ ] 휴대폰 소리 크게, 무음 모드 끄기, 화면 꺼짐 시간 길게
- [ ] 글씨 150%에서 모든 화면 깨짐 확인
- [ ] 실제 문서 3장으로 리허설 (촬영 → 결과 → 보관함 검색)
- [ ] 외국어 시연을 한다면 베트남어나 영어로 한 번 리허설
- [ ] 네트워크 문제에 대비해 백업 시연 영상 녹화 (A)

---

## 10. 확인이 필요한 것

- [ ] **번역 검수:** 한국어·영어 외 번역은 초안이에요. 특히 캄보디아어, 미얀마어, 네팔어, 힌디어는 원어민 확인이 필요해요.
- [ ] **엠마 발음:** 엠마가 캄보디아어, 미얀마어, 네팔어를 자연스럽게 읽는지 확인해야 해요.
- [ ] **음성 엔진(edge-tts):** 무료지만 공식 상용 API는 아니에요. 실서비스로 가면 클로바 보이스나 Google TTS로 바꿔요(`backend/common/tts.py`만 수정).
