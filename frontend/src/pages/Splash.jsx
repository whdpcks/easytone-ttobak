/* 시작 화면 (A) — 여러 나라 인사 + "찍으면 → 쉬운 말로 → 읽어드려요" 3단계 소개 */
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../common/Header';
import { LANGS } from '../common/SettingsContext';
import { useVoiceContext } from '../common/VoiceContext';
import useVoice from '../hooks/useVoice';
import Icon from '../utils/icons';
import { getToken } from '../api/client';
import { useT } from '../common/i18n';

const HOW = [
  { icon: 'camera', key: 'splash.how1' },
  { icon: 'mark', key: 'splash.how2' },
  { icon: 'speaker', key: 'splash.how3' },
];

export default function Splash() {
  const navigate = useNavigate();
  const { unlock } = useVoiceContext();
  const [hello, setHello] = useState(0);
  const [active, setActive] = useState(0);
  const t = useT();
  const VOICE = t('splash.voice');
  useVoice(VOICE);

  useEffect(() => {
    const t1 = setInterval(() => setHello(i => (i + 1) % LANGS.length), 1800);
    const t2 = setInterval(() => setActive(i => (i + 1) % HOW.length), 2200);
    return () => { clearInterval(t1); clearInterval(t2); };
  }, []);

  const go = (path) => { unlock(); navigate(getToken() ? '/home' : path); };

  return (
    <div className="app">
      <Header left="none" voiceText={VOICE} />
      <main className="body splash">
        <div className="hello" aria-hidden="true">
          <span key={hello} lang={LANGS[hello].value}>{LANGS[hello].hello}</span>
        </div>
        <div className="logo-wrap"><span className="logo">또박</span></div>
        <p className="tagline pre">{t('splash.tagline')}</p>

        <ol className="how">
          {HOW.map((h, i) => (
            <li key={h.key} className={i === active ? 'on' : ''}>
              <span className="how-ic">
                {h.icon === 'mark'
                  ? <span className="mark-ic" aria-hidden="true">가</span>
                  : <Icon name={h.icon} />}
              </span>
              <span className="how-tx"><b>{t(h.key)}</b><small>{t(`${h.key}d`)}</small></span>
            </li>
          ))}
        </ol>

        <div className="grow" />
        <button className="btn yellow" onClick={() => go('/signup')}>{t('splash.start')}</button>
        <button className="btn line" onClick={() => go('/login')}>{t('splash.login')}</button>
      </main>
    </div>
  );
}
