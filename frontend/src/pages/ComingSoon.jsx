/* 다른 담당 화면이 main에 합쳐지기 전까지 자리를 지키는 화면.
   B·C·D 화면이 들어오면 App.jsx에서 이 줄만 바꾸면 됩니다. */
import { useNavigate } from 'react-router-dom';
import Header from '../common/Header';
import { useT } from '../common/i18n';
import useVoice from '../hooks/useVoice';

export default function ComingSoon({ screen, owner }) {
  const navigate = useNavigate();
  const t = useT();
  const title = t(`soon.${screen}`);
  const voice = t('soon.voice', { title });
  useVoice(voice);
  return (
    <div className="app">
      <Header left="back" title={title} voiceText={voice} />
      <main className="body todo">
        <h1 className="h">{title}</h1>
        <p className="sub">{t('soon.sub', { owner })}</p>
        <button className="btn line" onClick={() => navigate('/home')}>{t('soon.home')}</button>
      </main>
    </div>
  );
}
