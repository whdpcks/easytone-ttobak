/* A의 인증 API·공통 헤더·음성을 C 결과 화면에 연결합니다. */

import { useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import DocumentResultPage from '../../c_results/DocumentResultPage.jsx';
import { api } from '../api/client';
import Header from '../common/Header';
import useVoice from '../hooks/useVoice';

export default function AnalysisResult() {
  const { docId } = useParams();
  const navigate = useNavigate();
  const { speak } = useVoice();

  const loadDocument = useCallback((id, { signal } = {}) => (
    api.get(`/documents/${id}`, { signal })
  ), []);
  const openDetail = useCallback((id, tileKey) => {
    navigate(`/detail/${id}/${tileKey}`);
  }, [navigate]);

  return (
    <DocumentResultPage
      documentId={Number(docId)}
      loadDocument={loadDocument}
      onOpenDetail={openDetail}
      announce={speak}
      header={<Header left="back" title="분석 결과" />}
    />
  );
}
