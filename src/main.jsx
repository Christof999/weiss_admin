import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'

import './styles/tokens.css'
import './styles/base.css'
import './styles/app.css'

import { registerServiceWorker } from './lib/push'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// Service Worker registrieren (PWA-Installation, Offline-Cache, Web Push).
// Die Push-Berechtigung wird separat & bewusst über den Button angefragt.
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    registerServiceWorker().catch(() => {})
  })
}
