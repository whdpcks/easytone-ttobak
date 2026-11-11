/* 다른 담당 화면이 main에 합쳐지기 전까지 자리를 지키는 화면.
   B·C·D 화면이 들어오면 App.jsx에서 이 줄만 바꾸면 됩니다. */
import { useNavigate } from 'react-router-dom';
import Header from '../common/Header';
import useVoice from '../hooks/useVoice';

export default function ComingSoon({ title, owner }) {
  const navigate = useNavigate();
  const voice = `${title} 화면은 준비 중이에요.`;
  useVoice(voice);
  return (
    <div className="app">
      <Header left="back" title={title} voiceText={voice} />
      <main className="body todo">
        <h1 className="h">{title}</h1>
        <p className="sub">{owner} 담당 화면이 합쳐지면 여기에 나와요.</p>
        <button className="btn line" onClick={() => navigate('/home')}>홈으로</button>
      </main>
    </div>
  );
}
