import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Icon from '../utils/icons';
import useVoice from '../hooks/useVoice';
import { CAT_CONFIG, CATEGORIES } from '../utils/catConfig';
import { getDocument, getDocuments } from '../api/documents';

/* ───────────────────────────────────────────
   상세 화면 (SCR-09) — 7종 타입
   URL: /detail/:docId/:type
   type = summary | datetime | place | items | cautions | contact | category
─────────────────────────────────────────── */
export default function Detail() {
  const { docId, type } = useParams();
  const navigate = useNavigate();
  const { speak } = useVoice();

  const [doc, setDoc] = useState(null);
  const [checked, setChecked] = useState({});

  useEffect(() => {
    getDocument(docId)
      .then(setDoc)
      .catch(e => console.error(e));
  }, [docId]);

  useEffect(() => {
    if (!doc) return;
    speak(voiceText(doc, type, checked));
  }, [doc, type]);

  if (!doc) return <div className="app"><div className="body" style={{ paddingTop: 40, textAlign: 'center', color: 'var(--ink2)' }}>불러오는 중…</div></div>;

  function goBack() { navigate(-1); }

  return (
    <div className="app">
      <div className="hdr">
        <button className="ib" onClick={goBack} aria-label="뒤로">
          <Icon name="back" /><span>뒤로</span>
        </button>
        <div className="ttl">{doc.title}</div>
        <button className="ib" onClick={() => speak(voiceText(doc, type, checked))} aria-label="다시 듣기">
          <Icon name="speaker" /><span>소리</span>
        </button>
      </div>

      <div className="body">
        {type === 'summary'  && <SummaryScreen   doc={doc} />}
        {type === 'datetime' && <DateTimeScreen  doc={doc} />}
        {type === 'place'    && <PlaceScreen     doc={doc} />}
        {type === 'items'    && <ItemsScreen     doc={doc} checked={checked} setChecked={setChecked} />}
        {type === 'cautions' && <CautionsScreen  doc={doc} />}
        {type === 'contact'  && <ContactScreen   doc={doc} />}
        {type === 'category' && <CategoryScreen  doc={doc} navigate={navigate} />}

        <button className="btn line" onClick={goBack}>다른 내용 보기</button>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════
   1. 요약
══════════════════════════════════════════= */
function SummaryScreen({ doc }) {
  return (
    <>
      <h1 className="h">한눈에 보기</h1>
      <div className="card">
        <ol className="sum-list">
          {doc.summary?.map((s, i) => (
            <li key={i}>
              <span className="num">{i + 1}</span>
              <span dangerouslySetInnerHTML={{ __html: s }} />
            </li>
          ))}
        </ol>
      </div>
    </>
  );
}

/* ═══════════════════════════════════════════
   2. 날짜·시간
══════════════════════════════════════════= */
function DateTimeScreen({ doc }) {
  const dt = doc.datetime;
  if (!dt) return <p className="sub">날짜 정보가 없어요.</p>;

  const dateObj = dt.date ? new Date(dt.date) : null;
  const today   = new Date();
  const dday    = dateObj ? Math.ceil((dateObj - today) / 86400000) : null;
  const month   = dateObj?.getMonth() + 1;
  const day     = dateObj?.getDate();
  const weekday = dateObj?.toLocaleDateString('ko-KR', { weekday: 'short' });

  return (
    <>
      <h1 className="h">{dt.label || '날짜·시간'}</h1>
      <div className="card">
        <div className="cal">
          <div className="day">
            <small>{month}월</small>
            <b>{day}</b>
            <span>{weekday}</span>
          </div>
          <div>
            <b style={{ fontSize: '1.35em', lineHeight: 1.3 }}>{dt.time || '하루 종일'}</b>
            <br />
            {dday !== null && (
              <span className="dday">
                {dday > 0 ? `${dday}일 남았어요` : dday === 0 ? '오늘이에요!' : '지났어요'}
              </span>
            )}
          </div>
        </div>
      </div>
      {dt.note && (
        <div className="card">
          <p style={{ margin: 0, fontSize: '1.08em' }}>{dt.note}</p>
        </div>
      )}
      {dt.check && (
        <div className="card" style={{ background: 'var(--red-soft)', borderColor: 'var(--red)' }}>
          <p style={{ margin: 0, fontWeight: 700 }}>종이를 한 번 더 확인해주세요</p>
        </div>
      )}
      <button className="btn red">
        <Icon name="cal" />알림 받기
      </button>
    </>
  );
}

/* ═══════════════════════════════════════════
   3. 장소
══════════════════════════════════════════= */
function PlaceScreen({ doc }) {
  const pl = doc.place;
  if (!pl) return <p className="sub">장소 정보가 없어요.</p>;

  return (
    <>
      <h1 className="h">{pl.name}</h1>
      <div className="card">
        <p style={{ margin: '0 0 6px', fontWeight: 700 }}>주소</p>
        <p style={{ margin: 0, fontSize: '1.1em', userSelect: 'all' }}>{pl.address}</p>
      </div>
      {pl.note && (
        <div className="card">
          <p style={{ margin: 0, fontSize: '1.08em' }}>{pl.note}</p>
        </div>
      )}
      <button
        className="btn primary"
        onClick={() => alert('지도 앱으로 길을 찾아요 (시연)')}
      >
        <Icon name="pin" />길 찾기
      </button>
    </>
  );
}

/* ═══════════════════════════════════════════
   4. 준비물 (체크리스트)
══════════════════════════════════════════= */
function ItemsScreen({ doc, checked, setChecked }) {
  const items = doc.items || [];
  const checkedCount = items.filter((_, i) => checked[`${doc.id}-${i}`]).length;

  function toggle(i) {
    setChecked(prev => ({ ...prev, [`${doc.id}-${i}`]: !prev[`${doc.id}-${i}`] }));
  }

  return (
    <>
      <h1 className="h">챙길 것 {items.length}가지</h1>
      <p className="sub">챙긴 것을 눌러 표시하세요. ({checkedCount}/{items.length})</p>
      <div className="check">
        {items.map((it, i) => (
          <button
            key={i}
            aria-pressed={!!checked[`${doc.id}-${i}`]}
            onClick={() => toggle(i)}
          >
            <span className="box">
              <Icon name="check" size={24} style={{ strokeWidth: 3 }} />
            </span>
            <span>
              <b>{it.name}</b>
              {it.detail && <small>{it.detail}</small>}
            </span>
          </button>
        ))}
      </div>
    </>
  );
}

/* ═══════════════════════════════════════════
   5. 주의할 점
══════════════════════════════════════════= */
function CautionsScreen({ doc }) {
  const cautions = doc.cautions || [];
  return (
    <>
      <h1 className="h">꼭 지켜주세요</h1>
      <ol className="warn">
        {cautions.map((c, i) => (
          <li key={i}>
            <span className="num" style={{ background: 'var(--red)' }}>{i + 1}</span>
            <span dangerouslySetInnerHTML={{ __html: c }} />
          </li>
        ))}
      </ol>
    </>
  );
}

/* ═══════════════════════════════════════════
   6. 연락처
══════════════════════════════════════════= */
function ContactScreen({ doc }) {
  const ct = doc.contact;
  if (!ct) return <p className="sub">연락처 정보가 없어요.</p>;

  return (
    <>
      <h1 className="h">궁금하면 전화하세요</h1>
      <div className="card">
        <p className="sub" style={{ margin: 0 }}>{ct.name}</p>
        <div className="tel">{ct.phone}</div>
      </div>
      <button
        className="btn primary"
        onClick={() => { window.location.href = `tel:${ct.phone.replace(/[^0-9]/g, '')}`; }}
      >
        <Icon name="phone" />전화 걸기
      </button>
    </>
  );
}

/* ═══════════════════════════════════════════
   7. 카테고리
══════════════════════════════════════════= */
function CategoryScreen({ doc, navigate }) {
  const [sameCategory, setSameCategory] = useState([]);
  const cfg = CAT_CONFIG[doc.category] ?? { c: '#4A5066', s: '#ECECE6', icon: 'doc' };

  useEffect(() => {
    getDocuments({ category: doc.category })
      .then(docs => setSameCategory(docs.filter(d => d.id !== doc.id)))
      .catch(console.error);
  }, [doc]);

  return (
    <>
      <h1 className="h">이 종이의 종류</h1>
      <div
        className="card"
        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}
      >
        <span
          className="cat-pill"
          style={{ '--c': cfg.c, '--c-soft': cfg.s }}
        >
          <Icon name={cfg.icon} size={16} />
          {doc.category}
        </span>
        <button
          className="btn line"
          style={{ width: 'auto', minHeight: 44, padding: '0 16px' }}
          onClick={() => alert('종류를 바꿀 수 있어요 (시연)')}
        >
          바꾸기
        </button>
      </div>

      <p style={{ fontWeight: 700, margin: '6px 0 0' }}>같은 종류 문서</p>
      <div className="list">
        {sameCategory.length === 0
          ? <p className="empty">아직 같은 종류 문서가 없어요.</p>
          : sameCategory.map(d => (
              <div
                key={d.id}
                className="row"
                style={{ '--c': cfg.c, '--c-soft': cfg.s }}
              >
                <span className="ri"><Icon name={cfg.icon} size={28} /></span>
                <div className="rt">
                  <b>{d.title}</b>
                  <small>{d.sender} · {d.created_at?.slice(0, 10).replace(/-/g, '.')}</small>
                </div>
                <button
                  className="open"
                  onClick={() => navigate(`/result/${d.id}`)}
                >
                  보기
                </button>
              </div>
            ))
        }
      </div>
    </>
  );
}

/* ───────────────────────────────────────────
   음성 텍스트 생성
─────────────────────────────────────────── */
function strip(s) { return (s || '').replace(/<[^>]+>/g, ''); }

function voiceText(doc, type, checked) {
  if (!doc) return '';
  switch (type) {
    case 'summary':
      return '문서 요약이에요. ' + (doc.summary || []).map(strip).join(' ');
    case 'datetime': {
      const dt = doc.datetime;
      if (!dt) return '날짜 정보가 없어요.';
      const dateObj = dt.date ? new Date(dt.date) : null;
      const today = new Date();
      const dday = dateObj ? Math.ceil((dateObj - today) / 86400000) : null;
      return `${dt.label}은 ${dt.date?.replace(/-/g, '년 ').replace(/-/g, '월 ')}일 ${dt.time || ''}이에요.${dday !== null ? ` ${dday}일 남았어요.` : ''} ${dt.note || ''}`;
    }
    case 'place': {
      const pl = doc.place;
      if (!pl) return '장소 정보가 없어요.';
      return `장소는 ${pl.name}이에요. ${pl.note || ''}`;
    }
    case 'items': {
      const items = doc.items || [];
      return `챙길 것은 ${items.length}가지예요. ${items.map(i => i.name).join(', ')}.`;
    }
    case 'cautions':
      return '주의할 점이에요. ' + (doc.cautions || []).map((c, i) => `${i + 1}번, ${strip(c)}`).join(' ');
    case 'contact': {
      const ct = doc.contact;
      if (!ct) return '연락처 정보가 없어요.';
      return `${ct.name}, 전화번호는 ${ct.phone.split('').join(' ')}이에요.`;
    }
    case 'category':
      return `이 종이는 ${doc.category} 종류예요.`;
    default:
      return '';
  }
}
