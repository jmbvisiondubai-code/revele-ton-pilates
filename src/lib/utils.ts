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

export function getGreeting(firstName: string): string {
  const hour = new Date().getHours()

  if (hour < 12) {
    return `Bonjour ${firstName}, prête à te reconnecter ?`
  } else if (hour < 17) {
    return `Bon après-midi ${firstName}, un moment pour toi ?`
  } else if (hour < 21) {
    return `Belle soirée ${firstName}, un moment pour toi ?`
  } else {
    return `Bonne nuit ${firstName}, détends-toi en douceur`
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
  intermediaire: 'Intermédiaire',
  avancee: 'Avancée',
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
