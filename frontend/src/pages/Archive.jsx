import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import Icon from '../utils/icons';
import useVoice from '../hooks/useVoice';
import Header, { HeaderButton } from '../common/Header';
import { useUI } from '../common/UIContext';
import { CAT_CONFIG, CATEGORIES, SUGGESTIONS } from '../utils/catConfig';
import { getDocuments, searchDocuments } from '../api/documents';

/* ───────────────────────────────────────────
   보관함 메인 화면 (SCR-10)
   D 담당: 목록 + 카테고리 필터 + AI 검색
─────────────────────────────────────────── */
export default function Archive() {
  const navigate = useNavigate();
  const { toast } = useUI();

  const [docs,         setDocs]         = useState([]);
  const [category,     setCategory]     = useState('전체');
  const [query,        setQuery]        = useState('');
  const [searchResult, setSearchResult] = useState(null); // { query, results:[{id,reason,doc}] }
  const [isSearching,  setIsSearching]  = useState(false);
  const inputRef = useRef(null);

  /* 목록 로드 */
  useEffect(() => {
    if (searchResult) return; // 검색 중엔 목록 갱신 안 함
    loadDocs();
  }, [category]);

  async function loadDocs() {
    try {
      const params = category !== '전체' ? { category } : {};
      const data = await getDocuments(params);
      setDocs(data);
    } catch (e) {
      console.error(e);
    }
  }

  /* 화면 안내 음성 */
  const guide = !searchResult
    ? '보관함이에요. 찾고 싶은 것을 적거나, 추천 검색어를 눌러주세요.'
    : searchResult.results.length
      ? `"${searchResult.query}"와 관련된 문서를 ${searchResult.results.length}개 찾았어요. ${searchResult.results.map(r => r.doc?.title).join(', ')}.`
      : '관련된 문서를 못 찾았어요.';

  useVoice(guide);

  /* AI 검색 실행 */
  async function doSearch(q) {
    const trimmed = q.trim();
    setQuery(trimmed);
    if (!trimmed) { setSearchResult(null); loadDocs(); return; }

    setIsSearching(true);
    setSearchResult(null);
    try {
      const results = await searchDocuments(trimmed);
      setSearchResult({ query: trimmed, results });
    } catch (e) {
      toast('검색 중 오류가 났어요. 다시 시도해주세요.');
    } finally {
      setIsSearching(false);
    }
  }

  function openDoc(id) {
    navigate(`/result/${id}`);
  }

  /* 필터링된 목록 */
  const filteredDocs = docs.filter(d =>
    category === '전체' || d.category === category
  );

  /* 검색 결과의 concept 텍스트 */
  function conceptText() {
    if (!searchResult?.results.length) return null;
    const cats = [...new Set(searchResult.results.map(r => r.doc?.category).filter(Boolean))];
    return cats.length ? cats.join(', ') : searchResult.query;
  }

  return (
    <div className="app">
      <Header
        left="home"
        title="보관함"
        voiceText={guide}
        right={<HeaderButton icon="user" label="내정보" onClick={() => navigate('/me')} />}
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
            placeholder="예: 일하는거, 병원"
            defaultValue={query}
            aria-label="검색어"
          />
          <button
            type="button"
            className="mic"
            aria-label="말로 찾기"
            onClick={() => {
              /* 음성 입력 — P1, 시연에서는 '일하는거' 자동 타이핑 */
              const q = '일하는거';
              inputRef.current.value = q;
              doSearch(q);
            }}
          >
            <Icon name="mic" />
          </button>
          <button type="submit">찾기</button>
        </form>

        {/* 추천 검색어 */}
        <div className="sugg">
          {SUGGESTIONS.map(s => (
            <button
              key={s}
              onClick={() => { inputRef.current.value = s; doSearch(s); }}
            >
              {s}
            </button>
          ))}
        </div>

        {/* 카테고리 필터 */}
        <div className="cats" role="group" aria-label="카테고리 필터">
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
              {c}
            </button>
          ))}
        </div>

        {/* 결과 영역 */}
        {isSearching ? (
          <SearchingState query={inputRef.current?.value || query} />
        ) : searchResult ? (
          <SearchResultView
            result={searchResult}
            conceptText={conceptText()}
            onOpen={openDoc}
            onClear={() => { setSearchResult(null); setQuery(''); if (inputRef.current) inputRef.current.value = ''; loadDocs(); }}
          />
        ) : (
          <DocList
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
function SearchingState({ query }) {
  return (
    <div className="list">
      <div className="ai-say">
        <span className="spark">AI</span>
        <span>"{query}"의 뜻을 생각하는 중…</span>
      </div>
      <div className="shimmer" />
      <div className="shimmer" />
    </div>
  );
}

/* ── AI 검색 결과 ── */
function SearchResultView({ result, conceptText, onOpen, onClear }) {
  const hasResults = result.results.length > 0;
  return (
    <div className="list">
      <div className="ai-say">
        <span className="spark">AI</span>
        <span>
          {hasResults
            ? <>
                "{result.query}"를{' '}
                {conceptText && <b style={{ background: 'var(--hl)', padding: '0 4px' }}>{conceptText}</b>}
                {' '}관련으로 이해했어요. 문서 {result.results.length}개를 찾았어요.
              </>
            : `"${result.query}"와 관련된 문서를 못 찾았어요. 다른 말로 찾아보세요.`}
        </span>
      </div>

      {result.results.map(r => (
        <DocRow key={r.id} doc={r.doc} why={r.reason} onOpen={() => onOpen(r.id)} />
      ))}

      {hasResults && (
        <button className="btn ghost" onClick={onClear}>전체 목록 보기</button>
      )}
    </div>
  );
}

/* ── 일반 목록 ── */
function DocList({ docs, category, onOpen }) {
  if (!docs.length) {
    return (
      <div className="list">
        <p className="empty">
          {category !== '전체' ? `${category} 문서가 없어요.` : '아직 찍어둔 문서가 없어요.'}
        </p>
      </div>
    );
  }
  return (
    <div className="list">
      {docs.map(d => (
        <DocRow key={d.id} doc={d} onOpen={() => onOpen(d.id)} />
      ))}
    </div>
  );
}

/* ── 문서 카드 한 줄 ── */
function DocRow({ doc, why, onOpen }) {
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
      <button className="open" onClick={onOpen} aria-label={`${doc.title} 보기`}>
        보기
      </button>
    </div>
  );
}
