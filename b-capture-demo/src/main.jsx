import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { AnimationPreview } from './DocumentProcessing.jsx'

const previewAnimation = new URLSearchParams(window.location.search).get('preview') === 'analysis'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    {previewAnimation ? <AnimationPreview /> : <App />}
  </StrictMode>,
)
