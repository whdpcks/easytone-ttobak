import { useEffect, useRef, useState } from 'react'
import './capture.css'
import { useNavigate } from 'react-router-dom'
import { api } from '../api/client'
import useAutoCapture from './useAutoCapture'
import DocumentProcessing from './DocumentProcessing'
import CaptureIntro from './CaptureIntro'

export default function Camera() {
  const navigate = useNavigate()
  const videoRef = useRef(null)
  const guideRef = useRef(null)
  const confirmationRef = useRef(null)
  const [captureConfirmation, setCaptureConfirmation] = useState(false)
  const [showIntro, setShowIntro] = useState(() => !window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  const [awaitingNext, setAwaitingNext] = useState(false)
  const [status, setStatus] = useState('opening')
  const [error, setError] = useState('')

  const [photos, setPhotos] = useState([])
  const [capturing, setCapturing] = useState(false)
  const photoUrls = useRef([])
  const documentId = useRef(null)
  const clientDocumentId = useRef(null)
  const uploadedPhotos = useRef(new Set())
  const busy = useRef(false)
  const mounted = useRef(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [processing, setProcessing] = useState(null)
  const [uploadStep, setUploadStep] = useState(0)

  useEffect(() => {
    const video = videoRef.current
    let cancelled = false
    let cameraStream
    mounted.current = true
    setStatus('opening')
    setError('')

    async function openCamera() {
      try {
        cameraStream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: 'environment' },
            width: { ideal: 2560 },
            height: { ideal: 1920 },
          },
          audio: false,
        })
        if (cancelled) {
          cameraStream.getTracks().forEach((track) => track.stop())
          return
        }
        video.srcObject = cameraStream
        await video.play()
        if (!cancelled) setStatus('on')
      } catch (error) {
        cameraStream?.getTracks().forEach((track) => track.stop())
        if (cancelled) return
        setStatus('off')
        setError(error.name === 'NotAllowedError'
          ? '카메라 권한을 허용한 뒤 새로고침해주세요.'
          : '카메라를 열 수 없어요. 카메라 연결을 확인하고 새로고침해주세요.')
      }
    }
    openCamera()

    return () => {
      cancelled = true
      mounted.current = false
      cameraStream?.getTracks().forEach((track) => track.stop())
      if (video.srcObject === cameraStream) video.srcObject = null
      photoUrls.current.forEach((url) => URL.revokeObjectURL(url))
    }
  }, [])

  useEffect(() => {
    const dialog = confirmationRef.current
    if (captureConfirmation && !dialog.open) dialog.showModal()
    if (!captureConfirmation && dialog.open) dialog.close()
  }, [captureConfirmation])

  function nextDocument() {
    setCaptureConfirmation(false)
    setAwaitingNext(false)
  }

  function finishCapture() {
    setCaptureConfirmation(false)
    savePhotos()
  }

  function takePhoto() {
    if (busy.current) return
    const video = videoRef.current

    if (!video?.videoWidth || !video.videoHeight) {
      setError('카메라 화면이 보이면 다시 찍어주세요.')
      return
    }

    setError('')

    // 현재 영상 한 장을 실제 영상 크기 그대로 복사한다.
    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    canvas.getContext('2d').drawImage(video, 0, 0)

    busy.current = true
    setCapturing(true)

    // 사진 변환이 끝난 순서대로 한 장씩 추가한다.
    canvas.toBlob((blob) => {
      busy.current = false
      if (!mounted.current) return
      setCapturing(false)
      if (!blob) {
        setError('사진을 찍지 못했어요. 다시 눌러주세요.')
        return
      }

      const url = URL.createObjectURL(blob)
      photoUrls.current.push(url)
      setPhotos((previous) => [
        ...previous,
        { blob, url, clientId: crypto.randomUUID(), width: canvas.width, height: canvas.height },
      ])
      setSaved(false)
      setAwaitingNext(true)
      setCaptureConfirmation(true)
    }, 'image/jpeg', 0.95)
  }

  const detection = useAutoCapture({
    videoRef,
    guideRef,
    enabled: status === 'on' && !showIntro && !awaitingNext && !saving && !capturing,
    onCapture: () => {
      setAwaitingNext(true)
      takePhoto()
    },
  })

  const hints = {
    loading: '자동 촬영을 준비하고 있어요.',
    waiting: '카메라 영상이 보이는지 확인해주세요.',
    dark: '화면이 너무 어두워요. 종이가 보이도록 조명을 밝혀주세요.',
    small: '종이를 조금 더 가까이 가져와주세요.',
    searching: '빨간 테두리 안에 종이 네 모서리를 맞춰주세요.',
    positioning: '종이가 빨간 테두리 안에 들어오도록 맞춰주세요.',
    blurry: '글씨가 선명해지도록 초점을 맞춰주세요.',
    steady: '좋아요. 잠깐 그대로 계시면 자동으로 찍어요.',
    error: '자동 촬영을 준비하지 못했어요. 새로고침해서 다시 시도해주세요.',
  }
  let cameraHint = status === 'opening' ? '카메라를 준비하고 있어요. 권한 요청이 나오면 허용해주세요.' : '카메라 연결과 권한을 확인해주세요.'
  if (status === 'on') cameraHint = hints[detection.state]
  if (showIntro && status === 'on') cameraHint = '촬영 방법을 안내하고 있어요.'
  if (capturing) cameraHint = '사진을 찍고 있어요.'
  if (awaitingNext && !capturing) cameraHint = '찍었어요. 끝내거나 다음 서류를 찍을 수 있어요.'
  if (saving) cameraHint = '찍은 사진을 저장하고 있어요.'
  if (saved) cameraHint = '찍은 사진을 저장했어요.'

  async function savePhotos() {
    if (photos.length === 0 || busy.current || saved) return

    busy.current = true
    setSaving(true)
    setError('')
    setProcessing('saving')
    setUploadStep(0)

    try {
      // 여러 장을 같은 문서에 저장할 수 있도록 문서 번호를 기억한다.
      if (documentId.current === null) {
        clientDocumentId.current ??= crypto.randomUUID()
        const { id } = await api.post('/documents', { client_document_id: clientDocumentId.current })
        documentId.current = id
      }

      setUploadStep(1)
      for (const [index, photo] of photos.entries()) {
        // 저장 완료 응답을 받은 사진은 다음 저장에서 건너뛴다.
        if (uploadedPhotos.current.has(photo.url)) continue

        await api.upload(`/documents/${documentId.current}/pages`, {
          file: new File([photo.blob], `capture-${index + 1}.jpg`, { type: 'image/jpeg' }),
          client_page_id: photo.clientId,
        })
        uploadedPhotos.current.add(photo.url)
      }

      setUploadStep(2)
      await api.post(`/documents/${documentId.current}/finish`)
      if (!mounted.current) return
      setSaved(true)
      navigate(`/loading/${documentId.current}`, { replace: true })
    } catch {
      setProcessing(null)
      setError('사진을 모두 저장하지 못했어요. 서버 연결을 확인하고 다시 눌러주세요.')
    } finally {
      busy.current = false
      setSaving(false)
    }
  }

  return (
    <main className="capture-app">
      <div className="camera-preview">
        <div className="camera-heading">
          <h1 className="camera-title">문서를 촬영해주세요</h1>
          <p className="camera-subtitle">빨간 네모 안에 종이를 맞춰주세요</p>
        </div>
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          aria-label="문서 촬영 카메라"
        />
        {!awaitingNext && detection.corners && (
          <svg className="document-outline" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
            <polygon points={detection.corners.map((point) => `${point.x},${point.y}`).join(' ')} />
          </svg>
        )}
        <div className="camera-overlay" aria-hidden="true">
          <div
            ref={guideRef}
            className={`a4-guide${!awaitingNext && detection.state === 'steady' ? ' is-ready' : ''}`}
          />
        </div>
        <div className="camera-photos" aria-label="촬영 안내와 장 수">
          <p className="camera-hint" role={error ? 'alert' : 'status'}>{error || cameraHint}</p>
          {status === 'on' && !showIntro && !awaitingNext && !error && (
            <progress className="capture-progress" value={detection.progress} max="1" aria-label="자동 촬영 준비" />
          )}
          <p className="camera-photo-count" role="status">{photos.length}장 찍었어요</p>
        </div>
        {showIntro && status === 'on' && (
          <CaptureIntro onComplete={() => setShowIntro(false)} />
        )}
        {processing && (
          <DocumentProcessing
            step={uploadStep}
            completed={processing === 'completed'}
            title="종이 보관 중"
            heading={'찍은 사진을\n보관하고 있어요'}
            steps={['문서 준비', '사진 저장', '분석 요청']}
            onStampFinished={() => setProcessing(null)}
          />
        )}
        <dialog
          ref={confirmationRef}
          className="capture-confirmation"
          aria-labelledby="capture-confirmation-title"
          onCancel={(event) => event.preventDefault()}
        >
          <h2 id="capture-confirmation-title">{photos.length}장 찍었어요</h2>
          {photos.length > 0 && (
            <img className="confirmation-thumbnail" src={photos[photos.length - 1].url} alt="방금 찍은 문서" />
          )}
          <div className="confirmation-actions">
            <button type="button" onClick={nextDocument}>다음 서류</button>
            <button type="button" onClick={finishCapture}>끝내기</button>
          </div>
        </dialog>
      </div>
      {error && photos.length > 0 && !saved && !captureConfirmation && (
        <button type="button" onClick={savePhotos} disabled={saving || capturing}>
          {saving ? '저장하는 중' : '다시 저장'}
        </button>
      )}
    </main>
  )
}