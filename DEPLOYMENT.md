# Deployment

Die Admin-PWA ist eine **Vite-React-App** und wird statisch gebaut
(`npm run build` → `dist/`). Empfohlen: **Vercel** (wie die Website).

## Vercel
1. Repository importieren. Vercel erkennt Vite automatisch
   (`framework: vite`, Build `vite build`, Output `dist/`) – siehe `vercel.json`.
2. **Environment Variables** setzen (alle aus `.env.example`):
   `VITE_FIREBASE_*`, `VITE_FIREBASE_VAPID_KEY`, `VITE_GOOGLE_MAPS_API_KEY`.
3. Deploy. Das SPA-Rewrite in `vercel.json` leitet alle Routen auf `index.html`
   (Direktaufruf von `/anfragen/<id>` funktioniert), während Service Worker,
   Manifest und Icons direkt ausgeliefert werden.

## Wichtig
- Die vollständige Einrichtung (Firebase Auth, Security Rules, Push) steht in
  **[SETUP.md](./SETUP.md)**.
- Der Service Worker `firebase-messaging-sw.js` muss unter der Domain-Wurzel
  erreichbar sein (liegt in `public/`, wird von Vite nach `dist/` kopiert).
- HTTPS ist Pflicht (Push & PWA-Installation). Vercel liefert das automatisch.
