# Deployment-Anleitung

## Sicherer Umgang mit dem Google Maps API Key

### Wichtig: Der API Key wird immer im Browser sichtbar sein

Da dies eine **clientseitige JavaScript-Anwendung** ist, wird der Google Maps API Key immer im Browser-Code sichtbar sein. Das ist **normal und akzeptabel**, wenn du die richtigen Sicherheitsmaßnahmen ergreifst.

### ✅ Sicherheitsmaßnahmen (MUSS durchgeführt werden!)

#### 1. HTTP-Referrer-Einschränkungen einrichten

**Das ist die wichtigste Sicherheitsmaßnahme!**

1. Gehe zu [Google Cloud Console](https://console.cloud.google.com/)
2. Navigiere zu **"APIs & Services"** > **"Credentials"**
3. Klicke auf deinen API Key
4. Unter **"Application restrictions"** wähle **"HTTP referrers (web sites)"**
5. Füge deine Domains hinzu:
   ```
   https://deine-domain.de/*
   https://www.deine-domain.de/*
   ```
6. Für lokale Entwicklung (optional):
   ```
   http://127.0.0.1:5500/*
   http://localhost:*/*
   ```
7. **Speichern**

**Wichtig:** Ohne diese Einschränkungen kann jeder deinen API Key von deiner Website kopieren und auf seiner eigenen Website verwenden!

#### 2. API-Einschränkungen

1. In der Google Cloud Console unter deinem API Key
2. Unter **"API restrictions"** wähle **"Restrict key"**
3. Aktiviere nur diese APIs:
   - ✅ Maps JavaScript API
   - ✅ Maps Drawing Library
4. **Speichern**

#### 3. Quotas und Monitoring

1. Setze **Quotas** für deinen API Key, um Kosten zu begrenzen
2. Aktiviere **Monitoring**, um ungewöhnliche Nutzung zu erkennen

### 📦 Deployment-Optionen

#### Option 1: Statisches Hosting (z.B. GitHub Pages, Netlify, Vercel)

1. **Vor dem Deployment:**
   - Stelle sicher, dass `config.js` in `.gitignore` ist ✅ (bereits erledigt)
   - Erstelle `config.js` auf dem Server mit deinem API Key
   - Oder verwende **Environment Variables** (siehe unten)

2. **Mit Environment Variables (empfohlen):**
   
   **Netlify:**
   - Gehe zu Site Settings > Environment Variables
   - Füge `GOOGLE_MAPS_API_KEY` hinzu
   - Erstelle ein Build-Script, das die Variable in `config.js` einfügt
   
   **Vercel:**
   - Gehe zu Project Settings > Environment Variables
   - Füge `GOOGLE_MAPS_API_KEY` hinzu
   - Verwende ein Build-Script

   **GitHub Pages:**
   - Erstelle `config.js` manuell auf dem Server
   - Oder verwende GitHub Actions mit Secrets

3. **Wichtig:** Setze HTTP-Referrer-Einschränkungen auf deine Domain!

#### Option 2: Eigener Webserver

1. Lade alle Dateien auf deinen Server hoch
2. Erstelle `config.js` direkt auf dem Server mit deinem API Key
3. Stelle sicher, dass `config.js` nicht öffentlich zugänglich ist (optional, aber nicht notwendig, wenn Referrer-Einschränkungen gesetzt sind)
4. Setze HTTP-Referrer-Einschränkungen auf deine Domain

### 🔒 Checkliste vor dem Deployment

- [ ] Neuer API Key erstellt (nicht der alte aus SECURITY.md verwenden!)
- [ ] HTTP-Referrer-Einschränkungen auf deine Domain gesetzt
- [ ] API-Einschränkungen aktiviert (nur Maps JavaScript API + Drawing Library)
- [ ] Quotas gesetzt (optional, aber empfohlen)
- [ ] `config.js` ist in `.gitignore` (✅ bereits erledigt)
- [ ] `config.js` wird nicht ins Git gepusht (✅ bereits erledigt)
- [ ] `config.js` auf dem Server mit dem richtigen API Key vorhanden

### ⚠️ Was NICHT funktioniert

- ❌ Den API Key im Code zu verstecken (er ist immer im Browser sichtbar)
- ❌ Den API Key auf dem Server zu speichern (die App läuft clientseitig)
- ❌ Den API Key zu verschlüsseln (der Browser muss ihn entschlüsseln können)

### ✅ Was funktioniert

- ✅ HTTP-Referrer-Einschränkungen (verhindert Diebstahl)
- ✅ API-Einschränkungen (begrenzt Schaden bei Diebstahl)
- ✅ Quotas (begrenzt Kosten bei Missbrauch)
- ✅ Monitoring (erkennt Missbrauch frühzeitig)

### 🆘 Falls der Key kompromittiert wurde

1. Gehe sofort zur Google Cloud Console
2. Lösche den kompromittierten Key
3. Erstelle einen neuen Key
4. Setze sofort die Einschränkungen
5. Aktualisiere `config.js` auf dem Server

### 📝 Beispiel: Build-Script für Environment Variables

Falls du Environment Variables verwenden möchtest, kannst du ein Build-Script erstellen:

```bash
#!/bin/bash
# build.sh

# Erstelle config.js aus Environment Variable
cat > config.js << EOF
window.Config = {
    API_BASE_URL: "${API_BASE_URL:-https://ilxyp19ev8.execute-api.eu-central-1.amazonaws.com/test1}",
    AUTH_TOKEN_KEY: "weiss_forst_auth_token",
    AUTH_EXPIRY_KEY: "weiss_forst_auth_expiry",
    LOGIN_PAGE: "index.html",
    GOOGLE_MAPS_API_KEY: "${GOOGLE_MAPS_API_KEY}"
};
EOF

echo "config.js wurde erstellt"
```

Dann in deiner CI/CD-Pipeline:
```bash
export GOOGLE_MAPS_API_KEY="dein-key-hier"
./build.sh
```

