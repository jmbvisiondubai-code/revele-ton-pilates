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
