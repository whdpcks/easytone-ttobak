/* 홈 (A) — 문서 촬영 / 보관함 큰 버튼 두 개 */
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Header, { HeaderButton } from '../common/Header';
import { useSettings } from '../common/SettingsContext';
import useVoice from '../hooks/useVoice';
import Icon from '../utils/icons';
import { api } from '../api/client';
import { useT } from '../common/i18n';

export default function Home() {
  const navigate = useNavigate();
  const { user } = useSettings();
  const [count, setCount] = useState(null);
  const t = useT();

  // 보관함 개수 (D의 GET /documents). 아직 없으면 개수 없이 보여줌
  useEffect(() => {
    const ctrl = new AbortController();
    api.get('/documents', { signal: ctrl.signal })
      .then(list => Array.isArray(list) && setCount(list.length))
      .catch(() => {});
    return () => ctrl.abort();
  }, []);

  const name = user?.name || '';
  const voiceText = t('home.voice', { name: name ? t('home.voiceName', { name }) : '' });
  useVoice(voiceText);

  return (
    <div className="app">
      <Header
        left="none"
        voiceText={voiceText}
        right={<HeaderButton icon="user" label={t('hdr.me')} onClick={() => navigate('/me')} />}
      />
      <main className="body">
        <h1 className="h">{name && <>{t('home.hello', { name })}<br /></>}{t('home.h')}</h1>

        <button className="big cam" onClick={() => navigate('/camera')}>
          <span className="ic"><Icon name="camera" /></span>
          <div><b>{t('home.cam')}</b><br /><span className="d">{t('home.camD')}</span></div>
          <span className="arrow"><Icon name="chev" /></span>
        </button>

        <button className="big box" onClick={() => navigate('/upload')}>
          <span className="ic"><Icon name="upload" /></span>
          <div><b>파일 업로드</b><br /><span className="d">문서 사진과 PDF를 읽어드려요</span></div>
          <span className="arrow"><Icon name="chev" /></span>
        </button>

        <button className="big box" onClick={() => navigate('/archive')}>
          <span className="ic"><Icon name="box" /></span>
          <div>
            <b>{t('home.box')}</b><br />
            <span className="d">{count === null ? t('home.boxD') : t('home.boxN', { n: count })}</span>
          </div>
          <span className="arrow"><Icon name="chev" /></span>
        </button>
      </main>
    </div>
  );
}
