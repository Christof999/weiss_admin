/**
 * Vercel Serverless Function: Push bei neuer Anfrage versenden.
 *
 * POST /api/push/notify
 *   Body: { id: "<contactRequests-Dokument-ID>" }
 *   (optional) Header: Authorization: Bearer <PUSH_API_TOKEN>
 */
import webpush from 'web-push'
import { getFirestore } from 'firebase-admin/firestore'
import { ensureFirebaseAdmin, missingFirebaseEnv } from '../_lib/firebase-admin.js'

const SUBS = 'adminPushSubscriptions'
const REQUESTS = 'contactRequests'
const MAX_AGE_MS = 15 * 60 * 1000 // 15 Minuten

function configureVapid() {
  webpush.setVapidDetails(
    process.env.PUSH_VAPID_SUBJECT || 'mailto:admin@weiss-forst.de',
    process.env.PUSH_VAPID_PUBLIC_KEY,
    process.env.PUSH_VAPID_PRIVATE_KEY,
  )
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  if (req.method === 'OPTIONS') return res.status(204).end()

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  if (process.env.PUSH_API_TOKEN) {
    const authHeader = req.headers.authorization || ''
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null
    if (token !== process.env.PUSH_API_TOKEN) {
      return res.status(401).json({ error: 'Unauthorized' })
    }
  }

  try {
    const missing = missingFirebaseEnv()
    if (missing.length) {
      return res
        .status(500)
        .json({ error: 'Internal error', detail: `Server-Env fehlt: ${missing.join(', ')}` })
    }

    ensureFirebaseAdmin()
    const db = getFirestore()

    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {}
    const { id } = body
    if (!id) return res.status(400).json({ error: 'Missing request id' })

    const snap = await db.collection(REQUESTS).doc(String(id)).get()
    if (!snap.exists) return res.status(404).json({ error: 'Request not found' })
    const data = snap.data() || {}

    const createdMs = data.createdAt?.toMillis
      ? data.createdAt.toMillis()
      : data.createdAt?._seconds
        ? data.createdAt._seconds * 1000
        : Date.now()
    if (Date.now() - createdMs > MAX_AGE_MS) {
      return res.status(409).json({ error: 'Request too old' })
    }

    configureVapid()

    const payload = JSON.stringify({
      title: 'Neue Anfrage',
      body: `${data.name || 'Unbekannt'}: ${(data.message || '').slice(0, 90)}`,
      url: '/anfragen',
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      tag: 'neue-anfrage',
    })

    const subsSnap = await db.collection(SUBS).where('active', '==', true).get()

    let sent = 0
    const cleanups = []
    await Promise.all(
      subsSnap.docs.map(async (docSnap) => {
        const sub = docSnap.data()
        if (!sub.endpoint || !sub.keys) return
        try {
          await webpush.sendNotification(
            { endpoint: sub.endpoint, keys: sub.keys },
            payload,
          )
          sent++
        } catch (err) {
          if (err.statusCode === 404 || err.statusCode === 410) {
            cleanups.push(docSnap.ref.set({ active: false }, { merge: true }))
          } else {
            console.warn('[notify] Sendefehler:', err.statusCode, err.body)
          }
        }
      }),
    )
    await Promise.allSettled(cleanups)

    return res.status(200).json({ ok: true, sent })
  } catch (err) {
    console.error('[notify] Fehler:', err)
    return res.status(500).json({ error: 'Internal error', detail: err?.message || String(err) })
  }
}
