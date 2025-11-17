const API_ENDPOINT = 'https://avppe0rz0a.execute-api.eu-central-1.amazonaws.com/test1/gallery';

async function fetchGallery() {
    try {
        const response = await fetch(API_ENDPOINT);
        if (!response.ok) throw new Error(`HTTP-Error: ${response.status}`);

        const { body } = await response.json();
        const images = JSON.parse(body);

        console.log('Geladene Bilder:', images); // Debugging
        const galleryDiv = document.getElementById('gallery');
        galleryDiv.innerHTML = ''; // Galerie leeren

        images.forEach(img => {
            if (img.endsWith('/')) return; // Ignoriere Ordner-Einträge
            
            // Erstelle die korrekte Struktur mit den passenden CSS-Klassen
            const imgContainer = document.createElement('div');
            imgContainer.className = 'gallery-item';
            
            const imgElement = document.createElement('img');
            imgElement.src = `https://website-imageslw.s3.eu-central-1.amazonaws.com/${img}`;
            imgElement.alt = img;
            
            // Erstelle den Overlay-Bereich
            const overlay = document.createElement('div');
            overlay.className = 'overlay';
            
            // Erstelle den Controls-Bereich innerhalb des Overlays
            const controls = document.createElement('div');
            controls.className = 'gallery-controls';
            
            // Erstelle den Bearbeiten-Button
            const editButton = document.createElement('button');
            editButton.innerHTML = '<i class="fas fa-edit"></i>';
            editButton.title = 'Bearbeiten';
            editButton.onclick = (e) => {
                e.stopPropagation(); // Verhindert Bubble-Up des Events
                openEditModal(img);
            };
            
            // Erstelle den Löschen-Button
            const deleteButton = document.createElement('button');
            deleteButton.innerHTML = '<i class="fas fa-trash"></i>';
            deleteButton.title = 'Löschen';
            deleteButton.onclick = (e) => {
                e.stopPropagation(); // Verhindert Bubble-Up des Events
                if (confirm(`Möchten Sie das Bild "${img}" wirklich löschen?`)) {
                    deleteImage(img);
                }
            };
            
            // Füge die Buttons zum Controls-Bereich hinzu
            controls.appendChild(editButton);
            controls.appendChild(deleteButton);
            
            // Füge den Dateinamen zum Overlay hinzu
            const fileName = document.createElement('div');
            fileName.className = 'file-name';
            fileName.textContent = img.split('/').pop(); // Nur den Dateinamen anzeigen, nicht den vollständigen Pfad
            
            // Baue die Komponenten zusammen
            overlay.appendChild(fileName);
            overlay.appendChild(controls);
            
            imgContainer.appendChild(imgElement);
            imgContainer.appendChild(overlay);
            
            // Klick auf das Bild öffnet das Modal
            imgContainer.onclick = () => openEditModal(img);
            
            // Füge das fertige Element zur Galerie hinzu
            galleryDiv.appendChild(imgContainer);
        });
    } catch (error) {
        console.error('Fehler beim Abrufen der Galerie:', error);
        const galleryDiv = document.getElementById('gallery');
        galleryDiv.innerHTML = '<div class="gallery-error">Fehler beim Laden der Bilder. Bitte versuchen Sie es später erneut.</div>';
    }
}

// Funktion zum Öffnen des Bearbeiten-Modals
function openEditModal(img) {
    const modal = document.getElementById('imageModal');
    const container = document.getElementById('modalImageContainer');
    
    // Modal-Inhalt setzen
    container.innerHTML = '';
    const imgElement = document.createElement('img');
    imgElement.src = `https://website-imageslw.s3.eu-central-1.amazonaws.com/${img}`;
    imgElement.alt = img;
    imgElement.style.maxWidth = '100%';
    imgElement.style.maxHeight = '300px';
    
    // Dateinamen anzeigen
    const fileName = document.createElement('p');
    fileName.textContent = img;
    fileName.style.marginTop = '10px';
    fileName.style.fontWeight = 'bold';
    
    container.appendChild(imgElement);
    container.appendChild(fileName);
    
    // Löschen-Button konfigurieren
    const deleteBtn = document.querySelector('#imageModal .button');
    deleteBtn.onclick = () => {
        if (confirm(`Möchten Sie das Bild "${img}" wirklich löschen?`)) {
            deleteImage(img);
            closeModal();
        }
    };
    
    // Modal anzeigen
    modal.style.display = 'flex';
}

function closeModal() {
    document.getElementById('imageModal').style.display = 'none';
}

async function uploadImage() {
    const fileInput = document.getElementById('imageUpload');
    const file = fileInput.files[0];

    if (!file) {
        alert('Bitte wählen Sie eine Datei aus.');
        return;
    }

    const fileName = file.name;
    const fileContent = await file.arrayBuffer();

    console.log('ArrayBuffer erfolgreich erstellt.');

    try {
        const response = await fetch(API_ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                fileName,
                fileContent: btoa(
                    new Uint8Array(fileContent).reduce((data, byte) => data + String.fromCharCode(byte), '')
                ),
            }),
        });

        if (response.ok) {
            alert(`Bild ${fileName} erfolgreich hochgeladen!`);
            fetchGallery(); // Galerie aktualisieren
        } else {
            console.error('Fehler beim Hochladen des Bildes:', await response.text());
            alert('Fehler beim Hochladen des Bildes!');
        }
    } catch (error) {
        console.error('Fehler beim Hochladen des Bildes:', error);
    }
}

async function deleteImage(fileName) {
    try {
        console.log(`Lösche Bild: ${fileName}`);
        const response = await fetch('https://avppe0rz0a.execute-api.eu-central-1.amazonaws.com/test1/gallery', {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ fileName }),
        });

        const result = await response.json();
        console.log('Lösch-Ergebnis:', result);

        if (response.ok) {
            alert(`Bild ${fileName} erfolgreich gelöscht!`);
            await fetchGallery(); // Galerie aktualisieren
        } else {
            alert('Fehler beim Löschen des Bildes!');
        }
    } catch (error) {
        console.error('Fehler beim Löschen des Bildes:', error);
    }
}

// Galerie initial laden
fetchGallery();

document.addEventListener("DOMContentLoaded", () => {
    // Service Worker registrieren für PWA-Funktionalität
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('/sw.js')
            .then(registration => {
                console.log('Service Worker erfolgreich registriert mit Scope:', registration.scope);
            })
            .catch(error => {
                console.error('Service Worker Registrierung fehlgeschlagen:', error);
            });
    }

    // Hole den Benutzernamen aus dem localStorage
    const username = localStorage.getItem("loggedInUser") || "Admin"; // Fallback: "Admin"

    const greetingElement = document.getElementById("greeting");

    // Tageszeit ermitteln
    const hours = new Date().getHours();
    let greeting;

    if (hours < 12) {
        greeting = "Guten Morgen";
    } else if (hours < 18) {
        greeting = "Guten Tag";
    } else {
        greeting = "Guten Abend";
    }

    // Grußbotschaft einfügen
    greetingElement.textContent = `${greeting}, ${username}! Willkommen im Adminbereich.`;
});
