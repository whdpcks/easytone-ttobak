import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Icon from '../utils/icons';
import useVoice from '../hooks/useVoice';
import Header from '../common/Header';
import { CAT_CONFIG } from '../utils/catConfig';
import { getDocument } from '../api/documents';
import { formatDay, formatTime } from '../utils/datetime';

/* ───────────────────────────────────────────
   분석 결과 화면 (SCR-08) — 보관함 [보기]에서 진입
   URL: /result/:docId → 타일을 누르면 /detail/:docId/:type
─────────────────────────────────────────── */
export default function Result() {
  const { docId } = useParams();
  const navigate = useNavigate();

  const [doc, setDoc] = useState(null);
  const [loadError, setLoadError] = useState(null);

  useEffect(() => {
    setDoc(null);
    setLoadError(null);
    getDocument(docId)
      .then(setDoc)
      .catch(e => setLoadError(e.status === 409
        ? '아직 종이를 읽고 있어요. 잠시 뒤에 다시 열어주세요.'
        : '이 문서를 찾지 못했어요.'));
  }, [docId]);

  const intro = doc && `${doc.title}이에요. ${doc.summary[0]} 보고 싶은 내용을 눌러주세요.`;

  useVoice(intro);

  function goBack() { navigate(-1); }

  if (loadError) {
    return (
      <div className="app">
        <div className="body" style={{ paddingTop: 40, textAlign: 'center' }}>
          <p className="sub">{loadError}</p>
          <button className="btn line" onClick={goBack}>뒤로 가기</button>
        </div>
      </div>
    );
  }

  if (!doc) return <div className="app"><div className="body" style={{ paddingTop: 40, textAlign: 'center', color: 'var(--ink2)' }}>불러오는 중…</div></div>;

  const cfg = CAT_CONFIG[doc.category] ?? CAT_CONFIG['기타'];

  return (
    <div className="app">
      <Header left="back" voiceText={intro} />

      <div className="body">
        <div>
          <p className="sub">{[doc.sender, doc.created_at.replace(/-/g, '.')].filter(Boolean).join(' · ')}</p>
          <h1 className="h">{doc.title}</h1>
          <span className="cat-pill" style={{ '--c': cfg.c, '--c-soft': cfg.s }}>
            <Icon name={cfg.icon} size={16} />{doc.category}
          </span>
        </div>

        <p className="sub" style={{ fontWeight: 700, color: 'var(--ink)' }}>보고 싶은 내용을 눌러주세요</p>

        <div className="tiles">
          {buildTiles(doc, cfg).map(t => (
            <button
              key={t.key}
              className={`tile${t.wide ? ' wide' : ''}`}
              style={{ '--t': t.c, '--t-soft': t.s }}
              onClick={() => navigate(`/detail/${doc.id}/${t.key}`)}
              aria-label={`${t.title} 자세히 보기`}
            >
              <span className="ti"><Icon name={t.icon} /></span>
              <div>
                <b>{t.title}</b>
                {t.sub && <><br /><small>{t.sub}</small></>}
                {t.warn && <><br /><small style={{ color: 'var(--red)', fontWeight: 700 }}>{t.warn}</small></>}
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

function buildTiles(doc, cfg) {
  const dt = doc.datetime;
  const pl = doc.place;
  const ct = doc.contact;
  return [
    { key: 'summary', icon: 'lines', c: '#161B2E', s: '#FFF3A6', title: '문서 요약', sub: doc.summary[0], wide: true, show: true },
    { key: 'datetime', icon: 'cal', c: '#D62839', s: '#FCE6E8', title: '날짜·시간',
      sub: dt?.date ? formatDay(dt.date) : formatTime(dt?.time) || dt?.label,
      warn: dt?.check && '종이를 확인해주세요', show: hasValue(dt) },
    { key: 'place', icon: 'pin', c: '#0E7C66', s: '#DDF3EC', title: '장소',
      sub: pl?.name?.split(' ')[0] || pl?.address || pl?.note, show: hasValue(pl) },
    { key: 'items', icon: 'bag', c: '#B4520A', s: '#FCEBDD', title: '준비물',
      sub: `${doc.items?.length}가지`, show: hasValue(doc.items) },
    { key: 'cautions', icon: 'alert', c: '#D62839', s: '#FCE6E8', title: '주의할 점',
      sub: `${doc.cautions?.length}가지`, show: hasValue(doc.cautions) },
    { key: 'contact', icon: 'phone', c: '#1F4FB8', s: '#E1E9FA', title: '연락처',
      sub: ct?.phone || ct?.name, show: hasValue(ct) },
    { key: 'category', icon: 'tag', c: cfg.c, s: cfg.s, title: '카테고리', sub: doc.category, show: true },
  ].filter(t => t.show);
}
