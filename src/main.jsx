import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'

import './styles/tokens.css'
import './styles/base.css'
import './styles/app.css'

import { registerMessagingServiceWorker } from './lib/messaging'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// Service Worker registrieren (PWA-Installation, Offline-Cache, Background-Push).
// Die Push-Berechtigung wird separat & bewusst über den Button angefragt.
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    registerMessagingServiceWorker().catch(() => {})
  })
}
