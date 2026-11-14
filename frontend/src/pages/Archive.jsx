import { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import Icon from '../utils/icons';
import useVoice from '../hooks/useVoice';
import Header, { HeaderButton } from '../common/Header';
import { useUI } from '../common/UIContext';
import { useSettings } from '../common/SettingsContext';
import { useT } from '../common/i18n';
import { CAT_CONFIG, CATEGORIES } from '../utils/catConfig';
import { catLabel, docLang, suggestions } from '../utils/archiveText';
import { getDocuments, searchDocuments } from '../api/documents';
import { useTranslatedDocs, primeDocument } from '../hooks/useDocument';
import useSpeechInput from '../hooks/useSpeechInput';

/* ───────────────────────────────────────────
   보관함 메인 화면 (SCR-10)
   D 담당: 목록 + 카테고리 필터 + AI 검색
─────────────────────────────────────────── */
/* 지난번 받은 목록 — key: `${category}:${lang}`. 다시 올 때 바로 보여 주고 뒤에서 새로 받음 */
const listCache = new Map();

/** 지운 문서를 기억해 둔 목록에서도 빼기 — 보관함으로 돌아갔을 때 잠깐이라도 보이지 않게 */
export function dropFromArchive(docId) {
  for (const [key, list] of listCache) if (Array.isArray(list)) listCache.set(key, list.filter(d => d.id !== Number(docId)));
}

export default function Archive() {
  const navigate = useNavigate();
  const { toast } = useUI();
  const lang = docLang(useSettings().lang);  // D는 한·영·일·중만, 그 외는 영어
  const t = useT();

  const [docs,         setDocs]         = useState(() => listCache.get(`${'전체'}:${lang}`) ?? null);  // null = 아직 받는 중
  const [category,     setCategory]     = useState('전체');
  const [query,        setQuery]        = useState('');
  const [searchResult, setSearchResult] = useState(null); // { query, results:[{id,reason,doc}] }
  const [isSearching,  setIsSearching]  = useState(false);
  const inputRef = useRef(null);

  /* 목록 로드 (사용할 말이 바뀌면 다시 — 번역해 둔 문서는 번역본으로 옴) */
  useEffect(() => {
    if (searchResult) return; // 검색 중엔 목록 갱신 안 함
    loadDocs();
  }, [category, lang]);

  async function loadDocs() {
    try {
      const params = category !== '전체' ? { category, lang } : { lang };
      const data = await getDocuments(params);
      listCache.set(`${category}:${lang}`, data);
      setDocs(data);
    } catch (e) {
      console.error(e);
    }
  }

  /* 아직 번역이 없는 문서는 하나씩 번역을 받아 바꿔 끼움 */
  const shownDocs = useTranslatedDocs(docs);
  const resultDocs = useMemo(() => searchResult?.results.map(r => r.doc) ?? [], [searchResult]);
  const shownResultDocs = useTranslatedDocs(resultDocs);
  const shownResults = searchResult?.results.map((r, i) => ({ ...r, doc: shownResultDocs[i] || r.doc })) ?? [];

  /* 화면 안내 음성 */
  const guide = !searchResult
    ? t('d.guide')
    : searchResult.results.length
      ? t('d.foundVoice', { q: searchResult.query, n: searchResult.results.length, titles: shownResults.map(r => r.doc?.title).join(', ') })
      : t('d.noneVoice');

  useVoice(guide);

  /* 말로 찾기 — 말하는 동안 검색창에 글자를 채우고, 말이 끝나면 그 말로 검색 */
  const MIC_ERR = { none: 'd.micNone', denied: 'd.micDenied', network: 'd.micNet', unsupported: 'd.micNo' };
  const mic = useSpeechInput({
    onText: text => { if (inputRef.current) inputRef.current.value = text; },
    onDone: text => { if (inputRef.current) inputRef.current.value = text; doSearch(text); },
    onError: kind => toast(t(MIC_ERR[kind])),
  });
  function micClick() {
    if (!mic.listening && mic.supported) {
      if (inputRef.current) inputRef.current.value = '';  // 새로 말한 것만 보이게
      toast(t('d.micOn'), { voice: false });  // 소리 안내는 마이크에 들어가니 글자로만
    }
    mic.toggle();
  }

  /* AI 검색 실행 */
  async function doSearch(q) {
    const trimmed = q.trim();
    setQuery(trimmed);
    if (!trimmed) { setSearchResult(null); loadDocs(); return; }

    setIsSearching(true);
    setSearchResult(null);
    try {
      const results = await searchDocuments(trimmed, lang);
      setSearchResult({ query: trimmed, results });
    } catch (e) {
      toast(t('d.searchErr'));
    } finally {
      setIsSearching(false);
    }
  }

  function openDoc(id) {
    // 목록에 있는 문서를 넘겨 둬서 결과 화면이 바로 뜨게 함
    const doc = [...(shownDocs ?? []), ...shownResults.map(r => r.doc)].find(d => d?.id === id);
    primeDocument(doc, lang);
    navigate(`/result/${id}`);
  }

  /* 필터링된 목록 */
  const filteredDocs = shownDocs?.filter(d =>
    category === '전체' || d.category === category
  ) ?? null;

  /* 검색 결과의 concept 텍스트 */
  function conceptText() {
    if (!searchResult?.results.length) return null;
    const cats = [...new Set(searchResult.results.map(r => r.doc?.category).filter(Boolean))];
    return cats.length ? cats.map(c => catLabel(t, c)).join(', ') : searchResult.query;
  }

  return (
    <div className="app">
      <Header
        left="home"
        title={t('d.title')}
        voiceText={guide}
        right={<HeaderButton icon="user" label={t('hdr.me')} onClick={() => navigate('/me')} />}
      />

      <div className="body">
        {/* 검색창 */}
        <form
          className="search"
          onSubmit={e => { e.preventDefault(); doSearch(inputRef.current.value); }}
        >
          <Icon name="search" />
          <input
            ref={inputRef}
            placeholder={mic.listening ? t('d.listening') : t('d.searchPh')}
            defaultValue={query}
            aria-label={t('d.searchAria')}
          />
          <button
            type="button"
            className={`mic${mic.listening ? ' on' : ''}`}
            aria-label={mic.listening ? t('d.micStop') : t('d.mic')}
            aria-pressed={mic.listening}
            onClick={micClick}
          >
            <Icon name="mic" />
          </button>
          <button type="submit">{t('d.find')}</button>
        </form>

        {/* 추천 검색어 */}
        <div className="sugg">
          {suggestions(t).map(s => (
            <button
              key={s}
              onClick={() => { inputRef.current.value = s; doSearch(s); }}
            >
              {s}
            </button>
          ))}
        </div>

        {/* 카테고리 필터 */}
        <div className="cats" role="group" aria-label={t('d.catAria')}>
          {CATEGORIES.map(c => (
            <button
              key={c}
              aria-pressed={category === c}
              onClick={() => {
                setCategory(c);
                setSearchResult(null);
                setQuery('');
                if (inputRef.current) inputRef.current.value = '';
              }}
            >
              {catLabel(t, c)}
            </button>
          ))}
        </div>

        {/* 결과 영역 */}
        {isSearching ? (
          <SearchingState t={t} query={inputRef.current?.value || query} />
        ) : searchResult ? (
          <SearchResultView
            t={t}
            result={{ ...searchResult, results: shownResults }}
            conceptText={conceptText()}
            onOpen={openDoc}
            onClear={() => { setSearchResult(null); setQuery(''); if (inputRef.current) inputRef.current.value = ''; loadDocs(); }}
          />
        ) : (
          <DocList
            t={t}
            docs={filteredDocs}
            category={category}
            onOpen={openDoc}
          />
        )}
      </div>

    </div>
  );
}

/* ── 로딩 중 ── */
function SearchingState({ t, query }) {
  return (
    <div className="list">
      <div className="ai-say">
        <span className="spark">AI</span>
        <span>{t('d.thinking', { q: query })}</span>
      </div>
      <div className="shimmer" />
      <div className="shimmer" />
    </div>
  );
}

/* ── AI 검색 결과 ── */
function SearchResultView({ t, result, conceptText, onOpen, onClear }) {
  const hasResults = result.results.length > 0;
  // {c} 자리에 형광펜 글자를 넣으려고 문장을 둘로 나눔 (언어마다 어순이 달라서)
  const MARK = '\u0000';
  const [before, after = ''] = t('d.understood', { q: result.query, n: result.results.length, c: MARK }).split(MARK);
  return (
    <div className="list">
      <div className="ai-say">
        <span className="spark">AI</span>
        <span>
          {hasResults
            ? <>
                {before}
                {conceptText && <b style={{ background: 'var(--hl)', padding: '0 4px' }}>{conceptText}</b>}
                {after}
              </>
            : t('d.noResult', { q: result.query })}
        </span>
      </div>

      {result.results.map(r => (
        <DocRow key={r.id} t={t} doc={r.doc} why={r.reason} onOpen={() => onOpen(r.id)} />
      ))}

      {hasResults && (
        <button className="btn ghost" onClick={onClear}>{t('d.showAll')}</button>
      )}
    </div>
  );
}

/* ── 일반 목록 ── */
function DocList({ t, docs, category, onOpen }) {
  if (!docs) return null;  // 아직 받는 중 — "문서가 없어요"가 깜빡이지 않게 비워 둠
  if (!docs.length) {
    return (
      <div className="list">
        <p className="empty">
          {category !== '전체' ? t('d.emptyCat', { c: catLabel(t, category) }) : t('d.empty')}
        </p>
      </div>
    );
  }
  return (
    <div className="list">
      {docs.map(d => (
        <DocRow key={d.id} t={t} doc={d} onOpen={() => onOpen(d.id)} />
      ))}
    </div>
  );
}

/* ── 문서 카드 한 줄 ── */
function DocRow({ t, doc, why, onOpen }) {
  if (!doc) return null;
  const cfg = CAT_CONFIG[doc.category] ?? { c: '#4A5066', s: '#ECECE6', icon: 'doc' };
  return (
    <div
      className="row"
      style={{ '--c': cfg.c, '--c-soft': cfg.s }}
    >
      <span className="ri">
        <Icon name={cfg.icon} size={28} />
      </span>
      <div className="rt">
        <b>{doc.title}</b>
        <small>{[doc.sender, doc.created_at.replace(/-/g, '.')].filter(Boolean).join(' · ')}</small>
        {why && <span className="why">{why}</span>}
      </div>
      <button className="open" onClick={onOpen} aria-label={t('d.openAria', { title: doc.title })}>
        {t('d.open')}
      </button>
    </div>
  );
}
