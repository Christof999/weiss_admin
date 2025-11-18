# Vercel Deployment Setup

## Environment Variable Name

**Variable Name:** `GOOGLE_MAPS_API_KEY`

## Schritt-für-Schritt Anleitung

### 1. Environment Variable in Vercel setzen

1. Gehe zu deinem Vercel Projekt
2. Klicke auf **"Settings"**
3. Gehe zu **"Environment Variables"**
4. Klicke auf **"Add New"**
5. Trage ein:
   - **Name:** `GOOGLE_MAPS_API_KEY`
   - **Value:** Dein Google Maps API Key (z.B. `AIzaSy...`)
   - **Environment:** Wähle alle aus:
     - ✅ Production
     - ✅ Preview
     - ✅ Development
6. Klicke auf **"Save"**

### 2. Optional: API_BASE_URL Variable (falls nötig)

Falls du eine andere API-URL verwenden möchtest:

- **Name:** `API_BASE_URL`
- **Value:** Deine API-URL
- **Environment:** Alle

### 3. Deployment

Das Build-Script (`build-config.js`) wird automatisch beim Deployment ausgeführt und erstellt `config.js` aus den Environment Variables.

### 4. HTTP-Referrer-Einschränkungen in Google Cloud Console

**WICHTIG:** Füge deine Vercel-Domain zu den HTTP-Referrer-Einschränkungen hinzu:

1. Gehe zu [Google Cloud Console](https://console.cloud.google.com/)
2. APIs & Services > Credentials
3. Öffne deinen API Key
4. Unter "Application restrictions" > "HTTP referrers (web sites)"
5. Füge hinzu:
   ```
   https://dein-projekt.vercel.app/*
   https://*.vercel.app/*
   ```
   (Ersetze `dein-projekt` mit deinem tatsächlichen Projektnamen)

### 5. Testen

Nach dem Deployment:
1. Öffne deine Vercel-URL
2. Prüfe in der Browser-Konsole, ob die Karte lädt
3. Falls Fehler: Prüfe, ob die Environment Variable korrekt gesetzt ist

## Troubleshooting

### Problem: Karte lädt nicht

**Lösung:**
1. Prüfe in Vercel: Settings > Environment Variables
2. Stelle sicher, dass `GOOGLE_MAPS_API_KEY` gesetzt ist
3. Prüfe die Build-Logs in Vercel (sollte "config.js wurde erfolgreich erstellt" zeigen)
4. Prüfe die Browser-Konsole auf Fehler

### Problem: "InvalidKeyMapError"

**Lösung:**
1. Prüfe, ob der API Key korrekt in Vercel eingetragen ist
2. Prüfe, ob HTTP-Referrer-Einschränkungen auf deine Vercel-Domain gesetzt sind
3. Prüfe, ob die Maps JavaScript API aktiviert ist

### Problem: Build schlägt fehl

**Lösung:**
1. Stelle sicher, dass Node.js im Build verfügbar ist (Vercel hat das standardmäßig)
2. Prüfe die Build-Logs in Vercel
3. Stelle sicher, dass `build-config.js` ausführbar ist

## Dateien

- `build-config.js` - Erstellt config.js aus Environment Variables
- `vercel.json` - Vercel-Konfiguration
- `config.js` - Wird beim Build automatisch erstellt (nicht committen!)

## Sicherheit

✅ `config.js` ist in `.gitignore` - wird nicht ins Git gepusht
✅ API Key wird nur als Environment Variable gespeichert
✅ Build-Script erstellt config.js nur beim Deployment
✅ HTTP-Referrer-Einschränkungen schützen vor Diebstahl

