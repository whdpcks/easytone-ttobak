import { useEffect, useState } from 'react';
import './DocumentResultPage.css';

/**
 * C 담당 결과 화면. A의 Header/음성/API 호출은 props로 전달받습니다.
 *
 * @param {object} props
 * @param {number} props.documentId - B가 생성한 문서 ID
 * @param {function} props.loadDocument - A의 인증된 API client 또는 그 래퍼: async (id, {signal}) => JSON
 * @param {function} props.onOpenDetail - D 상세 화면 이동: (id, tileKey) => void
 * @param {function} [props.announce] - A가 제공하는 음성 읽기 함수: (sentence) => void | cleanup
 * @param {import('react').ReactNode} [props.header] - A의 공통 Header 컴포넌트
 */
export default function DocumentResultPage({
  documentId,
  loadDocument,
  onOpenDetail,
  announce,
  header = null,
}) {
  const [revision, setRevision] = useState(0);
  const [document, setDocument] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;

    setLoading(true);
    setError(null);
    setDocument(null);

    if (typeof loadDocument !== 'function') {
      setError('결과를 불러올 API가 연결되지 않았어요.');
      setLoading(false);
      return () => controller.abort();
    }

    Promise.resolve()
      .then(() => loadDocument(documentId, { signal: controller.signal }))
      .then(result => {
        if (!active) return;
        if (!result || result.status !== 'completed') throw new Error('분석 결과가 아직 준비되지 않았어요.');
        setDocument(result);
      })
      .catch(() => {
        if (active) setError('결과를 불러오지 못했어요. 잠시 뒤 다시 시도해 주세요.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [documentId, loadDocument, revision]);

  return (
    <main className="ttobak-c-result" aria-busy={loading}>
      {header}
      <div className="ttobak-c-result__content">
        {loading && (
          <section className="ttobak-c-result__message" role="status" aria-live="polite">
            <span className="ttobak-c-result__spinner" aria-hidden="true" />
            <p>문서 결과를 불러오고 있어요.</p>
          </section>
        )}

        {!loading && error && (
          <section className="ttobak-c-result__message" role="alert">
            <p>{error}</p>
            <button type="button" className="ttobak-c-result__retry" onClick={() => setRevision(value => value + 1)}>
              다시 시도
            </button>
          </section>
        )}

        {!loading && document && (
          <>
            <section className="ttobak-c-result__introduction">
              <span className="ttobak-c-result__eyebrow">문서 분석 완료</span>
              <h1>{document.title}</h1>
              <p className="ttobak-c-result__meta">
                {document.sender ? `${document.sender} · ` : ''}분석일 {document.created_at}
              </p>
              <p className="ttobak-c-result__instruction">어떤 내용이 궁금하세요?</p>
              <p className="ttobak-c-result__subinstruction">아래 항목을 누르면 자세히 알려드려요.</p>
            </section>

          </>
        )}
      </div>
    </main>
  );
}
