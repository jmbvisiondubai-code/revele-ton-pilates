'use client'

import { motion } from 'framer-motion'
import { useOnboardingStore } from '@/stores/onboarding-store'
import { Button, Chip, Textarea } from '@/components/ui'
import type { Goal, PracticeLevel } from '@/types/database'

const levels: { value: PracticeLevel; label: string; description: string }[] = [
  {
    value: 'debutante',
    label: 'Débutante',
    description: 'Je découvre le Pilates ou j\'ai très peu pratiqué',
  },
  {
    value: 'initiee',
    label: 'Initiée',
    description: 'J\'ai les bases et je pratique depuis quelques semaines',
  },
  {
    value: 'intermediaire',
    label: 'Intermédiaire',
    description: 'Je pratique régulièrement depuis plusieurs mois',
  },
  {
    value: 'avancee',
    label: 'Avancée',
    description: 'Je pratique depuis longtemps et maîtrise les fondamentaux',
  },
]

const goalOptions: { value: Goal; label: string; emoji: string }[] = [
  { value: 'posture', label: 'Posture', emoji: '🧍‍♀️' },
  { value: 'souplesse', label: 'Souplesse', emoji: '🤸‍♀️' },
  { value: 'renforcement', label: 'Renforcement', emoji: '💪' },
  { value: 'gestion_stress', label: 'Gestion du stress', emoji: '🧘‍♀️' },
  { value: 'post_partum', label: 'Récupération post-partum', emoji: '🤱' },
  { value: 'soulagement_douleurs', label: 'Soulagement de douleurs', emoji: '🩹' },
  { value: 'tonicite', label: 'Tonicité', emoji: '✨' },
  { value: 'energie', label: 'Énergie', emoji: '⚡' },
  { value: 'connexion_corps_esprit', label: 'Connexion corps-esprit', emoji: '🌿' },
]

export function StepBody() {
  const {
    practiceLevel,
    goals,
    limitations,
    setPracticeLevel,
    toggleGoal,
    setLimitations,
    setStep,
  } = useOnboardingStore()

  function handleNext() {
    if (practiceLevel && goals.length > 0) {
      setStep(3)
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, x: 50 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -50 }}
      transition={{ duration: 0.4 }}
      className="space-y-8"
    >
      {/* Title */}
      <div className="text-center">
        <h2 className="font-[family-name:var(--font-heading)] text-3xl text-text mb-2">
          Ton corps, ton histoire
        </h2>
        <p className="text-text-secondary">
          Pour adapter chaque session à tes besoins
        </p>
      </div>

      {/* Level */}
      <div className="space-y-3">
        <label className="text-sm font-medium text-text-secondary">
          Ton niveau de pratique
        </label>
        <div className="space-y-2">
          {levels.map((level) => (
            <motion.button
              key={level.value}
              type="button"
              whileTap={{ scale: 0.98 }}
              onClick={() => setPracticeLevel(level.value)}
              className={`
                w-full text-left px-4 py-3.5 rounded-[var(--radius-lg)]
                border transition-all duration-200 cursor-pointer
                ${
                  practiceLevel === level.value
                    ? 'border-primary bg-primary/5 shadow-sm'
                    : 'border-border hover:border-primary/50'
                }
              `}
            >
              <span className="font-medium text-text">{level.label}</span>
              <p className="text-sm text-text-secondary mt-0.5">
                {level.description}
              </p>
            </motion.button>
          ))}
        </div>
      </div>

      {/* Goals */}
      <div className="space-y-3">
        <label className="text-sm font-medium text-text-secondary">
          Tes objectifs (choisis-en plusieurs)
        </label>
        <div className="flex flex-wrap gap-2">
          {goalOptions.map((goal) => (
            <Chip
              key={goal.value}
              label={goal.label}
              icon={<span>{goal.emoji}</span>}
              selected={goals.includes(goal.value)}
              onClick={() => toggleGoal(goal.value)}
            />
          ))}
        </div>
      </div>

      {/* Limitations */}
      <Textarea
        label="Pathologies ou limitations à signaler"
        placeholder="Décris ici toute douleur, blessure ou condition particulière que Marjorie devrait connaître..."
        value={limitations}
        onChange={(e) => setLimitations(e.target.value)}
        hint="Optionnel — ces informations restent confidentielles"
      />

      {/* Navigation */}
      <div className="flex gap-3">
        <Button variant="outline" onClick={() => setStep(1)} className="flex-1">
          Retour
        </Button>
        <Button
          onClick={handleNext}
          disabled={!practiceLevel || goals.length === 0}
          className="flex-[2]"
          size="lg"
        >
          Continuer
        </Button>
      </div>
    </motion.div>
  )
}
