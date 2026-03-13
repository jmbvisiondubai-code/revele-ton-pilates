/**
 * Download an .ics file programmatically.
 * Works in regular browsers AND WebViews (Capacitor/native apps)
 * where <a download> doesn't trigger a real download.
 */
export async function downloadIcs(url: string, filename = 'event.ics') {
  try {
    const res = await fetch(url)
    if (!res.ok) throw new Error('fetch failed')
    const blob = await res.blob()
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
    // Fallback: open in new tab
    window.open(url, '_blank')
  }
}
