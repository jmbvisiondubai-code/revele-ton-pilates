/**
 * Download an .ics file programmatically.
 * Uses multiple strategies to work across browsers, PWAs, and WebViews.
 */
export async function downloadIcs(url: string, filename = 'event.ics') {
  try {
    const res = await fetch(url)
    if (!res.ok) {
      alert('Cet événement n\u2019est pas encore disponible dans l\u2019agenda.')
      return
    }
    const text = await res.text()
    if (!text.startsWith('BEGIN:VCALENDAR')) {
      alert('Cet événement n\u2019est pas encore disponible dans l\u2019agenda.')
      return
    }

    // Strategy 1: Blob URL with <a download> (works in most browsers)
    const blob = new Blob([text], { type: 'text/calendar;charset=utf-8' })
    const blobUrl = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = blobUrl
    a.download = filename
    a.style.display = 'none'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)

    // Strategy 2: If blob didn't work (WebView), try data URI after a short delay
    setTimeout(() => {
      URL.revokeObjectURL(blobUrl)
      // In WebViews, the blob click often does nothing silently.
      // Open a data URI as fallback — Android will propose calendar apps.
      const encoded = encodeURIComponent(text)
      const dataUri = `data:text/calendar;charset=utf-8,${encoded}`
      window.open(dataUri, '_blank')
    }, 500)
  } catch {
    alert('Impossible de télécharger le fichier agenda. Vérifie ta connexion.')
  }
}
