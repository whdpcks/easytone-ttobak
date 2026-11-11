import { useEffect, useRef, useState } from 'react'
import './documentProcessing.css'

const analysisSteps = ['글자 읽기', '중요한 곳 표시하기', '쉬운 말로 바꾸기']

export default function DocumentProcessing({
  step = 0,
  completed = false,
  title = '종이 읽는 중',
  heading = '중요한 곳에\n형광펜 칠하는 중',
  steps = analysisSteps,
  highlightCycleMs = 3600,
  onStampFinished,
}) {
  const [stampVisible, setStampVisible] = useState(false)
  const finishedRef = useRef(onStampFinished)
  useEffect(() => {
    finishedRef.current = onStampFinished
  }, [onStampFinished])

  useEffect(() => {
    setStampVisible(completed)
    if (!completed) return
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const timer = setTimeout(() => {
      setStampVisible(false)
      finishedRef.current?.()
    }, reduceMotion ? 200 : 2100)
    return () => clearTimeout(timer)
  }, [completed])

  const date = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Seoul' })
    .format(new Date()).replaceAll('-', '.')

  return (
    <section className="document-processing" aria-label={completed ? '보관 완료' : title}
      style={{ '--highlight-cycle': `${highlightCycleMs}ms` }}>
      <header className="processing-header">{completed ? '보관 완료' : title}</header>
      {completed ? (
        <div className="processing-completion">
          <h1 className="processing-heading">보관함에 넣었어요</h1>
          <p>찍은 사진을 보관했어요.</p>
        </div>
      ) : (
        <div className="processing-body">
          <div className="load-paper" aria-hidden="true">
            <div className="ln t" />
            <div className="ln hl" style={{ '--highlight-delay': '0ms' }} />
            <div className="ln" />
            <div className="ln hl" style={{ width: '80%', '--highlight-delay': `${highlightCycleMs / 4}ms` }} />
            <div className="ln" />
            <div className="ln hl" style={{ width: '65%', '--highlight-delay': `${highlightCycleMs / 2}ms` }} />
            <div className="ln" style={{ width: '50%' }} />
          </div>
          <h1 className="processing-heading">{heading}</h1>
          <ul className="processing-steps" aria-label="진행 단계">
            {steps.map((label, index) => (
              <li key={label} className={index < step ? 'done' : index === step ? 'now' : ''}
                aria-current={index === step ? 'step' : undefined}>
                <span className="dot" aria-hidden="true">
                  <svg viewBox="0 0 24 24"><path d="m5 12 4 4L19 6" /></svg>
                </span>
                {label}
              </li>
            ))}
          </ul>
        </div>
      )}
      <p className="processing-status" role="status">{completed ? '보관 완료' : steps[step]}</p>
      {completed && stampVisible && (
        <div className="processing-stamp" aria-hidden="true">
          <b>보관<br />완료</b>
          <span>{date}</span>
        </div>
      )}
    </section>
  )
}

// Only the preview simulates time. Production steps come from processing responses.
export function AnimationPreview() {
  const [run, setRun] = useState(0)
  const [step, setStep] = useState(0)
  const [completed, setCompleted] = useState(false)
  const [stepDurationMs, setStepDurationMs] = useState(1200)

  useEffect(() => {
    setStep(0)
    setCompleted(false)
    const timers = [
      setTimeout(() => setStep(1), stepDurationMs),
      setTimeout(() => setStep(2), stepDurationMs * 2),
      setTimeout(() => setStep(3), stepDurationMs * 3),
      setTimeout(() => setCompleted(true), stepDurationMs * 3 + 500),
    ]
    return () => timers.forEach(clearTimeout)
  }, [run, stepDurationMs])

  return (
    <main className="animation-preview">
      <div className="animation-preview-frame">
        <DocumentProcessing key={`${run}-${stepDurationMs}`} step={step} completed={completed} />
      </div>
      <div className="animation-preview-controls">
        <label>
          <span>단계 전환 간격 · {(stepDurationMs / 1000).toFixed(1)}초</span>
          <input type="range" min="500" max="5000" step="100" value={stepDurationMs}
            aria-label="단계 전환 간격"
            onChange={(event) => setStepDurationMs(Number(event.target.value))} />
        </label>
        <button type="button" onClick={() => setRun((value) => value + 1)}>다시 보기</button>
      </div>
    </main>
  )
}
