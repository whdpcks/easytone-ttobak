/* 내 정보 (A) — 사용할 말, 글씨 크기, 목소리 빠르기, 촬영 안내 다시 보기, 로그아웃 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../common/Header';
import Sheet from '../common/Sheet';
import { LANGS, RATES, SCALES, labelOf, useSettings } from '../common/SettingsContext';
import { useUI } from '../common/UIContext';
import { useVoiceContext } from '../common/VoiceContext';
import { STORAGE, writeStorage } from '../common/storageKeys';
import useVoice from '../hooks/useVoice';
import Icon from '../utils/icons';
import { logout } from '../api/auth';
import { formatPhone } from './Login';

const VOICE = '내 정보 화면이에요. 사용할 말, 글씨 크기, 목소리 빠르기를 바꿀 수 있어요.';

function ChoiceSheet({ title, options, value, onPick, onClose }) {
  return (
    <Sheet label={title} onDismiss={onClose}>
      <h2>{title}</h2>
      <div className="sizes">
        {options.map(o => (
          <button key={o.value} aria-pressed={value === o.value} onClick={() => onPick(o)}>
            <b>{o.label}</b>
            {value === o.value && <Icon name="check" className="ck" />}
          </button>
        ))}
      </div>
      <button className="btn primary" onClick={onClose}>다 됐어요</button>
    </Sheet>
  );
}

export default function Me() {
  const navigate = useNavigate();
  const { user, setUser, lang, setLang, scale, rate, setRate } = useSettings();
  const { toast, confirm, openFontSheet } = useUI();
  const { speak, stop } = useVoiceContext();
  useVoice(VOICE);
  const [open, setOpen] = useState(null); // 'lang' | 'rate'

  const pickRate = (o) => {
    setRate(o.value);
    // 바꾼 빠르기로 바로 들려주기 (rate는 다음 렌더에 반영되므로 살짝 늦게)
    setTimeout(() => speak(`목소리 빠르기를 ${o.label}로 바꿨어요.`), 0);
  };

  const pickLang = (o) => {
    setLang(o.value);
    speak(o.value === 'ko' ? '한국어로 바꿨어요.' : '지금은 한국어로 안내해요. 다른 말은 준비 중이에요.');
  };

  const replayIntro = () => {
    writeStorage(STORAGE.cameraIntroSeen, null);
    toast('다음에 문서 촬영을 누르면 안내를 다시 보여드려요.');
  };

  const doLogout = async () => {
    const ok = await confirm({ title: '로그아웃할까요?', okText: '로그아웃', cancelText: '그대로 있기' });
    if (!ok) return;
    stop();
    await logout();
    setUser(null);
    navigate('/', { replace: true });
  };

  const first = user?.name?.[0] ?? '나';

  return (
    <div className="app">
      <Header left="back" title="내 정보" voiceText={VOICE} />
      <main className="body">
        <div className="prof">
          <div className="avatar" aria-hidden="true">{first}</div>
          <div>
            <b style={{ fontSize: '1.3em' }}>{user?.name ?? ''}</b><br />
            <span className="sub">{user?.phone ? formatPhone(user.phone) : ''}</span>
          </div>
        </div>

        <div className="card set">
          <button onClick={() => setOpen('lang')}>
            <b>사용할 말</b><span>{labelOf(LANGS, lang)}<Icon name="chev" /></span>
          </button>
          <button onClick={openFontSheet}>
            <b>글씨 크기</b><span>{labelOf(SCALES, scale)}<Icon name="chev" /></span>
          </button>
          <button onClick={() => setOpen('rate')}>
            <b>목소리 빠르기</b><span>{labelOf(RATES, rate)}<Icon name="chev" /></span>
          </button>
          <button onClick={replayIntro}>
            <b>촬영 안내 다시 보기</b><span><Icon name="chev" /></span>
          </button>
        </div>

        <button className="btn line" onClick={doLogout}>로그아웃</button>
      </main>

      {open === 'lang' && (
        <ChoiceSheet title="사용할 말" options={LANGS} value={lang} onPick={pickLang} onClose={() => setOpen(null)} />
      )}
      {open === 'rate' && (
        <ChoiceSheet title="목소리 빠르기" options={RATES} value={rate} onPick={pickRate} onClose={() => setOpen(null)} />
      )}
    </div>
  );
}
