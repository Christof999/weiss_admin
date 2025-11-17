/**
 * admin_anfrage_detail_neu.js
 * Verbesserte Version für die Verwaltung von Anfragen mit Arbeitsbereichen
 */

// Globale Variablen
let aktuelleAnfrage = null;
let map = null;
let arbeitsbereichManager = null;
let userLocation = null;

// Dokument geladen - Start der Anwendung
document.addEventListener('DOMContentLoaded', init);

// Google Maps Callback
function initGoogleMapsCallback() {
    console.log('Google Maps API geladen');
    if (map === null && aktuelleAnfrage !== null) {
        initializeMap(aktuelleAnfrage);
    }
}

// Globale Funktion für Google Maps API
window.initGoogleMapsCallback = initGoogleMapsCallback;

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
        
        // Event-Listener für UI-Elemente einrichten
        setupEventListeners();
        
    } catch (error) {
        console.error('Fehler beim Initialisieren der Detailseite:', error);
        
        // Fehlerfall anzeigen
        showError(error.message);
    }
}

/**
 * Zeigt Ladezustand an
 * @param {boolean} loading - Ob Ladeanimation gezeigt werden soll
 */
function showLoading(loading) {
    const loadingContainer = document.getElementById('loading-container');
    const contentContainer = document.getElementById('anfrage-detail-container');
    const errorContainer = document.getElementById('error-container');
    
    if (loadingContainer) loadingContainer.style.display = loading ? 'flex' : 'none';
    if (contentContainer) contentContainer.style.display = loading ? 'none' : 'block';
    if (errorContainer) errorContainer.style.display = 'none';
}

/**
 * Zeigt Fehlermeldung an
 * @param {string} message - Anzuzeigende Fehlermeldung
 */
function showError(message) {
    const loadingContainer = document.getElementById('loading-container');
    const contentContainer = document.getElementById('anfrage-detail-container');
    const errorContainer = document.getElementById('error-container');
    const errorMessage = document.getElementById('error-message');
    
    if (loadingContainer) loadingContainer.style.display = 'none';
    if (contentContainer) contentContainer.style.display = 'none';
    if (errorContainer) errorContainer.style.display = 'flex';
    if (errorMessage) errorMessage.textContent = message;
}

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
        }
        
        // Formularfelder mit Anfragedaten füllen
        renderAnfrageDetails(aktuelleAnfrage);
        
        // Google Maps initialisieren, wenn das API-Skript bereits geladen ist
        if (typeof google !== 'undefined' && typeof google.maps !== 'undefined') {
            initializeMap(aktuelleAnfrage);
        } else {
            console.log('Google Maps API noch nicht geladen. Wird nach dem Laden automatisch initialisiert.');
        }
        
        return aktuelleAnfrage;
        
    } catch (error) {
        console.error('Fehler beim Laden der Anfrage-Details:', error);
        showError(error.message + ". Änderungen werden nicht übernommen.");
        return null;
    }
}

/**
 * Initialisiert die Google Map und zeigt die Arbeitsbereiche an
 * @param {object} anfrage - Die aktuelle Anfrage
 */
function initializeMap(anfrage) {
    const mapElement = document.getElementById('map');
    if (!mapElement) {
        console.error('Map-Container nicht gefunden');
        return;
    }
    
    // Fallback-Koordinaten (Deutschland)
    const defaultPosition = { lat: 51.1657, lng: 10.4515 };
    
    // Map-Optionen
    const mapOptions = {
        zoom: 6,
        center: defaultPosition,
        mapTypeId: google.maps.MapTypeId.ROADMAP,
        mapTypeControl: true,
        streetViewControl: true,
        fullscreenControl: true
    };
    
    // Map erstellen
    map = new google.maps.Map(mapElement, mapOptions);
    
    // Karte an den ArbeitsbereichManager übergeben
    if (arbeitsbereichManager) {
        console.log('Setze Map im ArbeitsbereichManager');
        arbeitsbereichManager.setMap(map);
        
        // Zeichenwerkzeuge initialisieren
        console.log('Initialisiere Zeichenwerkzeuge');
        arbeitsbereichManager.initializeDrawingTools();

        // Arbeitsbereiche aus der Anfrage laden und anzeigen
        if (anfrage && anfrage.arbeitsbereiche && anfrage.arbeitsbereiche.length > 0) {
            console.log('Lade Arbeitsbereiche in den Manager:', anfrage.arbeitsbereiche);
            arbeitsbereichManager.loadFromAPI(anfrage.arbeitsbereiche);
            
            // Aktualisiere die Liste der Arbeitsbereiche unter der Karte
            renderArbeitsbereicheListe();
        } else {
            console.log('Keine Arbeitsbereiche in der Anfrage vorhanden');
        }
        
        // Event-Handler für Arbeitsbereich-Erstellung einrichten
        arbeitsbereichManager.onArbeitsbereichAdded = function(neuerBereich) {
            console.log('Neuer Arbeitsbereich erstellt:', neuerBereich);
            renderArbeitsbereicheListe();
        };
    }
    
    // Versuche, den Standort des Nutzers zu ermitteln
    ermittleBenutzerstandort();
}

/**
 * Ermittelt den Standort des Nutzers
 */
function ermittleBenutzerstandort() {
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            (position) => {
                userLocation = {
                    lat: position.coords.latitude,
                    lng: position.coords.longitude
                };
                console.log('Benutzerstandort ermittelt:', userLocation);
                
                // Wenn keine Arbeitsbereiche vorhanden sind, auf Benutzerstandort zentrieren
                if (arbeitsbereichManager && arbeitsbereichManager.arbeitsbereiche.length === 0 && map) {
                    map.setCenter(userLocation);
                    map.setZoom(12);
                    
                    // Marker für Benutzerstandort setzen
                    new google.maps.Marker({
                        position: userLocation,
                        map: map,
                        title: 'Ihr Standort'
                    });
                }
            },
            (error) => {
                console.warn('Fehler bei der Standortermittlung:', error);
            }
        );
    } else {
        console.warn('Geolocation wird von diesem Browser nicht unterstützt');
    }
}

/**
 * Zeigt die Anfrage-Details im Formular an
 * @param {object} anfrage - Die anzuzeigende Anfrage
 */
function renderAnfrageDetails(anfrage) {
    if (!anfrage) return;
    
    console.log('Rendere Anfrage-Details:', anfrage);
    
    // Kundeninformationen anzeigen (direkt aus den flachen API-Daten)
    document.getElementById('kunde-name').textContent = anfrage.name || 'Nicht angegeben';
    document.getElementById('kunde-adresse').textContent = anfrage.adresse || 'Nicht angegeben';
    document.getElementById('kunde-telefon').textContent = anfrage.phone || anfrage.telefon || 'Nicht angegeben';
    document.getElementById('kunde-email').textContent = anfrage.email || 'Nicht angegeben';
    
    // Status und Bearbeiter
    const statusSelect = document.getElementById('anfrage-status');
    const bearbeiterInput = document.getElementById('anfrage-bearbeiter');
    
    if (statusSelect) statusSelect.value = anfrage.status || 'Neu';
    if (bearbeiterInput) bearbeiterInput.value = anfrage.bearbeiter || '';
    
    // Notizen
    const notizenTextarea = document.getElementById('anfrage-notizen');
    if (notizenTextarea) notizenTextarea.value = anfrage.notizen || '';
    
    // Termin
    const terminDatumInput = document.getElementById('termin-datum');
    const terminZeitInput = document.getElementById('termin-zeit');
    
    if (terminDatumInput) terminDatumInput.value = anfrage.terminDatum || anfrage.appointment_date || '';
    if (terminZeitInput) terminZeitInput.value = anfrage.terminZeit || anfrage.appointment_time || '';
    
    // Anfrage-Details
    document.getElementById('anfrage-typ').textContent = anfrage.typ || 'Allgemeine Anfrage';
    document.getElementById('anfrage-beschreibung').textContent = anfrage.message || anfrage.beschreibung || 'Keine Beschreibung vorhanden';
    document.getElementById('anfrage-erstelltAm').textContent = anfrage.erstelltAm || anfrage.timestamp || 'Unbekannt';
}

/**
 * Aktualisiert die Liste der Arbeitsbereiche in der UI
 */
function renderArbeitsbereicheListe() {
    const arbeitsbereicheListe = document.getElementById('arbeitsbereiche-liste');
    if (!arbeitsbereicheListe) return;
    
    // Arbeitsbereiche aus dem Manager holen
    if (arbeitsbereichManager && arbeitsbereichManager.arbeitsbereiche && arbeitsbereichManager.arbeitsbereiche.length > 0) {
        // HTML für Arbeitsbereiche generieren
        const arbeitsbereicheHTML = arbeitsbereichManager.arbeitsbereiche.map((bereich, index) => {
            return `<div class="arbeitsbereich-item" data-id="${bereich.id}">
                <span class="bereich-name">${bereich.name || `Bereich ${index + 1}`}</span>
                <div class="bereich-actions">
                    <button class="bereich-view-button" data-id="${bereich.id}" title="Auf Karte anzeigen">
                        <i class="fas fa-map-marker-alt"></i>
                    </button>
                    <button class="bereich-remove-button" data-id="${bereich.id}" title="Bereich löschen">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>`;
        }).join('');
        
        arbeitsbereicheListe.innerHTML = arbeitsbereicheHTML;
        
        // Event-Listener für Klick auf Arbeitsbereiche (der gesamte Bereich ist klickbar)
        document.querySelectorAll('.arbeitsbereich-item').forEach(item => {
            item.addEventListener('click', function(event) {
                // Nur ausführen, wenn nicht auf einen Button geklickt wurde
                if (!event.target.closest('.bereich-actions button')) {
                    const bereichId = this.getAttribute('data-id');
                    console.log('Arbeitsbereich angeklickt:', bereichId);
                    zentriereAufArbeitsbereich(bereichId);
                }
            });
        });
        
        // Zusätzlicher Event-Listener für die spezifischen Anzeige-Buttons
        document.querySelectorAll('.bereich-view-button').forEach(button => {
            button.addEventListener('click', function(event) {
                event.stopPropagation(); // Verhindert Auslösen des Eltern-Click-Events
                const bereichId = this.getAttribute('data-id');
                console.log('Anzeige-Button für Arbeitsbereich geklickt:', bereichId);
                zentriereAufArbeitsbereich(bereichId);
            });
        });
        
        // Event-Listener für Lösch-Buttons hinzufügen
        document.querySelectorAll('.bereich-remove-button').forEach(button => {
            button.addEventListener('click', function(event) {
                event.stopPropagation(); // Verhindert Auslösen des Eltern-Click-Events
                const bereichId = this.getAttribute('data-id');
                console.log('Lösch-Button für Arbeitsbereich geklickt:', bereichId);
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

/**
 * Zentriert die Karte auf einen bestimmten Arbeitsbereich
 * @param {string} bereichId - ID des Arbeitsbereichs
 */
function zentriereAufArbeitsbereich(bereichId) {
    if (!map || !arbeitsbereichManager) return;
    
    console.log('Versuche auf Arbeitsbereich zu zentrieren:', bereichId);
    
    const bereich = arbeitsbereichManager.arbeitsbereiche.find(b => b.id === bereichId);
    if (!bereich) {
        console.warn('Arbeitsbereich nicht gefunden:', bereichId);
        return;
    }
    
    if (!bereich.coordinates || bereich.coordinates.length === 0) {
        console.warn('Arbeitsbereich hat keine Koordinaten:', bereichId);
        
        // Arbeitsbereich in der Liste hervorheben, auch wenn keine Zentrierung möglich ist
        highlightArbeitsbereichInList(bereichId);
        
        // Versuche, auf den letzten bekannten Standort zu zentrieren, wenn keine Koordinaten verfügbar sind
        if (arbeitsbereichManager.getLastValidLocation()) {
            const lastLocation = arbeitsbereichManager.getLastValidLocation();
            map.setCenter(lastLocation);
            map.setZoom(15);
            console.log('Zentriere auf letzten bekannten Standort:', lastLocation);
        } else if (userLocation) {
            map.setCenter(userLocation);
            map.setZoom(15);
            console.log('Zentriere auf Benutzerstandort:', userLocation);
        }
        return;
    }
    
    // Hier speichern wir einen gültigen Standort für zukünftige Verwendung
    if (bereich.coordinates && bereich.coordinates.length > 0) {
        arbeitsbereichManager.setLastValidLocation({
            lat: bereich.coordinates[0].lat,
            lng: bereich.coordinates[0].lng
        });
    }
    
    // Bounds erstellen für die Koordinaten des Bereichs
    const bounds = new google.maps.LatLngBounds();
    bereich.coordinates.forEach(coord => {
        bounds.extend(new google.maps.LatLng(coord.lat, coord.lng));
    });
    
    // Karte auf den Bereich zentrieren
    if (!bounds.isEmpty()) {
        console.log('Zentriere auf Koordinaten-Bereich:', bereich.coordinates);
        map.fitBounds(bounds);
        
        // Arbeitsbereich in der Liste hervorheben
        highlightArbeitsbereichInList(bereichId);
        
        // Zoom-Level optimieren
        setTimeout(() => {
            const currentZoom = map.getZoom();
            if (currentZoom > 18) {
                map.setZoom(18);
            } else if (currentZoom < 14 && bereich.coordinates.length <= 3) {
                map.setZoom(16);
            }
        }, 100);
    }
}

/**
 * Hebt einen Arbeitsbereich in der Liste visuell hervor
 * @param {string} bereichId - ID des hervorzuhebenden Arbeitsbereichs
 */
function highlightArbeitsbereichInList(bereichId) {
    // Alle Hervorhebungen zurücksetzen
    document.querySelectorAll('.arbeitsbereich-item').forEach(item => {
        item.classList.remove('highlighted');
    });
    
    // Den ausgewählten Bereich hervorheben
    const selectedItem = document.querySelector(`.arbeitsbereich-item[data-id="${bereichId}"]`);
    if (selectedItem) {
        selectedItem.classList.add('highlighted');
        // Scrolle zum Element, falls es außerhalb des sichtbaren Bereichs ist
        selectedItem.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
}

/**
 * Richtet Event-Listener für alle UI-Elemente ein
 */
function setupEventListeners() {
    // Event-Listener für Speichern-Button
    const saveButton = document.getElementById('save-button');
    if (saveButton) {
        saveButton.addEventListener('click', saveAnfrageChanges);
    }
    
    // Event-Listener für Arbeitsbereich hinzufügen Button
    const addBereichButton = document.getElementById('add-arbeitsbereich-button');
    if (addBereichButton && arbeitsbereichManager) {
        console.log('Richte Event-Listener für Arbeitsbereich-Button ein');
        addBereichButton.addEventListener('click', () => {
            if (arbeitsbereichManager.drawingMode) {
                console.log('Stoppe Zeichenmodus');
                arbeitsbereichManager.stopDrawing();
                addBereichButton.textContent = 'Arbeitsbereich hinzufügen';
                addBereichButton.innerHTML = '<i class="fas fa-plus"></i> Arbeitsbereich hinzufügen';
            } else {
                console.log('Starte Zeichenmodus');
                
                // Falls der DrawingManager noch nicht initialisiert wurde, initialisiere ihn
                if (!arbeitsbereichManager.drawingManager) {
                    console.log('DrawingManager wird initialisiert');
                    arbeitsbereichManager.initializeDrawingTools();
                }
                
                arbeitsbereichManager.startDrawing();
                addBereichButton.innerHTML = '<i class="fas fa-times"></i> Zeichnen abbrechen';
                
                // Erfolgs-Callback: Wird aufgerufen, nachdem ein neuer Bereich gezeichnet wurde
                arbeitsbereichManager.onArbeitsbereichAdded = (neuerBereich) => {
                    console.log('Neuer Arbeitsbereich wurde hinzugefügt:', neuerBereich);
                    addBereichButton.innerHTML = '<i class="fas fa-plus"></i> Arbeitsbereich hinzufügen';
                    renderArbeitsbereicheListe();
                };
            }
        });
    } else {
        console.warn('Arbeitsbereich-Button oder ArbeitsbereichManager nicht verfügbar');
    }
    
    // Event-Listener für Zurück-Button
    const backButton = document.getElementById('back-button');
    if (backButton) {
        backButton.addEventListener('click', () => {
            window.location.href = 'admin_anfragen.html';
        });
    }
}

/**
 * Testet verschiedene API-Formate, um zu sehen, was von der API akzeptiert wird
 */
async function testApiFormat() {
    if (!aktuelleAnfrage || !aktuelleAnfrage.id) {
        console.error('Keine aktuelle Anfrage zum Testen vorhanden');
        return;
    }
    
    const testId = aktuelleAnfrage.id;
    console.log('Teste API-Formate für ID:', testId);
    
    // Verschiedene Arbeitsbereiche-Formate für Tests
    let arbeitsbereichFormate = {};
    if (arbeitsbereichManager && arbeitsbereichManager.arbeitsbereiche.length > 0) {
        arbeitsbereichFormate = {
            'flattened': arbeitsbereichManager.exportToDynamoDBFormat('flattened'),
            'geometry_only': arbeitsbereichManager.exportToDynamoDBFormat('geometry_only'),
            'stringified': arbeitsbereichManager.exportToDynamoDBFormat('stringified'),
            'raw_coordinates': arbeitsbereichManager.exportToDynamoDBFormat('raw_coordinates'),
            'standard': arbeitsbereichManager.prepareForAPI()
        };
        console.log('Vorbereitung von Arbeitsbereichen in verschiedenen Formaten:', arbeitsbereichFormate);
    }
    
    // Zu testende API-Formate
    const testFormate = [
        // Format 1: Direkte Übertragung
        {
            id: aktuelleAnfrage.id,
            status: aktuelleAnfrage.status || 'IN_BEARBEITUNG',
            notizen: aktuelleAnfrage.notizen || 'Test-Notiz',
            // Füge Arbeitsbereiche im 'flattened' Format hinzu, wenn vorhanden
            ...(arbeitsbereichFormate.flattened && arbeitsbereichFormate.flattened.length > 0 ? 
                { arbeitsbereiche: arbeitsbereichFormate.flattened } : {})
        },
        
        // Format 2: DynamoDB-Item-Format
        {
            Item: {
                id: aktuelleAnfrage.id,
                status: aktuelleAnfrage.status || 'IN_BEARBEITUNG',
                notizen: aktuelleAnfrage.notizen || 'Test-Notiz',
                // Füge Arbeitsbereiche im 'stringified' Format hinzu, wenn vorhanden
                ...(arbeitsbereichFormate.stringified && arbeitsbereichFormate.stringified.length > 0 ? 
                    { arbeitsbereiche: arbeitsbereichFormate.stringified } : {})
            }
        },
        
        // Format 3: Mit anderen Arbeitsbereich-Formaten
        {
            id: aktuelleAnfrage.id,
            status: aktuelleAnfrage.status || 'IN_BEARBEITUNG',
            notizen: aktuelleAnfrage.notizen || 'Test-Notiz',
            // Füge Arbeitsbereiche im 'geometry_only' Format hinzu, wenn vorhanden
            ...(arbeitsbereichFormate.geometry_only && arbeitsbereichFormate.geometry_only.length > 0 ? 
                { arbeitsbereiche: arbeitsbereichFormate.geometry_only } : {})
        },
        
        // Format 4: Mit raw_coordinates
        {
            id: aktuelleAnfrage.id,
            status: aktuelleAnfrage.status || 'IN_BEARBEITUNG',
            notizen: aktuelleAnfrage.notizen || 'Test-Notiz',
            // Füge Arbeitsbereiche im 'raw_coordinates' Format hinzu, wenn vorhanden
            ...(arbeitsbereichFormate.raw_coordinates && arbeitsbereichFormate.raw_coordinates.length > 0 ? 
                { arbeitsbereiche: arbeitsbereichFormate.raw_coordinates } : {})
        }
    ];
    
    // Inkrementelle Tests durchführen
    for (let i = 0; i < testFormate.length; i++) {
        const testFormat = testFormate[i];
        console.log(`Teste Format ${i+1}:`, testFormat);
        
        try {
            const result = await fetch(`https://xnkjq7sfe2.execute-api.eu-central-1.amazonaws.com/prod/anfragen/${testId}?test=1`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(testFormat)
            });
            
            if (!result.ok) {
                const errorText = await result.text();
                console.error(`Format ${i+1} fehlgeschlagen:`, errorText);
            } else {
                const successData = await result.json();
                console.log(`Format ${i+1} erfolgreich!`, successData);
                
                // Speichere erfolgreiches Format für weitere Verwendung
                window.successFormat = testFormat;
                return testFormat;
            }
        } catch (error) {
            console.error(`Fehler bei Format ${i+1}:`, error.message);
        }
    }
    
    console.error('Kein kompatibles Format gefunden');
    return null;
}

/**
 * Speichert Änderungen an der Anfrage
 */
async function saveAnfrageChanges() {
    if (!aktuelleAnfrage) {
        console.error('Keine aktuelle Anfrage zum Speichern vorhanden');
        return;
    }
    
    try {
        // Änderungsbutton deaktivieren
        const saveButton = document.getElementById('save-button');
        if (saveButton) {
            saveButton.disabled = true;
            saveButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Speichern...';
        }
        
        // Formularwerte auslesen
        const statusSelect = document.getElementById('anfrage-status');
        const bearbeiterInput = document.getElementById('anfrage-bearbeiter');
        const notizenTextarea = document.getElementById('anfrage-notizen');
        const terminDatumInput = document.getElementById('termin-datum');
        const terminZeitInput = document.getElementById('termin-zeit');
        
        // Erstelle ein neues Update-Objekt basierend auf dem Lambda-Code
        // WICHTIG: Die Lambda-Funktion mappt:
        // - terminDatum -> appointment_date
        // - terminZeit -> appointment_time
        // - bereiche -> arbeitsbereiche
        let updateAnfrage = {
            id: aktuelleAnfrage.id
        };
        
        // Basis-Felder hinzufügen
        if (statusSelect && statusSelect.value) {
            updateAnfrage.status = statusSelect.value;
        }
        
        if (bearbeiterInput && bearbeiterInput.value) {
            updateAnfrage.bearbeiter = bearbeiterInput.value;
        }
        
        if (notizenTextarea && notizenTextarea.value) {
            updateAnfrage.notizen = notizenTextarea.value;
        }
        
        // Termin-Felder entsprechend dem Lambda-Mapping hinzufügen
        // Die Lambda-Funktion wandelt terminDatum -> appointment_date
        if (terminDatumInput && terminDatumInput.value) {
            updateAnfrage.terminDatum = terminDatumInput.value;
            // Der Lambda-Code mappt terminDatum auf appointment_date, aber wir senden es direkt
        }
        
        // Die Lambda-Funktion wandelt terminZeit -> appointment_time
        if (terminZeitInput && terminZeitInput.value) {
            updateAnfrage.terminZeit = terminZeitInput.value;
            // Der Lambda-Code mappt terminZeit auf appointment_time, aber wir senden es direkt
        }
        
        // Kopiere andere wichtige Felder
        ['name', 'email', 'phone', 'timestamp', 'message', 'adresse'].forEach(feld => {
            if (aktuelleAnfrage[feld]) {
                updateAnfrage[feld] = aktuelleAnfrage[feld];
            }
        });
        
        // WICHTIG: Arbeitsbereiche zum Speichern hinzufügen
        // Wir verwenden jetzt das api_compatible Format, das exakt dem Format entspricht,
        // das wir von der API erhalten haben
        const formatierteBereiche = (arbeitsbereichManager && arbeitsbereichManager.arbeitsbereiche.length > 0) ?
            arbeitsbereichManager.exportToDynamoDBFormat('api_compatible') : [];
            
        if (formatierteBereiche.length > 0) {
            console.log('Arbeitsbereiche zum Speichern vorbereiten...');
            console.log('Arbeitsbereiche für DynamoDB formatiert:', formatierteBereiche);
        } else {
            console.log('Keine Arbeitsbereiche zum Speichern vorhanden');
        }
        
        // Direkt das DynamoDB Item-Format verwenden, das mit der API funktioniert
        console.log('Verwende DynamoDB Item-Format für das Update');
        
        // Die grundlegende Item-Struktur erstellen
        updateAnfrage = {
            Item: {
                id: aktuelleAnfrage.id
            }
        };
        
        // Alle Properties vom bisherigen Update-Objekt übernehmen
        if (updateAnfrage.status) updateAnfrage.Item.status = updateAnfrage.status;
        if (updateAnfrage.bearbeiter) updateAnfrage.Item.bearbeiter = updateAnfrage.bearbeiter;
        if (updateAnfrage.notizen) updateAnfrage.Item.notizen = updateAnfrage.notizen;
        
        // Weitere Felder vom Original-Objekt übernehmen, falls sie nicht im Update sind
        if (!updateAnfrage.Item.status && aktuelleAnfrage.status) {
            updateAnfrage.Item.status = aktuelleAnfrage.status;
        }
        
        if (!updateAnfrage.Item.bearbeiter && aktuelleAnfrage.bearbeiter) {
            updateAnfrage.Item.bearbeiter = aktuelleAnfrage.bearbeiter;
        }
        
        // Falls vorhanden, Termin-Daten hinzufügen
        if (terminDatumInput && terminDatumInput.value) {
            updateAnfrage.Item.terminDatum = terminDatumInput.value;
            updateAnfrage.Item.appointment_date = terminDatumInput.value;
        }
        
        if (terminZeitInput && terminZeitInput.value) {
            updateAnfrage.Item.terminZeit = terminZeitInput.value;
            updateAnfrage.Item.appointment_time = terminZeitInput.value;
        }
        
        // Kopiere weitere wichtige Felder aus dem Original
        ['name', 'email', 'phone', 'timestamp', 'message', 'adresse'].forEach(feld => {
            if (aktuelleAnfrage[feld] && !updateAnfrage.Item[feld]) {
                updateAnfrage.Item[feld] = aktuelleAnfrage[feld];
            }
        });
        
        // WICHTIG: Arbeitsbereiche im korrekten Format im Item hinzufügen
        if (formatierteBereiche && formatierteBereiche.length > 0) {
            updateAnfrage.Item.arbeitsbereiche = formatierteBereiche;
            console.log('Arbeitsbereiche im Item-Format hinzugefügt:', formatierteBereiche);
        } else if (aktuelleAnfrage.arbeitsbereiche && aktuelleAnfrage.arbeitsbereiche.length > 0) {
            // Bestehende Arbeitsbereiche beibehalten, wenn keine neuen vorhanden sind
            updateAnfrage.Item.arbeitsbereiche = aktuelleAnfrage.arbeitsbereiche;
            console.log('Bestehende Arbeitsbereiche beibehalten:', updateAnfrage.Item.arbeitsbereiche);
        }
        
        console.log('Finales Update-Format für API:', updateAnfrage);
        
        console.log('Sende Anfrage entsprechend dem Lambda-Format:', updateAnfrage);
        
        // Über API speichern - verwende PUT-API für diesen Update
        // WICHTIG: Die ID ist jetzt in updateAnfrage.Item.id, da wir das DynamoDB Item-Format verwenden
        const ergebnis = await window.apiManager.updateAnfrage(updateAnfrage.Item.id, updateAnfrage);
        
        // Erfolgsfall für Basis-Daten
        console.log('Speichern der Basis-Daten erfolgreich:', ergebnis);
        
        // Erfolg - nichts weiteres zu tun
        // Die Arbeitsbereiche können später hinzugefügt werden, wenn das API-Format klar ist
        
        // Erfolgs-Nachricht anzeigen
        const message = document.getElementById('success-message');
        if (message) {
            message.textContent = 'Anfrage erfolgreich gespeichert!';
            message.style.display = 'block';
            setTimeout(() => { message.style.display = 'none'; }, 3000);
        }
        
        // Aktuelles Objekt mit den gespeicherten Werten aktualisieren
        for (const key in updateAnfrage) {
            if (key !== 'id') { // ID bleibt unverändert
                aktuelleAnfrage[key] = updateAnfrage[key];
            }
        }
        
        return ergebnis;
    } catch (error) {
        console.error('Fehler beim Speichern der Anfrage:', error);
        
        // Fehlermeldung anzeigen
        const message = document.getElementById('error-message-inline');
        if (message) {
            message.textContent = 'Fehler beim Speichern: ' + (error.message || 'Unbekannter Fehler');
            message.style.display = 'block';
            setTimeout(() => { message.style.display = 'none'; }, 5000);
        }
        
        // Versuche eine zweite Option mit noch weniger Feldern
        try {
            console.log('Zweiter Versuch mit Minimal-Daten...');
            // Korrekt auf das DOM-Element zugreifen
            const notizenElement = document.getElementById('anfrage-notizen');
            
            const minimalAnfrage = {
                id: aktuelleAnfrage.id,
                notizen: notizenElement ? notizenElement.value : 'Update ' + new Date().toISOString()
            };
            
            const fallbackErgebnis = await window.apiManager.updateAnfrage(minimalAnfrage.id, minimalAnfrage);
            console.log('Fallback-Speicherung erfolgreich:', fallbackErgebnis);
            
            // Erfolgs-Nachricht anzeigen
            const successMsg = document.getElementById('success-message');
            if (successMsg) {
                successMsg.textContent = 'Notfall-Speicherung erfolgreich!';
                successMsg.style.display = 'block';
                setTimeout(() => { successMsg.style.display = 'none'; }, 3000);
            }
            
            return fallbackErgebnis;
        } catch (fallbackError) {
            console.error('Auch Fallback-Speicherung fehlgeschlagen:', fallbackError);
            alert('Die Speicherung konnte nicht durchgeführt werden. Möglicherweise ist die API nicht erreichbar oder hat ein Problem mit dem Format der Daten.');
        }
        
        // Nichts zurückgeben, wenn alle Versuche fehlschlagen
        return null;
    } finally {
        // Button wieder aktivieren
        const saveButton = document.getElementById('save-button');
        if (saveButton) {
            saveButton.disabled = false;
            saveButton.innerHTML = '<i class="fas fa-save"></i> Speichern';
        }
    }
}
