/* 내 정보 (A) — 사용할 말, 글씨 크기, 목소리 빠르기, 가족과 함께 보기, 촬영 안내 다시 보기, 로그아웃 */
import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ChoiceSheet from '../common/ChoiceSheet';
import Header from '../common/Header';
import Sheet from '../common/Sheet';
import { formatPhone, isPhone } from '../common/PhoneVerify';
import { LANGS, RATES, SCALES, labelOf, useSettings } from '../common/SettingsContext';
import { useUI } from '../common/UIContext';
import { useVoiceContext } from '../common/VoiceContext';
import { errorText, useT } from '../common/i18n';
import { STORAGE, writeStorage } from '../common/storageKeys';
import useVoice from '../hooks/useVoice';
import Icon from '../utils/icons';
import { addFamily, getFamily, logout, removeFamily } from '../api/auth';

const RELATIONS = ['딸', '아들', '배우자', '손주', '며느리', '사위', '형제자매', '보호자', '기타'];

function FamilySheet({ family, onChanged, onClose }) {
  const { toast, confirm } = useUI();
  const t = useT();
  const [adding, setAdding] = useState(family.length === 0);
  const [relation, setRelation] = useState('딸');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const who = (m) => t('fam.who', { relation: t(`rel.${m.relation}`), name: m.name });

  const save = async (e) => {
    e.preventDefault();
    if (!name.trim()) { setError(t('err.name')); return; }
    if (!isPhone(phone)) { setError(t('err.phone')); return; }
    setBusy(true);
    try {
      await addFamily({ relation, name: name.trim(), phone });
      toast(t('fam.added', { who: who({ relation, name: name.trim() }) }));
      setName(''); setPhone(''); setAdding(false); setError('');
      onChanged();
    } catch (err) {
      setError(errorText(t, err));
    } finally {
      setBusy(false);
    }
  };

  const remove = async (m) => {
    const ok = await confirm({
      title: t('fam.removeQ', { who: who(m) }), okText: t('fam.remove'), cancelText: t('fam.keep'), danger: true,
    });
    if (!ok) return;
    await removeFamily(m.id).catch(() => {});
    onChanged();
  };

  return (
    <Sheet label={t('fam.title')} onDismiss={onClose}>
      <h2>{t('fam.title')}</h2>
      <p className="sub">{t('fam.sub')}</p>

      {family.length > 0 && (
        <ul className="fam">
          {family.map(m => (
            <li key={m.id}>
              <span className="fam-av" aria-hidden="true">{m.name[0]}</span>
              <span className="fam-tx"><b>{who(m)}</b><small>{formatPhone(m.phone)}</small></span>
              <button type="button" className="chip" onClick={() => remove(m)}>{t('fam.remove')}</button>
            </li>
          ))}
        </ul>
      )}

      {adding ? (
        <form className="fam-form" onSubmit={save}>
          <div className="field">
            <label htmlFor="rel">{t('fam.relation')}</label>
            <select id="rel" value={relation} onChange={(e) => setRelation(e.target.value)}>
              {RELATIONS.map(r => <option key={r} value={r}>{t(`rel.${r}`)}</option>)}
            </select>
          </div>
          <div className="field">
            <label htmlFor="fname">{t('fam.name')}</label>
            <input id="fname" value={name} maxLength={30} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="fphone">{t('fam.phone')}</label>
            <input id="fphone" inputMode="tel" placeholder="010-0000-0000" value={phone}
              onChange={(e) => setPhone(formatPhone(e.target.value))} />
          </div>
          {error && <p className="err" role="alert">{error}</p>}
          <button className="btn primary" type="submit" disabled={busy}>{busy ? t('fam.adding') : t('fam.add')}</button>
        </form>
      ) : (
        family.length < 5 && <button className="btn line" onClick={() => setAdding(true)}>{t('fam.more')}</button>
      )}
      <button className="btn ghost" onClick={onClose}>{t('common.close')}</button>
    </Sheet>
  );
}

export default function Me() {
  const navigate = useNavigate();
  const { user, setUser, lang, setLang, scale, rate, setRate } = useSettings();
  const { toast, confirm, openFontSheet } = useUI();
  const { speak, stop } = useVoiceContext();
  const t = useT();
  const voiceText = t('me.voice');
  useVoice(voiceText);
  const [open, setOpen] = useState(null); // 'lang' | 'rate' | 'family'
  const [family, setFamily] = useState([]);

  const loadFamily = useCallback(() => {
    getFamily().then(setFamily).catch(() => {});
  }, []);
  useEffect(() => { loadFamily(); }, [loadFamily]);

  const pickRate = (o) => {
    setRate(o.value);
    setTimeout(() => speak(t('rate.sample', { x: t(`rate.${o.value}`) })), 0);
  };
  const replayIntro = () => {
    writeStorage(STORAGE.cameraIntroSeen, null);
    toast(t('me.introToast'));
  };
  const doLogout = async () => {
    const ok = await confirm({ title: t('me.logoutQ'), okText: t('me.logout'), cancelText: t('me.stay') });
    if (!ok) return;
    stop();
    await logout();
    setUser(null);
    navigate('/', { replace: true });
  };

  const who = (m) => t('fam.who', { relation: t(`rel.${m.relation}`), name: m.name });
  const famLabel = family.length === 0
    ? t('me.familyAdd')
    : family.length === 1 ? who(family[0]) : t('me.familyMore', { who: who(family[0]), n: family.length - 1 });

  return (
    <div className="app">
      <Header left="back" title={t('me.title')} voiceText={voiceText} />
      <main className="body">
        <div className="prof">
          <div className="avatar" aria-hidden="true">{user?.name?.[0] ?? ''}</div>
          <div className="prof-tx">
            <b>{user?.name ?? ''}</b>
            <span className="sub">{user?.phone ? formatPhone(user.phone) : ''}</span>
          </div>
        </div>

        <div className="card set">
          <button onClick={() => setOpen('lang')}>
            <b>{t('me.lang')}</b><span lang={lang}>{labelOf(LANGS, lang)}<Icon name="chev" /></span>
          </button>
          <button onClick={openFontSheet}>
            <b>{t('me.font')}</b><span>{t(`font.${scale}`)}<Icon name="chev" /></span>
          </button>
          <button onClick={() => setOpen('rate')}>
            <b>{t('me.rate')}</b><span>{t(`rate.${rate}`)}<Icon name="chev" /></span>
          </button>
          <button onClick={() => setOpen('family')}>
            <b>{t('me.family')}</b><span>{famLabel}<Icon name="chev" /></span>
          </button>
          <button onClick={replayIntro}>
            <b>{t('me.intro')}</b><span><Icon name="chev" /></span>
          </button>
        </div>

        <button className="btn line" onClick={doLogout}>{t('me.logout')}</button>
      </main>

      {open === 'lang' && (
        <ChoiceSheet title={`${t('me.lang')} · Language`} options={LANGS} value={lang}
          onPick={(o) => setLang(o.value)} sub={(o) => o.ko} onClose={() => setOpen(null)} />
      )}
      {open === 'rate' && (
        <ChoiceSheet title={t('me.rate')} options={RATES} value={rate} label={(o) => t(`rate.${o.value}`)}
          onPick={pickRate} onClose={() => setOpen(null)} />
      )}
      {open === 'family' && (
        <FamilySheet family={family} onChanged={loadFamily} onClose={() => setOpen(null)} />
      )}
    </div>
  );
}
