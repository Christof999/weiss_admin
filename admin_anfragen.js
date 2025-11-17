// JavaScript für den Anfragenmanager
// API-Endpunkte für die Anfragenverwaltung
const REST_API_BASE_URL = 'https://xnkjq7sfe2.execute-api.eu-central-1.amazonaws.com/prod'; // Funktionierender API-Endpunkt

// Definiere alle API-Endpunkte auf Basis des funktionierenden Endpunkts
// Zurück zum ursprünglichen Pfad, da dort jetzt GET konfiguriert ist
const GET_ANFRAGEN_API_ENDPOINT = `${REST_API_BASE_URL}/anfragen`; 
const PUT_ANFRAGEN_API_ENDPOINT = `${REST_API_BASE_URL}/anfragen`;
const KONTAKT_API_ENDPOINT = `${REST_API_BASE_URL}/kontakt`;

// Hilfsfunktion für API-Aufrufe, die den Service Worker umgeht
async function fetchAPI(url, options = {}) {
    // Füge einen zufälligen Parameter hinzu, um den Service Worker zu umgehen
    let bypassUrl = `${url}${url.includes('?') ? '&' : '?'}noserviceworker=${Date.now()}`;
    console.log('Verwende Bypass-URL:', bypassUrl);
    
    // Standard-Headers für alle Anfragen
    if (!options.headers) {
        options.headers = {};
    }
    
    // Content-Type setzen falls nicht vorhanden und Body existiert
    if (options.body && !options.headers['Content-Type']) {
        options.headers['Content-Type'] = 'application/json';
    }
    
    // Accept-Header setzen falls nicht vorhanden
    if (!options.headers['Accept']) {
        options.headers['Accept'] = 'application/json';
    }
    
    console.log('Fetch API Options:', options);
    
    try {
        return await fetch(bypassUrl, options);
    } catch (error) {
        console.error('Fetch-Fehler mit Bypass-URL:', error);
        throw error;
    }
}

// DOM Elemente
const anfrageContainer = document.getElementById('anfragen-container');
const filterButtons = document.querySelectorAll('.filter-button');
const speichernButton = document.getElementById('speichern-button');
const closeButtons = document.querySelectorAll('.close-button, .close-modal-button');

// Status-Typen für Filter
const statusTypes = ['Alle', 'Neu', 'In Bearbeitung', 'Abgeschlossen'];

// Speichert die aktuell geladenen Anfragen
let alleAnfragen = [];
// Speichert die aktuell angezeigte Anfrage
let aktuelleAnfrage = null;
// Aktueller Filter-Status (Standard: 'Alle')
let aktuellerFilter = 'alle';

// DEMO-MODUS Flag - auf true setzen, um immer Demo-Daten zu verwenden
const DEMO_MODUS = false; // Deaktiviert - echte Daten verwenden

/**
 * HINWEIS: Um die API vollständig zu nutzen, muss die Lambda-Funktion aktualisiert werden:
 * Ändern Sie in Ihrer Lambda-Funktion für /anfragen:
 * 'Access-Control-Allow-Methods': 'OPTIONS,GET,POST,PUT,DELETE'
 *
 * Aktuell erlaubt die Lambda-Funktion nur: 'OPTIONS,GET'
 */

// Event Listener
document.addEventListener('DOMContentLoaded', init);

/**
 * Initialisiert die Anwendung
 */
async function init() {
    console.log("Initialisierung der Anfragenverwaltung");
    
    // DOM-Elemente initialisieren, die später im Code benötigt werden
    const detailModal = document.getElementById('anfrage-detail-modal');
    
    // Überprüfen, ob der Benutzer eingeloggt ist
    if (window.Auth && !window.Auth.isAuthenticated()) {
        console.log('Benutzer ist nicht eingeloggt, Weiterleitung zur Login-Seite');
        window.location.href = 'index.html';
        return;
    }
    
    // Event-Listener für Filter-Buttons
    filterButtons.forEach(button => {
        button.addEventListener('click', () => {
            // Aktiven Button aktualisieren
            filterButtons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
            
            // Aktuellen Filter speichern
            aktuellerFilter = button.dataset.filter;
            console.log('Filter geändert auf:', aktuellerFilter);
            
            // Anfragen filtern
            renderAnfragen();
        });
    });
    
    // Event-Listener für Modal schließen
    closeButtons.forEach(button => {
        button.addEventListener('click', () => {
            document.getElementById('anfrage-detail-modal').style.display = 'none';
        });
    });
    
    // Event-Listener für Speicher-Button
    speichernButton.addEventListener('click', saveAnfrageChanges);
    
    // Klick außerhalb des Modals schließt es
    window.addEventListener('click', (event) => {
        if (event.target === document.getElementById('anfrage-detail-modal')) {
            document.getElementById('anfrage-detail-modal').style.display = 'none';
        }
    });
    
    // Anfragen laden
    await loadAnfragen();
}

/**
 * Lädt alle Anfragen vom Server oder Demo-Daten
 */
async function loadAnfragen() {
    // Anzeigen, dass die Daten geladen werden
    anfrageContainer.innerHTML = '<div class="loading">Anfragen werden geladen...</div>';
    
    try {
        console.log('Lade Anfragen direkt über die API...');
        const anfragen = await loadAnfragenDirekt();
        
        if (anfragen && anfragen.length > 0) {
            // Wenn Anfragen erfolgreich geladen wurden
            alleAnfragen = anfragen;
            
            // Anfragen im LocalStorage speichern für Offline-Zugriff
            saveAnfragen();
            
            // Anfragen anzeigen
            renderAnfragen();
            return;
        }
    } catch (error) {
        console.log('Fehler beim direkten Laden der Anfragen:', error);
        
        // Zeige Fehlermeldung statt Demo-Daten zu laden
        anfrageContainer.innerHTML = `
            <div class="error-container">
                <h3>Fehler beim Laden der Anfragen</h3>
                <p>${error.message}</p>
                <p>
                    <strong>Hinweis für den Administrator:</strong><br>
                    Bitte überprüfen Sie die API Gateway-Konfiguration:<br>
                    1. Existiert der Pfad /anfragen in Ihrer API?<br>
                    2. Ist die POST-Methode für diesen Pfad konfiguriert?<br>
                    3. Wurde die API nach den Änderungen neu bereitgestellt?<br>
                    4. Sind die CORS-Einstellungen korrekt?
                </p>
                <button class="retry-button" onclick="loadAnfragen()">
                    <i class="fas fa-sync"></i> Erneut versuchen
                </button>
                <button class="demo-button" onclick="loadDemoData()">
                    <i class="fas fa-vial"></i> Test-Daten anzeigen (nur für Entwicklungszwecke)
                </button>
            </div>
        `;
        
        showToast('Fehler beim Laden der Anfragen: ' + error.message, 'error');
        return;
    }
    
    // Nur ausführen, wenn explizit Demo-Modus aktiviert ist
    if (DEMO_MODUS) {
        console.log('Lade stattdessen gespeicherte oder Demo-Anfragen...');
        alleAnfragen = await loadSavedOrDemoAnfragen();
        renderAnfragen();
    }
}

/**
 * Lädt gespeicherte oder Demo-Anfragen
 */
function loadSavedOrDemoAnfragen() {
    try {
        // Versuche, gespeicherte Anfragen aus dem LocalStorage zu laden
        const savedAnfragen = localStorage.getItem('weissForstAnfragen');
        
        if (savedAnfragen) {
            alleAnfragen = JSON.parse(savedAnfragen);
        } else {
            // Wenn keine gespeicherten Daten vorhanden sind, lade Demo-Daten
            alleAnfragen = createDemoAnfragen();
            saveAnfragen();
        }
        
        renderAnfragen();
    } catch (error) {
        console.error("Fehler beim Laden der gespeicherten/Demo-Anfragen:", error);
        throw error;
    }
}

/**
 * Speichert die aktuellen Anfragen im LocalStorage
 */
function saveAnfragen() {
    try {
        localStorage.setItem('weissForstAnfragen', JSON.stringify(alleAnfragen));
        console.log("Anfragen im LocalStorage gespeichert");
    } catch (error) {
        console.error("Fehler beim Speichern der Anfragen im LocalStorage:", error);
    }
}

/**
 * Direkte Methode zum Laden der Anfragen
 */
async function loadAnfragenDirekt() {
    try {
        console.log('Versuche Anfragen über GET-Methode zu laden...');
        
        // Verwende GET-Methode, da die Lambda-Funktion jetzt korrekt konfiguriert ist
        const response = await fetchAPI(GET_ANFRAGEN_API_ENDPOINT, {
            method: 'GET', // Jetzt GET statt POST verwenden
            headers: {
                'Accept': 'application/json'
            }
        });
        
        if (!response.ok) {
            const errorBody = await response.text();
            console.error('API-Antwort nicht OK:', response.status, errorBody);
            throw new Error(`HTTP-Fehler: ${response.status} - ${errorBody}`);
        }
        
        // Parse JSON-Antwort
        const data = await response.json();
        console.log('Erhaltene Daten von der API:', data);
        
        // Verbesserte Erkennung des Datenformats
        if (Array.isArray(data)) {
            console.log('Daten direkt als Array erhalten');
            if (processAnfragenData(data)) {
                return alleAnfragen;
            }
        } else if (typeof data === 'object') {
            // Verschiedene mögliche Formate durchprobieren
            
            // 1. Direkt die Items-Property
            if (data.Items && Array.isArray(data.Items)) {
                console.log('Daten als data.Items erhalten');
                if (processAnfragenData(data.Items)) {
                    return alleAnfragen;
                }
            }
            // 2. Im body-String (typisch für API Gateway)
            else if (data.body) {
                try {
                    const bodyData = typeof data.body === 'string' ? JSON.parse(data.body) : data.body;
                    console.log('Daten aus data.body geparst:', bodyData);
                    
                    if (Array.isArray(bodyData)) {
                        if (processAnfragenData(bodyData)) {
                            return alleAnfragen;
                        }
                    } else if (bodyData.Items && Array.isArray(bodyData.Items)) {
                        if (processAnfragenData(bodyData.Items)) {
                            return alleAnfragen;
                        }
                    }
                } catch (parseError) {
                    console.error("Fehler beim Parsen von data.body:", parseError);
                }
            }
            // 3. Falls alle anderen Eigenschaften fehlschlagen, versuche das Objekt selbst
            else {
                console.log('Versuche, das Objekt direkt zu verarbeiten');
                const dataValues = Object.values(data);
                if (dataValues.length > 0 && Array.isArray(dataValues[0])) {
                    if (processAnfragenData(dataValues[0])) {
                        return alleAnfragen;
                    }
                } else if (processAnfragenData([data])) {
                    return alleAnfragen;
                }
            }
        }
        
        // Wenn alle Versuche fehlschlagen, zeige die rohen Daten in der Konsole
        console.error("Daten konnten nicht verarbeitet werden. Rohdaten:", data);
        throw new Error('Die Daten konnten nicht im erwarteten Format verarbeitet werden. Siehe Konsole für Details.');
    } catch (error) {
        console.error('Fehler beim direkten Laden der Anfragen:', error);
        throw error;
    }
}

/**
 * Speichert Änderungen an einer Anfrage
 */
async function saveAnfrageChanges() {
    if (!aktuelleAnfrage) {
        console.error("Keine aktuelle Anfrage zum Speichern vorhanden");
        return;
    }
    
    try {
        const status = document.getElementById('anfrage-status').value;
        const bearbeiter = document.getElementById('anfrage-bearbeiter')?.value || '';
        const notizen = document.getElementById('anfrage-notizen')?.value || '';
        const terminDatum = document.getElementById('termin-datum')?.value || '';
        const terminZeit = document.getElementById('termin-zeit')?.value || '';
        
        // Originaldaten für den Vergleich speichern
        const originalAnfrage = { ...aktuelleAnfrage };
        
        // Aktualisiere die lokale Anfrage
        aktuelleAnfrage.status = status;
        aktuelleAnfrage.bearbeiter = bearbeiter;
        aktuelleAnfrage.notizen = notizen;
        aktuelleAnfrage.terminDatum = terminDatum;
        aktuelleAnfrage.terminZeit = terminZeit;
        
        if (!DEMO_MODUS) {
            // API-Aufruf implementieren - PUT für das Aktualisieren einer Anfrage mit ID
            const updateData = {
                status: status,
                bearbeiter: bearbeiter,
                notizen: notizen,
                terminDatum: terminDatum,
                terminZeit: terminZeit
            };
            
            // Korrektes URL-Muster, wie es von der Lambda-Funktion erwartet wird
            const response = await fetchAPI(`${PUT_ANFRAGEN_API_ENDPOINT}/${aktuelleAnfrage.id}`, {
                method: 'PUT', // Lambda unterstützt sowohl PUT als auch POST
                body: JSON.stringify(updateData)
            });
            
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`HTTP-Fehler: ${response.status} - ${errorText || 'Fehler beim Aktualisieren'}`);
            }
            
            console.log('Änderungen erfolgreich gespeichert:', response);
        }
        
        // Lokale Daten aktualisieren
        const index = alleAnfragen.findIndex(a => a.id === aktuelleAnfrage.id);
        if (index !== -1) {
            alleAnfragen[index] = aktuelleAnfrage;
            saveAnfragen();
        }
        
        // UI aktualisieren
        renderAnfragen();
        
        // Modal schließen
        document.getElementById('anfrage-detail-modal').style.display = 'none';
        
        // Erfolgsmeldung
        showToast('Änderungen gespeichert!', 'success');
        
    } catch (error) {
        console.error("Fehler beim Speichern der Änderungen:", error);
        showToast(`Fehler: ${error.message}`, 'error');
    }
}

/**
 * Markiert eine Anfrage als abgeschlossen
 * @param {string} id Die ID der Anfrage
 */
async function markAsCompleted(id) {
    if (!confirm(`Möchten Sie diese Anfrage als abgeschlossen markieren?`)) {
        return;
    }
    
    try {
        // Finde die Anfrage
        const anfrage = alleAnfragen.find(a => a.id === id);
        if (!anfrage) {
            throw new Error("Anfrage nicht gefunden");
        }
        
        // Status aktualisieren
        anfrage.status = 'Abgeschlossen';
        
        if (!DEMO_MODUS) {
            // API-Aufruf implementieren - PUT für das Aktualisieren einer Anfrage
            const updateData = {
                status: 'Abgeschlossen'
            };
            
            // Korrektes URL-Muster, wie es von der Lambda-Funktion erwartet wird
            const response = await fetchAPI(`${PUT_ANFRAGEN_API_ENDPOINT}/${id}`, {
                method: 'PUT', // Lambda unterstützt sowohl PUT als auch POST
                body: JSON.stringify(updateData)
            });
            
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`HTTP-Fehler: ${response.status} - ${errorText || 'Fehler beim Aktualisieren'}`);
            }
            
            console.log('Anfrage erfolgreich als abgeschlossen markiert:', response);
        }
        
        // UI aktualisieren
        saveAnfragen();
        renderAnfragen();
        
        // Erfolgsmeldung
        showToast("Anfrage als abgeschlossen markiert", "success");
        
    } catch (error) {
        console.error("Fehler beim Markieren als abgeschlossen:", error);
        showToast(`Fehler: ${error.message}`, 'error');
    }
}

/**
 * Verarbeitet die API-Daten und aktualisiert die UI entsprechend
 * @param {object|array} data - Die Anfragedaten vom Server
 * @returns {boolean} True wenn Anfragen erfolgreich verarbeitet wurden, sonst False
 */
function processAnfragenData(data) {
    try {
        let processedData;
        
        // API kann Daten in verschiedenen Formaten zurückgeben
        if (Array.isArray(data)) {
            // Wenn data bereits ein Array ist
            processedData = data;
        } else if (data.body && typeof data.body === 'string') {
            // Wenn data.body ein String ist, versuche ihn zu parsen
            try {
                processedData = JSON.parse(data.body);
            } catch (parseError) {
                console.error("Fehler beim Parsen von data.body:", parseError);
                return false;
            }
        } else if (data.Items && Array.isArray(data.Items)) {
            // DynamoDB-Format
            processedData = data.Items;
        } else {
            console.error("Unbekanntes Datenformat:", data);
            return false;
        }
        
        if (!Array.isArray(processedData)) {
            console.error("Verarbeitete Daten sind kein Array:", processedData);
            return false;
        }
        
        // Setze die Anfragen und aktualisiere die UI
        alleAnfragen = processedData;
        saveAnfragen();
        renderAnfragen();
        return true;
        
    } catch (error) {
        console.error("Fehler bei der Datenverarbeitung:", error);
        return false;
    }
}

/**
 * Rendert die Anfragen basierend auf dem aktuellen Filter
 */
function renderAnfragen() {
    console.log("Rendere Anfragen, Filter:", aktuellerFilter);
    
    // Keine Anfragen vorhanden
    if (!alleAnfragen || alleAnfragen.length === 0) {
        anfrageContainer.innerHTML = `
            <div class="anfrage-leer">
                <i class="fas fa-inbox fa-3x"></i>
                <p>Keine Anfragen vorhanden</p>
            </div>
        `;
        return;
    }
    
    // Anfragen filtern
    let gefilterteAnfragen = [...alleAnfragen];
    if (aktuellerFilter.toLowerCase() !== 'alle') {
        gefilterteAnfragen = alleAnfragen.filter(anfrage => 
            anfrage.status && anfrage.status.toLowerCase() === aktuellerFilter.toLowerCase()
        );
    }
    
    // Keine Anfragen nach der Filterung
    if (gefilterteAnfragen.length === 0) {
        anfrageContainer.innerHTML = `
            <div class="anfrage-leer">
                <i class="fas fa-filter fa-3x"></i>
                <p>Keine ${aktuellerFilter} Anfragen gefunden</p>
            </div>
        `;
        return;
    }
    
    // Anfragen nach Datum sortieren (neueste zuerst)
    gefilterteAnfragen.sort((a, b) => {
        const dateA = a.timestamp || a.erstelltAm || '2000-01-01';
        const dateB = b.timestamp || b.erstelltAm || '2000-01-01';
        return new Date(dateB) - new Date(dateA);
    });
    
    // Anfragen rendern
    let html = '';
    gefilterteAnfragen.forEach(anfrage => {
        const statusClass = getStatusClass(anfrage.status);
        const datum = anfrage.timestamp || anfrage.erstelltAm || 'Unbekannt';
        const formattedDatum = formatDate(datum);
        
        // Termin-Badge hinzufügen, falls vorhanden (unterstützt alte und neue Feldnamen)
        let terminBadge = '';
        
        // Prüfe neue Feldnamen (appointment_date und appointment_time)
        if (anfrage.appointment_date) {
            terminBadge = `
                <span class="termin-badge">
                    <i class="fas fa-calendar-alt"></i> Termin: ${anfrage.appointment_date} ${anfrage.appointment_time || ''}
                </span>
            `;
        } 
        // Prüfe alte Feldnamen (terminDatum und terminZeit) als Fallback
        else if (anfrage.terminDatum) {
            terminBadge = `
                <span class="termin-badge">
                    <i class="fas fa-calendar-alt"></i> Termin: ${anfrage.terminDatum} ${anfrage.terminZeit || ''}
                </span>
            `;
        }
        
        // Telefonnummer und E-Mail-Feld können verschiedene Namen haben
        const telefon = anfrage.phone || anfrage.telefon || anfrage.telephone || 'Keine Telefonnummer';
        const email = anfrage.email || anfrage.emailAddress || anfrage.email_address || 'Keine E-Mail';
        const adresse = anfrage.address || anfrage.adresse || 'Keine Adresse angegeben';
        
        html += `
            <div class="anfrage-card">
                <span class="status-badge status-${statusClass}">${anfrage.status || 'Neu'}</span>
                
                <div class="anfrage-datum">
                    <i class="fas fa-clock"></i> ${formattedDatum}
                </div>
                
                ${terminBadge}
                
                <div class="anfrage-details">
                    <h3>${anfrage.name || 'Kein Name'}</h3>
                    <p><i class="fas fa-home"></i> ${adresse}</p>
                    <p><i class="fas fa-phone"></i> ${telefon}</p>
                    <p><i class="fas fa-envelope"></i> ${email}</p>
                </div>
                
                <div class="anfrage-aktionen">
                    <button onclick="showAnfrageDetails('${anfrage.id}')" class="view-details-btn">
                        <i class="fas fa-eye"></i> Details
                    </button>
                    ${anfrage.status !== 'Abgeschlossen' ? `
                        <button onclick="markAsCompleted('${anfrage.id}')" class="mark-completed-btn">
                            <i class="fas fa-check"></i> Abschließen
                        </button>
                    ` : ''}
                </div>
            </div>
        `;
    });
    
    anfrageContainer.innerHTML = html;
}

/**
 * Zeigt die Detailansicht einer Anfrage an
 * @param {string} id Die ID der Anfrage
 */
function showAnfrageDetails(id) {
    // Zu der Detail-Seite navigieren und die Anfrage-ID als Parameter übergeben
    window.location.href = `admin_anfrage_detail.html?id=${id}`;
}

/**
 * Initialisiert die Google Map und zeigt die Arbeitsbereiche an
 * @param {object} anfrage Die aktuelle Anfrage
 */
function initializeMap(anfrage) {
    const mapElement = document.getElementById('google-map');
    if (!mapElement) return;
    
    // Fallback-Koordinaten (Deutschland)
    const defaultPosition = { lat: 51.1657, lng: 10.4515 };
    
    // Karte initialisieren
    const map = new google.maps.Map(mapElement, {
        zoom: 6,
        center: defaultPosition,
        mapTypeId: 'roadmap',
        mapTypeControl: true,
        streetViewControl: false,
        fullscreenControl: true
    });
    
    // Arbeitsbereiche anzeigen, falls vorhanden
    const arbeitsbereiche = anfrage.arbeitsbereiche || [];
    
    if (arbeitsbereiche.length > 0) {
        // Für jeden Arbeitsbereich ein Polygon erstellen
        arbeitsbereiche.forEach((bereich, index) => {
            if (bereich.coordinates && bereich.coordinates.length > 0) {
                // Polygon erstellen
                const polygon = new google.maps.Polygon({
                    paths: bereich.coordinates,
                    strokeColor: getRandomColor(),
                    strokeOpacity: 0.8,
                    strokeWeight: 2,
                    fillColor: getRandomColor(),
                    fillOpacity: 0.35,
                    map: map
                });
                
                // Bounds berechnen, um die Karte auf alle Polygone zu zentrieren
                const bounds = new google.maps.LatLngBounds();
                bereich.coordinates.forEach(coord => {
                    bounds.extend(new google.maps.LatLng(coord.lat, coord.lng));
                });
                
                // Info-Fenster mit Bereichsname
                const infoWindow = new google.maps.InfoWindow({
                    content: `<div><strong>Bereich ${index + 1}:</strong> ${bereich.name || 'Ohne Namen'}</div>`
                });
                
                // Klick-Handler für das Polygon
                google.maps.event.addListener(polygon, 'click', (event) => {
                    infoWindow.setPosition(event.latLng);
                    infoWindow.open(map);
                });
                
                // Karte auf den Arbeitsbereich zoomen
                map.fitBounds(bounds);
            }
        });
    }
}

/**
 * Generiert eine zufällige Farbe für Polygone
 * @returns {string} Eine hexadezimale Farbdarstellung
 */
function getRandomColor() {
    const letters = '0123456789ABCDEF';
    let color = '#';
    for (let i = 0; i < 6; i++) {
        color += letters[Math.floor(Math.random() * 16)];
    }
    return color;
}

/**
 * Öffnet den Editor für Arbeitsbereiche
 * @param {object} anfrage Die aktuelle Anfrage
 */
function openArbeitsbereicheEditor(anfrage) {
    // Aktuellen Zustand der Arbeitsbereiche sichern
    const aktuelleArbeitsbereiche = aktuelleAnfrage.arbeitsbereiche || [];
    
    // Modal für Arbeitsbereiche erstellen, falls noch nicht vorhanden
    let arbeitsbereicheModal = document.getElementById('arbeitsbereiche-modal');
    
    if (!arbeitsbereicheModal) {
        arbeitsbereicheModal = document.createElement('div');
        arbeitsbereicheModal.id = 'arbeitsbereiche-modal';
        arbeitsbereicheModal.className = 'modal';
        arbeitsbereicheModal.innerHTML = `
            <div class="modal-inhalt" style="max-width: 800px;">
                <div class="modal-header">
                    <h2>Arbeitsbereiche bearbeiten</h2>
                    <span class="close-button">&times;</span>
                </div>
                <div class="modal-body">
                    <div id="editor-map-container" style="height: 400px; margin-bottom: 15px;">
                        <div id="editor-map" style="height: 100%; width: 100%;"></div>
                    </div>
                    <div class="editor-controls">
                        <div class="editor-buttons">
                            <button id="add-bereich-button" class="action-button">
                                <i class="fas fa-plus"></i> Neuen Bereich hinzufügen
                            </button>
                            <button id="clear-drawing-button" class="action-button">
                                <i class="fas fa-trash"></i> Zeichnung löschen
                            </button>
                        </div>
                        <div class="bereiche-liste" id="editor-bereiche-liste">
                            <!-- Wird dynamisch gefüllt -->
                        </div>
                    </div>
                </div>
                <div class="modal-footer">
                    <button id="save-bereiche-button" class="primary-button">Speichern</button>
                    <button id="cancel-bereiche-button">Abbrechen</button>
                </div>
            </div>
        `;
        document.body.appendChild(arbeitsbereicheModal);
        
        // Event-Listener für das Schließen
        const closeButton = arbeitsbereicheModal.querySelector('.close-button');
        closeButton.addEventListener('click', () => {
            arbeitsbereicheModal.style.display = 'none';
        });
        
        // Event-Listener für Abbrechen
        const cancelButton = document.getElementById('cancel-bereiche-button');
        cancelButton.addEventListener('click', () => {
            arbeitsbereicheModal.style.display = 'none';
        });
    }
    
    // Modal anzeigen
    arbeitsbereicheModal.style.display = 'block';
    
    // Diese Funktion würde aufgerufen, wenn Google Maps geladen ist
    if (window.google && window.google.maps) {
        initializeArbeitsbereicheEditor(anfrage, arbeitsbereicheModal);
    } else {
        // Fehlermeldung anzeigen
        document.getElementById('editor-map-container').innerHTML = `
            <div style="height: 100%; display: flex; align-items: center; justify-content: center; background-color: #f0f0f0;">
                <p>Google Maps nicht verfügbar. Bitte laden Sie die Seite neu und versuchen Sie es erneut.</p>
            </div>
        `;
    }
}

/**
 * Initialisiert den Arbeitsbereich-Editor mit Google Maps
 * @param {object} anfrage Die aktuelle Anfrage
 * @param {HTMLElement} modal Das Modal-Element
 */
function initializeArbeitsbereicheEditor(anfrage, modal) {
    // Google Maps für den Editor initialisieren
    const mapElement = document.getElementById('editor-map');
    if (!mapElement) return;
    
    // Fallback-Koordinaten (Deutschland)
    const defaultPosition = { lat: 51.1657, lng: 10.4515 };
    
    // Karte initialisieren
    const map = new google.maps.Map(mapElement, {
        zoom: 6,
        center: defaultPosition,
        mapTypeId: 'roadmap',
        mapTypeControl: true,
        streetViewControl: false,
        fullscreenControl: true
    });
    
    // Drawing Manager initialisieren
    const drawingManager = new google.maps.drawing.DrawingManager({
        drawingMode: null,
        drawingControl: true,
        drawingControlOptions: {
            position: google.maps.ControlPosition.TOP_CENTER,
            drawingModes: [
                google.maps.drawing.OverlayType.POLYGON
            ]
        },
        polygonOptions: {
            editable: true,
            draggable: true,
            fillColor: '#FF8C00',
            fillOpacity: 0.35,
            strokeColor: '#FF8C00',
            strokeWeight: 2
        }
    });
    
    drawingManager.setMap(map);
    
    // Vorhandene Arbeitsbereiche anzeigen und editierbar machen
    const arbeitsbereiche = anfrage.arbeitsbereiche || [];
    const editorPolygons = [];
    
    // Liste der Bereiche im Editor anzeigen
    renderBereicheListe(arbeitsbereiche);
    
    if (arbeitsbereiche.length > 0) {
        // Bounds für alle Polygone
        const bounds = new google.maps.LatLngBounds();
        
        // Für jeden Arbeitsbereich ein editierbares Polygon erstellen
        arbeitsbereiche.forEach((bereich, index) => {
            if (bereich.coordinates && bereich.coordinates.length > 0) {
                // Polygon erstellen
                const polygon = new google.maps.Polygon({
                    paths: bereich.coordinates,
                    strokeColor: getRandomColor(),
                    strokeOpacity: 0.8,
                    strokeWeight: 2,
                    fillColor: getRandomColor(),
                    fillOpacity: 0.35,
                    editable: true,
                    draggable: true,
                    map: map
                });
                
                // Polygon speichern
                editorPolygons.push({
                    polygon: polygon,
                    name: bereich.name,
                    index: index
                });
                
                // Bounds berechnen
                bereich.coordinates.forEach(coord => {
                    bounds.extend(new google.maps.LatLng(coord.lat, coord.lng));
                });
            }
        });
        
        // Karte auf vorhandene Arbeitsbereiche zoomen
        if (!bounds.isEmpty()) {
            map.fitBounds(bounds);
        }
    }
    
    // Event-Listener für das Zeichnen eines neuen Polygons
    google.maps.event.addListener(drawingManager, 'polygoncomplete', function(polygon) {
        // Zeichenmodus deaktivieren
        drawingManager.setDrawingMode(null);
        
        // Neuen Arbeitsbereich hinzufügen
        const newIndex = editorPolygons.length;
        editorPolygons.push({
            polygon: polygon,
            name: `Neuer Bereich ${newIndex + 1}`,
            index: newIndex
        });
        
        // Bereiche-Liste aktualisieren
        const updatedBereiche = getUpdatedBereiche();
        renderBereicheListe(updatedBereiche);
    });
    
    // Event-Listener für den "Neuen Bereich hinzufügen"-Button
    document.getElementById('add-bereich-button').addEventListener('click', function() {
        // Zeichenmodus aktivieren
        drawingManager.setDrawingMode(google.maps.drawing.OverlayType.POLYGON);
    });
    
    // Event-Listener für den "Zeichnung löschen"-Button
    document.getElementById('clear-drawing-button').addEventListener('click', function() {
        // Alle Polygone entfernen
        editorPolygons.forEach(item => {
            item.polygon.setMap(null);
        });
        
        // Array leeren
        editorPolygons.length = 0;
        
        // Indizes aktualisieren
        editorPolygons.forEach((item, i) => {
            item.index = i;
        });
        
        // Liste neu rendern
        renderBereicheListe([]);
    });
    
    // Event-Listener für den "Speichern"-Button
    document.getElementById('save-bereiche-button').addEventListener('click', function() {
        // Aktuelle Arbeitsbereiche aus den Polygonen extrahieren
        const updatedBereiche = getUpdatedBereiche();
        
        // In der Anfrage speichern
        aktuelleAnfrage.arbeitsbereiche = updatedBereiche;
        
        // Modal schließen
        modal.style.display = 'none';
        
        // Hauptansicht aktualisieren
        showAnfrageDetails(aktuelleAnfrage.id);
    });
    
    /**
     * Extrahiert die aktuellen Arbeitsbereiche aus den Polygonen
     * @returns {Array} Die aktualisierten Arbeitsbereiche
     */
    function getUpdatedBereiche() {
        return editorPolygons.map((item, index) => {
            const polygon = item.polygon;
            const path = polygon.getPath();
            const coordinates = [];
            
            for (let i = 0; i < path.getLength(); i++) {
                const point = path.getAt(i);
                coordinates.push({
                    lat: point.lat(),
                    lng: point.lng()
                });
            }
            
            return {
                name: item.name,
                coordinates: coordinates
            };
        });
    }
    
    /**
     * Rendert die Liste der Bereiche im Editor
     * @param {Array} bereiche Die anzuzeigenden Bereiche
     */
    function renderBereicheListe(bereiche) {
        const listeElement = document.getElementById('editor-bereiche-liste');
        
        if (bereiche.length === 0) {
            listeElement.innerHTML = '<div class="keine-bereiche">Keine Arbeitsbereiche definiert</div>';
            return;
        }
        
        // HTML für die Bereiche erstellen
        const bereicheHTML = bereiche.map((bereich, index) => {
            return `
                <div class="bereich-item" data-index="${index}">
                    <input type="text" class="bereich-name-input" value="${bereich.name || `Bereich ${index + 1}`}" 
                           placeholder="Bereichsname" data-index="${index}">
                    <button class="bereich-remove-button" data-index="${index}">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            `;
        }).join('');
        
        listeElement.innerHTML = bereicheHTML;
        
        // Event-Listener für die Namensänderungen
        const nameInputs = listeElement.querySelectorAll('.bereich-name-input');
        nameInputs.forEach(input => {
            input.addEventListener('change', function() {
                const index = parseInt(this.dataset.index);
                if (editorPolygons[index]) {
                    editorPolygons[index].name = this.value;
                }
            });
        });
        
        // Event-Listener für die Lösch-Buttons
        const removeButtons = listeElement.querySelectorAll('.bereich-remove-button');
        removeButtons.forEach(button => {
            button.addEventListener('click', function() {
                const index = parseInt(this.dataset.index);
                if (editorPolygons[index]) {
                    // Polygon von der Karte entfernen
                    editorPolygons[index].polygon.setMap(null);
                    
                    // Aus dem Array entfernen
                    editorPolygons.splice(index, 1);
                    
                    // Indizes aktualisieren
                    editorPolygons.forEach((item, i) => {
                        item.index = i;
                    });
                    
                    // Liste neu rendern
                    renderBereicheListe(getUpdatedBereiche());
                }
            });
        });
    }
}

/**
 * Fügt einen Termin zum Kalender hinzu
 * @param {object} anfrage Die aktuelle Anfrage
 */
function addTerminToCalendar(anfrage) {
    const terminDatumElement = document.getElementById('termin-datum');
    const terminZeitElement = document.getElementById('termin-zeit');
    
    if (!terminDatumElement.value) {
        showToast('Bitte wählen Sie ein Datum für den Termin aus.', 'warning');
        return;
    }
    
    const terminDatum = terminDatumElement.value;
    const terminZeit = terminZeitElement.value || '12:00';
    
    // Titel und Beschreibung für den Kalendereintrag erstellen
    const titel = `Termin: ${anfrage.name || 'Kunde'}`;
    const beschreibung = `Anfrage ID: ${anfrage.id}\nName: ${anfrage.name || 'Nicht angegeben'}\nE-Mail: ${anfrage.email || 'Nicht angegeben'}\nTelefon: ${anfrage.phone || 'Nicht angegeben'}\n\nNachricht: ${anfrage.message || 'Keine Nachricht'}\n\nNotizen: ${anfrage.notizen || 'Keine Notizen'}`;
    
    // Startzeit und Endzeit berechnen
    const [stunden, minuten] = terminZeit.split(':').map(Number);
    const startDate = new Date(terminDatum);
    startDate.setHours(stunden, minuten, 0, 0);
    
    const endDate = new Date(startDate);
    endDate.setHours(endDate.getHours() + 1); // Standarddauer: 1 Stunde
    
    // Google Calendar Link erstellen
    const startISO = startDate.toISOString().replace(/-|:|\.\d+/g, '');
    const endISO = endDate.toISOString().replace(/-|:|\.\d+/g, '');
    
    const calendarUrl = `https://www.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(titel)}&dates=${startISO}/${endISO}&details=${encodeURIComponent(beschreibung)}&sf=true&output=xml`;
    
    // In neuem Tab öffnen
    window.open(calendarUrl, '_blank');
    
    // Termin in der Anfrage speichern
    aktuelleAnfrage.terminDatum = terminDatum;
    aktuelleAnfrage.terminZeit = terminZeit;
    
    // Erfolgsmeldung anzeigen
    showToast('Termin wurde im Kalender geöffnet', 'success');
}

/**
 * Speichert Änderungen an einer Anfrage
 */
async function saveAnfrageChanges() {
    if (!aktuelleAnfrage) {
        console.error("Keine aktuelle Anfrage zum Speichern vorhanden");
        return;
    }
    
    try {
        const status = document.getElementById('anfrage-status').value;
        const bearbeiter = document.getElementById('anfrage-bearbeiter')?.value || '';
        const notizen = document.getElementById('anfrage-notizen')?.value || '';
        const terminDatum = document.getElementById('termin-datum')?.value || '';
        const terminZeit = document.getElementById('termin-zeit')?.value || '';
        
        // Originaldaten für den Vergleich speichern
        const originalAnfrage = { ...aktuelleAnfrage };
        
        // Aktualisiere die lokale Anfrage
        aktuelleAnfrage.status = status;
        aktuelleAnfrage.bearbeiter = bearbeiter;
        aktuelleAnfrage.notizen = notizen;
        aktuelleAnfrage.terminDatum = terminDatum;
        aktuelleAnfrage.terminZeit = terminZeit;
        // Arbeitsbereiche wurden bereits während des Editierens aktualisiert
        
        if (!DEMO_MODUS) {
            // API-Aufruf implementieren - PUT für das Aktualisieren einer Anfrage mit ID
            const updateData = {
                status: status,
                bearbeiter: bearbeiter,
                notizen: notizen,
                terminDatum: terminDatum,
                terminZeit: terminZeit,
                arbeitsbereiche: aktuelleAnfrage.arbeitsbereiche || []
            };
            
            // Korrektes URL-Muster, wie es von der Lambda-Funktion erwartet wird
            const response = await fetchAPI(`${PUT_ANFRAGEN_API_ENDPOINT}/${aktuelleAnfrage.id}`, {
                method: 'PUT', // Lambda unterstützt sowohl PUT als auch POST
                body: JSON.stringify(updateData)
            });
            
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`HTTP-Fehler: ${response.status} - ${errorText || 'Fehler beim Aktualisieren'}`);
            }
            
            console.log('Änderungen erfolgreich gespeichert:', response);
        }
        
        // Lokale Daten aktualisieren
        const index = alleAnfragen.findIndex(a => a.id === aktuelleAnfrage.id);
        if (index !== -1) {
            alleAnfragen[index] = aktuelleAnfrage;
            saveAnfragen();
        }
        
        // UI aktualisieren
        renderAnfragen();
        
        // Modal schließen
        document.getElementById('anfrage-detail-modal').style.display = 'none';
        
        // Erfolgsmeldung
        showToast('Änderungen gespeichert!', 'success');
        
    } catch (error) {
        console.error("Fehler beim Speichern der Änderungen:", error);
        showToast(`Fehler: ${error.message}`, 'error');
    }
}

/**
 * Erstellt Demo-Anfragen für die Anzeige
 * @returns {Array} Ein Array mit Demo-Anfragen
 */
function createDemoAnfragen() {
    const now = new Date();
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const lastWeek = new Date(now);
    lastWeek.setDate(lastWeek.getDate() - 7);
    
    return [
        {
            id: 'demo1',
            name: 'Max Mustermann',
            email: 'max@example.com',
            phone: '0123 456789',
            address: 'Musterstraße 1, 12345 Musterstadt',
            message: 'Ich benötige Hilfe bei der Entfernung von drei Bäumen in meinem Garten.',
            status: 'Neu',
            timestamp: now.toISOString(),
            bearbeiter: '',
            notizen: ''
        },
        {
            id: 'demo2',
            name: 'Anna Schmidt',
            email: 'anna@example.com',
            phone: '0987 654321',
            address: 'Beispielweg 42, 54321 Beispielstadt',
            message: 'Anfrage für Brennholzlieferung für den kommenden Winter.',
            status: 'In Bearbeitung',
            timestamp: yesterday.toISOString(),
            bearbeiter: 'Thomas',
            notizen: 'Kunde wünscht Lieferung Anfang Oktober.',
            terminDatum: '2025-10-01',
            terminZeit: '09:00'
        },
        {
            id: 'demo3',
            name: 'Peter Meyer',
            email: 'peter@example.com',
            phone: '01234 56789',
            address: 'Waldstraße 7, 98765 Forstheim',
            message: 'Benötige ein Angebot für die Pflanzung einer neuen Hecke.',
            status: 'Abgeschlossen',
            timestamp: lastWeek.toISOString(),
            bearbeiter: 'Michael',
            notizen: 'Kunde hat Angebot akzeptiert. Hecke wurde am 15.04. gepflanzt.'
        }
    ];
}

/**
 * Gibt die CSS-Klasse für einen Status zurück
 * @param {string} status Der Status-Text
 * @returns {string} Die CSS-Klasse
 */
function getStatusClass(status) {
    if (!status) return 'neu';
    
    switch (status.toLowerCase()) {
        case 'neu':
            return 'neu';
        case 'in bearbeitung':
            return 'bearbeitung';
        case 'abgeschlossen':
            return 'abgeschlossen';
        default:
            return 'neu';
    }
}

/**
 * Formatiert ein Datum in eine lesbare Form
 * @param {string} dateString Das zu formatierende Datum
 * @returns {string} Das formatierte Datum
 */
function formatDate(dateString) {
    if (!dateString || dateString === 'Unbekannt') return 'Unbekannt';
    
    try {
        const date = new Date(dateString);
        return date.toLocaleDateString('de-DE', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    } catch (error) {
        console.error("Fehler beim Formatieren des Datums:", error);
        return dateString;
    }
}

/**
 * Zeigt eine Toast-Meldung an
 * @param {string} message - Die Nachricht
 * @param {string} type - Der Typ der Meldung (info, success, warning, error)
 */
function showToast(message, type = 'info') {
    // Container für Toast-Meldungen erstellen, falls noch nicht vorhanden
    let toastContainer = document.querySelector('.toast-container');
    
    if (!toastContainer) {
        toastContainer = document.createElement('div');
        toastContainer.className = 'toast-container';
        toastContainer.style.position = 'fixed';
        toastContainer.style.bottom = '20px';
        toastContainer.style.right = '20px';
        toastContainer.style.zIndex = '10000';
        document.body.appendChild(toastContainer);
    }
    
    // Toast-Element erstellen
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.style.padding = '12px 20px';
    toast.style.margin = '10px 0';
    toast.style.borderRadius = '4px';
    toast.style.color = 'white';
    toast.style.boxShadow = '0 2px 5px rgba(0, 0, 0, 0.2)';
    toast.style.display = 'flex';
    toast.style.alignItems = 'center';
    toast.style.maxWidth = '350px';
    toast.style.opacity = '0';
    toast.style.transition = 'opacity 0.3s';
    
    // Farbe je nach Typ setzen
    switch (type) {
        case 'success':
            toast.style.backgroundColor = '#4CAF50';
            break;
        case 'warning':
            toast.style.backgroundColor = '#FF9800';
            break;
        case 'error':
            toast.style.backgroundColor = '#F44336';
            break;
        default:
            toast.style.backgroundColor = '#2196F3';
    }
    
    // Icon je nach Typ
    let icon = '';
    switch (type) {
        case 'success':
            icon = 'check-circle';
            break;
        case 'warning':
            icon = 'exclamation-triangle';
            break;
        case 'error':
            icon = 'exclamation-circle';
            break;
        default:
            icon = 'info-circle';
    }
    
    toast.innerHTML = `
        <i class="fas fa-${icon}" style="margin-right: 10px;"></i>
        <span>${message}</span>
    `;
    
    // Toast zum Container hinzufügen
    toastContainer.appendChild(toast);
    
    // Toast anzeigen
    setTimeout(() => {
        toast.style.opacity = '1';
    }, 10);
    
    // Toast nach 3 Sekunden entfernen
    setTimeout(() => {
        toast.style.opacity = '0';
        
        // Nach der Ausblend-Animation entfernen
        setTimeout(() => {
            if (toastContainer.contains(toast)) {
                toastContainer.removeChild(toast);
            }
            
            // Container entfernen, wenn keine Toasts mehr vorhanden sind
            if (toastContainer.children.length === 0) {
                document.body.removeChild(toastContainer);
            }
        }, 300);
    }, 3000);
}

/**
 * Lädt Demo-Daten für Testansicht
 */
function loadDemoData() {
    // Anzeigen, dass Demo-Daten geladen werden
    anfrageContainer.innerHTML = '<div class="loading">Demo-Daten werden geladen...</div>';
    
    // Banner anzeigen, dass Demo-Daten verwendet werden
    showToast('Es werden Test-Daten angezeigt, keine echten Daten!', 'warning');
    
    // Demo-Daten erstellen und anzeigen
    alleAnfragen = createDemoAnfragen();
    
    // Hinweisbanner einfügen
    const demoBanner = document.createElement('div');
    demoBanner.className = 'demo-banner';
    demoBanner.innerHTML = `
        <strong>TEST-MODUS AKTIV</strong>
        <p>Sie sehen Test-Daten, nicht die tatsächlichen Anfragen. Dies dient nur zu Entwicklungszwecken.</p>
        <button class="retry-button" onclick="loadAnfragen()">
            <i class="fas fa-sync"></i> Echte Daten laden
        </button>
        <button class="demo-button" onclick="loadDemoData()">
            <i class="fas fa-vial"></i> Test-Daten anzeigen (nur für Entwicklungszwecke)
        </button>
    `;
    demoBanner.style.backgroundColor = '#FFF3CD';
    demoBanner.style.color = '#856404';
    demoBanner.style.padding = '10px';
    demoBanner.style.marginBottom = '20px';
    demoBanner.style.borderRadius = '5px';
    demoBanner.style.border = '1px solid #FFEEBA';
    
    // Banner vor den Anfragen einfügen
    anfrageContainer.innerHTML = '';
    anfrageContainer.appendChild(demoBanner);
    
    // Anfragen rendern
    renderAnfragen();
}
