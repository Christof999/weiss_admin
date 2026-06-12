# Sicherheit

## Authentifizierung
Die App nutzt **Firebase Authentication** (E-Mail/Passwort). Die frühere
clientseitige Klartext-Anmeldung wurde vollständig entfernt. Konten werden in
der Firebase Console verwaltet (siehe [SETUP.md](./SETUP.md) §3.1).

## Zugriffskontrolle
Der eigentliche Schutz liegt in den **Firestore- und Storage-Security-Rules**
(SETUP.md §3.2/§3.3), nicht im Client:
- Öffentliche Website darf Anfragen nur **erstellen** und Inhalte **lesen**.
- **Lesen/Ändern/Löschen** von Anfragen sowie **Upload/Löschen** von Bildern
  ist ausschließlich authentifizierten Admins erlaubt.

## API-Keys
- Die `VITE_FIREBASE_*`-Werte sind bei Firebase-Web-Apps öffentlich und nicht
  geheim – Sicherheit kommt über die Rules.
- Der **Google-Maps-API-Key** ist im Browser sichtbar. Er muss in der Google
  Cloud Console per **HTTP-Referrer auf die Admin-Domain eingeschränkt** und auf
  die *Maps JavaScript API* begrenzt werden.

## Secrets im Repo
`.env` ist über `.gitignore` ausgeschlossen. Niemals echte Werte committen –
ausschließlich `.env.example` als Vorlage pflegen.
