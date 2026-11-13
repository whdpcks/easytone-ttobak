/* D 담당 — 결과·상세 화면이 같이 쓰는 상태 표시
   - DocLoading: 문서를 받는 동안 (글자 없이 상단 줄만)
   - DocError:   분석 중(409) / 문서 없음
   - FallbackNotice: 번역 실패 → "한국어 원문" 표시 + 다시 번역하기
   - DocHeader: 결과·상세 화면 상단 (뒤로 · 글씨 · 소리 · 내정보) — 불러오는 중에도 그대로 */
import { useNavigate } from 'react-router-dom';
import { useT } from '../common/i18n';
import Header, { HeaderButton } from '../common/Header';

export function DocHeader({ voiceText }) {
  const t = useT();
  const navigate = useNavigate();
  return (
    <Header left="back" voiceText={voiceText}
      right={<HeaderButton icon="user" label={t('hdr.me')} onClick={() => navigate('/me')} />} />
  );
}

/* 문서를 받는 동안 — 글자 없이 상단 줄만 (빈 본문). 받는 즉시 화면이 채워짐 */
export function DocLoading() {
  return (
    <div className="app">
      <DocHeader />
      <div className="body" aria-busy="true" />
    </div>
  );
}

export function DocError({ error }) {
  const t = useT();
  const navigate = useNavigate();
  return (
    <div className="app">
      <DocHeader />
      <div className="body" style={{ paddingTop: 40, textAlign: 'center' }}>
        <p className="sub">{error === 'reading' ? t('d.reading') : t('d.notFound')}</p>
        <button className="btn line" onClick={() => navigate(-1)}>{t('d.goBack')}</button>
      </div>
    </div>
  );
}

export function FallbackNotice({ onRetry }) {
  const t = useT();
  return (
    <div className="card" role="status" style={{ background: 'var(--red-soft)', borderColor: 'var(--red)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
      <p style={{ margin: 0, fontWeight: 700 }}>{t('d.fallback')}</p>
      <button className="btn line" style={{ width: 'auto', minHeight: 44, padding: '0 14px', flex: 'none' }} onClick={onRetry}>
        {t('d.retry')}
      </button>
    </div>
  );
}
