/**
 * Download an .ics file programmatically.
 * Works in regular browsers AND WebViews (Capacitor/native apps)
 * where <a download> doesn't trigger a real download.
 */
export async function downloadIcs(url: string, filename = 'event.ics') {
  try {
    const res = await fetch(url)
    if (!res.ok) {
      alert('Cet événement n\u2019est pas encore disponible dans l\u2019agenda.')
      return
    }
    const text = await res.text()
    // Verify it's actually an ICS file
    if (!text.startsWith('BEGIN:VCALENDAR')) {
      alert('Cet événement n\u2019est pas encore disponible dans l\u2019agenda.')
      return
    }
    const blob = new Blob([text], { type: 'text/calendar;charset=utf-8' })
    const blobUrl = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = blobUrl
    a.download = filename
    a.style.display = 'none'
    document.body.appendChild(a)
    a.click()
    // Cleanup
    setTimeout(() => {
      URL.revokeObjectURL(blobUrl)
      document.body.removeChild(a)
    }, 200)
  } catch {
    alert('Impossible de télécharger le fichier agenda. Vérifie ta connexion.')
  }
}
