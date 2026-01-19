// Gemeinsames PWA-Setup (Service Worker Registrierung)
// Diese Datei ist bewusst klein und wird in allen relevanten Seiten eingebunden.

(() => {
  try {
    if (!('serviceWorker' in navigator)) return;

    window.addEventListener('load', () => {
      navigator.serviceWorker
        .register('/sw.js')
        .then((registration) => {
          console.log('Service Worker registriert:', registration.scope);
        })
        .catch((error) => {
          console.warn('Service Worker Registrierung fehlgeschlagen:', error);
        });
    });
  } catch (e) {
    console.warn('PWA init Fehler:', e);
  }
})();

