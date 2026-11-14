import { useLayoutEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Icon from '../utils/icons';
import useVoice from '../hooks/useVoice';
import { useSettings } from '../common/SettingsContext';
import { useT } from '../common/i18n';
import { catLabel, docLang } from '../utils/archiveText';
import { forgetDocument, useDocument } from '../hooks/useDocument';
import { forgetPages, usePages } from '../hooks/useOriginal';
import { deleteDocument } from '../api/documents';
import { useUI } from '../common/UIContext';
import { dropFromArchive } from './Archive';
import { formatDay, formatTime } from '../utils/datetime';
import { DocError, DocHeader, DocLoading, FallbackNotice } from './DocStatus';

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
  const { doc, error, fallback, retry } = useDocument(docId);
  const pages = usePages(docId);  // 원문 보기 타일은 원본이 있을 때만
  const { confirm, toast } = useUI();
  const [deleting, setDeleting] = useState(false);

  // 삭제하기 — 문서 이름과 함께 한 번 더 묻고, 지우면 보관함으로
  async function remove() {
    const ok = await confirm({
      title: doc.title, message: t('d.delAsk'),
      okText: t('d.delYes'), cancelText: t('d.delNo'), danger: true,
    });
    if (!ok) return;
    setDeleting(true);
    try {
      await deleteDocument(doc.id);
      forgetDocument(doc.id);
      forgetPages(doc.id);
      dropFromArchive(doc.id);
      toast(t('d.deleted'));
      navigate('/archive', { replace: true });
    } catch {
      setDeleting(false);
      toast(t('d.delFail'));
    }
  }

  // 보관함에서 [보기]로 들어오면 늘 맨 위부터 — 목록에서 내려 둔 스크롤이 남지 않게 (그리기 전에 올림)
  useLayoutEffect(() => { window.scrollTo(0, 0); }, [docId]);

  const intro = doc && t('d.intro', { title: doc.title, s: doc.summary?.[0] ?? '' });
  useVoice(intro);

  if (error) return <DocError error={error} />;
  if (!doc) return <DocLoading />;

  return (
    <div className="app">
      <DocHeader voiceText={intro} />

      <div className="body">
        {fallback && <FallbackNotice onRetry={retry} />}
        <div>
          <p className="sub">{[doc.sender, doc.created_at.replace(/-/g, '.')].filter(Boolean).join(' · ')}</p>
          <h1 className="h">{doc.title}</h1>
          <span className="cat-pill">{catLabel(t, doc.category)}</span>
        </div>

        <p className="sub" style={{ fontWeight: 700, color: 'var(--ink)' }}>{t('d.pick')}</p>

        <div className="tiles">
          {buildTiles(doc, t, lang, pages).map(tile => (
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

        <button className="del-doc" onClick={remove} disabled={deleting}>
          <Icon name="trash" />{t('d.delete')}
        </button>
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

function buildTiles(doc, t, lang, pages) {
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
    // 카테고리 타일 대신 원문 보기 (찍거나 올린 원본이 있을 때만 — 시연 샘플 문서에는 없음)
    { key: 'original', icon: 'doc', c: '#4A5066', s: '#ECECE6', title: t('d.t.original'), sub: t('d.origSub'), show: pages?.length > 0 },
  ].filter(tile => tile.show);
}
