# Sicherheitshinweise

## Google Maps API Key

Der Google Maps API Key wurde aus dem öffentlichen Code entfernt und in `config.js` verschoben.

### WICHTIG - Sofortige Maßnahmen:

1. **Key in Google Cloud Console neu generieren oder Berechtigungen einschränken:**
   - Gehe zu [Google Cloud Console](https://console.cloud.google.com/)
   - Navigiere zu "APIs & Services" > "Credentials"
   - Finde deinen API Key: `AIzaSyBC1ROorGCf3g3ja3wlTLF6oYuEb1pio8I`
   - **Option 1:** Key löschen und einen neuen erstellen
   - **Option 2:** HTTP-Referrer-Einschränkungen hinzufügen (empfohlen)
     - Füge nur deine Domain hinzu (z.B. `https://deine-domain.de/*`)
     - Oder deine lokale Entwicklungs-URL (z.B. `http://127.0.0.1:5500/*`)

2. **config.js nicht ins Git committen:**
   - `config.js` ist bereits in `.gitignore` eingetragen
   - Verwende `config.example.js` als Vorlage
   - Erstelle lokal eine `config.js` mit deinem eigenen Key

3. **Für neue Entwickler:**
   - Kopiere `config.example.js` zu `config.js`
   - Füge deinen eigenen Google Maps API Key ein

### Key aus Git-Historie entfernen (optional):

Falls der Key bereits im Git-Repository committed wurde, sollte er aus der Historie entfernt werden:

```bash
# WICHTIG: Dies überschreibt die Git-Historie!
# Nur ausführen, wenn das Repository nicht von anderen verwendet wird!

git filter-branch --force --index-filter \
  "git rm --cached --ignore-unmatch config.js" \
  --prune-empty --tag-name-filter cat -- --all

# Danach force-push (VORSICHT!)
git push origin --force --all
```

**Besser:** Einfach den Key in Google Cloud Console neu generieren - das ist sicherer!

