/**
 * Manager für die Verwaltung aller Arbeitsbereiche
 * Bietet Methoden zum Hinzufügen, Entfernen und Anzeigen von Arbeitsbereichen auf der Karte
 */
class ArbeitsbereichManager {
  /**
   * Erstellt eine neue Manager-Instanz
   * @param {google.maps.Map} map - Google Maps Instanz (optional)
   */
  constructor(map = null) {
    this.map = map;
    this.arbeitsbereiche = [];
    this.polygons = new Map(); // Map für Referenzen auf Google Maps Polygone
    this.activePolygon = null; // Aktiv bearbeitetes Polygon
    this.drawingManager = null; // Google Maps Drawing Manager
    this.drawingMode = false; // Flag für aktiven Zeichenmodus
    this.lastValidLocation = null; // Speichert den letzten gültigen Standort
  }

  /**
   * Setzt die Google Maps Instanz
   * @param {google.maps.Map} map - Google Maps Instanz
   */
  setMap(map) {
    this.map = map;
    this.renderAllBereiche();
  }

  /**
   * Lädt Arbeitsbereiche aus den API-Daten
   * @param {Array} apiArbeitsbereiche - Array von Arbeitsbereichsdaten aus der API
   */
  loadFromAPI(apiArbeitsbereiche) {
    this.clearAll();
    
    if (!apiArbeitsbereiche || !Array.isArray(apiArbeitsbereiche)) {
      console.warn('Keine gültigen Arbeitsbereiche in API-Daten gefunden');
      return;
    }
    
    console.log('Lade Arbeitsbereiche aus API:', apiArbeitsbereiche);
    
    apiArbeitsbereiche.forEach(bereichData => {
      try {
        // Je nach Format der Daten aus der API
        const bereich = window.Arbeitsbereich.fromGeoJSON(bereichData);
        if (bereich) {
          this.addBereich(bereich);
        }
      } catch (error) {
        console.error('Fehler beim Laden eines Arbeitsbereichs:', error);
      }
    });
    
    console.log('Geladene Arbeitsbereiche:', this.arbeitsbereiche);
  }

  /**
   * Entfernt alle Arbeitsbereiche von der Karte und aus dem Speicher
   */
  clearAll() {
    // Alle Polygone von der Karte entfernen
    this.polygons.forEach(polygon => {
      if (polygon) polygon.setMap(null);
    });
    this.polygons.clear();
    this.arbeitsbereiche = [];
  }

  /**
   * Fügt einen neuen Arbeitsbereich hinzu
   * @param {Arbeitsbereich} bereich - Arbeitsbereich-Instanz
   * @returns {Arbeitsbereich} Hinzugefügter Arbeitsbereich
   */
  addBereich(bereich) {
    this.arbeitsbereiche.push(bereich);
    if (this.map && bereich.coordinates && bereich.coordinates.length > 0) {
      this.renderBereich(bereich);
    }
    return bereich;
  }

  /**
   * Entfernt einen Arbeitsbereich
   * @param {string} id - ID des zu entfernenden Arbeitsbereichs
   */
  removeBereich(id) {
    // Polygon von der Karte entfernen
    const polygon = this.polygons.get(id);
    if (polygon) {
      polygon.setMap(null);
      this.polygons.delete(id);
    }
    
    // Aus dem Array entfernen
    this.arbeitsbereiche = this.arbeitsbereiche.filter(bereich => bereich.id !== id);
  }

  /**
   * Rendert einen Arbeitsbereich auf der Karte
   * @param {Arbeitsbereich} bereich - Zu rendernder Arbeitsbereich
   * @returns {google.maps.Polygon} Das erstellte Polygon
   */
  renderBereich(bereich) {
    if (!this.map || !bereich.coordinates || bereich.coordinates.length === 0) {
      console.warn('Karte oder Koordinaten nicht verfügbar, Bereich wird nicht gerendert:', bereich);
      return null;
    }
    
    // Zufällige Farben generieren
    const strokeColor = this._getRandomColor();
    const fillColor = this._getRandomColor();
    
    // Polygon erstellen
    const polygon = new google.maps.Polygon({
      paths: bereich.coordinates,
      strokeColor: strokeColor,
      strokeOpacity: 0.8,
      strokeWeight: 2,
      fillColor: fillColor,
      fillOpacity: 0.35,
      map: this.map,
      bereichId: bereich.id // Speichere die ID am Polygon
    });
    
    // Speichern für spätere Referenz
    this.polygons.set(bereich.id, polygon);
    
    // Info-Fenster für Bereich-Details
    const infoWindow = new google.maps.InfoWindow({
      content: `<div><strong>${bereich.name}</strong></div>`
    });
    
    // Klick-Handler für das Polygon
    google.maps.event.addListener(polygon, 'click', (event) => {
      // Info-Fenster öffnen
      infoWindow.setPosition(event.latLng);
      infoWindow.open(this.map);
      
      // Karte auf den Arbeitsbereich zentrieren
      this.centerMapOnBereich(bereich);
    });
    
    return polygon;
  }

  /**
   * Rendert alle Arbeitsbereiche auf der Karte
   */
  renderAllBereiche() {
    if (!this.map) {
      console.warn('Keine Karte verfügbar, Arbeitsbereiche werden nicht gerendert');
      return;
    }
    
    // Zuerst alle bestehenden Polygone von der Karte entfernen
    this.polygons.forEach(polygon => {
      polygon.setMap(null);
    });
    this.polygons.clear();
    
    // Alle Arbeitsbereiche rendern
    this.arbeitsbereiche.forEach(bereich => {
      if (bereich.coordinates && bereich.coordinates.length > 0) {
        this.renderBereich(bereich);
      }
    });
    
    // Wenn Arbeitsbereiche vorhanden sind, zentriere die Karte auf sie
    if (this.arbeitsbereiche.length > 0) {
      this.centerMapOnAllBereiche();
    }
  }

  /**
   * Zentriert die Karte auf alle Arbeitsbereiche
   */
  centerMapOnAllBereiche() {
    if (!this.map || this.arbeitsbereiche.length === 0) {
      return;
    }
    
    console.log('Zentriere Karte auf alle Arbeitsbereiche');
    
    // Bounds-Objekt erstellen, um alle Arbeitsbereiche einzuschließen
    const bounds = new google.maps.LatLngBounds();
    let hasValidCoordinates = false;
    
    // Alle Koordinaten der Arbeitsbereiche zu den Bounds hinzufügen
    this.arbeitsbereiche.forEach(bereich => {
      if (bereich.coordinates && bereich.coordinates.length > 0) {
        bereich.coordinates.forEach(coord => {
          if (coord.lat && coord.lng) {
            bounds.extend(coord);
            hasValidCoordinates = true;
          }
        });
      }
    });
    
    // Karte auf alle Polygone zoomen, wenn vorhanden
    if (hasValidCoordinates && !bounds.isEmpty()) {
      this.map.fitBounds(bounds);
      
      // Zoom anpassen, falls zu stark gezoomt
      const listener = google.maps.event.addListenerOnce(this.map, 'bounds_changed', function() {
        if (this.getZoom() > 16) {
          this.setZoom(16);
        }
      });
    }
  }

  /**
   * Zentriert die Karte auf einen bestimmten Arbeitsbereich
   * @param {Arbeitsbereich} bereich - Der Arbeitsbereich auf den zentriert werden soll
   */
  centerMapOnBereich(bereich) {
    if (!this.map || !bereich || !bereich.coordinates || bereich.coordinates.length === 0) {
      return;
    }
    
    console.log('Zentriere Karte auf Arbeitsbereich:', bereich.id);
    
    // Bounds-Objekt erstellen, um den Arbeitsbereich einzuschließen
    const bounds = new google.maps.LatLngBounds();
    
    // Alle Koordinaten des Arbeitsbereichs zu den Bounds hinzufügen
    bereich.coordinates.forEach(coord => {
      if (coord.lat && coord.lng) {
        bounds.extend(coord);
      }
    });
    
    // Karte auf die Bounds zentrieren
    this.map.fitBounds(bounds);
    
    // Zoom anpassen, falls zu stark gezoomt
    const listener = google.maps.event.addListenerOnce(this.map, 'bounds_changed', function() {
      if (this.getZoom() > 15) {
        this.setZoom(15);
      }
    });
  }

  /**
   * Initialisiert den Drawing Manager für die Bearbeitung von Arbeitsbereichen
   */
  initializeDrawingTools() {
    if (!this.map || !google.maps.drawing) {
      console.error('Google Maps oder Drawing Library nicht verfügbar');
      return;
    }
    
    // Drawing Manager konfigurieren
    this.drawingManager = new google.maps.drawing.DrawingManager({
      drawingMode: null,
      drawingControl: true,
      drawingControlOptions: {
        position: google.maps.ControlPosition.TOP_CENTER,
        drawingModes: ['polygon']
      },
      polygonOptions: {
        editable: true,
        draggable: true,
        strokeColor: '#FF0000',
        strokeOpacity: 0.8,
        strokeWeight: 2,
        fillColor: '#FF0000',
        fillOpacity: 0.35
      }
    });
    
    // Drawing Manager der Karte hinzufügen
    this.drawingManager.setMap(this.map);
    
    // Event-Listener für das Zeichnen von Polygonen
    google.maps.event.addListener(this.drawingManager, 'polygoncomplete', (polygon) => {
      // Drawing-Mode deaktivieren nach dem Zeichnen
      this.drawingManager.setDrawingMode(null);
      
      // Koordinaten aus dem Polygon extrahieren
      const path = polygon.getPath();
      const coordinates = [];
      for (let i = 0; i < path.getLength(); i++) {
        const point = path.getAt(i);
        coordinates.push({
          lat: point.lat(),
          lng: point.lng()
        });
      }
      
      // Neuen Arbeitsbereich erstellen
      const bereich = new window.Arbeitsbereich('Neuer Bereich', coordinates);
      this.addBereich(bereich);
      
      // Temporäres Polygon entfernen
      polygon.setMap(null);
      
      // Eigenes Polygon mit Event-Handlern rendern
      this.renderBereich(bereich);
      
      // Callback für UI-Update
      if (typeof this.onArbeitsbereichAdded === 'function') {
        this.onArbeitsbereichAdded(bereich);
      }
    });
  }

  /**
   * Generiert eine zufällige Farbe für Polygone
   * @returns {string} Hexadezimaler Farbwert
   * @private
   */
  _getRandomColor() {
    const letters = '0123456789ABCDEF';
    let color = '#';
    for (let i = 0; i < 6; i++) {
      color += letters[Math.floor(Math.random() * 16)];
    }
    return color;
  }

  /**
   * Bereitet die Arbeitsbereiche für die API vor
   * @returns {Array} Array von GeoJSON-Objekten für die API
   */
  prepareForAPI() {
    return this.arbeitsbereiche.map(bereich => bereich.toGeoJSON());
  }
  
  /**
   * Exportiert die Arbeitsbereiche im Format für die API
   * @returns {Array} Array von GeoJSON-Objekten für die API
   */
  exportBereicheToAPI() {
    console.log('Exportiere Arbeitsbereiche für API:', this.arbeitsbereiche);
    const exportedBereiche = this.prepareForAPI();
    console.log('Exportierte Arbeitsbereiche:', exportedBereiche);
    return exportedBereiche;
  }
  
  /**
   * Exportiert die Arbeitsbereiche im Format für DynamoDB
   * @param {string} format - Das zu verwendende Format ('geometry_only', 'stringified', 'raw_coordinates')
   * @returns {Array} Array von Arbeitsbereich-Objekten im DynamoDB-Format
   */
  exportToDynamoDBFormat(format = 'api_compatible') {
    if (!this.arbeitsbereiche || this.arbeitsbereiche.length === 0) {
      return [];
    }
    
    console.log(`Exportiere Arbeitsbereiche im Format '${format}' für DynamoDB`);
    
    // Verschiedene Formate zur Verfügung stellen, um das richtige zu finden
    switch (format) {
      case 'api_compatible':
        // Exakt das Format verwenden, das wir auch von der API erhalten
        // Dadurch sicherstellen, dass die Lambda-Funktion es verarbeiten kann
        return this.arbeitsbereiche.map(bereich => {
          const geoJson = bereich.toGeoJSON();
          return {
            id: bereich.id,
            name: bereich.name || 'Unbenannter Bereich',
            polygon: JSON.stringify(geoJson)
          };
        });
        
      case 'geometry_only':
        // Nur die Geometry-Komponente verwenden (ohne Feature-Wrapper)
        return this.arbeitsbereiche.map(bereich => {
          const geoJson = bereich.toGeoJSON();
          return geoJson.geometry;
        });
        
      case 'stringified':
        // Als JSON-Strings serialisieren (oft erwartet DynamoDB das)
        return this.arbeitsbereiche.map(bereich => {
          const geoJson = bereich.toGeoJSON();
          return JSON.stringify(geoJson);
        });
        
      case 'raw_coordinates':
        // Nur die Koordinaten als Arrays zurückgeben
        return this.arbeitsbereiche.map(bereich => {
          const geoJson = bereich.toGeoJSON();
          return geoJson.geometry.coordinates[0];
        });
        
      case 'flattened':
        // Format für DynamoDB optimieren
        return this.arbeitsbereiche.map(bereich => {
          const geoJson = bereich.toGeoJSON();
          return {
            id: bereich.id,
            name: bereich.name || 'Arbeitsbereich',
            geometry_type: 'Polygon',
            coordinates_json: JSON.stringify(geoJson.geometry.coordinates)
          };
        });
      
      default:
        // Standard: API-kompatibles Format
        return this.exportToDynamoDBFormat('api_compatible');
    }
  }
  
  /**
   * Exportiert die Arbeitsbereiche im Format für DynamoDB
   * DynamoDB erwartet ein spezielles Format für GeoJSON-Objekte
   * @returns {Array} Array von Arbeitsbereich-Objekten im DynamoDB-Format
   */
  exportToDynamoDBFormat() {
    console.log('Exportiere Arbeitsbereiche für DynamoDB:', this.arbeitsbereiche);
    
    // Wenn keine Arbeitsbereiche vorhanden sind, leeres Array zurückgeben
    if (!this.arbeitsbereiche || this.arbeitsbereiche.length === 0) {
      return [];
    }
    
    // Arbeitsbereiche in DynamoDB-Format umwandeln
    const dynamoDbBereiche = this.arbeitsbereiche.map(bereich => {
      const geoJson = bereich.toGeoJSON();
      
      // DynamoDB-Format erstellen
      return {
        // Wichtig: Die IDs müssen erhalten bleiben
        id: bereich.id,
        name: bereich.name || 'Arbeitsbereich',
        // Das GeoJSON-Objekt wird als String gespeichert
        polygon: JSON.stringify(geoJson)
      };
    });
    
    console.log('Für DynamoDB formatierte Arbeitsbereiche:', dynamoDbBereiche);
    return dynamoDbBereiche;
  }
  
  /**
   * Startet den Zeichenmodus für neue Arbeitsbereiche
   */
  startDrawing() {
    if (!this.map || !this.drawingManager) {
      console.error('Karte oder DrawingManager nicht verfügbar');
      this.initializeDrawingTools(); // Versuche den DrawingManager zu initialisieren
      if (!this.drawingManager) return;
    }
    
    // Zeichenmodus auf Polygon setzen
    this.drawingManager.setDrawingMode(google.maps.drawing.OverlayType.POLYGON);
    this.drawingMode = true;
    console.log('Zeichenmodus gestartet');
  }
  
  /**
   * Stoppt den Zeichenmodus
   */
  stopDrawing() {
    if (!this.drawingManager) {
      console.error('DrawingManager nicht verfügbar');
      return;
    }
    
    // Zeichenmodus deaktivieren
    this.drawingManager.setDrawingMode(null);
    this.drawingMode = false;
    console.log('Zeichenmodus gestoppt');
  }
  
  /**
   * Speichert einen gültigen Standort für spätere Verwendung
   * @param {Object} location - Ein Objekt mit lat und lng Eigenschaften
   */
  setLastValidLocation(location) {
    if (location && location.lat && location.lng) {
      this.lastValidLocation = location;
      console.log('Letzter gültiger Standort gespeichert:', location);
    }
  }
  
  /**
   * Gibt den letzten gespeicherten gültigen Standort zurück
   * @returns {Object|null} - Ein Objekt mit lat und lng Eigenschaften oder null
   */
  getLastValidLocation() {
    return this.lastValidLocation;
  }
}

// Für ES Modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ArbeitsbereichManager;
} else {
  window.ArbeitsbereichManager = ArbeitsbereichManager;
}
