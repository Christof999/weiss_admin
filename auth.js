// Authentifizierungsmodul für die Admin-App
// Konfiguration aus config.js verwenden (falls verfügbar), sonst Fallback-Werte
const API_BASE_URL = (typeof window.Config !== 'undefined' && window.Config.API_BASE_URL) 
    ? window.Config.API_BASE_URL 
    : "https://ilxyp19ev8.execute-api.eu-central-1.amazonaws.com/test1";
const AUTH_TOKEN_KEY = (typeof window.Config !== 'undefined' && window.Config.AUTH_TOKEN_KEY) 
    ? window.Config.AUTH_TOKEN_KEY 
    : "weiss_forst_auth_token";
const AUTH_EXPIRY_KEY = (typeof window.Config !== 'undefined' && window.Config.AUTH_EXPIRY_KEY) 
    ? window.Config.AUTH_EXPIRY_KEY 
    : "weiss_forst_auth_expiry";
const LOGIN_PAGE = (typeof window.Config !== 'undefined' && window.Config.LOGIN_PAGE) 
    ? window.Config.LOGIN_PAGE 
    : "login.html";

/**
 * Führt die Authentifizierung durch und speichert das Token im localStorage
 * @param {string} username Benutzername 
 * @param {string} password Passwort
 * @returns {Promise<boolean>} true wenn erfolgreich, false wenn nicht
 */
async function authenticate(username, password) {
    try {
        // In einer produktiven Umgebung würden wir hier eine POST-Anfrage 
        // an einen sicheren API-Endpoint senden.
        // Da wir aktuell keine Backend-Authentifizierung haben, verwenden wir eine 
        // temporäre Lösung mit verschlüsselten Credentials (nicht sicher, aber besser als Klartext)
        
        // Verschlüsselte Credentials (Base64 + einfache XOR-Verschlüsselung)
        // Dies ist NICHT kryptographisch sicher, nur ein Hindernis für einfaches Auslesen
        const encryptedCredentials = {
            // Diese Werte würden in der Produktion von einem sicheren Backend generiert
            "THVrYXM=": "YWRtaW4xMjM0NTY=", // "Lukas" : "admin123456" (Base64 encoded)
            "Q2hyaXN0b2Y=": "Zm9yc3RHYnIyMDI1" // "Christof" : "forstGbr2025" (Base64 encoded)
        };
        
        // Einfache Funktion zum Verschlüsseln/Entschlüsseln (XOR mit einem geheimen Schlüssel)
        function simpleEncrypt(str, key = "WEI$$F0RST") {
            let result = '';
            for (let i = 0; i < str.length; i++) {
                result += String.fromCharCode(str.charCodeAt(i) ^ key.charCodeAt(i % key.length));
            }
            return btoa(result); // Base64 encode
        }
        
        function simpleDecrypt(encoded, key = "WEI$$F0RST") {
            const str = atob(encoded); // Base64 decode
            let result = '';
            for (let i = 0; i < str.length; i++) {
                result += String.fromCharCode(str.charCodeAt(i) ^ key.charCodeAt(i % key.length));
            }
            return result;
        }
        
        // Benutzer-Authentifizierung
        const encodedUsername = btoa(username);
        if (!encryptedCredentials[encodedUsername]) {
            return false;
        }
        
        const storedPassword = atob(encryptedCredentials[encodedUsername]);
        if (password !== storedPassword) {
            return false;
        }
        
        // Generiere ein JWT-ähnliches Token
        // In Produktion würde dies vom Backend erstellt und signiert werden
        const now = Date.now();
        const expiresIn = 8 * 60 * 60 * 1000; // 8 Stunden
        const expiry = now + expiresIn;
        
        const tokenPayload = {
            sub: username,
            iat: now,
            exp: expiry
        };
        
        // Token generieren (verschlüsselt mit unserem einfachen Algorithmus)
        // In Produktion würde ein echter JWT mit geeigneter Signierung verwendet werden
        const token = simpleEncrypt(JSON.stringify(tokenPayload));
        
        // Token und Ablaufzeit im localStorage speichern
        localStorage.setItem(AUTH_TOKEN_KEY, token);
        localStorage.setItem(AUTH_EXPIRY_KEY, expiry.toString());
        localStorage.setItem("loggedInUser", username); // Für Abwärtskompatibilität
        
        return true;
    } catch (error) {
        console.error("Authentifizierungsfehler:", error);
        return false;
    }
}

/**
 * Prüft, ob der Benutzer authentifiziert ist
 * @returns {boolean} true wenn authentifiziert, false wenn nicht
 */
function isAuthenticated() {
    const token = localStorage.getItem(AUTH_TOKEN_KEY);
    const expiry = localStorage.getItem(AUTH_EXPIRY_KEY);
    
    if (!token || !expiry) {
        return false;
    }
    
    // Prüfe, ob das Token abgelaufen ist
    if (Date.now() > parseInt(expiry, 10)) {
        // Token ist abgelaufen, lösche es
        logout();
        return false;
    }
    
    return true;
}

/**
 * Gibt den aktuellen Benutzer zurück
 * @returns {string|null} Benutzername oder null, wenn nicht angemeldet
 */
function getCurrentUser() {
    return localStorage.getItem("loggedInUser");
}

/**
 * Abmeldung des Benutzers
 */
function logout() {
    localStorage.removeItem(AUTH_TOKEN_KEY);
    localStorage.removeItem(AUTH_EXPIRY_KEY);
    localStorage.removeItem("loggedInUser");
}

/**
 * Schützt eine Seite vor unauthentifiziertem Zugriff
 * @param {string} loginPage Pfad zur Login-Seite (optional, verwendet LOGIN_PAGE aus Config wenn nicht angegeben)
 */
function protectPage(loginPage = null) {
    if (!isAuthenticated()) {
        window.location.href = loginPage || LOGIN_PAGE;
        return false;
    }
    return true;
}

/**
 * Fügt Authentifizierungsheader zu einer Fetch-Anfrage hinzu
 * @param {Object} options Fetch-Optionen
 * @returns {Object} Erweiterte Fetch-Optionen mit Auth-Header
 */
function addAuthHeaders(options = {}) {
    const token = localStorage.getItem(AUTH_TOKEN_KEY);
    
    if (!token) {
        return options;
    }
    
    return {
        ...options,
        headers: {
            ...options.headers,
            'Authorization': `Bearer ${token}`
        }
    };
}

// Exportiere die Funktionen als window.Auth (für Abwärtskompatibilität)
window.Auth = {
    API_BASE_URL,
    authenticate,
    isAuthenticated,
    getCurrentUser,
    logout,
    protectPage,
    addAuthHeaders
};

// Exportiere auch als window.NewAuth für Kompatibilität mit neueren Dateien
window.NewAuth = window.Auth;
