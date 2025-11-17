/**
 * API-Manager zur Verwaltung aller API-Aufrufe
 * Behält die unterschiedlichen API-Endpunkte bei und vereinheitlicht die Kommunikation
 */
class ApiManager {
  constructor() {
    // Primäre API-Endpunkte - Verwende die PUT-URL auch für GET, da die GET-URL Probleme macht
    this.GET_ANFRAGEN_BASE_URL = 'https://dx7fo93g1i.execute-api.eu-central-1.amazonaws.com/prod';
    this.PUT_ANFRAGEN_BASE_URL = 'https://xnkjq7sfe2.execute-api.eu-central-1.amazonaws.com/prod';
    this.ALT_API_BASE_URL = 'https://ilxyp19ev8.execute-api.eu-central-1.amazonaws.com/test1';
    
    // Endpunkte für verschiedene Operationen
    this.GET_ANFRAGEN_API_ENDPOINT = `${this.GET_ANFRAGEN_BASE_URL}/anfragen`;
    this.PUT_ANFRAGEN_API_ENDPOINT = `${this.PUT_ANFRAGEN_BASE_URL}/anfragen`;
    
    // Kombinierte Endpunkte
    this.ANFRAGEN_API_ENDPOINT = `${this.PUT_ANFRAGEN_BASE_URL}/anfragen`;
  }

  /**
   * Hilfsfunktion für API-Aufrufe, mit Bypass für Service Worker
   * @param {string} url - Die URL für die Anfrage
   * @param {object} options - Die Optionen für die Anfrage (method, headers, body)
   * @returns {Promise<Response>} - Die Antwort des Fetch-Aufrufs
   */
  async fetchAPI(url, options = {}) {
    // Service Worker umgehen
    let bypassUrl = `${url}${url.includes('?') ? '&' : '?'}noserviceworker=${Date.now()}`;
    console.log('Verwende Bypass-URL:', bypassUrl);
    
    // Default-Werte für Options setzen
    options.method = options.method || 'GET';
    
    // WICHTIG: no-cors Modus entfernen, wenn PUT, PATCH oder DELETE verwendet wird
    // no-cors unterstützt nur GET, POST und HEAD
    if (options.mode === 'no-cors' && ['PUT', 'PATCH', 'DELETE'].includes(options.method.toUpperCase())) {
      console.warn(`Entferne 'no-cors' Modus für ${options.method} Request, da dieser Modus nur GET, POST und HEAD unterstützt`);
      delete options.mode;
    }
    
    // Headers zusammenführen
    options.headers = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      ...(options.headers || {})
    };
    
    console.log('Fetch API Options:', options);
    if (options.body) {
      console.log('Request Body:', options.body);
    }
    
    // Request ausführen
    try {
      const response = await fetch(bypassUrl, options);
      console.log('API-Antwort Status:', response.status, response.statusText);
      
      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Keine Detailinformationen verfügbar');
        throw new Error(`HTTP Fehler! Status: ${response.status}. Details: ${errorText}`);
      }
      
      return response;
    } catch (error) {
      console.error('Fehler bei fetchAPI:', error);
      throw error;
    }
  }

  /**
   * Lädt eine Anfrage anhand ihrer ID
   * @param {string} anfrageId - Die ID der zu ladenden Anfrage
   * @returns {Promise<Object>} - Die geladene Anfrage
   */
  async getAnfrage(anfrageId) {
    console.log(`Lade Anfrage mit ID: ${anfrageId}`);
    
    // Verwende nur die PUT-URL, da die GET-URL 405-Fehler verursacht
    const url = `${this.PUT_ANFRAGEN_API_ENDPOINT}/${anfrageId}`;
    
    try {
      // Verwende PUT-URL mit GET-Methode (oder PUT falls erforderlich)
      const response = await this.fetchAPI(url, { method: 'GET' });
      const responseData = await response.json();
      
      console.log('Anfrage-Daten von der API:', responseData);
      
      // Verarbeite Arbeitsbereiche aus verschiedenen möglichen Strukturen
      // 1. Prüfe DynamoDB Item-Struktur (wenn vorhanden)
      if (responseData.Item && typeof responseData.Item === 'object') {
        console.log('DynamoDB Item-Struktur in der Antwort gefunden');
        
        // Arbeitsbereiche aus Item extrahieren
        if (responseData.Item.arbeitsbereiche) {
          responseData.arbeitsbereiche = responseData.Item.arbeitsbereiche;
          console.log('Arbeitsbereiche aus Item-Struktur extrahiert:', responseData.arbeitsbereiche);
        }
        
        // Weitere wichtige Felder aus Item extrahieren
        Object.keys(responseData.Item).forEach(key => {
          if (key !== 'arbeitsbereiche') {
            responseData[key] = responseData.Item[key];
          }
        });
      }
      
      // 2. Standardprüfung auf Arbeitsbereiche auf oberster Ebene
      if (!responseData.arbeitsbereiche) {
        responseData.arbeitsbereiche = [];
        console.log('Keine Arbeitsbereiche in der API-Antwort - initialisiere leere Liste');
      } else {
        console.log('Arbeitsbereiche aus API-Antwort:', responseData.arbeitsbereiche);
      }
      
      return responseData;
    } catch (error) {
      console.error('Fehler beim Laden der Anfrage:', error);
      
      // Versuchen, stattdessen eine PUT-Anfrage zu senden (falls die API dies erfordert)
      try {
        console.log('Versuche alternative Methode (PUT) für die Anfrage');
        const altResponse = await this.fetchAPI(url, { method: 'PUT', body: JSON.stringify({}) });
        const altResponseData = await altResponse.json();
        
        if (!altResponseData) {
          console.error('Keine Antwort von der API erhalten');
          return null;
        }
        
        // Stelle sicher, dass arbeitsbereiche ein Array ist
        if (!altResponseData.arbeitsbereiche) {
          altResponseData.arbeitsbereiche = [];
          console.log('Keine Arbeitsbereiche in der API-Antwort - initialisiere leere Liste');
        }
        
        return altResponseData;
      } catch (fallbackError) {
        console.error('Fehler beim alternativen Laden der Anfrage:', fallbackError);
        return null;
      }
    }
  }

  /**
   * Aktualisiert eine Anfrage über die API
   * @param {string} anfrageId - Die ID der Anfrage
   * @param {Object} data - Die aktualisierten Daten
   * @returns {Promise<Object>} - Die Antwort der API
   */
  async updateAnfrage(anfrageId, data) {
    if (!anfrageId) {
      throw new Error('Keine Anfrage-ID angegeben');
    }
    
    console.log(`Aktualisiere Anfrage mit ID: ${anfrageId}`, data);
    
    // Verwende direkt die Haupt-API, da die alternative API CORS-Probleme hat
    const url = `${this.ANFRAGEN_API_ENDPOINT}/${anfrageId}`;
    
    // Prüfen, ob das DynamoDB Item-Format verwendet wird
    // Dies ist ein Format wie: { Item: { id: '123', status: 'neu', ... } }
    if (data.Item && typeof data.Item === 'object') {
      console.log('DynamoDB Item-Format erkannt, sende direkt an API');
      return await this.fetchAPI(url, {
        method: 'PUT',
        body: JSON.stringify(data)
      });
    }
    
    // Für andere Formate: Standardmäßig die Daten für DynamoDB formatieren
    // WICHTIG: DynamoDB erwartet exakte Struktur und Typen
    let dynamoDBFormat = {};
    
    // Pflichtfelder
    dynamoDBFormat.id = anfrageId;
    
    // Konvertiere alle Werte nach dem erwarteten DynamoDB-Schema
    if (data.status) dynamoDBFormat.status = String(data.status);
    if (data.bearbeiter) dynamoDBFormat.bearbeiter = String(data.bearbeiter);
    if (data.notizen) dynamoDBFormat.notizen = String(data.notizen);
    
    // Termin-Daten
    if (data.terminDatum) dynamoDBFormat.appointment_date = String(data.terminDatum);
    if (data.terminZeit) dynamoDBFormat.appointment_time = String(data.terminZeit);
    
    // Andere Felder, falls vorhanden
    if (data.name) dynamoDBFormat.name = String(data.name);
    if (data.email) dynamoDBFormat.email = String(data.email);
    if (data.phone) dynamoDBFormat.phone = String(data.phone);
    
    // Nur für Debugging
    console.log('DynamoDB-Format:', dynamoDBFormat);
    
    try {
      // Anfrage an API senden - explizit als JSON stringifizieren
      const jsonString = JSON.stringify(dynamoDBFormat);
      console.log('JSON-String für DynamoDB:', jsonString);
      
      const response = await this.fetchAPI(url, {
        method: 'PUT',
        body: jsonString
      });
      
      // Daten auslesen
      const responseData = await response.json();
      console.log('Antwort nach Aktualisierung:', responseData);
      
      return responseData;
    } catch (error) {
      console.error(`API-Fehler: ${error.message}`);
      
      // Minimales Format als letzten Versuch
      try {
        const bareMinimum = {
          id: anfrageId,
          status: "Updated"
        };
        
        console.log('Letzter Versuch mit Minimal-Format:', bareMinimum);
        
        const minResponse = await this.fetchAPI(url, {
          method: 'PUT',
          body: JSON.stringify(bareMinimum)
        });
        
        return await minResponse.json();
      } catch (lastError) {
        console.error('Auch Minimal-Format fehlgeschlagen:', lastError);
        throw new Error('Speichern fehlgeschlagen nach mehreren Versuchen');
      }
    }
  }

  /**
   * Lädt alle Anfragen
   * @returns {Promise<Array>} - Die geladenen Anfragen
   */
  async getAllAnfragen() {
    console.log('Lade alle Anfragen');
    
    // URL zusammenbauen
    const url = `${this.ANFRAGEN_API_ENDPOINT}`;
    
    // Anfrage an API senden
    const response = await this.fetchAPI(url);
    
    // Daten auslesen
    const data = await response.json();
    console.log('Alle Anfragen von der API:', data);
    
    return data;
  }

  /**
   * Führt eine API-Operation durch und behandelt Fehler einheitlich
   * @param {Function} operation - Die auszuführende API-Operation (Promise-Funktion)
   * @param {string} errorMessage - Die Fehlermeldung bei einem Fehler
   * @param {Function} onLoading - Callback für Ladezustand
   * @param {Function} onError - Callback für Fehlerfall
   * @returns {Promise<any>} - Das Ergebnis der Operation oder null bei einem Fehler
   */
  async handleApiOperation(operation, errorMessage, onLoading, onError) {
    try {
      if (onLoading) onLoading(true);
      const result = await operation();
      if (onLoading) onLoading(false);
      return result;
    } catch (error) {
      console.error(errorMessage, error);
      if (onLoading) onLoading(false);
      if (onError) onError(error.message);
      return null;
    }
  }
}

// Singleton-Instanz exportieren
window.apiManager = new ApiManager();
