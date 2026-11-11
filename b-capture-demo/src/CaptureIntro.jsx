import { useEffect, useRef, useState } from 'react'

export default function CaptureIntro({ onComplete }) {
  const completeRef = useRef(onComplete)
  const [leaving, setLeaving] = useState(false)

  useEffect(() => {
    completeRef.current = onComplete
  }, [onComplete])

  useEffect(() => {
    const fadeTimer = setTimeout(() => setLeaving(true), 2600)
    const finishTimer = setTimeout(() => completeRef.current(), 3000)
    return () => {
      clearTimeout(fadeTimer)
      clearTimeout(finishTimer)
    }
  }, [])

  return (
    <section className={`capture-intro${leaving ? ' is-leaving' : ''}`} aria-label="촬영 방법 안내">
      <div className="intro-stage" aria-hidden="true">
        <div className="intro-paper"><i /><i /><i /><i /></div>
        <div className="intro-phone" />
        <div className="intro-flash" />
      </div>
      <h2>종이 위에서<br />이렇게 찍어요</h2>
      <p>종이를 평평한 곳에 놓고,<br />휴대폰을 위에서 들어주세요.</p>
      <button type="button" onClick={onComplete}>건너뛰기</button>
    </section>
  )
}
