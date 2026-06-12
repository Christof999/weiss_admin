/**
 * Vercel Serverless Function: Push-Subscriptions verwalten (Legacy/Fallback).
 *
 * Seit der Umstellung schreibt die App Subscriptions direkt per Firestore-Client.
 * Dieser Endpunkt bleibt für ältere Clients erhalten.
 *
 * POST /api/push/subscription
 *   Header: Authorization: Bearer <Firebase ID Token>
 *   Body:   { action: 'upsert' | 'disable', subscription, meta }
 */
import { getFirestore } from 'firebase-admin/firestore'
import { getAuth } from 'firebase-admin/auth'
import { ensureFirebaseAdmin, missingFirebaseEnv } from '../_lib/firebase-admin.js'

const COLLECTION = 'adminPushSubscriptions'

function docIdFromEndpoint(endpoint) {
  return Buffer.from(endpoint).toString('base64').replace(/[^a-zA-Z0-9]/g, '').slice(0, 120)
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const missing = missingFirebaseEnv()
    if (missing.length) {
      return res
        .status(500)
        .json({ error: 'Internal error', detail: `Server-Env fehlt: ${missing.join(', ')}` })
    }

    ensureFirebaseAdmin()

    const authHeader = req.headers.authorization || ''
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null
    if (!token) return res.status(401).json({ error: 'Missing token' })

    let decoded
    try {
      decoded = await getAuth().verifyIdToken(token)
    } catch {
      return res.status(401).json({ error: 'Invalid token' })
    }

    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {}
    const { action = 'upsert', subscription, meta = {} } = body

    if (!subscription?.endpoint) {
      return res.status(400).json({ error: 'Missing subscription endpoint' })
    }

    const db = getFirestore()
    const ref = db.collection(COLLECTION).doc(docIdFromEndpoint(subscription.endpoint))

    if (action === 'disable') {
      await ref.set(
        { active: false, disabledAt: new Date().toISOString() },
        { merge: true },
      )
      return res.status(200).json({ ok: true })
    }

    await ref.set(
      {
        endpoint: subscription.endpoint,
        keys: subscription.keys || null,
        expirationTime: subscription.expirationTime || null,
        active: true,
        adminUid: decoded.uid,
        adminEmail: decoded.email || '',
        userAgent: meta.userAgent || '',
        isStandalone: Boolean(meta.isStandalone),
        updatedAt: new Date().toISOString(),
      },
      { merge: true },
    )

    return res.status(200).json({ ok: true })
  } catch (err) {
    console.error('[subscription] Fehler:', err)
    return res
      .status(500)
      .json({ error: 'Internal error', detail: err?.message || String(err) })
  }
}
