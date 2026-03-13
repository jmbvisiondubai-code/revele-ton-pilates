import type { BadgeCategory } from '@/types/database'

// ── Level progression ────────────────────────────────────────────────────────
// Thresholds: number of badges earned to reach each level
// If user starts at "debutante": 0→15 = debutante, 15→40 = intermediaire, 40+ = avancee
// If user starts at "intermediaire": must earn ALL intermediaire-eligible badges to reach avancee
// If user starts at "avancee": continues earning badges freely

export const LEVEL_THRESHOLDS = {
  debutante: { min: 0, next: 'intermediaire' as const, badgesRequired: 15 },
  intermediaire: { min: 15, next: 'avancee' as const, badgesRequired: 40 },
  avancee: { min: 40, next: null, badgesRequired: Infinity },
}

export function getLevelProgress(
  currentLevel: string,
  earnedCount: number,
  startLevel: string
): {
  currentLevel: string
  nextLevel: string | null
  badgesForNext: number
  progress: number // 0-100
  shouldLevelUp: boolean
  newLevel: string | null
} {
  // Determine effective level based on badges earned
  let effectiveLevel = startLevel || 'debutante'

  if (startLevel === 'debutante') {
    if (earnedCount >= LEVEL_THRESHOLDS.intermediaire.badgesRequired) effectiveLevel = 'avancee'
    else if (earnedCount >= LEVEL_THRESHOLDS.debutante.badgesRequired) effectiveLevel = 'intermediaire'
  } else if (startLevel === 'intermediaire') {
    if (earnedCount >= LEVEL_THRESHOLDS.intermediaire.badgesRequired) effectiveLevel = 'avancee'
  }

  const shouldLevelUp = effectiveLevel !== currentLevel && effectiveLevel !== startLevel
  const newLevel = shouldLevelUp ? effectiveLevel : null

  const threshold = LEVEL_THRESHOLDS[effectiveLevel as keyof typeof LEVEL_THRESHOLDS]
  const nextLevel = threshold?.next || null
  const badgesForNext = threshold?.badgesRequired ?? Infinity

  // Progress toward next level
  let progress = 100
  if (nextLevel) {
    const currentThreshold = LEVEL_THRESHOLDS[effectiveLevel as keyof typeof LEVEL_THRESHOLDS]
    const prevMin = currentThreshold.min
    const nextMin = currentThreshold.badgesRequired
    progress = Math.min(100, Math.round(((earnedCount - prevMin) / (nextMin - prevMin)) * 100))
  }

  return {
    currentLevel: effectiveLevel,
    nextLevel,
    badgesForNext,
    progress,
    shouldLevelUp,
    newLevel,
  }
}

// ── Badge categories with display info ───────────────────────────────────────

export const BADGE_CATEGORIES: {
  key: BadgeCategory | 'teacher' | 'wellness' | 'challenge' | 'social'
  label: string
  emoji: string
  description: string
}[] = [
  { key: 'regularity', label: 'Régularité', emoji: '🔥', description: 'Pratique régulière et séries' },
  { key: 'milestone', label: 'Jalons', emoji: '🏆', description: 'Caps et accomplissements' },
  { key: 'exploration', label: 'Exploration', emoji: '🧭', description: 'Découvrir de nouvelles pratiques' },
  { key: 'community', label: 'Communauté', emoji: '💬', description: 'Participation et partage' },
  { key: 'wellness', label: 'Bien-être', emoji: '🧘', description: 'Équilibre corps et esprit' },
  { key: 'challenge', label: 'Défis', emoji: '⚡', description: 'Relever des défis spéciaux' },
  { key: 'social', label: 'Social', emoji: '🤝', description: 'Interactions et entraide' },
  { key: 'teacher', label: 'Professeur', emoji: '🎓', description: 'Badge spécial professeurs' },
]

// ── All badges (to insert into Supabase) ─────────────────────────────────────
// condition_type values: total_sessions, streak, total_minutes, variety,
// live_attendance, welcome, community_posts, articles_read, course_rating,
// consecutive_weeks, monthly_sessions, teacher, daily_practice, focus_type, equipment

export interface BadgeSeed {
  name: string
  description: string
  icon: string
  category: string
  condition_type: string
  condition_value: number
}

export const ALL_BADGES: BadgeSeed[] = [
  // ═══════════════════════════════════════════════════════════════════════════
  // RÉGULARITÉ (20 badges)
  // ═══════════════════════════════════════════════════════════════════════════
  { name: 'Série de 3 jours', description: 'Tes 3 premiers jours consécutifs', icon: '✨', category: 'regularity', condition_type: 'streak', condition_value: 3 },
  { name: 'Série de 7 jours', description: 'Une semaine complète de pratique', icon: '🔥', category: 'regularity', condition_type: 'streak', condition_value: 7 },
  { name: 'Série de 14 jours', description: '2 semaines de pratique !', icon: '💪', category: 'regularity', condition_type: 'streak', condition_value: 14 },
  { name: 'Série de 21 jours', description: '3 semaines, une habitude se forme !', icon: '🌿', category: 'regularity', condition_type: 'streak', condition_value: 21 },
  { name: '1 mois de régularité', description: '30 jours de pratique régulière', icon: '🌟', category: 'regularity', condition_type: 'streak', condition_value: 30 },
  { name: 'Série de 45 jours', description: '45 jours sans interruption', icon: '🔮', category: 'regularity', condition_type: 'streak', condition_value: 45 },
  { name: '2 mois consécutifs', description: '60 jours de pratique ininterrompue', icon: '💫', category: 'regularity', condition_type: 'streak', condition_value: 60 },
  { name: '3 mois consécutifs', description: '90 jours — un trimestre de discipline', icon: '🏅', category: 'regularity', condition_type: 'streak', condition_value: 90 },
  { name: 'Série de 120 jours', description: '4 mois de pratique quotidienne !', icon: '🌈', category: 'regularity', condition_type: 'streak', condition_value: 120 },
  { name: '6 mois consécutifs', description: '180 jours — un engagement extraordinaire', icon: '👸', category: 'regularity', condition_type: 'streak', condition_value: 180 },
  { name: '1 an consécutif', description: '365 jours — une année entière de pratique !', icon: '🎆', category: 'regularity', condition_type: 'streak', condition_value: 365 },
  { name: '1 semaine complète', description: 'Au moins 1 séance pendant 7 jours', icon: '📅', category: 'regularity', condition_type: 'consecutive_weeks', condition_value: 1 },
  { name: '4 semaines régulières', description: '1 mois de semaines actives', icon: '🗓️', category: 'regularity', condition_type: 'consecutive_weeks', condition_value: 4 },
  { name: '8 semaines régulières', description: '2 mois de semaines actives', icon: '📆', category: 'regularity', condition_type: 'consecutive_weeks', condition_value: 8 },
  { name: '12 semaines régulières', description: '3 mois de semaines actives', icon: '🎯', category: 'regularity', condition_type: 'consecutive_weeks', condition_value: 12 },
  { name: 'Matinale', description: '10 séances pratiquées le matin', icon: '🌅', category: 'regularity', condition_type: 'daily_practice', condition_value: 10 },
  { name: 'Couche-tard active', description: '10 séances pratiquées le soir', icon: '🌙', category: 'regularity', condition_type: 'daily_practice', condition_value: 20 },
  { name: 'Régulière du weekend', description: '10 séances le weekend', icon: '☀️', category: 'regularity', condition_type: 'daily_practice', condition_value: 30 },
  { name: '5 séances en une semaine', description: '5 séances sur une même semaine', icon: '⭐', category: 'regularity', condition_type: 'monthly_sessions', condition_value: 5 },
  { name: '20 séances en un mois', description: '20 séances sur un même mois', icon: '🌙', category: 'regularity', condition_type: 'monthly_sessions', condition_value: 20 },

  // ═══════════════════════════════════════════════════════════════════════════
  // JALONS / MILESTONES (20 badges)
  // ═══════════════════════════════════════════════════════════════════════════
  { name: 'Bienvenue', description: 'Tu as rejoint la communauté Révèle Ton Pilates !', icon: '🌸', category: 'milestone', condition_type: 'welcome', condition_value: 0 },
  { name: 'Première session', description: 'Tu as complété ta toute première session !', icon: '🌱', category: 'milestone', condition_type: 'total_sessions', condition_value: 1 },
  { name: '5 sessions', description: 'Tu prends le rythme — 5 sessions !', icon: '🌿', category: 'milestone', condition_type: 'total_sessions', condition_value: 5 },
  { name: '10 sessions', description: 'Tu as atteint 10 sessions !', icon: '🎋', category: 'milestone', condition_type: 'total_sessions', condition_value: 10 },
  { name: '25 sessions', description: '25 sessions — tu es engagée', icon: '🌳', category: 'milestone', condition_type: 'total_sessions', condition_value: 25 },
  { name: '50 sessions', description: 'Tu as atteint 50 sessions complètes', icon: '💎', category: 'milestone', condition_type: 'total_sessions', condition_value: 50 },
  { name: '75 sessions', description: '75 sessions — presque à 100 !', icon: '🔷', category: 'milestone', condition_type: 'total_sessions', condition_value: 75 },
  { name: '100 sessions', description: 'Un cap magnifique — 100 sessions', icon: '👑', category: 'milestone', condition_type: 'total_sessions', condition_value: 100 },
  { name: '150 sessions', description: '150 sessions — une vraie passionnée', icon: '💜', category: 'milestone', condition_type: 'total_sessions', condition_value: 150 },
  { name: '200 sessions', description: '200 sessions — exemplaire', icon: '🏆', category: 'milestone', condition_type: 'total_sessions', condition_value: 200 },
  { name: '300 sessions', description: '300 sessions — une pilateuse confirmée', icon: '🌠', category: 'milestone', condition_type: 'total_sessions', condition_value: 300 },
  { name: '500 sessions', description: '500 sessions — légende du Pilates', icon: '🎇', category: 'milestone', condition_type: 'total_sessions', condition_value: 500 },
  { name: '1 heure de pratique', description: '60 minutes de pratique cumulées', icon: '⏱️', category: 'milestone', condition_type: 'total_minutes', condition_value: 60 },
  { name: '5 heures de pratique', description: '5 heures de pratique cumulées', icon: '🕐', category: 'milestone', condition_type: 'total_minutes', condition_value: 300 },
  { name: '10 heures', description: '10 heures de pratique cumulées', icon: '⏰', category: 'milestone', condition_type: 'total_minutes', condition_value: 600 },
  { name: '25 heures', description: '25 heures — un jour entier de Pilates !', icon: '🕰️', category: 'milestone', condition_type: 'total_minutes', condition_value: 1500 },
  { name: '50 heures', description: '50 heures de pratique cumulées', icon: '⌛', category: 'milestone', condition_type: 'total_minutes', condition_value: 3000 },
  { name: '100 heures', description: '100 heures — maîtrise absolue', icon: '🏛️', category: 'milestone', condition_type: 'total_minutes', condition_value: 6000 },
  { name: '200 heures', description: '200 heures de pratique au compteur', icon: '🌍', category: 'milestone', condition_type: 'total_minutes', condition_value: 12000 },
  { name: '500 heures', description: '500 heures — dévouement incroyable', icon: '🌌', category: 'milestone', condition_type: 'total_minutes', condition_value: 30000 },

  // ═══════════════════════════════════════════════════════════════════════════
  // EXPLORATION (15 badges)
  // ═══════════════════════════════════════════════════════════════════════════
  { name: 'Curieuse', description: 'Tu as essayé 2 types de cours différents', icon: '🔍', category: 'exploration', condition_type: 'variety', condition_value: 2 },
  { name: 'Exploratrice', description: 'Tu as essayé 5 types de cours différents', icon: '🧭', category: 'exploration', condition_type: 'variety', condition_value: 5 },
  { name: 'Aventurière', description: 'Tu as essayé 8 types de cours', icon: '🗺️', category: 'exploration', condition_type: 'variety', condition_value: 8 },
  { name: 'Full Body addict', description: '10 séances Full Body complétées', icon: '💃', category: 'exploration', condition_type: 'focus_type', condition_value: 10 },
  { name: 'Reine du Reformer', description: '10 séances Reformer', icon: '🎪', category: 'exploration', condition_type: 'focus_type', condition_value: 11 },
  { name: 'Quick Pilates fan', description: '10 séances Quick Pilates', icon: '⚡', category: 'exploration', condition_type: 'focus_type', condition_value: 12 },
  { name: 'Souplesse mastery', description: '10 séances Souplesse', icon: '🦋', category: 'exploration', condition_type: 'focus_type', condition_value: 13 },
  { name: 'Accessoiriste', description: '10 séances avec accessoires', icon: '🎾', category: 'exploration', condition_type: 'equipment', condition_value: 10 },
  { name: 'Swiss Ball pro', description: '10 séances avec Swiss Ball', icon: '🔴', category: 'exploration', condition_type: 'equipment', condition_value: 11 },
  { name: 'Élastique master', description: '10 séances avec élastique', icon: '🟡', category: 'exploration', condition_type: 'equipment', condition_value: 12 },
  { name: 'Foam Roller addict', description: '10 séances Foam Roller', icon: '🟢', category: 'exploration', condition_type: 'equipment', condition_value: 13 },
  { name: 'Session longue', description: '5 sessions de plus de 35 minutes', icon: '🎬', category: 'exploration', condition_type: 'focus_type', condition_value: 14 },
  { name: 'Perfect Time fan', description: '10 séances Perfect Time', icon: '⏳', category: 'exploration', condition_type: 'focus_type', condition_value: 15 },
  { name: 'Touche-à-tout', description: 'Tous les types de focus essayés', icon: '🌈', category: 'exploration', condition_type: 'variety', condition_value: 10 },
  { name: 'Programme complété', description: 'Tu as terminé un programme complet', icon: '📜', category: 'exploration', condition_type: 'variety', condition_value: 15 },

  // ═══════════════════════════════════════════════════════════════════════════
  // COMMUNAUTÉ (15 badges)
  // ═══════════════════════════════════════════════════════════════════════════
  { name: 'Premier post', description: 'Tu as publié ton premier post communautaire', icon: '💬', category: 'community', condition_type: 'community_posts', condition_value: 1 },
  { name: 'Bavarde', description: '10 posts dans la communauté', icon: '🗣️', category: 'community', condition_type: 'community_posts', condition_value: 10 },
  { name: 'Pilier de la communauté', description: '50 posts communautaires', icon: '🏛️', category: 'community', condition_type: 'community_posts', condition_value: 50 },
  { name: 'Fidèle du live', description: 'Tu as participé à 10 sessions live', icon: '📺', category: 'community', condition_type: 'live_attendance', condition_value: 10 },
  { name: 'Fan des lives', description: '25 participations live', icon: '🎥', category: 'community', condition_type: 'live_attendance', condition_value: 25 },
  { name: 'Live addict', description: '50 participations live', icon: '📡', category: 'community', condition_type: 'live_attendance', condition_value: 50 },
  { name: 'Premier commentaire', description: 'Tu as commenté un article', icon: '✏️', category: 'community', condition_type: 'articles_read', condition_value: 1 },
  { name: 'Lectrice assidue', description: '10 articles lus et commentés', icon: '📖', category: 'community', condition_type: 'articles_read', condition_value: 10 },
  { name: 'Bibliophile', description: '25 articles consultés', icon: '📚', category: 'community', condition_type: 'articles_read', condition_value: 25 },
  { name: 'Première évaluation', description: 'Tu as noté un cours', icon: '⭐', category: 'community', condition_type: 'course_rating', condition_value: 1 },
  { name: 'Critique avisée', description: '10 cours évalués', icon: '🌟', category: 'community', condition_type: 'course_rating', condition_value: 10 },
  { name: 'Guide des débutantes', description: '25 cours évalués', icon: '💫', category: 'community', condition_type: 'course_rating', condition_value: 25 },
  { name: 'Ambassadrice', description: '100 posts et interactions', icon: '🎀', category: 'community', condition_type: 'community_posts', condition_value: 100 },
  { name: 'Première réaction', description: 'Tu as réagi à un post', icon: '❤️', category: 'community', condition_type: 'community_posts', condition_value: 2 },
  { name: 'Encourageante', description: '50 réactions données', icon: '💝', category: 'community', condition_type: 'community_posts', condition_value: 51 },

  // ═══════════════════════════════════════════════════════════════════════════
  // BIEN-ÊTRE (10 badges)
  // ═══════════════════════════════════════════════════════════════════════════
  { name: 'Zen attitude', description: '5 séances souplesse/relaxation', icon: '🧘', category: 'wellness', condition_type: 'focus_type', condition_value: 20 },
  { name: 'Respiration profonde', description: '10 séances centrées respiration', icon: '🌬️', category: 'wellness', condition_type: 'focus_type', condition_value: 21 },
  { name: 'Écoute de soi', description: 'Noté des limitations dans ton profil', icon: '🫶', category: 'wellness', condition_type: 'daily_practice', condition_value: 40 },
  { name: 'Posture queen', description: '15 séances travail de posture', icon: '👸', category: 'wellness', condition_type: 'focus_type', condition_value: 22 },
  { name: 'Anti-stress', description: '10 séances axées gestion du stress', icon: '🍃', category: 'wellness', condition_type: 'focus_type', condition_value: 23 },
  { name: 'Récupération active', description: '10 séances récupération', icon: '🛁', category: 'wellness', condition_type: 'focus_type', condition_value: 24 },
  { name: 'Énergie boostée', description: '10 séances boost énergie', icon: '⚡', category: 'wellness', condition_type: 'focus_type', condition_value: 25 },
  { name: 'Équilibre trouvé', description: '3 objectifs cochés simultanément', icon: '⚖️', category: 'wellness', condition_type: 'daily_practice', condition_value: 41 },
  { name: 'Corps et esprit', description: '20 séances bien-être complétées', icon: '🌺', category: 'wellness', condition_type: 'focus_type', condition_value: 26 },
  { name: 'Harmonie totale', description: '50 séances bien-être', icon: '🪷', category: 'wellness', condition_type: 'focus_type', condition_value: 27 },

  // ═══════════════════════════════════════════════════════════════════════════
  // DÉFIS (10 badges)
  // ═══════════════════════════════════════════════════════════════════════════
  { name: 'Défi 7 jours', description: 'Tu as relevé le défi 7 jours', icon: '🎯', category: 'challenge', condition_type: 'streak', condition_value: 7 },
  { name: 'Défi 30 jours', description: 'Tu as relevé le défi 30 jours', icon: '🏋️', category: 'challenge', condition_type: 'streak', condition_value: 30 },
  { name: 'Double séance', description: '2 séances le même jour', icon: '✌️', category: 'challenge', condition_type: 'daily_practice', condition_value: 50 },
  { name: '3 séances en un jour', description: '3 séances le même jour !', icon: '🤯', category: 'challenge', condition_type: 'daily_practice', condition_value: 51 },
  { name: '1h de pratique en un jour', description: '60+ minutes en une journée', icon: '💪', category: 'challenge', condition_type: 'daily_practice', condition_value: 52 },
  { name: 'Semaine parfaite', description: '7 jours / 7 séances', icon: '🌟', category: 'challenge', condition_type: 'monthly_sessions', condition_value: 7 },
  { name: 'Mois parfait', description: 'Une séance chaque jour du mois', icon: '📅', category: 'challenge', condition_type: 'monthly_sessions', condition_value: 30 },
  { name: 'Top 5% régularité', description: 'Parmi les 5% les plus régulières', icon: '🥇', category: 'challenge', condition_type: 'streak', condition_value: 60 },
  { name: 'Jamais 2 sans 3', description: '3 séances en 3 jours', icon: '🎲', category: 'challenge', condition_type: 'daily_practice', condition_value: 53 },
  { name: 'Sans limites', description: '10 séances de niveaux différents', icon: '🚀', category: 'challenge', condition_type: 'variety', condition_value: 20 },

  // ═══════════════════════════════════════════════════════════════════════════
  // SOCIAL (8 badges)
  // ═══════════════════════════════════════════════════════════════════════════
  { name: 'Première conversation', description: 'Tu as envoyé ton premier message privé', icon: '💌', category: 'social', condition_type: 'community_posts', condition_value: 3 },
  { name: 'Connectée', description: '10 conversations privées', icon: '🔗', category: 'social', condition_type: 'community_posts', condition_value: 11 },
  { name: 'Bienveillante', description: '20 réactions positives données', icon: '🥰', category: 'social', condition_type: 'community_posts', condition_value: 21 },
  { name: 'Mentor', description: 'A aidé 5 membres dans la communauté', icon: '🧑‍🏫', category: 'social', condition_type: 'community_posts', condition_value: 30 },
  { name: 'Inspiration', description: '10 de tes posts ont reçu des réactions', icon: '✨', category: 'social', condition_type: 'community_posts', condition_value: 40 },
  { name: 'Soutien actif', description: '50 messages d\'encouragement', icon: '💪', category: 'social', condition_type: 'community_posts', condition_value: 52 },
  { name: 'Super membre', description: 'Présente depuis plus de 6 mois', icon: '🌟', category: 'social', condition_type: 'consecutive_weeks', condition_value: 26 },
  { name: 'Pionnière', description: 'Parmi les premières membres', icon: '🚩', category: 'social', condition_type: 'consecutive_weeks', condition_value: 52 },

  // ═══════════════════════════════════════════════════════════════════════════
  // PROFESSEUR (2 badges)
  // ═══════════════════════════════════════════════════════════════════════════
  { name: 'Professeur certifié', description: 'Professeur de Pilates certifié', icon: '🎓', category: 'teacher', condition_type: 'teacher', condition_value: 1 },
  { name: 'Professeur expert', description: 'Professeur avec 100+ heures sur la plateforme', icon: '🏫', category: 'teacher', condition_type: 'teacher', condition_value: 2 },
]

// Level up messages
export const LEVEL_UP_MESSAGES: Record<string, { title: string; message: string; emoji: string }> = {
  intermediaire: {
    title: 'Bravo, tu passes en Intermédiaire !',
    message: 'Tu as débloqué suffisamment de badges pour prouver ton engagement. Ta régularité et ta persévérance t\'ont permise de monter de niveau. Continue comme ça !',
    emoji: '🎉',
  },
  avancee: {
    title: 'Félicitations, tu es maintenant Avancée !',
    message: 'Ton dévouement est exceptionnel. Tu as maîtrisé tous les aspects de ta pratique et tu mérites pleinement ce niveau. Tu es une véritable inspiration !',
    emoji: '🏆',
  },
}
