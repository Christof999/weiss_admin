# Weiß Forst GbR – Admin PWA

Installierbare Admin-App (PWA) zur Verwaltung der [Weiß Forst GbR](https://www.xn--wei-forst-i1a.de)
Website. Verwaltet **dieselben Daten wie die Website** über Firebase.

**Stack:** React 18 · Vite 5 · Firebase (Auth · Firestore · Storage · Cloud Messaging) ·
Google Maps · React Router · lucide-react

## Funktionen
- **Anfragen verwalten** – Live-Liste aus Firestore `contactRequests`, Filter/Suche,
  Status (neu / in Bearbeitung / erledigt), Bearbeiter, Termin, interne Notizen.
- **Arbeitsbereiche** – robuster Karten-Editor (Polygone zeichnen, bearbeiten,
  benennen, löschen) pro Anfrage.
- **Galerie** – Bilder aus Firebase Storage anzeigen, per Drag-&-Drop/Mehrfachauswahl
  hochladen und löschen.
- **Benachrichtigungen** – sofortiges In-App-Popup bei neuer Anfrage (Live-Abo) plus
  echte **Web-Push-Notifications** via FCM (App geschlossen).
- **PWA** – Homescreen-Installation, Offline-App-Shell, Design der Website
  (Waldgrün-Palette, Fraunces/Inter).
- **Login** – Firebase Authentication (ersetzt die alte unsichere Anmeldung).

## Schnellstart
```bash
npm install
cp .env.example .env     # Firebase-/Maps-Werte eintragen
npm run dev
```

➡️ Vollständige Einrichtung (Firebase Console, Security Rules, Push, Deployment):
**[SETUP.md](./SETUP.md)** · **[DEPLOYMENT.md](./DEPLOYMENT.md)** · **[SECURITY.md](./SECURITY.md)**

## Projektstruktur
```
src/
  lib/         firebase.js (Daten), messaging.js (Push), utils.js
  context/     AuthContext, NotificationContext (Live-Anfragen + Popups)
  components/  Layout, ArbeitsbereichEditor, Toasts, NewRequestPopup …
  pages/       Login, Dashboard, Anfragen, AnfrageDetail, Galerie
  styles/      tokens.css (Design-System der Website), base.css, app.css
public/
  firebase-messaging-sw.js   Service Worker (Push + Offline-Cache)
  manifest.webmanifest, icons/
cloud-functions/             Beispiel-Cloud-Function für Background-Push
```
