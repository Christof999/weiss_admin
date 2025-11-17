/**
 * Klasse zur Verwaltung einzelner Arbeitsbereiche
 * Diese Klasse bietet eine einheitliche Schnittstelle für die Arbeit mit Arbeitsbereichen
 */
class Arbeitsbereich {
  /**
   * Erstellt eine neue Arbeitsbereich-Instanz
   * @param {string} name - Name des Arbeitsbereichs
   * @param {Array} coordinates - Array von lat/lng-Koordinaten
   * @param {string} id - Optionale ID, wenn nicht angegeben wird automatisch generiert
   */
  constructor(name, coordinates, id = null) {
    this.id = id || this._generateId();
    this.name = name || 'Neuer Bereich';
    this.coordinates = coordinates || [];
  }

  /**
   * Generiert eine eindeutige ID für den Arbeitsbereich
   * @returns {string} Eindeutige ID
   * @private
   */
  _generateId() {
    return 'bereich_' + new Date().getTime() + '_' + Math.floor(Math.random() * 1000);
  }

  /**
   * Konvertiert den Arbeitsbereich in ein GeoJSON-Objekt für die Speicherung
   * @returns {Object} GeoJSON-Feature-Objekt
   */
  toGeoJSON() {
    // Stellen Sie sicher, dass wir genügend Koordinaten haben
    if (!this.coordinates || this.coordinates.length < 3) {
      console.error('Ungültiger Arbeitsbereich: Zu wenige Koordinaten für ein Polygon', this.coordinates);
      return null;
    }
    
    // Array von Koordinaten im GeoJSON-Format erstellen [lng, lat]
    let coordsArray = this.coordinates.map(coord => [coord.lng, coord.lat]);
    
    // Stellen Sie sicher, dass das Polygon geschlossen ist (letzter Punkt = erster Punkt)
    if (coordsArray.length >= 3) {
      const firstPoint = coordsArray[0];
      const lastPoint = coordsArray[coordsArray.length - 1];
      
      // Prüfen, ob der Polygon bereits geschlossen ist
      if (firstPoint[0] !== lastPoint[0] || firstPoint[1] !== lastPoint[1]) {
        console.log('Schließe Polygon durch Hinzufügen des ersten Punktes am Ende');
        coordsArray.push([...firstPoint]); // Kopie des ersten Punktes hinzufügen
      }
    }
    
    console.log('GeoJSON-Koordinaten:', coordsArray);
    
    return {
      type: 'Feature',
      properties: {
        id: this.id,
        name: this.name
      },
      geometry: {
        type: 'Polygon',
        coordinates: [coordsArray]
      }
    };
  }

  /**
   * Erstellt eine Arbeitsbereich-Instanz aus einem GeoJSON-Objekt
   * @param {Object} geoJson - GeoJSON-Feature-Objekt
   * @returns {Arbeitsbereich|null} Neue Arbeitsbereich-Instanz oder null bei ungültigen Daten
   */
  static fromGeoJSON(geoJson) {
    console.log('fromGeoJSON erhält:', JSON.stringify(geoJson));
    
    if (!geoJson) {
      console.warn('GeoJSON ist null oder undefiniert');
      return null;
    }
    
    // Koordinaten extrahieren
    let coordinates = [];
    let name = 'Unbenannter Bereich';
    let id = null;
    
    try {
      // 1. Verarbeitung von DynamoDB-Format mit polygon-Eigenschaft als String
      if (geoJson.polygon) {
        // ID und Name direkt übernehmen
        id = geoJson.id;
        name = geoJson.name || 'Unbenannter Bereich';
        
        // Wenn polygon 'null' ist, geben wir einen leeren Arbeitsbereich zurück
        if (geoJson.polygon === 'null') {
          console.warn('Polygon ist als "null"-String gespeichert');
          return new Arbeitsbereich(name, [], id);
        }
        
        // Polygon-JSON parsen
        try {
          console.log('Versuche Polygon-String zu parsen:', geoJson.polygon);
          const parsedPolygon = JSON.parse(geoJson.polygon);
          
          // GeoJSON Feature-Format
          if (parsedPolygon.type === 'Feature' && parsedPolygon.geometry) {
            if (parsedPolygon.geometry.type === 'Polygon' && 
                Array.isArray(parsedPolygon.geometry.coordinates) && 
                parsedPolygon.geometry.coordinates.length > 0) {
              
              coordinates = parsedPolygon.geometry.coordinates[0].map(coord => ({
                lat: coord[1],
                lng: coord[0]
              }));
              console.log('Feature-Format Koordinaten extrahiert:', coordinates.length);
              
              // Übernehme zusätzliche Eigenschaften, falls vorhanden
              if (parsedPolygon.properties) {
                name = parsedPolygon.properties.name || name;
                id = parsedPolygon.properties.id || id;
              }
            }
          }
          // Direktes Polygon-Format
          else if (parsedPolygon.type === 'Polygon' && 
                   Array.isArray(parsedPolygon.coordinates) && 
                   parsedPolygon.coordinates.length > 0) {
            
            coordinates = parsedPolygon.coordinates[0].map(coord => ({
              lat: coord[1],
              lng: coord[0]
            }));
            console.log('Direktes Polygon-Format Koordinaten extrahiert:', coordinates.length);
          }
        } catch (parseError) {
          console.error('Fehler beim Parsen des Polygon-Strings:', parseError);
        }
      }
      // 2. Direktes GeoJSON-Format ohne String-Konvertierung
      else {
        // Feature Format
        if (geoJson.type === 'Feature' && geoJson.geometry) {
          if (geoJson.properties) {
            name = geoJson.properties.name || name;
            id = geoJson.properties.id || id;
          }
          
          if (geoJson.geometry.type === 'Polygon' && 
              Array.isArray(geoJson.geometry.coordinates) && 
              geoJson.geometry.coordinates.length > 0) {
            
            coordinates = geoJson.geometry.coordinates[0].map(coord => ({
              lat: coord[1],
              lng: coord[0]
            }));
            console.log('Feature-Format Koordinaten extrahiert:', coordinates.length);
          }
        }
        // Direktes Polygon-Format
        else if (geoJson.type === 'Polygon' && 
                 Array.isArray(geoJson.coordinates) && 
                 geoJson.coordinates.length > 0) {
          
          coordinates = geoJson.coordinates[0].map(coord => ({
            lat: coord[1],
            lng: coord[0]
          }));
          console.log('Direktes Polygon-Format extrahiert:', coordinates.length);
        }
        // Direktes Koordinatenarray im lat/lng Format
        else if (Array.isArray(geoJson) && geoJson.length > 0 && 
                 typeof geoJson[0].lat !== 'undefined' && 
                 typeof geoJson[0].lng !== 'undefined') {
          
          coordinates = geoJson;
          console.log('Direktes lat/lng Array extrahiert:', coordinates.length);
        }
      }
      
      // Fehlerbehandlung: Keine Koordinaten gefunden
      if (!coordinates || coordinates.length === 0) {
        console.warn('Koordinaten konnten nicht extrahiert werden:', geoJson);
      } else {
        console.log('Extrahierte Koordinaten:', coordinates);
      }
    } catch (error) {
      console.error('Fehler beim Extrahieren der Koordinaten:', error, geoJson);
    }
    
    return new Arbeitsbereich(name, coordinates, id);
  }
}

// Für ES Modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = Arbeitsbereich;
} else {
  window.Arbeitsbereich = Arbeitsbereich;
}
