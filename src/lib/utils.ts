// Splits text into plain segments, URL segments, and @mention segments
const PARTS_REGEX = /(https?:\/\/[^\s]+|www\.[^\s]+|@[a-zA-Z0-9_-]+)/gi

export type TextPart = { type: 'text' | 'url' | 'mention'; value: string }

function splitTextParts(text: string, regex: RegExp): TextPart[] {
  const result: TextPart[] = []
  let lastIndex = 0
  let match: RegExpExecArray | null
  regex.lastIndex = 0
  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) result.push({ type: 'text', value: text.slice(lastIndex, match.index) })
    const val = match[0]
    if (val.startsWith('@')) result.push({ type: 'mention', value: val })
    else result.push({ type: 'url', value: val })
    lastIndex = match.index + match[0].length
  }
  if (lastIndex < text.length) result.push({ type: 'text', value: text.slice(lastIndex) })
  return result
}

// With URL + mention detection (community posts)
export function parseTextParts(text: string): TextPart[] {
  return splitTextParts(text, new RegExp(PARTS_REGEX.source, 'gi'))
}

// URL only (private messages)
const URL_REGEX = /(https?:\/\/[^\s]+|www\.[^\s]+)/gi
export function parseTextWithLinks(text: string): TextPart[] {
  return splitTextParts(text, new RegExp(URL_REGEX.source, 'gi'))
}

export function safeUrl(url: string): string {
  return /^https?:\/\//i.test(url) ? url : `https://${url}`
}

export function getGreeting(firstName: string): { salut: string; message: string } {
  const hour = new Date().getHours()

  if (hour < 12) {
    return { salut: `Bonjour ${firstName}`, message: 'Prête à te reconnecter à ton corps ?' }
  } else if (hour < 17) {
    return { salut: `Bon après-midi ${firstName}`, message: 'Accorde-toi un moment pour toi' }
  } else if (hour < 21) {
    return { salut: `Belle soirée ${firstName}`, message: 'Le moment idéal pour relâcher les tensions' }
  } else {
    return { salut: `Bonne nuit ${firstName}`, message: 'Détends-toi en douceur avant de dormir' }
  }
}

export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  return mins > 0 ? `${hours}h ${mins}min` : `${hours}h`
}

export function formatRelativeDate(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return "À l'instant"
  if (diffMins < 60) return `Il y a ${diffMins} min`
  if (diffHours < 24) return `Il y a ${diffHours}h`
  if (diffDays < 7) return `Il y a ${diffDays}j`
  return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
}

export function formatFutureDate(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = date.getTime() - now.getTime()
  const diffDays = Math.ceil(diffMs / 86400000)

  if (diffDays <= 0) return 'Expiré'
  if (diffDays === 1) return 'Expire demain'
  if (diffDays < 30) return `Expire dans ${diffDays} jours`
  const diffMonths = Math.floor(diffDays / 30)
  if (diffMonths === 1) return 'Expire dans 1 mois'
  return `Expire dans ${diffMonths} mois`
}

export function formatSubscriptionRemaining(endDateString: string): { label: string; percent: number; urgent: boolean; daysLeft: number } {
  const end = new Date(endDateString)
  const now = new Date()
  const diffMs = end.getTime() - now.getTime()
  const diffDays = Math.ceil(diffMs / 86400000)
  const totalDays = 365
  // percent = remaining time (100% = full year left, 0% = expired)
  const percent = Math.max(0, Math.min(100, Math.round((diffDays / totalDays) * 100)))

  if (diffDays <= 0) return { label: 'Accompagnement terminé', percent: 0, urgent: true, daysLeft: 0 }
  if (diffDays <= 30) return { label: `${diffDays} jour${diffDays > 1 ? 's' : ''} restant${diffDays > 1 ? 's' : ''}`, percent, urgent: true, daysLeft: diffDays }
  if (diffDays <= 90) return { label: `${Math.ceil(diffDays / 30)} mois restant${diffDays > 45 ? 's' : ''}`, percent, urgent: false, daysLeft: diffDays }
  const months = Math.round(diffDays / 30)
  return { label: `${months} mois restants`, percent, urgent: false, daysLeft: diffDays }
}

export const GOAL_LABELS: Record<string, string> = {
  posture: 'Posture',
  souplesse: 'Souplesse',
  renforcement: 'Renforcement',
  gestion_stress: 'Gestion du stress',
  post_partum: 'Récupération post-partum',
  soulagement_douleurs: 'Soulagement de douleurs',
  tonicite: 'Tonicité',
  energie: 'Énergie',
  connexion_corps_esprit: 'Connexion corps-esprit',
}

export const LEVEL_LABELS: Record<string, string> = {
  debutante: 'Débutante',
  initiee: 'Initiée',
  intermediaire: 'Intermédiaire',
  avancee: 'Avancée',
  coach: 'Coach',
  tous_niveaux: 'Tous niveaux',
}

export const FOCUS_LABELS: Record<string, string> = {
  programme: 'Programme',
  full_body: 'Full Body',
  reformer: 'Reformer',
  perfect_time: 'Pilates Perfect Time (16 à 30 min)',
  quick: 'Quick Pilates (15 min max)',
  session_longue: 'Sessions Longues (35 min à 1h)',
  souplesse: 'Souplesse',
  accessoires: 'Avec Accessoires / Petit matériel Pilates',
}

export const EQUIPMENT_LABELS: Record<string, string> = {
  tapis: 'Tapis seul',
  swiss_ball: 'Swiss Ball',
  elastique: 'Élastique',
  foam_roller: 'Foam Roller',
}
