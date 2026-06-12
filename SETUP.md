# Einrichtung – Weiß Forst GbR Admin-PWA

Diese Admin-App verwaltet **dieselben Daten wie die Website** (`wei-forstmain`):

- **Anfragen** → Firestore-Collection `contactRequests`
- **Galerie** → Firebase Storage (`gallery/` + Bucket-Root)

Stack: **React 18 + Vite 5**, **Firebase** (Auth, Firestore, Storage), Google Maps
(Arbeitsbereich-Editor), **natives Web Push (VAPID)** über Vercel-Serverless-Funktionen.

---

## 1. Lokale Entwicklung

```bash
npm install
cp .env.example .env      # Werte eintragen (siehe unten)
npm run dev               # http://localhost:5174
```

---

## 2. Umgebungsvariablen

**Frontend (`VITE_*`, im Browser sichtbar – nicht geheim):**

| Variable | Quelle |
|---|---|
| `VITE_FIREBASE_*` (6×) | Firebase Console → Projekteinstellungen → Web-App-Config. **Identisch zur Website.** |
| `VITE_PUSH_VAPID_PUBLIC_KEY` | Öffentlicher VAPID-Key (siehe §4.1) |
| `VITE_GOOGLE_MAPS_API_KEY` | Google Cloud Console → Anmeldedaten |

**Server / Vercel (geheim, NICHT mit `VITE_`):**

| Variable | Quelle |
|---|---|
| `FIREBASE_SERVICE_ACCOUNT_JSON` | **Empfohlen:** gesamtes Dienstkonto-JSON (einzeilig) – für `/api/push/notify` |
| `FIREBASE_PROJECT_ID` / `FIREBASE_CLIENT_EMAIL` / `FIREBASE_PRIVATE_KEY` | Alternative zu oben: Felder aus dem JSON einzeln |
| `PUSH_VAPID_PUBLIC_KEY` / `PUSH_VAPID_PRIVATE_KEY` | VAPID-Schlüsselpaar (siehe §4.1) |
| `PUSH_VAPID_SUBJECT` | z. B. `mailto:admin@weiss-forst.de` |
| `PUSH_API_TOKEN` | optional – gemeinsames Geheimnis für `/api/push/notify` |

In **Vercel** alle Variablen unter *Project → Settings → Environment Variables* anlegen.
`FIREBASE_PRIVATE_KEY` mit den `\n` exakt aus der JSON kopieren (in einfache
Anführungszeichen setzen, falls Vercel mehrzeilig zickt).

---

## 3. Firebase Console – einmalige Einrichtung

### 3.1 Authentifizierung (Admin-Login)
**Build → Authentication → Sign-in method → E-Mail/Passwort aktivieren**, dann unter
**Users** die Admin-Konten anlegen.

### 3.2 Firestore Security Rules
```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // Anfragen: Website darf absenden, nur Admins verwalten
    match /contactRequests/{id} {
      allow create: if true;
      allow read, update, delete: if request.auth != null;
    }

    // Öffentliche Website-Inhalte
    match /gallery/{id} { allow read: if true; allow write: if request.auth != null; }
    match /posts/{id}   { allow read: if true; allow write: if request.auth != null; }

    // Push-Subscriptions: eingeloggte Admins speichern ihr Gerät selbst;
    // Lesen/Versand nur serverseitig über Admin-SDK (/api/push/notify).
    match /adminPushSubscriptions/{id} {
      allow read: if false;
      allow create, update: if request.auth != null
        && request.resource.data.adminUid == request.auth.uid
        && request.resource.data.endpoint is string
        && request.resource.data.keys is map;
      allow delete: if request.auth != null && resource.data.adminUid == request.auth.uid;
    }
  }
}
```

### 3.3 Storage Security Rules
```
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /{allPaths=**} {
      allow read: if true;                    // Galerie öffentlich (auch listAll)
      allow write: if request.auth != null;   // Upload & Löschen nur eingeloggt
    }
  }
}
```

---

## 4. Web Push einrichten

Ansatz: **natives Web Push mit VAPID** – kein Firebase-Blaze-Plan, keine Cloud
Functions. Der Versand läuft über zwei Vercel-Funktionen:
- Die App speichert Geräte-Subscriptions direkt in Firestore (`adminPushSubscriptions`)
- `api/push/notify.js` – verschickt die Push an alle Admin-Geräte (Admin-SDK)

### 4.1 VAPID-Schlüsselpaar erzeugen
```bash
npx web-push generate-vapid-keys
```
→ `Public Key` in `VITE_PUSH_VAPID_PUBLIC_KEY` **und** `PUSH_VAPID_PUBLIC_KEY`,
`Private Key` in `PUSH_VAPID_PRIVATE_KEY`.

### 4.2 Admin-Gerät abonnieren
In der App auf das **Glocken-Symbol** / die **Push-Kachel** tippen → „Zulassen".
Das Gerät wird in `adminPushSubscriptions` gespeichert.

### 4.3 Auslöser: Website ruft `notify` auf
Die Anfrage entsteht auf der **Website**, daher muss diese nach dem Absenden
die Admin-Funktion anstoßen. In `wei-forstmain` in `submitContactRequest`
(`src/lib/firebase.js`) direkt nach dem `addDoc` ergänzen:

```js
const ref = await addDoc(collection(db, 'contactRequests'), {
  ...data, createdAt: serverTimestamp(), handled: false,
})
// Admins benachrichtigen (Fehler bewusst ignorieren)
fetch('https://<ADMIN-DOMAIN>/api/push/notify', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    // nur falls PUSH_API_TOKEN gesetzt ist:
    // Authorization: 'Bearer <PUSH_API_TOKEN>',
  },
  body: JSON.stringify({ id: ref.id }),
}).catch(() => {})
return ref
```

`notify` prüft, dass die Anfrage existiert und frisch ist (< 15 Min.), und sendet
dann an alle aktiven Admin-Geräte. Abgelaufene Subscriptions werden automatisch
deaktiviert.

### 4.4 In-App-Popup (App geöffnet)
Funktioniert unabhängig von allem oben über das Firestore-Live-Abo (`onSnapshot`)
inkl. Ton – sobald ein Admin die App offen hat.

### iOS-Hinweis
Web Push funktioniert auf iPhone/iPad nur, wenn die PWA über „Zum Home-Bildschirm
hinzufügen" installiert und **aus dem Icon** geöffnet wurde (iOS ≥ 16.4).

---

## 5. Google Maps
Google Cloud Console: **Maps JavaScript API** aktivieren. Key per HTTP-Referrer auf
die Admin-Domain einschränken. Fehlt der Key, bleibt die App nutzbar (Karte zeigt
einen Hinweis).

---

## 6. Deployment (Vercel)
Vite wird automatisch erkannt; `api/`-Funktionen werden als Serverless Functions
deployt. SPA-Rewrites und der Ausschluss von `/api` stehen in `vercel.json`.
Details siehe **DEPLOYMENT.md**.
