import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Archive from './pages/Archive';
import Detail  from './pages/Detail';

/*
  라우팅 — A/B/C 담당 화면은 나중에 추가
  D 담당: /archive, /detail/:docId/:type
*/
export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* D 담당 화면 */}
        <Route path="/archive"               element={<Archive />} />
        <Route path="/detail/:docId/:type"   element={<Detail />}  />

        {/* 임시 — 팀 통합 후 A/B/C 화면으로 교체 */}
        <Route path="*" element={<Navigate to="/archive" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
