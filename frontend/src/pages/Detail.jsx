import { useState, useEffect, useLayoutEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Icon from '../utils/icons';
import useVoice from '../hooks/useVoice';
import { useSettings } from '../common/SettingsContext';
import { useT } from '../common/i18n';
import { useUI } from '../common/UIContext';
import { makeIcs, saveIcs } from '../utils/calendar';
import { CAT_CONFIG } from '../utils/catConfig';
import { catLabel, docLang } from '../utils/archiveText';
import { getDocuments } from '../api/documents';
import { primeDocument, useDocument, useTranslatedDocs } from '../hooks/useDocument';
import { parseDate, daysUntil, formatTime, formatMonthDay, formatMonthShort, formatWeekdayParts } from '../utils/datetime';
import { DocError, DocHeader, DocLoading, FallbackNotice } from './DocStatus';
import { Mark, markAll, markNumbers } from '../utils/marks';

/* ───────────────────────────────────────────
   상세 화면 (SCR-09) — 7종 타입
   URL: /detail/:docId/:type
   type = summary | datetime | place | items | cautions | contact | category
   글자는 A의 i18n(t), 문서 내용은 C의 번역 API(useDocument)로 지금 쓰는 말에 맞춥니다.
─────────────────────────────────────────── */
export default function Detail() {
  const { docId, type } = useParams();
  const navigate = useNavigate();
  const lang = docLang(useSettings().lang);  // D는 한·영·일·중만, 그 외는 영어
  const t = useT();
  const { doc, error, fallback, retry } = useDocument(docId);
  const [checked, setChecked] = useState({});

  // 상세 화면은 늘 맨 위부터 — 앞 화면에서 내려 둔 스크롤이 그대로 남지 않게 (그리기 전에 올림)
  useLayoutEffect(() => { window.scrollTo(0, 0); }, [docId, type]);

  const guide = doc ? voiceText(doc, type, t, lang) : '';
  useVoice(guide);

  if (error) return <DocError error={error} />;
  if (!doc) return <DocLoading />;

  const props = { doc, t, lang };
  return (
    <div className="app">
      <DocHeader voiceText={guide} />

      <div className="body">
        {fallback && <FallbackNotice onRetry={retry} />}
        <p className="sub doc-name">{doc.title}</p>
        {type === 'summary'  && <SummaryScreen   {...props} />}
        {type === 'datetime' && <DateTimeScreen  {...props} />}
        {type === 'place'    && <PlaceScreen     {...props} />}
        {type === 'items'    && <ItemsScreen     {...props} checked={checked} setChecked={setChecked} />}
        {type === 'cautions' && <CautionsScreen  {...props} />}
        {type === 'contact'  && <ContactScreen   {...props} />}
        {type === 'category' && <CategoryScreen  {...props} navigate={navigate} />}

        <button className="btn line" onClick={() => navigate(-1)}>{t('d.other')}</button>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════
   1. 요약
══════════════════════════════════════════= */
function SummaryScreen({ doc, t }) {
  const clock = { t: 80 };  // 줄을 넘어 차례로 떠오르게 같은 clock을 씀
  return (
    <>
      <h1 className="h">{t('d.glance')}</h1>
      <div className="card">
        <ol className="sum-list">
          {(doc.summary || []).map((s, i) => (
            <li key={i}>
              <span className="num">{i + 1}</span>
              <span>{summaryLine(s, i, clock)}</span>
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
function DateTimeScreen({ doc, t, lang }) {
  const { toast } = useUI();
  const dt = doc.datetime;
  if (!dt) return <p className="sub">{t('d.noDate')}</p>;

  const dateObj = dt.date ? parseDate(dt.date) : null;
  const dday    = dateObj ? daysUntil(dateObj) : null;
  const wd      = dateObj ? formatWeekdayParts(dateObj, lang) : null;  // ['화', '요일']
  // 알림 받기 — 휴대폰 달력에 넣을 일정 파일을 만들어 줌 (달력 앱이 미리 알려 줌)
  function remind() {
    if (dday < 0) { toast(t('d.remindPast')); return; }
    const title = dt.label && dt.label !== doc.title ? `${doc.title} - ${dt.label}` : doc.title;
    saveIcs(makeIcs({
      title, date: dt.date, time: dt.time, note: dt.note,
      location: doc.place?.address || doc.place?.name, uid: `${doc.id}-${dt.date}`,
    }), title);
    toast(t(dt.time ? 'd.remindDone' : 'd.remindDoneDay'));
  }

  return (
    <>
      <h1 className="h">{dt.label || t('d.t.datetime')}</h1>
      <div className="card">
        <div className="cal">
          {dateObj && (
            <div className="day">
              <small>{formatMonthShort(dateObj, lang)}</small>
              <b>{dateObj.getDate()}</b>
              <span>{wd[0]}<span className="wd-rest">{wd[1]}</span></span>
            </div>
          )}
          <div>
            <b style={{ fontSize: '1.35em', lineHeight: 1.3 }}><Mark delay={60}>{formatTime(dt.time, lang) || t('d.allDay')}</Mark></b>
            <br />
            {dday !== null && (
              <span className="dday">
                {dday > 0 ? t('d.dleft', { n: dday }) : dday === 0 ? t('d.today') : t('d.past')}
              </span>
            )}
          </div>
        </div>
      </div>
      {dt.note && (
        <div className="card">
          <p style={{ margin: 0, fontSize: '1.08em' }}>{markNumbers(dt.note, { t: 300 })}</p>
        </div>
      )}
      {dt.check && (
        <div className="card" style={{ background: 'var(--red-soft)', borderColor: 'var(--red)' }}>
          <p style={{ margin: 0, fontWeight: 700 }}>{t('d.checkAgain')}</p>
        </div>
      )}
      {dateObj && (
        <button className="btn red" onClick={remind}>
          <Icon name="cal" />{t('d.remind')}
        </button>
      )}
    </>
  );
}

/* ═══════════════════════════════════════════
   3. 장소
══════════════════════════════════════════= */
/* 길 찾기 — 카카오맵에서 주소를 검색한 화면을 새 창으로 엶
   (휴대폰에 카카오맵 앱이 있으면 카카오맵 웹이 앱으로 열기를 안내해 줌) */
function openKakaoMap(query) {
  const url = `https://map.kakao.com/link/search/${encodeURIComponent(query)}`;
  window.open(url, '_blank', 'noopener');
}

function PlaceScreen({ doc, t }) {
  const pl = doc.place;
  if (!pl) return <p className="sub">{t('d.noPlace')}</p>;

  return (
    <>
      <h1 className="h">{pl.name || t('d.whereTo')}</h1>
      {pl.address && (
        <div className="card">
          <p style={{ margin: '0 0 6px', fontWeight: 700 }}>{t('d.address')}</p>
          <p style={{ margin: 0, fontSize: '1.1em', userSelect: 'all' }}><Mark delay={60}>{pl.address}</Mark></p>
        </div>
      )}
      {pl.note && (
        <div className="card">
          <p style={{ margin: 0, fontSize: '1.08em' }}>{pl.note}</p>
        </div>
      )}
      {(pl.address || pl.name) && (
        <button className="btn primary" onClick={() => openKakaoMap(pl.address || pl.name)}>
          <Icon name="pin" />{t('d.route')}
        </button>
      )}
    </>
  );
}

/* ═══════════════════════════════════════════
   4. 준비물 (체크리스트)
══════════════════════════════════════════= */
function ItemsScreen({ doc, t, checked, setChecked }) {
  const items = doc.items || [];
  const checkedCount = items.filter((_, i) => checked[`${doc.id}-${i}`]).length;

  function toggle(i) {
    setChecked(prev => ({ ...prev, [`${doc.id}-${i}`]: !prev[`${doc.id}-${i}`] }));
  }

  return (
    <>
      <h1 className="h">{t('d.itemsH', { n: items.length })}</h1>
      <p className="sub">{t('d.itemsSub', { c: checkedCount, n: items.length })}</p>
      <div className="check">
        {items.map((it, i) => (
          <button
            key={i}
            className="pop-in"
            style={{ '--i': i }}
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
function CautionsScreen({ doc, t }) {
  const cautions = doc.cautions || [];
  const clock = { t: 80 };
  return (
    <>
      <h1 className="h">{t('d.cautionsH')}</h1>
      <ol className="warn">
        {cautions.map((c, i) => (
          <li key={i}>
            <span className="num">{i + 1}</span>
            <span>{markNumbers(c, clock)}</span>
          </li>
        ))}
      </ol>
    </>
  );
}

/* ═══════════════════════════════════════════
   6. 연락처
══════════════════════════════════════════= */
function ContactScreen({ doc, t }) {
  const ct = doc.contact;
  if (!ct) return <p className="sub">{t('d.noContact')}</p>;
  const num = phoneNumber(ct.phone);

  return (
    <>
      <h1 className="h">{t('d.callH')}</h1>
      <div className="card">
        {ct.name && <p className="sub" style={{ margin: 0 }}>{ct.name}</p>}
        {num && <div className="tel"><Mark>{num}</Mark></div>}
        {/* '국번없이 1345(…)'처럼 번호에 설명이 붙어 있으면 작게 함께 보여줌 */}
        {ct.phone && ct.phone !== num && <p className="sub" style={{ margin: '6px 0 0' }}>{ct.phone}</p>}
      </div>
      {num && (
        <button
          className="btn primary"
          onClick={() => { window.location.href = `tel:${num.replace(/[^0-9]/g, '')}`; }}
        >
          <Icon name="phone" />{t('d.call')}
        </button>
      )}
    </>
  );
}

/* ═══════════════════════════════════════════
   7. 카테고리
══════════════════════════════════════════= */
function CategoryScreen({ doc, t, lang, navigate }) {
  const [sameCategory, setSameCategory] = useState([]);
  const cfg = CAT_CONFIG[doc.category] ?? { c: '#4A5066', s: '#ECECE6', icon: 'doc' };
  const shown = useTranslatedDocs(sameCategory);

  useEffect(() => {
    getDocuments({ category: doc.category, lang })
      .then(docs => setSameCategory(docs.filter(d => d.id !== doc.id)))
      .catch(console.error);
  }, [doc.id, doc.category, lang]);

  return (
    <>
      <h1 className="h">{t('d.kindH')}</h1>
      <div
        className="card"
        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}
      >
        <span className="cat-pill">{catLabel(t, doc.category)}</span>
        <button
          className="btn line"
          style={{ width: 'auto', minHeight: 44, padding: '0 16px' }}
          onClick={() => alert(t('d.changeDemo'))}
        >
          {t('d.change')}
        </button>
      </div>

      <p style={{ fontWeight: 700, margin: '6px 0 0' }}>{t('d.same')}</p>
      <div className="list">
        {shown.length === 0
          ? <p className="empty">{t('d.sameEmpty')}</p>
          : shown.map(d => (
              <div
                key={d.id}
                className="row"
                style={{ '--c': cfg.c, '--c-soft': cfg.s }}
              >
                <span className="ri"><Icon name={cfg.icon} size={28} /></span>
                <div className="rt">
                  <b>{d.title}</b>
                  <small>{[d.sender, d.created_at.replace(/-/g, '.')].filter(Boolean).join(' · ')}</small>
                </div>
                <button
                  className="open"
                  onClick={() => { primeDocument(d, lang); navigate(`/result/${d.id}`); }}
                  aria-label={t('d.openAria', { title: d.title })}
                >
                  {t('d.open')}
                </button>
              </div>
            ))
        }
      </div>
    </>
  );
}

/* 요약 한 줄 — 날짜·시간·금액을 강조. 첫 줄에 숫자가 없으면 첫 줄을 통째로 */
function summaryLine(text, i, clock) {
  const marked = markNumbers(text, clock);
  return i === 0 && marked === text ? markAll(text, clock) : marked;
}

/* 전화번호 칸에서 번호만 꺼냄 ('국번없이 1345(…)' → '1345', '02-1234-5678' → 그대로) */
function phoneNumber(phone) {
  if (!phone) return '';
  return phone.match(/\d[\d-]{2,}\d/)?.[0] ?? '';
}

/* ───────────────────────────────────────────
   음성 텍스트 생성 (지금 쓰는 말로)
─────────────────────────────────────────── */
function voiceText(doc, type, t, lang) {
  if (!doc) return '';
  switch (type) {
    case 'summary':
      return t('v.summary', { s: (doc.summary || []).join(' ') });
    case 'datetime': {
      const dt = doc.datetime;
      if (!dt) return t('d.noDate');
      const dateObj = dt.date ? parseDate(dt.date) : null;
      const when = [dateObj && formatMonthDay(dateObj, lang), formatTime(dt.time, lang)].filter(Boolean).join(' ');
      const dday = dateObj ? daysUntil(dateObj) : null;
      return [
        when && t('v.date', { label: dt.label || t('v.dateLabel'), when }),
        dday > 0 && t('v.dleft', { n: dday }),
        dt.note,
        dt.check && t('d.checkAgain'),
      ].filter(Boolean).join(' ');
    }
    case 'place': {
      const pl = doc.place;
      if (!pl) return t('d.noPlace');
      return [pl.name && t('v.place', { name: pl.name }), pl.address, pl.note].filter(Boolean).join(' ');
    }
    case 'items': {
      const items = doc.items || [];
      return t('v.items', { n: items.length, list: items.map(i => i.name).join(', ') });
    }
    case 'cautions':
      return t('v.cautions', { list: (doc.cautions || []).map((c, i) => t('v.nth', { i: i + 1, c })).join(' ') });
    case 'contact': {
      const ct = doc.contact;
      const num = phoneNumber(ct?.phone);
      if (!num) return t('d.noContact');
      return t('v.contact', { name: ct.name ? `${ct.name}, ` : '', phone: num.split('').join(' ') });
    }
    case 'category':
      return t('v.category', { c: catLabel(t, doc.category) });
    default:
      return '';
  }
}
