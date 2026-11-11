/* ─────────────────────────────────────────────
   라우팅 + 공통 Provider (A 담당)

   담당 화면이 main에 합쳐지면 ComingSoon 줄을 각자 화면으로 바꿔 주세요.
   공통으로 쓸 수 있는 것:
     useVoice(text)            hooks/useVoice     자동 읽기·다시 듣기
     <Header .../>             common/Header      뒤로·글씨·소리 버튼
     useUI()                   common/UIContext   toast, confirm, openFontSheet
     useSettings()             common/SettingsContext  user, scale, rate, lang
     api.get/post/upload       api/client         토큰 자동 첨부
     <Sheet>                   common/Sheet       아래에서 올라오는 창
───────────────────────────────────────────── */
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import './styles/common.css';

import { SettingsProvider } from './common/SettingsContext';
import { VoiceProvider } from './common/VoiceContext';
import { UIProvider } from './common/UIContext';
import CaptionBar from './common/CaptionBar';
import RequireAuth from './common/RequireAuth';

import Splash from './pages/Splash';
import Login from './pages/Login';
import Signup from './pages/Signup';
import Home from './pages/Home';
import Me from './pages/Me';
import ComingSoon from './pages/ComingSoon';

const auth = (el) => <RequireAuth>{el}</RequireAuth>;

export default function App() {
  return (
    <SettingsProvider>
      <VoiceProvider>
        <UIProvider>
          <BrowserRouter>
            <Routes>
              {/* A */}
              <Route path="/" element={<Splash />} />
              <Route path="/login" element={<Login />} />
              <Route path="/signup" element={<Signup />} />
              <Route path="/home" element={auth(<Home />)} />
              <Route path="/me" element={auth(<Me />)} />

              {/* B: 촬영 → 로딩·도장 */}
              <Route path="/camera" element={auth(<ComingSoon title="문서 촬영" owner="B" />)} />
              <Route path="/loading/:docId" element={auth(<ComingSoon title="읽는 중" owner="B" />)} />

              {/* C: 결과 */}
              <Route path="/result/:docId" element={auth(<ComingSoon title="분석 결과" owner="C" />)} />

              {/* D: 보관함 · 상세 */}
              <Route path="/archive" element={auth(<ComingSoon title="보관함" owner="D" />)} />
              <Route path="/detail/:docId/:type" element={auth(<ComingSoon title="자세히 보기" owner="D" />)} />

              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
            <CaptionBar />
          </BrowserRouter>
        </UIProvider>
      </VoiceProvider>
    </SettingsProvider>
  );
}
