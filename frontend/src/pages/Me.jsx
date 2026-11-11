/* 내 정보 (A) — 사용할 말, 글씨 크기, 목소리 빠르기, 가족과 함께 보기, 촬영 안내 다시 보기, 로그아웃 */
import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../common/Header';
import Sheet from '../common/Sheet';
import { formatPhone, isPhone } from '../common/PhoneVerify';
import { LANGS, RATES, SCALES, labelOf, useSettings } from '../common/SettingsContext';
import { useUI } from '../common/UIContext';
import { useVoiceContext } from '../common/VoiceContext';
import { STORAGE, writeStorage } from '../common/storageKeys';
import useVoice from '../hooks/useVoice';
import Icon from '../utils/icons';
import { addFamily, getFamily, logout, removeFamily } from '../api/auth';

const VOICE = '내 정보 화면이에요. 사용할 말, 글씨 크기, 목소리 빠르기, 함께 볼 가족을 바꿀 수 있어요.';
const RELATIONS = ['딸', '아들', '배우자', '손주', '며느리', '사위', '형제자매', '보호자', '기타'];

function ChoiceSheet({ title, options, value, onPick, onClose, sub }) {
  return (
    <Sheet label={title} onDismiss={onClose}>
      <h2>{title}</h2>
      <div className={`sizes${options.length > 4 ? ' scroll' : ''}`}>
        {options.map(o => (
          <button key={o.value} aria-pressed={value === o.value} onClick={() => onPick(o)}>
            <b lang={o.value}>{o.label}</b>
            {sub && <small className="sub">{sub(o)}</small>}
            {value === o.value && <Icon name="check" className="ck" />}
          </button>
        ))}
      </div>
      <button className="btn primary" onClick={onClose}>다 됐어요</button>
    </Sheet>
  );
}

function FamilySheet({ family, onChanged, onClose }) {
  const { toast, confirm } = useUI();
  const [adding, setAdding] = useState(family.length === 0);
  const [relation, setRelation] = useState('딸');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const save = async (e) => {
    e.preventDefault();
    if (!name.trim()) { setError('이름을 넣어 주세요.'); return; }
    if (!isPhone(phone)) { setError('전화번호를 다시 확인해 주세요.'); return; }
    setBusy(true);
    try {
      await addFamily({ relation, name: name.trim(), phone });
      toast(`${relation} ${name.trim()} 님을 넣었어요.`);
      setName(''); setPhone(''); setAdding(false); setError('');
      onChanged();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const remove = async (m) => {
    const ok = await confirm({ title: `${m.relation} ${m.name} 님을 뺄까요?`, okText: '빼기', cancelText: '그대로 두기', danger: true });
    if (!ok) return;
    await removeFamily(m.id).catch(() => {});
    onChanged();
  };

  return (
    <Sheet label="가족과 함께 보기" onDismiss={onClose}>
      <h2>가족과 함께 보기</h2>
      <p className="sub">찍은 종이를 가족도 함께 볼 수 있어요.</p>

      {family.length > 0 && (
        <ul className="fam">
          {family.map(m => (
            <li key={m.id}>
              <span className="fam-av" aria-hidden="true">{m.name[0]}</span>
              <span className="fam-tx"><b>{m.relation} {m.name}</b><small>{formatPhone(m.phone)}</small></span>
              <button type="button" className="chip" onClick={() => remove(m)}>빼기</button>
            </li>
          ))}
        </ul>
      )}

      {adding ? (
        <form className="fam-form" onSubmit={save}>
          <div className="field">
            <label htmlFor="rel">관계</label>
            <select id="rel" value={relation} onChange={(e) => setRelation(e.target.value)}>
              {RELATIONS.map(r => <option key={r}>{r}</option>)}
            </select>
          </div>
          <div className="field">
            <label htmlFor="fname">이름</label>
            <input id="fname" value={name} maxLength={30} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="fphone">전화번호</label>
            <input id="fphone" inputMode="tel" placeholder="010-0000-0000" value={phone}
              onChange={(e) => setPhone(formatPhone(e.target.value))} />
          </div>
          {error && <p className="err" role="alert">{error}</p>}
          <button className="btn primary" type="submit" disabled={busy}>{busy ? '넣는 중…' : '가족 넣기'}</button>
        </form>
      ) : (
        family.length < 5 && <button className="btn line" onClick={() => setAdding(true)}>+ 가족 더 넣기</button>
      )}
      <button className="btn ghost" onClick={onClose}>닫기</button>
    </Sheet>
  );
}

export default function Me() {
  const navigate = useNavigate();
  const { user, setUser, lang, setLang, scale, rate, setRate } = useSettings();
  const { toast, confirm, openFontSheet } = useUI();
  const { speak, stop } = useVoiceContext();
  useVoice(VOICE);
  const [open, setOpen] = useState(null); // 'lang' | 'rate' | 'family'
  const [family, setFamily] = useState([]);

  const loadFamily = useCallback(() => {
    getFamily().then(setFamily).catch(() => {});
  }, []);
  useEffect(() => { loadFamily(); }, [loadFamily]);

  const pickRate = (o) => {
    setRate(o.value);
    setTimeout(() => speak(`목소리 빠르기를 ${o.label}로 바꿨어요.`), 0);
  };
  const pickLang = (o) => {
    setLang(o.value);
    speak(o.value === 'ko' ? '한국어로 바꿨어요.' : `${o.ko}를 골랐어요. 안내는 지금 한국어로 나와요.`);
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

  const famLabel = family.length === 0
    ? '넣기'
    : family.length === 1 ? `${family[0].relation} ${family[0].name}` : `${family[0].relation} ${family[0].name} 외 ${family.length - 1}명`;

  return (
    <div className="app">
      <Header left="back" title="내 정보" voiceText={VOICE} />
      <main className="body">
        <div className="prof">
          <div className="avatar" aria-hidden="true">{user?.name?.[0] ?? '나'}</div>
          <div className="prof-tx">
            <b>{user?.name ?? ''}</b>
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
          <button onClick={() => setOpen('family')}>
            <b>가족과 함께 보기</b><span>{famLabel}<Icon name="chev" /></span>
          </button>
          <button onClick={replayIntro}>
            <b>촬영 안내 다시 보기</b><span><Icon name="chev" /></span>
          </button>
        </div>

        <button className="btn line" onClick={doLogout}>로그아웃</button>
      </main>

      {open === 'lang' && (
        <ChoiceSheet title="사용할 말" options={LANGS} value={lang} onPick={pickLang}
          sub={(o) => o.ko} onClose={() => setOpen(null)} />
      )}
      {open === 'rate' && (
        <ChoiceSheet title="목소리 빠르기" options={RATES} value={rate} onPick={pickRate} onClose={() => setOpen(null)} />
      )}
      {open === 'family' && (
        <FamilySheet family={family} onChanged={loadFamily} onClose={() => setOpen(null)} />
      )}
    </div>
  );
}
