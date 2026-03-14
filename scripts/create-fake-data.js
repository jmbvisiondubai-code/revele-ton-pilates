const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing SUPABASE_URL or SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false }
})

const ADMIN_ID = 'ea60681e-9ed4-4476-ad40-a3b25a1ab560'

const clients = [
  { first: 'Sophie', last: 'Martin', email: 'sophie.martin.test@fakepilates.com', level: 'intermediaire', sessions: 24, goals: ['renforcement', 'posture'], limitations: 'Scoliose légère', sub_months: 8 },
  { first: 'Claire', last: 'Dubois', email: 'claire.dubois.test@fakepilates.com', level: 'debutante', sessions: 5, goals: ['souplesse'], limitations: null, sub_months: 2 },
  { first: 'Emma', last: 'Bernard', email: 'emma.bernard.test@fakepilates.com', level: 'avancee', sessions: 52, goals: ['renforcement', 'tonicite', 'energie'], limitations: 'Tendinite épaule droite', sub_months: 14 },
  { first: 'Julie', last: 'Petit', email: 'julie.petit.test@fakepilates.com', level: 'intermediaire', sessions: 18, goals: ['posture', 'soulagement_douleurs'], limitations: null, sub_months: 6 },
  { first: 'Camille', last: 'Roux', email: 'camille.roux.test@fakepilates.com', level: 'debutante', sessions: 2, goals: ['post_partum', 'renforcement'], limitations: 'Diastasis', sub_months: 1 },
  { first: 'Léa', last: 'Moreau', email: 'lea.moreau.test@fakepilates.com', level: 'intermediaire', sessions: 30, goals: ['gestion_stress', 'connexion_corps_esprit'], limitations: null, sub_months: 10 },
  { first: 'Manon', last: 'Laurent', email: 'manon.laurent.test@fakepilates.com', level: 'avancee', sessions: 45, goals: ['tonicite', 'souplesse', 'energie'], limitations: 'Entorse cheville (ancienne)', sub_months: 12 },
  { first: 'Chloé', last: 'Simon', email: 'chloe.simon.test@fakepilates.com', level: 'debutante', sessions: 8, goals: ['tonicite', 'renforcement'], limitations: null, sub_months: 3 },
  { first: 'Inès', last: 'Michel', email: 'ines.michel.test@fakepilates.com', level: 'intermediaire', sessions: 15, goals: ['souplesse', 'soulagement_douleurs'], limitations: 'Arthrose hanche gauche', sub_months: 5 },
  { first: 'Sarah', last: 'Garcia', email: 'sarah.garcia.test@fakepilates.com', level: 'debutante', sessions: 0, goals: ['connexion_corps_esprit'], limitations: null, sub_months: 0 }
]

const liveSessions = [
  { title: 'Pilates Flow - Matinée', scheduled: '2026-02-10T09:00:00Z', session_type: 'collectif', max: 12, past: true },
  { title: 'Renforcement Profond', scheduled: '2026-02-17T10:00:00Z', session_type: 'collectif', max: 10, past: true },
  { title: 'Stretching & Mobilité', scheduled: '2026-02-24T18:00:00Z', session_type: 'collectif', max: 12, past: true },
  { title: 'Pilates Cardio', scheduled: '2026-03-03T09:00:00Z', session_type: 'masterclass', max: 10, past: true },
  { title: 'Barre au Sol', scheduled: '2026-03-07T10:00:00Z', session_type: 'atelier', max: 8, past: true },
  { title: 'Full Body Pilates', scheduled: '2026-03-10T09:00:00Z', session_type: 'collectif', max: 12, past: true },
  { title: 'Pilates Doux - Récupération', scheduled: '2026-03-17T09:00:00Z', session_type: 'collectif', max: 12, past: false },
  { title: 'Pilates Intensif', scheduled: '2026-03-20T18:00:00Z', session_type: 'masterclass', max: 10, past: false },
  { title: 'Mobilité & Respiration', scheduled: '2026-03-24T10:00:00Z', session_type: 'collectif', max: 12, past: false }
]

const recommendations = [
  { clientIdx: 1, title: 'Étirements quotidiens', message: 'Faire 10 min d\'étirements chaque matin pour améliorer la souplesse. Concentre-toi sur les ischio-jambiers et les hanches.', category: 'mouvement' },
  { clientIdx: 2, title: 'Renforcement épaule', message: 'Éviter les mouvements au-dessus de la tête pour le moment. Privilégier les exercices de rotation externe avec élastique léger, 3x/semaine.', category: 'mouvement' },
  { clientIdx: 2, title: 'Programme avancé', message: 'Tu es prête pour le niveau avancé ! Intègre des exercices sur reformer si possible, et augmente les répétitions de 12 à 15.', category: 'cours' },
  { clientIdx: 3, title: 'Posture bureau', message: 'Toutes les 45 min, fais la série : rétraction menton + ouverture thoracique + rotation cervicale. 5 répétitions de chaque.', category: 'bien_etre' },
  { clientIdx: 4, title: 'Post-partum phase 1', message: 'On commence doucement : respiration diaphragmatique + activation transverse 3x/jour. Pas d\'abdominaux classiques pour l\'instant.', category: 'mouvement' },
  { clientIdx: 5, title: 'Anti-stress', message: 'Intègre 5 min de respiration carrée (4-4-4-4) avant chaque séance. Ça va transformer ton ressenti pendant le cours.', category: 'mindset' },
  { clientIdx: 7, title: 'Gainage progressif', message: 'Commence par des planches de 20s et augmente de 5s chaque semaine. Objectif : tenir 1 min stable d\'ici fin avril.', category: 'mouvement' },
  { clientIdx: 8, title: 'Mobilité hanches', message: 'Les exercices de rotation interne/externe sont essentiels pour toi. Fais la série que je t\'ai montrée en live au moins 4x/semaine.', category: 'mouvement' },
  { clientIdx: 8, title: 'Gestion douleur', message: 'Si tu sens une gêne pendant un exercice, passe en version allégée. Ne force jamais sur la hanche gauche en fin d\'amplitude.', category: 'bien_etre' },
  { clientIdx: 9, title: 'Programme découverte', message: 'Bienvenue ! Commence par les cours VOD niveau débutant : "Bases du Pilates" et "Premiers pas". Fais-les 2x avant de passer aux lives.', category: 'cours' }
]

async function main() {
  console.log('=== Mise à jour des 10 clientes test ===\n')

  // Users already created, just get their IDs
  const { data: existing } = await supabase.auth.admin.listUsers()
  const userIds = []

  for (const c of clients) {
    const found = existing?.users?.find(u => u.email === c.email)

    if (found) {
      console.log(`✓ ${c.first} ${c.last} trouvée (${found.id})`)
      userIds.push(found.id)

      // Update profile with correct column names
      const subStart = new Date()
      subStart.setMonth(subStart.getMonth() - c.sub_months)

      const updateData = {
        first_name: c.first,
        last_name: c.last,
        practice_level: c.level,
        total_sessions: c.sessions,
        goals: c.goals,
        limitations: c.limitations,
        onboarding_completed: true
      }
      if (c.sub_months > 0) {
        updateData.subscription_start = subStart.toISOString().split('T')[0]
      }

      const { error: profErr } = await supabase.from('profiles').update(updateData).eq('id', found.id)

      if (profErr) console.error(`  Profil erreur: ${profErr.message}`)
      else console.log(`  Profil mis à jour`)
    } else {
      console.error(`✗ ${c.first} ${c.last} non trouvée !`)
      userIds.push(null)
    }
  }

  console.log('\n=== Création des sessions live ===\n')

  const liveIds = []

  for (const ls of liveSessions) {
    const { data, error } = await supabase.from('live_sessions').insert({
      title: ls.title,
      scheduled_at: ls.scheduled,
      session_type: ls.session_type,
      is_collective: ls.session_type === 'collectif',
      max_participants: ls.max,
      meeting_url: 'https://zoom.us/j/fake' + Math.floor(Math.random() * 9000000 + 1000000)
    }).select('id').single()

    if (error) {
      console.error(`✗ Live "${ls.title}": ${error.message}`)
      liveIds.push(null)
    } else {
      console.log(`✓ Live "${ls.title}" (${data.id})`)
      liveIds.push(data.id)
    }
  }

  console.log('\n=== Création des inscriptions ===\n')

  for (let i = 0; i < liveIds.length; i++) {
    if (!liveIds[i]) continue
    const ls = liveSessions[i]

    const validUsers = userIds.filter(id => id !== null)
    const numParticipants = ls.past ? Math.floor(Math.random() * 5) + 4 : Math.floor(Math.random() * 4) + 2
    const shuffled = [...validUsers].sort(() => Math.random() - 0.5)
    const participants = shuffled.slice(0, Math.min(numParticipants, shuffled.length))

    for (const userId of participants) {
      const attended = ls.past ? Math.random() < 0.8 : null
      const { error } = await supabase.from('live_registrations').insert({
        live_session_id: liveIds[i],
        user_id: userId,
        attended: attended
      })

      if (error && !error.message.includes('duplicate')) {
        console.error(`  Inscription erreur: ${error.message}`)
      }
    }

    console.log(`✓ ${participants.length} inscriptions pour "${ls.title}"${ls.past ? ' (avec présences)' : ''}`)
  }

  console.log('\n=== Création des recommandations ===\n')

  for (const rec of recommendations) {
    const userId = userIds[rec.clientIdx]
    if (!userId) continue

    const { error } = await supabase.from('recommendations').insert({
      user_id: userId,
      created_by: ADMIN_ID,
      title: rec.title,
      message: rec.message,
      category: rec.category
    })

    if (error) {
      console.error(`✗ Reco "${rec.title}": ${error.message}`)
    } else {
      console.log(`✓ Reco "${rec.title}" pour ${clients[rec.clientIdx].first}`)
    }
  }

  console.log('\n=== Terminé ! ===')
}

main().catch(console.error)
