/* D 담당 — 결과·상세 화면이 같이 쓰는 상태 표시
   - DocLoading: 불러오는 중 / 지금 쓰는 말로 바꾸는 중
   - DocError:   분석 중(409) / 문서 없음
   - FallbackNotice: 번역 실패 → "한국어 원문" 표시 + 다시 번역하기 */
import { useNavigate } from 'react-router-dom';
import { useT } from '../common/i18n';

export function DocLoading({ translating }) {
  const t = useT();
  return (
    <div className="app">
      <div className="body" style={{ paddingTop: 40, textAlign: 'center', color: 'var(--ink2)' }} aria-live="polite">
        {translating ? t('d.translating') : t('common.loading')}
      </div>
    </div>
  );
}

export function DocError({ error }) {
  const t = useT();
  const navigate = useNavigate();
  return (
    <div className="app">
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
