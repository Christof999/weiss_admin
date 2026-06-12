# Einrichtung – Weiß Forst GbR Admin-PWA

Diese Admin-App verwaltet **dieselben Daten wie die Website** (`wei-forstmain`):

- **Anfragen** → Firestore-Collection `contactRequests`
- **Galerie** → Firebase Storage (`gallery/` + Bucket-Root)

Stack: **React 18 + Vite 5**, **Firebase** (Auth, Firestore, Storage, Cloud Messaging),
Google Maps (Arbeitsbereich-Editor). PWA mit Web-Push.

---

## 1. Lokale Entwicklung

```bash
npm install
cp .env.example .env      # Werte eintragen (siehe unten)
npm run dev               # http://localhost:5174
```

Build & Vorschau:

```bash
npm run build
npm run preview
```

---

## 2. Umgebungsvariablen (`.env`)

Alle `VITE_*`-Werte sind im Browser sichtbar – das ist bei Firebase-Web-Apps
normal. Die Sicherheit beruht auf **Firebase Auth + Security Rules**, nicht auf
geheimen Keys.

| Variable | Quelle |
|---|---|
| `VITE_FIREBASE_API_KEY` … `VITE_FIREBASE_APP_ID` | Firebase Console → Projekteinstellungen → „Allgemein" → Web-App-Config. **Identisch zur Website.** |
| `VITE_FIREBASE_VAPID_KEY` | Firebase Console → Projekteinstellungen → **Cloud Messaging** → „Web-Konfiguration" → Schlüsselpaar generieren (Public Key) |
| `VITE_GOOGLE_MAPS_API_KEY` | Google Cloud Console → APIs & Dienste → Anmeldedaten |

In **Vercel** dieselben Variablen unter *Project → Settings → Environment Variables* anlegen.

---

## 3. Firebase Console – einmalige Einrichtung

### 3.1 Authentifizierung (Admin-Login)
1. **Build → Authentication → Sign-in method → E-Mail/Passwort aktivieren**.
2. Unter **Users** die Admin-Konten anlegen (z. B. `lukas@weiss-forst.de`,
   `christof@weiss-forst.de`) inkl. Passwort. Diese Logins ersetzen die alte,
   unsichere Klartext-Anmeldung.

### 3.2 Firestore Security Rules
Die Website darf nur Anfragen **erstellen**; lesen/ändern/löschen ist
Admins (eingeloggten Nutzern) vorbehalten:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{db}/documents {

    // Anfragen: jeder darf absenden, nur Admins verwalten
    match /contactRequests/{id} {
      allow create: if true;
      allow read, update, delete: if request.auth != null;
    }

    // Öffentliche Inhalte (von der Website gelesen)
    match /posts/{id}   { allow read: if true; allow write: if request.auth != null; }
    match /gallery/{id} { allow read: if true; allow write: if request.auth != null; }

    // FCM-Tokens der Admins (nur eingeloggt)
    match /adminTokens/{id} { allow read, write: if request.auth != null; }
  }
}
```

> Optional härter: statt `request.auth != null` eine feste Admin-UID-Liste prüfen,
> z. B. `request.auth.uid in ['UID1','UID2']`.

### 3.3 Storage Security Rules
Bilder sind öffentlich lesbar (Website), Upload/Löschen nur für Admins:

```
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /{allPaths=**} {
      allow read: if true;
      allow write: if request.auth != null;   // Upload & Löschen nur eingeloggt
    }
  }
}
```

---

## 4. Echte Push-Benachrichtigungen (App geschlossen)

Das **In-App-Popup** bei neuen Anfragen funktioniert sofort (Firestore-Live-Abo),
solange die App geöffnet ist. Für echte Push-Notifications, **auch wenn die App
geschlossen ist**, braucht es eine Cloud Function, die bei neuen
`contactRequests` eine FCM-Nachricht sendet.

### 4.1 VAPID-Key
Siehe `VITE_FIREBASE_VAPID_KEY` oben. Ohne diesen Key bleibt der „Push
aktivieren"-Button wirkungslos (In-App-Popup funktioniert trotzdem).

### 4.2 Cloud Function (Blaze-Plan erforderlich)
Ein fertiges Beispiel liegt in [`cloud-functions/index.js`](./cloud-functions/index.js).
Es sendet bei jeder neuen Anfrage eine Push an das Topic **`neue-anfragen`**.

Deployment:

```bash
cd cloud-functions
npm install
firebase deploy --only functions
```

Die Admin-App abonniert das Topic automatisch nicht clientseitig (Web-FCM nutzt
Tokens). Zwei einfache Optionen:

- **Topic-Abo serverseitig**: beim Login-Token einmalig per Admin-SDK
  `messaging().subscribeToTopic(token, 'neue-anfragen')` aufrufen, oder
- **Direktversand an gespeicherte Tokens**: Tokens in einer Collection
  `adminTokens` ablegen und die Function an alle Tokens senden.

Die Client-Seite holt den Token bereits über „Push aktivieren" (`enablePush`).
Wer es einfach halten will, speichert diesen Token in `adminTokens` – die
Beispiel-Function unterstützt beide Wege (siehe Kommentare im Code).

---

## 5. Google Maps (Arbeitsbereich-Editor)
In der Google Cloud Console aktivieren: **Maps JavaScript API**. Die Bibliotheken
`drawing` und `geometry` werden vom Client geladen. Den API-Key per
**HTTP-Referrer** (deine Domain) einschränken.

Fehlt der Key, bleibt die App voll funktionsfähig – nur die Kartenfläche zeigt
einen Hinweis und Arbeitsbereiche werden als Liste verwaltet.

---

## 6. PWA / Homescreen
Die App ist installierbar (`manifest.webmanifest`, Service Worker
`firebase-messaging-sw.js`). Auf iOS: Safari → Teilen → „Zum Home-Bildschirm".
Auf Android/Chrome erscheint automatisch ein Installations-Hinweis.
