/* 시작 화면 (A) — 언어 선택, 시작하기(여기서 소리가 풀림) */
import { useNavigate } from 'react-router-dom';
import Header from '../common/Header';
import { LANGS, useSettings } from '../common/SettingsContext';
import { useUI } from '../common/UIContext';
import { useVoiceContext } from '../common/VoiceContext';
import useVoice from '../hooks/useVoice';
import { getToken } from '../api/client';

const VOICE = '안녕하세요. 또박입니다. 어려운 종이, 또박또박 읽어드릴게요. 시작하기를 눌러주세요.';

export default function Splash() {
  const navigate = useNavigate();
  const { lang, setLang } = useSettings();
  const { unlock } = useVoiceContext();
  const { toast } = useUI();
  useVoice(VOICE);

  const chooseLang = (v) => {
    setLang(v);
    if (v !== 'ko') toast('지금은 한국어로 안내해요. 결과를 고른 말로 보여주는 기능은 준비 중이에요.');
  };

  const start = () => {
    unlock();
    navigate(getToken() ? '/home' : '/login');
  };

  return (
    <div className="app">
      <Header left="none" voiceText={VOICE} />
      <main className="body" style={{ justifyContent: 'center', textAlign: 'center', gap: 22 }}>
        <div style={{ isolation: 'isolate', paddingTop: 30 }}>
          <span className="logo">또박</span>
        </div>
        <p style={{ fontSize: '1.25em', fontWeight: 700, margin: 0 }}>
          어려운 종이,<br />또박또박 읽어드려요
        </p>
        <div>
          <p className="sub" style={{ marginBottom: 8 }}>사용할 말을 고르세요</p>
          <div className="chips">
            {LANGS.map(l => (
              <button key={l.value} className="chip" aria-pressed={lang === l.value} onClick={() => chooseLang(l.value)}>
                {l.label}
              </button>
            ))}
          </div>
        </div>
        <button className="btn red" onClick={start}>시작하기</button>
      </main>
    </div>
  );
}
