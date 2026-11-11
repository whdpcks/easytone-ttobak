import { useEffect, useRef, useState } from 'react'

export default function App() {
  const videoRef = useRef(null)
  const [status, setStatus] = useState('off')
  const [error, setError] = useState('')

  const [photo, setPhoto] = useState(null)

  useEffect(() => {
    return () => {
      if (photo) URL.revokeObjectURL(photo.url)
    }
  }, [photo])

  useEffect(() => {
    const video = videoRef.current

    return () => {
      // 화면을 나가면 카메라 사용을 멈춘다.
      video?.srcObject?.getTracks().forEach((track) => track.stop())
    }
  }, [])

  async function startCamera() {
    const video = videoRef.current
    setStatus('opening')
    setError('')

    try {
      // 브라우저에 카메라 영상을 요청한다.
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
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

  // 복사한 화면을 JPEG로 만들고 미리보기 주소를 만든다.
  canvas.toBlob((blob) => {
    if (!blob) {
      setError('사진을 찍지 못했어요. 다시 눌러주세요.')
      return
    }

    setPhoto({
      blob,
      url: URL.createObjectURL(blob),
      width: canvas.width,
      height: canvas.height,
    })
  }, 'image/jpeg', 0.95)
}

  return (
    <main>
      <h1>문서 촬영</h1>
      <button type="button" onClick={startCamera} disabled={status !== 'off'}>
        {{ off: '카메라 켜기', opening: '카메라 여는 중', on: '카메라 켜짐' }[status]}
      </button>
      {error && <p role="alert">{error}</p>}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        style={{ display: 'block', width: '100%', maxWidth: 480 }}
      />
      <button type="button" onClick={takePhoto} disabled={status !== 'on'}>
       찍기
      </button>

      {photo && (
        <section>
          <h2>1장 찍었어요</h2>
          <img src={photo.url} alt="찍은 문서" style={{ width: '100%', maxWidth: 480 }} />
          <p>사진 크기 {photo.width} × {photo.height}px</p>
       </section>
)}
    </main>
  )
}