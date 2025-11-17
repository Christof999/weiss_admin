// Beitragsmanagement-Modul für Admin-App
// Die API_BASE_URL wird aus auth.js importiert (unterstützt auch config.js)

// Globale Variable für geladene Posts (Cache)
let cachedPosts = [];

async function loadPosts() {
    const postList = document.getElementById("posts");
    
    // Zeige den Ladeindikator an
    postList.innerHTML = `
        <div class="loader">
            <i class="fas fa-spinner fa-2x"></i>
            <p>Beiträge werden geladen...</p>
        </div>
    `;
    
    try {
        const posts = await fetchPostsFromS3(); 
        console.log("Posts aus fetchPostsFromS3():", posts);

        // Entferne den Ladeindikator
        postList.innerHTML = "";
        
        if (!Array.isArray(posts) || posts.length === 0) {
            console.error("Erwartet wurde ein Array, erhalten:", posts);
            postList.innerHTML = `
                <div class="post-empty">
                    <i class="fas fa-info-circle fa-2x" style="color: var(--primary-green); margin-bottom: 10px;"></i>
                    <p>Keine Beiträge gefunden. Fügen Sie unten einen neuen Beitrag hinzu.</p>
                </div>
            `;
            return;
        }

       
        posts.forEach(post => {
            const postCard = document.createElement("div");
            postCard.className = "post-card";
            
            // Vorschaubild mit Fallback für fehlende Bilder
            const imageUrl = post.imageUrl || 'images/placeholder.jpg';
            
            postCard.innerHTML = `
                <img src="${imageUrl}" alt="${post.title}" onerror="this.src='images/placeholder.jpg'; this.onerror=null;">
                <div class="post-content">
                    <h3>${post.title}</h3>
                    <p>${post.text}</p>
                </div>
                <div class="actions">
                    <button onclick="deletePost('${post.id}')">
                        <i class="fas fa-trash"></i> Löschen
                    </button>
                </div>
            `;
            postList.appendChild(postCard);
        });
    } catch (error) {
        console.error("Fehler beim Laden der Beiträge:", error, {
            message: error.message,
            stack: error.stack
        });
        
        postList.innerHTML = `
            <div class="post-empty">
                <i class="fas fa-exclamation-triangle fa-2x" style="color: #d9534f; margin-bottom: 10px;"></i>
                <p>Fehler beim Laden der Beiträge: ${error.message}</p>
                <button class="button" onclick="loadPosts()" style="margin-top: 10px;">
                    <i class="fas fa-sync"></i> Erneut versuchen
                </button>
            </div>
        `;
    }
}


async function fetchPostsFromS3() {
    try {
        console.log("Sende GET-Anfrage an:", `${window.Auth.API_BASE_URL}/posts`);
        
        // Authentifizierungs-Header hinzufügen
        const options = window.Auth.addAuthHeaders({
            method: 'GET'
        });
        
        const response = await fetch(`${window.Auth.API_BASE_URL}/posts`, options);

        console.log("Antwort der GET-API:", response);

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`Fehlerstatus: ${response.status}`, errorText);
            throw new Error(`Fehler beim Abrufen der Beiträge: ${response.status} - ${errorText}`);
        }

        const data = await response.json();
        console.log("Rohdaten von der API:", data);

        let posts;
        if (data && typeof data.body === 'string') {
            posts = JSON.parse(data.body);
        } else {
            posts = data;
        }

        console.log("Parsed posts:", posts);
        // Posts im Cache speichern
        cachedPosts = posts;
        return posts;
    } catch (error) {
        console.error("Fehler beim Abrufen der Beiträge:", error, {
            message: error.message,
            stack: error.stack
        });
        throw error; // Fehler weitergeben für bessere Fehlerbehandlung
    }
}


document.getElementById("newPostForm").addEventListener("submit", async function (event) {
    event.preventDefault(); 

    const title = document.getElementById("postTitle").value;
    const text = document.getElementById("postText").value;
    const imageFile = document.getElementById("postImage").files[0];

    if (!title || !text) {
        alert("Bitte füllen Sie Titel und Text aus.");
        return;
    }

    // Ändere den Submit-Button, um den Ladevorgang anzuzeigen
    const submitButton = this.querySelector('button[type="submit"]');
    const originalButtonText = submitButton.innerHTML;
    submitButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Wird hochgeladen...';
    submitButton.disabled = true;

    // Benachrichtigung vorübergehend entfernen (falls vorhanden)
    const notification = document.getElementById('notification');
    if (notification) {
        notification.style.display = 'none';
    }

    const formData = new FormData();
    formData.append("title", title);
    formData.append("text", text);

    try {
        // Meldung, dass der Upload beginnt
        console.log("Starte Upload-Prozess...");
        
        if (imageFile) {
            console.log("Bild wird vorbereitet...");
            const reader = new FileReader();
            
            // FileReader als Promise verpacken
            const readFilePromise = new Promise((resolve, reject) => {
                reader.onload = () => resolve(reader.result);
                reader.onerror = reject;
                reader.readAsDataURL(imageFile);
            });
            
            try {
                // Auf das Einlesen des Bildes warten
                const imageData = await readFilePromise;
                console.log("Bild erfolgreich eingelesen");
                formData.append("imageBase64", imageData);
                
                // Beitrag hochladen
                await uploadPost(formData);
                
                // Nach erfolgreichem Upload:
                document.getElementById("newPostForm").reset();
                alert("Beitrag erfolgreich erstellt!");
                window.location.reload();
            } catch (error) {
                console.error("Fehler beim Verarbeiten des Bildes oder Hochladen:", error);
                // Submit-Button zurücksetzen
                submitButton.innerHTML = originalButtonText;
                submitButton.disabled = false;
                alert("Fehler beim Hochladen: " + error.message);
            }
        } else {
            // Beitrag ohne Bild hochladen
            try {
                await uploadPost(formData);
                
                // Nach erfolgreichem Upload:
                document.getElementById("newPostForm").reset();
                alert("Beitrag erfolgreich erstellt!");
                window.location.reload();
            } catch (error) {
                console.error("Fehler beim Hochladen ohne Bild:", error);
                // Submit-Button zurücksetzen
                submitButton.innerHTML = originalButtonText;
                submitButton.disabled = false;
                alert("Fehler beim Hochladen: " + error.message);
            }
        }
    } catch (error) {
        console.error("Allgemeiner Fehler im Form-Handler:", error);
        // Bei Fehler Button zurücksetzen
        submitButton.innerHTML = originalButtonText;
        submitButton.disabled = false;
        alert("Fehler beim Hochladen: " + error.message);
    }
});

async function uploadPost(formData) {
    try {
        console.log("Sende POST-Anfrage mit Daten:", {
            title: formData.get("title"),
            text: formData.get("text"),
            hasImage: !!formData.get("imageBase64")
        });
        
        // Authentifizierungs-Header hinzufügen
        // WICHTIG: no-cors Modus entfernt für bessere Fehlerbehandlung
        const options = window.Auth.addAuthHeaders({
            method: 'POST',
            body: JSON.stringify({
                title: formData.get("title"),
                text: formData.get("text"),
                imageBase64: formData.get("imageBase64") || null,
            }),
            headers: {
                'Content-Type': 'application/json',
            }
        });
        
        const response = await fetch(`${window.Auth.API_BASE_URL}/posts`, options);

        console.log("Antwort der POST-API:", response);
        
        // Prüfe den Response-Status
        if (!response.ok) {
            const errorText = await response.text().catch(() => 'Unbekannter Fehler');
            throw new Error(`HTTP-Fehler: ${response.status} - ${errorText}`);
        }
        
        // Parse die Antwort, falls vorhanden
        try {
            const responseData = await response.json();
            console.log("Post erfolgreich erstellt:", responseData);
            return responseData;
        } catch (e) {
            // Keine JSON-Antwort, das ist ok
            console.log("Post erfolgreich erstellt (keine JSON-Antwort)");
            return true;
        }
    } catch (error) {
        console.error("Fehler im uploadPost:", error);
        // Hier den Fehler weiterwerfen, aber mit klarerem Logging
        throw error;
    }
}


// Beitrag löschen
async function deletePost(postId) {
    if (!confirm(`Möchten Sie diesen Beitrag wirklich löschen?`)) {
        return;
    }

    try {
        const deleteButton = event.target.closest('button');
        const originalButtonText = deleteButton.innerHTML;
        deleteButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Löschen...';
        deleteButton.disabled = true;
        
        console.log(`Sende DELETE-Anfrage für Post-ID: ${postId}`);
        
        // Authentifizierungs-Header hinzufügen
        const options = window.Auth.addAuthHeaders({
            method: 'DELETE',
        });
        
        const response = await fetch(`${window.Auth.API_BASE_URL}/posts/${postId}`, options);

        console.log("Antwort der DELETE-API:", response);

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`Fehlerstatus: ${response.status}`, errorText);
            throw new Error(`Fehler beim Löschen des Beitrags: ${response.status} - ${errorText}`);
        }

        alert(`Beitrag erfolgreich gelöscht!`);
        await loadPosts(); 
    } catch (error) {
        console.error("Fehler beim Löschen des Beitrags:", error);
        alert("Fehler beim Löschen des Beitrags: " + error.message);
        
        // Button zurücksetzen, falls vorhanden
        if (event && event.target) {
            const deleteButton = event.target.closest('button');
            if (deleteButton) {
                deleteButton.innerHTML = '<i class="fas fa-trash"></i> Löschen';
                deleteButton.disabled = false;
            }
        }
    }
}


/**
 * BEARBEITEN-FUNKTIONALITÄT ENTFERNT
 * Beiträge können nur noch erstellt und gelöscht werden, nicht mehr bearbeitet werden.
 */
/*
async function editPost(postId) {
    console.log('Bearbeite Beitrag mit ID:', postId);
    
    try {
        // Modal öffnen
        const modal = document.getElementById('editPostModal');
        if (!modal) {
            console.error('Edit-Modal nicht gefunden');
            alert('Bearbeitungs-Modal nicht gefunden. Bitte laden Sie die Seite neu.');
            return;
        }
        
        // Modal anzeigen
        modal.style.display = 'block';
        
        // Ladeindikator im Modal anzeigen
        const form = document.getElementById('editPostForm');
        const originalFormHTML = form.innerHTML;
        form.innerHTML = '<div style="text-align: center; padding: 20px;"><i class="fas fa-spinner fa-spin fa-2x"></i><p>Beitrag wird geladen...</p></div>';
        
        // Beitrag von der API laden
        const post = await fetchPostById(postId);
        
        if (!post) {
            alert('Beitrag konnte nicht geladen werden.');
            modal.style.display = 'none';
            form.innerHTML = originalFormHTML;
            return;
        }
        
        // Formular wiederherstellen
        form.innerHTML = originalFormHTML;
        
        // Daten in das Formular einfügen
        document.getElementById('editPostId').value = post.id;
        document.getElementById('editPostTitle').value = post.title || '';
        document.getElementById('editPostText').value = post.text || '';
        
        // Aktuelles Bild anzeigen, falls vorhanden
        const imagePreview = document.getElementById('editPostImagePreview');
        if (post.imageUrl) {
            // Erstelle Vorschaubild, falls noch nicht vorhanden
            let previewContainer = document.getElementById('editPostImagePreview');
            if (!previewContainer) {
                previewContainer = document.createElement('div');
                previewContainer.id = 'editPostImagePreview';
                previewContainer.className = 'input-group';
                previewContainer.style.marginTop = '10px';
                const imageInput = document.getElementById('editPostImage');
                imageInput.parentElement.appendChild(previewContainer);
            }
            previewContainer.innerHTML = `
                <label>Aktuelles Bild:</label>
                <img src="${post.imageUrl}" alt="Aktuelles Bild" style="max-width: 100%; max-height: 200px; border-radius: 4px; margin-top: 5px;">
                <p style="font-size: 12px; color: #666; margin-top: 5px;">Wählen Sie ein neues Bild aus, um es zu ändern.</p>
            `;
        }
        
        // Event-Listener für Formular-Submit hinzufügen (falls noch nicht vorhanden)
        const editForm = document.getElementById('editPostForm');
        const existingHandler = editForm.getAttribute('data-handler-attached');
        if (!existingHandler) {
            editForm.addEventListener('submit', async function(event) {
                event.preventDefault();
                await saveEditedPost();
            });
            editForm.setAttribute('data-handler-attached', 'true');
        }
        
    } catch (error) {
        console.error('Fehler beim Laden des Beitrags:', error);
        alert('Fehler beim Laden des Beitrags: ' + error.message);
        const modal = document.getElementById('editPostModal');
        if (modal) {
            modal.style.display = 'none';
        }
    }
}
*/

/**
 * Lädt einen einzelnen Beitrag von der API
 * @param {string} postId - ID des Beitrags
 * @returns {Promise<Object>} Beitragsdaten
 */
async function fetchPostById(postId) {
    try {
        console.log("Lade Beitrag mit ID:", postId);
        
        // Versuche zuerst aus dem Cache zu laden (falls bereits geladen)
        if (cachedPosts && cachedPosts.length > 0) {
            const cachedPost = cachedPosts.find(p => p.id === postId);
            if (cachedPost) {
                console.log("Beitrag aus Cache geladen:", cachedPost);
                return cachedPost;
            }
        }
        
        // Falls nicht im Cache, versuche von der API zu laden
        // Service Worker umgehen
        const url = `${window.Auth.API_BASE_URL}/posts/${postId}?noserviceworker=${Date.now()}`;
        console.log("Lade Beitrag von API:", url);
        
        try {
            // Versuche ohne Auth-Header (GET-Requests funktionieren oft ohne)
            let response = await fetch(url, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json'
                }
            });
            
            // Wenn 403/401, versuche mit Auth-Header
            if (response.status === 403 || response.status === 401) {
                console.log("GET ohne Auth fehlgeschlagen, versuche mit Auth-Header");
                const options = window.Auth.addAuthHeaders({
                    method: 'GET',
                    headers: {
                        'Accept': 'application/json'
                    }
                });
                response = await fetch(url, options);
            }
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            
            const data = await response.json();
            console.log("Rohdaten von der API:", data);
            
            // Daten extrahieren (abhängig vom API-Format)
            let post;
            if (data && typeof data.body === 'string') {
                post = JSON.parse(data.body);
            } else if (data && data.Item) {
                // DynamoDB Format
                post = data.Item;
            } else {
                post = data;
            }
            
            console.log("Geladener Beitrag:", post);
            return post;
            
        } catch (apiError) {
            console.warn("API-Request fehlgeschlagen, verwende Cache:", apiError);
            
            // Falls API-Request fehlschlägt, versuche aus Cache
            if (cachedPosts && cachedPosts.length > 0) {
                const cachedPost = cachedPosts.find(p => p.id === postId);
                if (cachedPost) {
                    console.log("Beitrag aus Cache geladen (Fallback):", cachedPost);
                    return cachedPost;
                }
            }
            
            // Wenn auch kein Cache vorhanden, lade alle Posts neu
            console.log("Lade alle Posts neu, um Beitrag zu finden...");
            await loadPosts();
            const post = cachedPosts.find(p => p.id === postId);
            if (post) {
                return post;
            }
            
            throw new Error(`Beitrag mit ID ${postId} konnte nicht gefunden werden.`);
        }
        
    } catch (error) {
        console.error("Fehler beim Laden des Beitrags:", error);
        throw error;
    }
}

/**
 * BEARBEITEN-FUNKTIONALITÄT ENTFERNT
 * Beiträge können nur noch erstellt und gelöscht werden, nicht mehr bearbeitet werden.
 */
/*
async function saveEditedPost() {
    const form = document.getElementById('editPostForm');
    const postId = document.getElementById('editPostId').value;
    const title = document.getElementById('editPostTitle').value;
    const text = document.getElementById('editPostText').value;
    const imageFile = document.getElementById('editPostImage').files[0];
    
    if (!postId || !title || !text) {
        alert("Bitte füllen Sie alle Pflichtfelder aus.");
        return;
    }
    
    // Submit-Button deaktivieren
    const submitButton = form.querySelector('button[type="submit"]');
    const originalButtonText = submitButton.innerHTML;
    submitButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Wird gespeichert...';
    submitButton.disabled = true;
    
    try {
        // Bild vorbereiten, falls vorhanden
        let imageBase64 = null;
        if (imageFile) {
            const reader = new FileReader();
            const readFilePromise = new Promise((resolve, reject) => {
                reader.onload = () => resolve(reader.result);
                reader.onerror = reject;
                reader.readAsDataURL(imageFile);
            });
            imageBase64 = await readFilePromise;
        }
        
        // Update-Daten zusammenstellen
        const updateData = {
            title: title,
            text: text
        };
        
        if (imageBase64) {
            updateData.imageBase64 = imageBase64;
        }
        
        console.log("Sende Update-Anfrage für Beitrag:", postId);
        console.log("Update-Daten:", updateData);
        
        // Versuche verschiedene URL-Strukturen für Updates
        // Da PUT nicht in CORS erlaubt ist, müssen wir POST verwenden
        // Versuche verschiedene Endpunkt-Varianten:
        const possibleUrls = [
            `${window.Auth.API_BASE_URL}/posts/${postId}`,  // RESTful: POST /posts/{id}
            `${window.Auth.API_BASE_URL}/posts/update/${postId}`,  // Expliziter Update-Endpunkt
            `${window.Auth.API_BASE_URL}/posts/${postId}/update`,  // Alternative Struktur
        ];
        
        // Füge ID zu den Update-Daten hinzu (für Fallback)
        updateData.id = postId;
        
        // Authentifizierungs-Header hinzufügen
        const options = window.Auth.addAuthHeaders({
            method: 'POST',
            body: JSON.stringify(updateData),
            headers: {
                'Content-Type': 'application/json',
            }
        });
        
        console.log("Request-Optionen:", options);
        console.log("Request-Body:", JSON.stringify(updateData));
        
        // Versuche verschiedene URLs, bis eine funktioniert
        let response;
        let url;
        let lastError;
        
        for (const testUrl of possibleUrls) {
            url = `${testUrl}?noserviceworker=${Date.now()}`;
            console.log("Versuche URL:", url);
            
            try {
                response = await fetch(url, options);
                console.log("Antwort für URL", testUrl, ":", response);
                console.log("Response Status:", response.status);
                
                // Wenn Status 200 oder 201, war die Anfrage erfolgreich
                if (response.status === 200 || response.status === 201) {
                    console.log("Erfolgreiche Antwort für URL:", testUrl);
                    break; // Erfolgreich, breche Schleife ab
                } else if (response.status === 404) {
                    // Endpunkt existiert nicht, versuche nächste URL
                    console.log("404 für URL:", testUrl, "- versuche nächste...");
                    lastError = new Error(`Endpunkt nicht gefunden: ${testUrl}`);
                    continue;
                } else {
                    // Anderer Fehler, breche ab
                    lastError = new Error(`HTTP-Fehler: ${response.status}`);
                    break;
                }
            } catch (fetchError) {
                console.log("Fehler für URL", testUrl, ":", fetchError.message);
                lastError = fetchError;
                
                // Wenn es ein CORS-Problem ist, aber Status 201 war, könnte es trotzdem funktioniert haben
                if (fetchError.message.includes("Load failed") || fetchError.message.includes("access control")) {
                    // Versuche trotzdem die nächste URL
                    continue;
                }
            }
        }
        
        // Wenn keine URL funktionierte, verwende Fallback: Standard-POST mit ID im Body
        if (!response || (response.status !== 200 && response.status !== 201)) {
            console.warn("Keine der Update-URLs funktionierte, verwende Fallback: Standard-POST mit ID im Body");
            console.warn("⚠️ WICHTIG: Die Backend-API muss angepasst werden, um Updates zu unterstützen!");
            url = `${window.Auth.API_BASE_URL}/posts?noserviceworker=${Date.now()}`;
            
            try {
                response = await fetch(url, options);
                console.log("Fallback-Response:", response);
            } catch (fallbackError) {
                console.error("Auch Fallback fehlgeschlagen:", fallbackError);
                throw new Error(`Update fehlgeschlagen: Keine der Update-URLs funktionierte. Bitte Backend-API anpassen. Letzter Fehler: ${fallbackError.message}`);
            }
        }
        
        // Verarbeite die Antwort
        let updateSuccessful = false;
        
        if (response) {
            console.log("Antwort der POST-API (Update):", response);
            console.log("Response Status:", response.status);
            console.log("Response OK:", response.ok);
            console.log("Response Type:", response.type);
            
            // Wenn Status 201 oder 200, war die Anfrage erfolgreich
            if (response.status === 201 || response.status === 200) {
                updateSuccessful = true;
                console.log("API hat Update erfolgreich verarbeitet (Status:", response.status + ")");
                
                // Versuche die Antwort zu lesen
                try {
                    if (response.ok || response.status === 201) {
                        try {
                            const responseData = await response.json();
                            console.log("Update erfolgreich:", responseData);
                        } catch (e) {
                            // Keine JSON-Antwort wegen CORS, das ist ok wenn Status 201/200
                            console.log("Update erfolgreich (CORS blockiert Antwort, aber Status war erfolgreich)");
                        }
                    }
                } catch (readError) {
                    // Wenn wir die Antwort nicht lesen können wegen CORS, aber Status 201/200 war, ist das ok
                    if (response.status === 201 || response.status === 200) {
                        console.log("Update erfolgreich (CORS blockiert Antwort, aber Status war erfolgreich)");
                    } else {
                        console.error("Fehler beim Lesen der Antwort:", readError);
                    }
                }
            } else {
                let errorText = 'Unbekannter Fehler';
                try {
                    errorText = await response.text();
                    console.error("Fehler-Response-Text:", errorText);
                } catch (e) {
                    console.error("Konnte Fehler-Text nicht lesen:", e);
                }
                throw new Error(`HTTP-Fehler: ${response.status} - ${errorText}`);
            }
        } else {
            // Keine Response - das sollte nicht passieren, da wir einen Fallback haben
            throw new Error("Keine Antwort von der API erhalten");
        }
        
        // WICHTIG: Lokales Update im Cache als Workaround
        // Da die API möglicherweise einen neuen Post erstellt statt zu aktualisieren,
        // aktualisieren wir lokal den Cache, damit die UI korrekt angezeigt wird
        if (updateSuccessful) {
            console.log("Aktualisiere lokalen Cache als Workaround...");
            const index = cachedPosts.findIndex(p => p.id === postId);
            if (index !== -1) {
                cachedPosts[index] = {
                    ...cachedPosts[index],
                    title: title,
                    text: text,
                    // Bild nur aktualisieren, wenn ein neues hochgeladen wurde
                    ...(imageBase64 ? { imageBase64: imageBase64 } : {})
                };
                console.log("Cache aktualisiert:", cachedPosts[index]);
            }
        }
        
        // Erfolgsmeldung anzeigen
        const notification = document.getElementById('notification');
        if (notification) {
            notification.style.display = 'block';
            let message = 'Beitrag erfolgreich aktualisiert!';
            
            // Warnung hinzufügen, wenn CORS-Problem erkannt wurde
            if (updateSuccessful && response && (response.status === 201 || response.status === 200)) {
                const responseType = response.type;
                if (responseType === 'opaque' || responseType === 'error') {
                    message += ' (Hinweis: CORS-Problem erkannt. Bitte Backend-API anpassen für vollständige Funktionalität.)';
                    console.warn("⚠️ WICHTIG: Die Backend-API muss angepasst werden:");
                    console.warn("1. PUT-Methode in Access-Control-Allow-Methods hinzufügen");
                    console.warn("2. Access-Control-Allow-Origin für 'http://127.0.0.1:5500' erlauben (oder '*' für Entwicklung)");
                    console.warn("3. Updates über POST mit ID im Body unterstützen (falls PUT nicht möglich)");
                }
            }
            
            document.getElementById('notification-message').textContent = message;
            setTimeout(() => {
                notification.style.display = 'none';
            }, 8000); // Länger anzeigen wegen Warnung
        }
        
        if (!updateSuccessful) {
            throw new Error('Update konnte nicht durchgeführt werden. Bitte versuchen Sie es erneut.');
        }
        
        // Modal schließen
        closeEditModal();
        
        // Liste neu laden
        await loadPosts();
        
    } catch (error) {
        console.error("Fehler beim Speichern des Beitrags:", error);
        alert("Fehler beim Speichern: " + error.message);
    } finally {
        // Button zurücksetzen
        submitButton.innerHTML = originalButtonText;
        submitButton.disabled = false;
    }
}
*/

/**
 * BEARBEITEN-FUNKTIONALITÄT ENTFERNT
 * Beiträge können nur noch erstellt und gelöscht werden, nicht mehr bearbeitet werden.
 */
/*
function closeEditModal() {
    const modal = document.getElementById('editPostModal');
    if (modal) {
        modal.style.display = 'none';
    }
    
    // Formular zurücksetzen
    const form = document.getElementById('editPostForm');
    if (form) {
        form.reset();
        const preview = document.getElementById('editPostImagePreview');
        if (preview) {
            preview.remove();
        }
    }
}
*/

// Funktionen global verfügbar machen für onclick-Handler in HTML
// window.editPost = editPost; // ENTFERNT - Bearbeiten-Funktionalität deaktiviert
// window.closeEditModal = closeEditModal; // ENTFERNT - Bearbeiten-Funktionalität deaktiviert
window.deletePost = deletePost;
window.loadPosts = loadPosts;

window.addEventListener("DOMContentLoaded", loadPosts);