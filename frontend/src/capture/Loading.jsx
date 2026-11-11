import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { api } from '../api/client'
import DocumentProcessing from './DocumentProcessing'

export default function Loading() {
  const { docId } = useParams()
  const navigate = useNavigate()
  const [state, setState] = useState(null)
  const [error, setError] = useState('')
  useEffect(() => {
    const controller = new AbortController()
    let timer
    async function poll() {
      try {
        const result = await api.get(`/documents/${docId}/status`, { signal: controller.signal })
        if (controller.signal.aborted) return
        setState(result)
        setError('')
        if (!result.done) timer = setTimeout(poll, 1500)
      } catch (e) {
        if (controller.signal.aborted) return
        setError(e.message)
        timer = setTimeout(poll, 3000)
      }
    }
    poll()
    return () => { controller.abort(); clearTimeout(timer) }
  }, [docId])
  const failed = state?.status === 'failed'
  if (failed || error) return <main className="app"><div className="body"><h1>{failed ? '문서를 읽지 못했어요' : '연결을 확인하고 있어요'}</h1><p role="alert">{error || state.error}</p><button onClick={() => navigate('/home')}>홈으로</button></div></main>
  return <main className="capture-app"><div className="camera-preview"><DocumentProcessing
    step={{ ocr: 0, ai: 1, saving: 2 }[state?.step] ?? 0}
    completed={state?.status === 'completed'}
    heading={state?.step ? '중요한 곳에\n형광펜 칠하는 중' : '문서 읽기를\n기다리고 있어요'}
    onStampFinished={() => navigate(`/result/${docId}`, { replace: true })}
  /></div></main>
}
