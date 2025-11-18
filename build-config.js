#!/usr/bin/env node
/**
 * Build-Script für Vercel Deployment
 * Erstellt config.js aus Environment Variables
 */

const fs = require('fs');
const path = require('path');

// Hole Environment Variables (Vercel stellt diese zur Verfügung)
const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY || '';
const API_BASE_URL = process.env.API_BASE_URL || 'https://ilxyp19ev8.execute-api.eu-central-1.amazonaws.com/test1';

// Prüfe ob API Key vorhanden ist
if (!GOOGLE_MAPS_API_KEY) {
    console.error('⚠️  WARNUNG: GOOGLE_MAPS_API_KEY Environment Variable nicht gesetzt!');
    console.error('   Die Karte wird nicht funktionieren.');
    console.error('   Setze die Variable in Vercel: Project Settings > Environment Variables');
}

// Erstelle config.js Inhalt
const configContent = `// Konfigurationsdatei (automatisch generiert)
// WICHTIG: Diese Datei wird beim Build automatisch erstellt!
// Ändere diese Datei nicht manuell - verwende stattdessen Environment Variables in Vercel.

window.Config = {
    API_BASE_URL: "${API_BASE_URL}",
    AUTH_TOKEN_KEY: "weiss_forst_auth_token",
    AUTH_EXPIRY_KEY: "weiss_forst_auth_expiry",
    LOGIN_PAGE: "index.html",
    GOOGLE_MAPS_API_KEY: "${GOOGLE_MAPS_API_KEY}"
};
`;

// Schreibe config.js
const configPath = path.join(__dirname, 'config.js');
fs.writeFileSync(configPath, configContent, 'utf8');

console.log('✅ config.js wurde erfolgreich erstellt');
if (GOOGLE_MAPS_API_KEY) {
    console.log(`   API Key: ${GOOGLE_MAPS_API_KEY.substring(0, 10)}...`);
} else {
    console.log('   ⚠️  Kein API Key gesetzt!');
}

