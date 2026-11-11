import { useEffect, useRef, useState } from 'react'
import './capture.css'
import useAutoCapture from './useAutoCapture'

export default function App() {
  const videoRef = useRef(null)
  const guideRef = useRef(null)
  const [autoCapture, setAutoCapture] = useState(true)
  const [awaitingNext, setAwaitingNext] = useState(false)
  const [status, setStatus] = useState('off')
  const [error, setError] = useState('')

  const [photos, setPhotos] = useState([])
  const [capturing, setCapturing] = useState(false)
  const photoUrls = useRef([])
  const documentId = useRef(null)
  const uploadedPhotos = useRef(new Set())
  const busy = useRef(false)
  const mounted = useRef(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    const video = videoRef.current
    mounted.current = true

    return () => {
      mounted.current = false
      // 화면을 나가면 카메라와 사진 미리보기 자원을 정리한다.
      video?.srcObject?.getTracks().forEach((track) => track.stop())
      photoUrls.current.forEach((url) => URL.revokeObjectURL(url))
    }
  }, [])

  async function startCamera() {
    const video = videoRef.current
    setStatus('opening')
    setError('')

    try {
      // 브라우저에 카메라 영상을 요청한다.
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 2560 },
          height: { ideal: 1920 },
        },
        audio: false,
      })

      if (videoRef.current !== video) {
        stream.getTracks().forEach((track) => track.stop())
        return
      }

      // 받은 영상을 화면의 video 요소에 연결한다.
      video.srcObject = stream
      setStatus('on')
    } catch (err) {
      console.error(err)
      setStatus('off')
      setError('카메라를 열 수 없어요. 브라우저의 카메라 권한을 확인해주세요.')
    }
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
        { blob, url, width: canvas.width, height: canvas.height },
      ])
      setSaved(false)
      setAwaitingNext(true)
    }, 'image/jpeg', 0.95)
  }

  const detection = useAutoCapture({
    videoRef,
    guideRef,
    enabled: status === 'on' && autoCapture && !awaitingNext && !saving && !capturing,
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
    error: '자동 촬영을 준비하지 못했어요. 직접 찍기를 눌러주세요.',
  }
  let cameraHint = '카메라를 켜고 종이를 빨간 테두리 안에 맞춰주세요.'
  if (status === 'on') cameraHint = autoCapture ? hints[detection.state] : '종이를 맞추고 직접 찍기를 눌러주세요.'
  if (capturing) cameraHint = '사진을 찍고 있어요.'
  if (awaitingNext && !capturing) cameraHint = '찍었어요. 다음 종이를 준비하고 다음 서류를 눌러주세요.'

  async function savePhotos() {
    if (photos.length === 0 || busy.current || saved) return

    busy.current = true
    setSaving(true)
    setError('')

    try {
      // 여러 장을 같은 문서에 저장할 수 있도록 문서 번호를 기억한다.
      if (documentId.current === null) {
        const response = await fetch('/documents', { method: 'POST' })
        if (!response.ok) throw new Error('문서를 만들지 못했어요.')
        const { id } = await response.json()
        documentId.current = id
      }

      for (const [index, photo] of photos.entries()) {
        // 저장 완료 응답을 받은 사진은 다음 저장에서 건너뛴다.
        if (uploadedPhotos.current.has(photo.url)) continue

        const form = new FormData()
        form.append('file', photo.blob, `capture-${index + 1}.jpg`)
        const response = await fetch(`/documents/${documentId.current}/pages`, {
          method: 'POST',
          body: form,
        })
        if (!response.ok) throw new Error('사진을 저장하지 못했어요.')
        uploadedPhotos.current.add(photo.url)
      }

      setSaved(true)
    } catch {
      setError('사진을 모두 저장하지 못했어요. 서버 연결을 확인하고 다시 눌러주세요.')
    } finally {
      busy.current = false
      setSaving(false)
    }
  }

  return (
    <main>
      <h1>문서 촬영</h1>
      <button type="button" onClick={startCamera} disabled={status !== 'off'}>
        {{ off: '카메라 켜기', opening: '카메라 여는 중', on: '카메라 켜짐' }[status]}
      </button>
      {error && <p role="alert">{error}</p>}
      <div className="camera-preview">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          aria-label="문서 촬영 카메라"
        />
        {autoCapture && !awaitingNext && detection.corners && (
          <svg className="document-outline" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
            <polygon points={detection.corners.map((point) => `${point.x},${point.y}`).join(' ')} />
          </svg>
        )}
        <div className="camera-overlay" aria-hidden="true">
          <div
            ref={guideRef}
            className={`a4-guide${autoCapture && !awaitingNext && detection.state === 'steady' ? ' is-ready' : ''}`}
          />
        </div>
      </div>
      <p className="camera-hint" role="status">{cameraHint}</p>
      {status === 'on' && autoCapture && !awaitingNext && (
        <progress className="capture-progress" value={detection.progress} max="1" aria-label="자동 촬영 준비" />
      )}
      <div className="capture-controls">
        <label>
          <input type="checkbox" checked={autoCapture} onChange={(event) => setAutoCapture(event.target.checked)} />
          자동 촬영
        </label>
        {awaitingNext && (
          <button type="button" onClick={() => setAwaitingNext(false)} disabled={saving || capturing}>
            다음 서류
          </button>
        )}
      </div>
      <button type="button" onClick={takePhoto} disabled={status !== 'on' || saving || capturing}>
        직접 찍기
      </button>

      <p role="status">{photos.length}장 찍었어요</p>
      {photos.length > 0 && (
        <section aria-label="찍은 사진">
          {photos.map((photo, index) => (
            <div key={photo.url}>
              <img
                src={photo.url}
                alt={`찍은 문서 ${index + 1}장째`}
                style={{ width: '100%', maxWidth: 240 }}
              />
              <p>{index + 1}장째 · {photo.width} × {photo.height}px</p>
            </div>
          ))}
          <button
            type="button"
            onClick={savePhotos}
            disabled={saving || saved || capturing}
          >
            {saving ? '저장하는 중' : saved ? '사진 저장 완료' : '사진 모두 저장'}
          </button>
        </section>
      )}
    </main>
  )
}