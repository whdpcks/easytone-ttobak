import { useEffect, useRef, useState } from 'react'
import { advanceStability, detectDocument } from './documentDetection'

let openCvPromise

function loadOpenCv() {
  if (window.cv?.Mat) return Promise.resolve({ cv: window.cv })
  if (openCvPromise) return openCvPromise
  openCvPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script')
    const timeout = setTimeout(() => {
      script.remove()
      reject(new Error('Document detector timed out'))
    }, 30000)
    script.src = `${import.meta.env.BASE_URL}vendor/opencv-4.13.0.js`
    script.async = true
    script.onload = () => {
      function ready(cv) {
        if (cv.Mat) {
          clearTimeout(timeout)
          // Some OpenCV builds expose a self-returning then() method.
          // A wrapper prevents Promise resolution from recursively awaiting it.
          resolve({ cv })
        } else {
          const previous = cv.onRuntimeInitialized
          cv.onRuntimeInitialized = () => {
            previous?.()
            clearTimeout(timeout)
            resolve({ cv })
          }
        }
      }
      if (window.cv instanceof Promise) window.cv.then(ready, reject)
      else ready(window.cv)
    }
    script.onerror = () => {
      clearTimeout(timeout)
      script.remove()
      reject(new Error('Document detector could not load'))
    }
    document.head.appendChild(script)
  }).catch((error) => {
    openCvPromise = undefined
    throw error
  })
  return openCvPromise
}

export default function useAutoCapture({ videoRef, guideRef, enabled, onCapture }) {
  const captureRef = useRef(onCapture)
  const [detection, setDetection] = useState({ state: 'loading', progress: 0 })

  useEffect(() => {
    captureRef.current = onCapture
  }, [onCapture])

  useEffect(() => {
    if (!enabled) return
    let stopped = false
    let timer
    let stable = null
    let previousVideoTime = -1
    let lastFrameAt = 0
    const canvas = document.createElement('canvas')
    const context = canvas.getContext('2d', { willReadFrequently: true })
    setDetection({ state: 'loading', progress: 0 })

    async function start() {
      try {
        const { cv } = await loadOpenCv()
        if (stopped) return

        function inspectFrame() {
          if (stopped) return
          const video = videoRef.current
          const guide = guideRef.current
          const now = performance.now()
          if (document.hidden || !video?.videoWidth || !guide || video.readyState < 2 || video.currentTime === previousVideoTime) {
            if (document.hidden || now - lastFrameAt > 600) {
              stable = null
              setDetection({ state: 'waiting', progress: 0, corners: null })
            }
            timer = setTimeout(inspectFrame, 180)
            return
          }
          previousVideoTime = video.currentTime
          lastFrameAt = now
          try {
            const preview = video.getBoundingClientRect()
            const frame = guide.getBoundingClientRect()
            // Match object-fit: cover, including the part of the camera cropped by the preview.
            const scale = Math.max(preview.width / video.videoWidth, preview.height / video.videoHeight)
            const sourceWidth = preview.width / scale
            const sourceHeight = preview.height / scale
            canvas.width = 384
            canvas.height = Math.round(384 * preview.height / preview.width)
            context.drawImage(video, (video.videoWidth - sourceWidth) / 2, (video.videoHeight - sourceHeight) / 2, sourceWidth, sourceHeight, 0, 0, canvas.width, canvas.height)
            const result = detectDocument(cv, context.getImageData(0, 0, canvas.width, canvas.height), {
              x: (frame.left - preview.left) / preview.width * canvas.width,
              y: (frame.top - preview.top) / preview.height * canvas.height,
              width: frame.width / preview.width * canvas.width,
              height: frame.height / preview.height * canvas.height,
            })
            stable = advanceStability(stable, result.state === 'ready' ? result.corners : null, performance.now(), canvas.width)
            setDetection({
              state: stable ? 'steady' : result.state,
              progress: stable?.progress ?? 0,
              corners: result.corners?.map((point) => ({
                x: point.x / canvas.width * 100,
                y: point.y / canvas.height * 100,
              })),
            })
            if (result.state === 'ready' && stable?.progress === 1) {
              // Stop this loop immediately; the confirmation UI explicitly rearms it.
              stopped = true
              captureRef.current()
              return
            }
            timer = setTimeout(inspectFrame, 180)
          } catch {
            setDetection({ state: 'error', progress: 0 })
          }
        }
        inspectFrame()
      } catch {
        if (!stopped) setDetection({ state: 'error', progress: 0 })
      }
    }
    start()
    return () => {
      stopped = true
      clearTimeout(timer)
    }
  }, [enabled, guideRef, videoRef])

  return detection
}
