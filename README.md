# easytone-ttobak
이지톤 출품작 '또박' - 종이 문서를 촬영하면 AI가 핵심 정보와 해야 할 일을 쉬운 말과 음성으로 안내하는 서비스

## 로컬 실행

```bash
# 백엔드 (Python 3.11+)
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env          # UPSTAGE_API_KEY 등 채우기
uvicorn main:app --reload --port 8000

# 프론트 (다른 터미널)
cd frontend
npm ci
npm run dev                   # http://localhost:5173  (/api → localhost:8000)
```

- 시연용 계정: `010-1234-5678` / 인증번호 `000000` (로그인 화면의 **간편 로그인**)
- 백엔드 테스트: `cd backend && python -m unittest discover -s tests -v`

## 공통 기반 사용법 (A)

| 쓰고 싶은 것 | 가져오기 |
|---|---|
| 화면 자동 음성 · 다시 듣기 | `useVoice(text)` — `hooks/useVoice` |
| 뒤로 · 글씨 · 소리 버튼 헤더 | `<Header left="back" title="..." voiceText={text} />` — `common/Header` |
| 토스트 · 확인 창 · 글씨 시트 | `const { toast, confirm, openFontSheet } = useUI()` — `common/UIContext` |
| 아래에서 올라오는 창 | `<Sheet locked>` — `common/Sheet` |
| 로그인 사용자 · 설정 | `const { user, scale, rate } = useSettings()` — `common/SettingsContext` |
| 서버 호출 (토큰 자동) | `api.get / post / patch / upload` — `api/client` |
| 백엔드 로그인 사용자 | `Depends(get_current_user)` — `backend/common/auth.py` |
| 문서 소유권 검사 | `Depends(require_document_owner)` — B의 `documents.user_id` 필요 |
