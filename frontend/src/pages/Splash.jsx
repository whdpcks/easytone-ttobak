/* 시작 화면 (A) — 여러 나라 인사 + "찍으면 → 쉬운 말로 → 읽어드려요" 3단계 소개 */
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../common/Header';
import { LANGS } from '../common/SettingsContext';
import { useVoiceContext } from '../common/VoiceContext';
import useVoice from '../hooks/useVoice';
import Icon from '../utils/icons';
import { getToken } from '../api/client';

const VOICE = '안녕하세요. 또박입니다. 종이를 찍으면, 중요한 것만 쉬운 말로 바꿔서 읽어드려요. 처음이면 시작하기를 눌러주세요.';

const HOW = [
  { icon: 'camera', title: '종이를 찍으면', desc: '안내문, 고지서, 계약서 무엇이든' },
  { icon: 'mark', title: '중요한 것만 쉬운 말로', desc: '날짜, 준비물, 주의할 점을 골라서' },
  { icon: 'speaker', title: '소리 내어 읽어드려요', desc: '글씨도 크게, 몇 번이든 다시' },
];

export default function Splash() {
  const navigate = useNavigate();
  const { unlock } = useVoiceContext();
  const [hello, setHello] = useState(0);
  const [active, setActive] = useState(0);
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
        <p className="tagline">어려운 종이,<br />또박또박 읽어드려요</p>

        <ol className="how">
          {HOW.map((h, i) => (
            <li key={h.title} className={i === active ? 'on' : ''}>
              <span className="how-ic">
                {h.icon === 'mark'
                  ? <span className="mark-ic" aria-hidden="true">가</span>
                  : <Icon name={h.icon} />}
              </span>
              <span className="how-tx"><b>{h.title}</b><small>{h.desc}</small></span>
            </li>
          ))}
        </ol>

        <div className="grow" />
        <button className="btn red" onClick={() => go('/signup')}>시작하기</button>
        <button className="btn line" onClick={() => go('/login')}>이미 가입했어요 · 로그인</button>
      </main>
    </div>
  );
}
