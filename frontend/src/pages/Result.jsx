import { useNavigate, useParams } from 'react-router-dom';
import Icon from '../utils/icons';
import useVoice from '../hooks/useVoice';
import Header from '../common/Header';
import { useSettings } from '../common/SettingsContext';
import { useT } from '../common/i18n';
import { CAT_CONFIG } from '../utils/catConfig';
import { catLabel, docLang } from '../utils/archiveText';
import { useDocument } from '../hooks/useDocument';
import { formatDay, formatTime } from '../utils/datetime';
import { DocError, DocLoading, FallbackNotice } from './DocStatus';

/* ───────────────────────────────────────────
   분석 결과 화면 (SCR-08) — 보관함 [보기]에서 진입
   URL: /result/:docId → 타일을 누르면 /detail/:docId/:type
   사용할 말이 한국어가 아니면 C의 번역 API로 받은 문서를 보여줍니다.
─────────────────────────────────────────── */
export default function Result() {
  const { docId } = useParams();
  const navigate = useNavigate();
  const lang = docLang(useSettings().lang);  // D는 한·영·일·중만, 그 외는 영어
  const t = useT();
  const { doc, error, translating, fallback, retry } = useDocument(docId);

  const intro = doc && t('d.intro', { title: doc.title, s: doc.summary?.[0] ?? '' });
  useVoice(intro);

  if (error) return <DocError error={error} />;
  if (!doc) return <DocLoading translating={translating} />;

  const cfg = CAT_CONFIG[doc.category] ?? CAT_CONFIG['기타'];

  return (
    <div className="app">
      <Header left="back" voiceText={intro} />

      <div className="body">
        {fallback && <FallbackNotice onRetry={retry} />}
        <div>
          <p className="sub">{[doc.sender, doc.created_at.replace(/-/g, '.')].filter(Boolean).join(' · ')}</p>
          <h1 className="h">{doc.title}</h1>
          <span className="cat-pill" style={{ '--c': cfg.c, '--c-soft': cfg.s }}>
            <Icon name={cfg.icon} size={16} />{catLabel(t, doc.category)}
          </span>
        </div>

        <p className="sub" style={{ fontWeight: 700, color: 'var(--ink)' }}>{t('d.pick')}</p>

        <div className="tiles">
          {buildTiles(doc, cfg, t, lang).map(tile => (
            <button
              key={tile.key}
              className={`tile${tile.wide ? ' wide' : ''}`}
              style={{ '--t': tile.c, '--t-soft': tile.s }}
              onClick={() => navigate(`/detail/${doc.id}/${tile.key}`)}
              aria-label={t('d.moreAria', { x: tile.title })}
            >
              <span className="ti"><Icon name={tile.icon} /></span>
              <div>
                <b>{tile.title}</b>
                {tile.sub && <><br /><small>{tile.sub}</small></>}
                {tile.warn && <><br /><small style={{ color: 'var(--red)', fontWeight: 700 }}>{tile.warn}</small></>}
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/* C 규격: null(또는 내용이 모두 빈 값)인 항목은 타일을 숨깁니다. */
function hasValue(v) {
  if (v === null || v === undefined) return false;
  if (typeof v === 'string') return v.trim() !== '';
  if (Array.isArray(v)) return v.some(hasValue);
  return Object.entries(v).some(([k, part]) => k !== 'check' && hasValue(part));
}

function buildTiles(doc, cfg, t, lang) {
  const dt = doc.datetime;
  const pl = doc.place;
  const ct = doc.contact;
  return [
    { key: 'summary', icon: 'lines', c: '#161B2E', s: '#FFF3A6', title: t('d.t.summary'), sub: doc.summary?.[0], wide: true, show: true },
    { key: 'datetime', icon: 'cal', c: '#D62839', s: '#FCE6E8', title: t('d.t.datetime'),
      sub: dt?.date ? formatDay(dt.date, lang) : formatTime(dt?.time, lang) || dt?.label,
      warn: dt?.check && t('d.checkPaper'), show: hasValue(dt) },
    { key: 'place', icon: 'pin', c: '#0E7C66', s: '#DDF3EC', title: t('d.t.place'),
      sub: pl?.name?.split(' ')[0] || pl?.address || pl?.note, show: hasValue(pl) },
    { key: 'items', icon: 'bag', c: '#B4520A', s: '#FCEBDD', title: t('d.t.items'),
      sub: t('d.count', { n: doc.items?.length ?? 0 }), show: hasValue(doc.items) },
    { key: 'cautions', icon: 'alert', c: '#D62839', s: '#FCE6E8', title: t('d.t.cautions'),
      sub: t('d.count', { n: doc.cautions?.length ?? 0 }), show: hasValue(doc.cautions) },
    { key: 'contact', icon: 'phone', c: '#1F4FB8', s: '#E1E9FA', title: t('d.t.contact'),
      sub: ct?.phone || ct?.name, show: hasValue(ct) },
    { key: 'category', icon: 'tag', c: cfg.c, s: cfg.s, title: t('d.t.category'), sub: catLabel(t, doc.category), show: true },
  ].filter(tile => tile.show);
}
