# API Gateway Konfiguration für Posts-Update

## Übersicht

Die Lambda-Funktion unterstützt jetzt:
- ✅ **GET /posts** - Alle Posts abrufen (bestehend)
- ✅ **GET /posts/{id}** - Einzelnen Post abrufen (NEU)
- ✅ **POST /posts** - Neuen Post erstellen (bestehend)
- ✅ **PUT /posts/{id}** - Post aktualisieren (NEU)
- ✅ **POST /posts/{id}** - Post aktualisieren (NEU, Fallback)

## API Gateway Konfiguration

### 1. Ressourcen-Struktur

Erstelle folgende Ressourcen-Struktur in API Gateway:

```
/posts
  ├── GET (alle Posts)
  ├── POST (neuer Post)
  └── {id}
      ├── GET (einzelner Post)
      ├── PUT (Update)
      └── POST (Update, Fallback)
```

### 2. Schritt-für-Schritt Anleitung

#### Schritt 1: Basis-Ressource `/posts`

**GET /posts**
- Methode: GET
- Integration: Lambda-Funktion
- Lambda-Funktion: `lambda_function_posts` (oder dein Funktionsname)

**POST /posts**
- Methode: POST
- Integration: Lambda-Funktion
- Lambda-Funktion: `lambda_function_posts`

#### Schritt 2: Unter-Ressource `/posts/{id}`

1. Erstelle eine neue Ressource unter `/posts`
2. Ressourcenname: `{id}`
3. Pfad: `{id}`

**GET /posts/{id}**
- Methode: GET
- Integration: Lambda-Funktion
- Lambda-Funktion: `lambda_function_posts`
- **WICHTIG:** Aktiviere "Use Lambda Proxy integration"

**PUT /posts/{id}**
- Methode: PUT
- Integration: Lambda-Funktion
- Lambda-Funktion: `lambda_function_posts`
- **WICHTIG:** Aktiviere "Use Lambda Proxy integration"

**POST /posts/{id}** (optional, als Fallback)
- Methode: POST
- Integration: Lambda-Funktion
- Lambda-Funktion: `lambda_function_posts`
- **WICHTIG:** Aktiviere "Use Lambda Proxy integration"

#### Schritt 3: CORS konfigurieren

Für jede Methode (GET, POST, PUT) unter `/posts` und `/posts/{id}`:

1. Klicke auf die Methode
2. Klicke auf "Actions" → "Enable CORS"
3. Konfiguration:
   - **Access-Control-Allow-Origin:** `*` (oder spezifisch: `http://127.0.0.1:5500`)
   - **Access-Control-Allow-Headers:** `Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token`
   - **Access-Control-Allow-Methods:** `GET,POST,PUT,OPTIONS`
4. Klicke auf "Enable CORS and replace existing CORS headers"

#### Schritt 4: OPTIONS-Methode

Die Lambda-Funktion behandelt OPTIONS automatisch, aber du kannst auch eine explizite OPTIONS-Methode erstellen:

**OPTIONS /posts**
- Methode: OPTIONS
- Integration: Mock
- Mock Response:
  ```json
  {
    "statusCode": 200
  }
  ```
- Method Response Headers:
  - `Access-Control-Allow-Origin`
  - `Access-Control-Allow-Methods`
  - `Access-Control-Allow-Headers`

**OPTIONS /posts/{id}**
- Gleiche Konfiguration wie oben

### 3. Deployment

Nach der Konfiguration:
1. Klicke auf "Actions" → "Deploy API"
2. Wähle deine Stage (z.B. `prod` oder `test1`)
3. Klicke auf "Deploy"

### 4. Testen

Teste die Endpunkte:

```bash
# Alle Posts abrufen
curl https://deine-api.execute-api.eu-central-1.amazonaws.com/prod/posts

# Einzelnen Post abrufen
curl https://deine-api.execute-api.eu-central-1.amazonaws.com/prod/posts/post-123

# Post aktualisieren (PUT)
curl -X PUT https://deine-api.execute-api.eu-central-1.amazonaws.com/prod/posts/post-123 \
  -H "Content-Type: application/json" \
  -d '{"title":"Neuer Titel","text":"Neuer Text"}'

# Post aktualisieren (POST als Fallback)
curl -X POST https://deine-api.execute-api.eu-central-1.amazonaws.com/prod/posts/post-123 \
  -H "Content-Type: application/json" \
  -d '{"title":"Neuer Titel","text":"Neuer Text"}'
```

## Wichtige Hinweise

1. **Lambda Proxy Integration:** Muss für alle Methoden aktiviert sein, damit `event.pathParameters` verfügbar ist.

2. **CORS:** Stelle sicher, dass CORS für alle Methoden konfiguriert ist, sonst funktioniert das Frontend nicht.

3. **Umgebungsvariable:** Die Lambda-Funktion verwendet `process.env.TABLE_NAME`. Stelle sicher, dass diese Variable gesetzt ist:
   - Tabellenname: `weissforstgbr-posts` (oder dein Tabellenname)

4. **UUID-Paket:** Die Lambda-Funktion verwendet `uuid`. Stelle sicher, dass das Paket im Lambda-Layer oder im Deployment-Paket enthalten ist.

## Troubleshooting

**Problem:** Pfad-Parameter werden nicht erkannt
- Lösung: Aktiviere "Lambda Proxy Integration" für die Methode

**Problem:** CORS-Fehler
- Lösung: Stelle sicher, dass CORS für alle Methoden konfiguriert ist und OPTIONS-Methode existiert

**Problem:** 404-Fehler bei Updates
- Lösung: Prüfe, ob die Ressource `/posts/{id}` korrekt erstellt wurde

**Problem:** Post wird nicht aktualisiert, sondern neu erstellt
- Lösung: Stelle sicher, dass die ID im Pfad-Parameter übergeben wird, nicht nur im Body

