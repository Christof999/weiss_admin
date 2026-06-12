/** Formatierungs- und Hilfsfunktionen. */

const DATE_FMT = new Intl.DateTimeFormat('de-DE', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
})
const TIME_FMT = new Intl.DateTimeFormat('de-DE', {
  hour: '2-digit',
  minute: '2-digit',
})

export function formatDate(millis) {
  if (!millis) return '–'
  return DATE_FMT.format(new Date(millis))
}

export function formatDateTime(millis) {
  if (!millis) return '–'
  const d = new Date(millis)
  return `${DATE_FMT.format(d)}, ${TIME_FMT.format(d)} Uhr`
}

/** "vor 3 Min." / "vor 2 Std." / "gestern" … */
export function relativeTime(millis) {
  if (!millis) return ''
  const diff = Date.now() - millis
  const min = Math.round(diff / 60000)
  if (min < 1) return 'gerade eben'
  if (min < 60) return `vor ${min} Min.`
  const hrs = Math.round(min / 60)
  if (hrs < 24) return `vor ${hrs} Std.`
  const days = Math.round(hrs / 24)
  if (days === 1) return 'gestern'
  if (days < 7) return `vor ${days} Tagen`
  return formatDate(millis)
}

export const STATUS_LABELS = {
  neu: 'Neu',
  bearbeitung: 'In Bearbeitung',
  erledigt: 'Erledigt',
}

export function statusLabel(status) {
  return STATUS_LABELS[status] || 'Neu'
}

export function greeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Guten Morgen'
  if (h < 18) return 'Guten Tag'
  return 'Guten Abend'
}

/** Übersetzt Firebase-Auth-Fehlercodes in verständliches Deutsch. */
export function authErrorMessage(err) {
  const code = err?.code || ''
  switch (code) {
    case 'auth/invalid-email':
      return 'Ungültige E-Mail-Adresse.'
    case 'auth/user-disabled':
      return 'Dieses Konto wurde deaktiviert.'
    case 'auth/user-not-found':
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
      return 'E-Mail oder Passwort ist falsch.'
    case 'auth/too-many-requests':
      return 'Zu viele Versuche. Bitte später erneut versuchen.'
    case 'auth/network-request-failed':
      return 'Netzwerkfehler. Bitte Internetverbindung prüfen.'
    default:
      if (err?.message === 'NOT_CONFIGURED')
        return 'Firebase ist nicht konfiguriert (siehe SETUP.md).'
      return 'Anmeldung fehlgeschlagen. Bitte erneut versuchen.'
  }
}
