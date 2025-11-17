# Implementierungsleitfaden für die Verbesserung der Arbeitsbereiche

Dieser Leitfaden beschreibt, wie Sie die neuen Module für die Verwaltung von Arbeitsbereichen in Ihren bestehenden Code integrieren können. Die Module behalten die bestehenden API-Endpunkte bei, während sie gleichzeitig die Funktionalität für Arbeitsbereiche verbessern.

## 1. HTML-Änderungen (bereits implementiert)

In der `admin_anfrage_detail.html` wurden folgende Skripte hinzugefügt, um die neuen Module zu laden:

```html
<!-- Unsere Module -->
<script src="modules/arbeitsbereich.js"></script>
<script src="modules/arbeitsbereich-manager.js"></script>
<script src="modules/api-manager.js"></script>
```

## 2. Änderungen an admin_anfrage_detail.js

### 2.1 Entfernen der API-Endpunkt-Definitionen am Anfang der Datei

Da die API-Endpunkte jetzt im `api-manager.js` verwaltet werden, können Sie die folgenden Zeilen am Anfang der Datei entfernen:

```javascript
// Primäre API-Endpunkte
const GET_ANFRAGEN_BASE_URL = 'https://dx7fo93g1i.execute-api.eu-central-1.amazonaws.com/prod'; // Für GET-Anfragen
const PUT_ANFRAGEN_BASE_URL = 'https://xnkjq7sfe2.execute-api.eu-central-1.amazonaws.com/prod'; // Für PUT-Anfragen

// Alternative API-Endpunkte (falls die primären nicht funktionieren)
const ALT_API_BASE_URL = 'https://ilxyp19ev8.execute-api.eu-central-1.amazonaws.com/test1';

// API-Endpunkte
const GET_ANFRAGEN_API_ENDPOINT = `${GET_ANFRAGEN_BASE_URL}/anfragen`;
const PUT_ANFRAGEN_API_ENDPOINT = `${PUT_ANFRAGEN_BASE_URL}/anfragen`;
```

### 2.2 Hinzufügen einer globalen Variable für den ArbeitsbereichManager

Fügen Sie nach den bestehenden globalen Variablen eine neue Variable für den ArbeitsbereichManager hinzu:

```javascript
// Globale Variablen
let aktuelleAnfrage = null;
let map = null;
let drawingManager = null;
let currentPolygon = null;
let arbeitsbereichManager = null; // Neu: Manager für Arbeitsbereiche
```

### 2.3 Anpassen der init-Funktion

Modifizieren Sie die init-Funktion, um den ArbeitsbereichManager zu initialisieren:

```javascript
/**
 * Initialisiert die Anwendung
 */
async function init() {
    console.log('Initialisierung der Anfragen-Detailseite');
    
    // Lade-Animation anzeigen, Fehler und Inhalt verstecken
    showLoading(true);
    
    try {
        // Parameter aus der URL lesen
        const urlParams = new URLSearchParams(window.location.search);
        const anfrageId = urlParams.get('id');
        
        if (!anfrageId) {
            throw new Error('Keine Anfrage-ID in der URL gefunden');
        }
        
        // Arbeitsbereich-Manager initialisieren (ohne Map zunächst)
        arbeitsbereichManager = new ArbeitsbereichManager();
        
        // Anfrage laden über den API-Manager
        await loadAnfrageDetails(anfrageId);
        
        // Lade-Animation verstecken, Inhalte anzeigen
        showLoading(false);
        
    } catch (error) {
        console.error('Fehler beim Initialisieren der Detailseite:', error);
        
        // Fehlerfall anzeigen
        showError(error.message);
    }
}
```

### 2.4 Anpassen der loadAnfrageDetails-Funktion

Die loadAnfrageDetails-Funktion sollte den API-Manager verwenden und die Arbeitsbereiche in den ArbeitsbereichManager laden:

```javascript
/**
 * Lädt die Anfrage-Details basierend auf der ID in der URL
 * @param {string} anfrageId - Die ID der zu ladenden Anfrage
 */
async function loadAnfrageDetails(anfrageId) {
    try {
        if (!anfrageId) {
            throw new Error('Keine Anfrage-ID angegeben');
        }
        
        console.log(`Lade Anfrage mit ID: ${anfrageId}`);
        
        // Anfrage über den API-Manager laden
        aktuelleAnfrage = await window.apiManager.getAnfrage(anfrageId);
        
        if (!aktuelleAnfrage) {
            throw new Error('Die Anfrage konnte nicht geladen werden.');
        }
        
        console.log('Geladene Anfrage:', aktuelleAnfrage);
        
        // Stelle sicher, dass arbeitsbereiche ein Array ist
        if (!aktuelleAnfrage.arbeitsbereiche) {
            aktuelleAnfrage.arbeitsbereiche = [];
            console.log('Keine Arbeitsbereiche in der API-Antwort - initialisiere leere Liste');
        } else {
            console.log('Arbeitsbereiche aus API-Antwort:', aktuelleAnfrage.arbeitsbereiche);
            
            // Arbeitsbereiche in den Arbeitsbereich-Manager laden
            arbeitsbereichManager.loadFromAPI(aktuelleAnfrage.arbeitsbereiche);
        }
        
        // Details anzeigen
        renderAnfrageDetails();
        
        return aktuelleAnfrage;
        
    } catch (error) {
        console.error('Fehler beim Laden der Anfrage-Details:', error);
        showError(error.message + ". Änderungen werden nicht übernommen.");
        return null;
    }
}
```

### 2.5 Anpassen der initializeMap-Funktion

Die initializeMap-Funktion sollte den map-Parameter an den ArbeitsbereichManager übergeben:

```javascript
/**
 * Initialisiert die Google Map und zeigt die Arbeitsbereiche an
 * @param {object} anfrage Die aktuelle Anfrage
 */
function initializeMap(anfrage) {
    const mapElement = document.getElementById('google-map');
    if (!mapElement) return;
    
    // Fallback-Koordinaten (Deutschland)
    const defaultPosition = { lat: 51.1657, lng: 10.4515 };
    
    // Karte initialisieren mit Satellit als Standard
    map = new google.maps.Map(mapElement, {
        zoom: 15,
        center: defaultPosition,
        mapTypeId: 'satellite',  // Satellitenansicht als Standard
        mapTypeControl: true,
        streetViewControl: false,
        fullscreenControl: true
    });
    
    // Karte an den ArbeitsbereichManager übergeben
    if (arbeitsbereichManager) {
        arbeitsbereichManager.setMap(map);
    }
    
    // Versuche, den Standort des Nutzers zu ermitteln
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            (position) => {
                const userLocation = {
                    lat: position.coords.latitude,
                    lng: position.coords.longitude
                };
                map.setCenter(userLocation);
                
                // Optional: Marker für die Position des Nutzers setzen
                new google.maps.Marker({
                    position: userLocation,
                    map: map,
                    title: 'Ihr Standort',
                    icon: {
                        url: 'http://maps.google.com/mapfiles/ms/icons/blue-dot.png'
                    }
                });
            },
            (error) => {
                console.warn("Standortbestimmung fehlgeschlagen:", error);
                // Wenn keine Arbeitsbereiche vorhanden sind, zeige Deutschland
                if (!anfrage.arbeitsbereiche || anfrage.arbeitsbereiche.length === 0) {
                    map.setCenter(defaultPosition);
                    map.setZoom(6);
                }
            }
        );
    }
}
```

### 2.6 Anpassen der openArbeitsbereicheEditor-Funktion

Die openArbeitsbereicheEditor-Funktion sollte den ArbeitsbereichManager verwenden:

```javascript
/**
 * Öffnet den Editor für Arbeitsbereiche
 * @param {object} anfrage Die aktuelle Anfrage
 */
function openArbeitsbereicheEditor(anfrage) {
    // Modal anzeigen
    const arbeitsbereicheModal = document.getElementById('arbeitsbereiche-modal');
    if (arbeitsbereicheModal) {
        arbeitsbereicheModal.style.display = 'block';
    }
    
    // Prüfen, ob Google Maps verfügbar ist
    if (window.google && window.google.maps) {
        if (arbeitsbereichManager) {
            // Drawing-Tools im ArbeitsbereichManager initialisieren
            arbeitsbereichManager.initializeDrawingTools();
            
            // Callback für UI-Updates setzen
            arbeitsbereichManager.onArbeitsbereichAdded = function(bereich) {
                // UI für Arbeitsbereiche aktualisieren
                renderArbeitsbereicheListe();
            }
        }
    } else {
        // Fehlermeldung anzeigen
        document.getElementById('editor-map-container').innerHTML = `
            <div style="height: 100%; display: flex; align-items: center; justify-content: center; background-color: #f0f0f0;">
                <p>Google Maps nicht verfügbar. Bitte laden Sie die Seite neu und versuchen Sie es erneut.</p>
            </div>
        `;
    }
}
```

### 2.7 Neue Funktion: renderArbeitsbereicheListe

Fügen Sie eine neue Funktion hinzu, um die Arbeitsbereiche in der UI zu aktualisieren:

```javascript
/**
 * Aktualisiert die Liste der Arbeitsbereiche in der UI
 */
function renderArbeitsbereicheListe() {
    const arbeitsbereicheListe = document.getElementById('arbeitsbereiche-liste');
    if (!arbeitsbereicheListe) return;
    
    // Arbeitsbereiche aus dem Manager holen
    const arbeitsbereiche = arbeitsbereichManager ? arbeitsbereichManager.arbeitsbereiche : [];
    
    if (arbeitsbereiche.length > 0) {
        // HTML für die Arbeitsbereiche generieren
        const arbeitsbereicheHTML = arbeitsbereiche.map((bereich, index) => {
            return `<div class="arbeitsbereich-item">
                <span>Bereich ${index + 1}: ${bereich.name || 'Ohne Namen'}</span>
                <button class="bereich-remove-button" data-id="${bereich.id}">
                    <i class="fas fa-trash"></i>
                </button>
            </div>`;
        }).join('');
        
        arbeitsbereicheListe.innerHTML = arbeitsbereicheHTML;
        
        // Event-Listener für Lösch-Buttons hinzufügen
        document.querySelectorAll('.bereich-remove-button').forEach(button => {
            button.addEventListener('click', function() {
                const bereichId = this.getAttribute('data-id');
                if (arbeitsbereichManager) {
                    arbeitsbereichManager.removeBereich(bereichId);
                    renderArbeitsbereicheListe();
                }
            });
        });
    } else {
        // Meldung anzeigen, wenn keine Arbeitsbereiche vorhanden sind
        arbeitsbereicheListe.innerHTML = '<div class="keine-bereiche">Keine Arbeitsbereiche definiert</div>';
    }
}
```

### 2.8 Anpassen der saveAnfrageChanges-Funktion

Die saveAnfrageChanges-Funktion sollte die Arbeitsbereiche aus dem ArbeitsbereichManager holen:

```javascript
/**
 * Speichert Änderungen an der Anfrage
 */
async function saveAnfrageChanges() {
    // UI-Status aktualisieren
    showToast('Speichere Änderungen...', 'info');
    
    try {
        // Daten aus Formular sammeln
        const status = document.getElementById('anfrage-status').value;
        const bearbeiter = document.getElementById('anfrage-bearbeiter').value;
        const notizen = document.getElementById('anfrage-notizen').value;
        const terminDatum = document.getElementById('termin-datum').value;
        const terminZeit = document.getElementById('termin-zeit').value;
        
        // Aktualisierte Daten vorbereiten
        const updateData = {
            status: status,
            bearbeiter: bearbeiter,
            notizen: notizen,
            terminDatum: terminDatum,
            terminZeit: terminZeit,
            letzteAktualisierung: new Date().toISOString()
        };
        
        // Arbeitsbereiche hinzufügen, wenn verfügbar
        if (arbeitsbereichManager) {
            updateData.arbeitsbereiche = arbeitsbereichManager.prepareForAPI();
        }
        
        console.log('Sende aktualisierte Daten:', updateData);
        
        // Daten über den API-Manager senden
        const response = await window.apiManager.updateAnfrage(aktuelleAnfrage.id, updateData);
        
        if (response) {
            console.log('Antwort nach Aktualisierung:', response);
            
            // Lokale Anfrage-Daten aktualisieren
            aktuelleAnfrage = {
                ...aktuelleAnfrage,
                ...updateData
            };
            
            // Erfolgsmeldung
            showToast('Änderungen wurden erfolgreich gespeichert', 'success');
            return true;
        } else {
            throw new Error('Keine Antwort von der API erhalten');
        }
    } catch (error) {
        console.error('Fehler beim Speichern der Änderungen:', error);
        showToast('Fehler beim Speichern: ' + error.message, 'error');
        return false;
    }
}
```

## 3. Test der Implementierung

Nachdem Sie diese Änderungen vorgenommen haben, sollten Sie die Anwendung testen:

1. Öffnen Sie die Seite und prüfen Sie, ob die Arbeitsbereiche korrekt geladen werden
2. Testen Sie das Hinzufügen, Bearbeiten und Löschen von Arbeitsbereichen
3. Überprüfen Sie, ob die Daten korrekt über die API gespeichert werden

Bei Problemen prüfen Sie die Konsole auf Fehlermeldungen und passen Sie den Code entsprechend an.

## 4. Weitere Verbesserungen

Nach der erfolgreichen Implementierung der Grundfunktionen können Sie folgende Verbesserungen in Betracht ziehen:

1. Implementierung einer einheitlichen Fehlerbehandlung mit dem ApiManager
2. Bessere Validierung der Arbeitsbereiche vor dem Speichern
3. Zusätzliche Funktionen für die Bearbeitung von Arbeitsbereichen, wie das Umbenennen
4. Performance-Optimierungen für den Umgang mit vielen Arbeitsbereichen
