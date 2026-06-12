/**
 * Cloud Function: Push-Benachrichtigung bei neuer Anfrage.
 *
 * Trigger: neues Dokument in der Firestore-Collection `contactRequests`
 * (genau die Collection, in die das Website-Kontaktformular schreibt).
 *
 * Versendet eine FCM-Web-Push an alle Admin-Geräte. Unterstützt zwei Wege:
 *   1. Topic "neue-anfragen"  (einfach, wenn Tokens serverseitig abonniert werden)
 *   2. Collection `adminTokens` (jedes Dokument: { token: "<fcm-token>" })
 *
 * Voraussetzungen:
 *   - Firebase Blaze-Plan (Functions benötigen ihn)
 *   - `firebase deploy --only functions`
 */
const { onDocumentCreated } = require('firebase-functions/v2/firestore')
const { initializeApp } = require('firebase-admin/app')
const { getFirestore } = require('firebase-admin/firestore')
const { getMessaging } = require('firebase-admin/messaging')

initializeApp()

exports.notifyNewAnfrage = onDocumentCreated(
  { document: 'contactRequests/{id}', region: 'europe-west1' },
  async (event) => {
    const data = event.data?.data() || {}

    const title = 'Neue Anfrage'
    const body = `${data.name || 'Unbekannt'}: ${(data.message || '').slice(0, 90)}`

    const notification = { title, body }
    const webpush = {
      notification: {
        title,
        body,
        icon: '/icons/icon-192.png',
        badge: '/icons/icon-192.png',
      },
      fcmOptions: { link: '/anfragen' },
    }
    const payloadData = { url: '/anfragen', anfrageId: event.params.id }

    // Weg 1: Topic
    const topicSend = getMessaging()
      .send({ topic: 'neue-anfragen', notification, webpush, data: payloadData })
      .catch((e) => console.warn('Topic-Versand fehlgeschlagen:', e.message))

    // Weg 2: gespeicherte Admin-Tokens
    const tokensSnap = await getFirestore().collection('adminTokens').get().catch(() => null)
    const tokens = tokensSnap ? tokensSnap.docs.map((d) => d.data().token).filter(Boolean) : []

    let multicast = Promise.resolve()
    if (tokens.length) {
      multicast = getMessaging()
        .sendEachForMulticast({ tokens, notification, webpush, data: payloadData })
        .then((res) => {
          // ungültige Tokens aufräumen
          res.responses.forEach((r, i) => {
            if (!r.success && tokensSnap) {
              tokensSnap.docs[i].ref.delete().catch(() => {})
            }
          })
        })
        .catch((e) => console.warn('Token-Versand fehlgeschlagen:', e.message))
    }

    await Promise.all([topicSend, multicast])
  },
)
