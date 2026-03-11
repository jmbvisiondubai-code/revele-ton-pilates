'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { Sun, CloudSun, Moon, Heart } from 'lucide-react'
import { useOnboardingStore } from '@/stores/onboarding-store'
import { createClient } from '@/lib/supabase/client'
import { Button, Chip } from '@/components/ui'
import type { PreferredTime } from '@/types/database'

const rhythmOptions = [
  { value: 2, label: '2x / sem.' },
  { value: 3, label: '3x / sem.' },
  { value: 4, label: '4x / sem.' },
  { value: 5, label: '5x / sem.' },
]

const dayOptions = [
  { value: 'lundi', label: 'Lun' },
  { value: 'mardi', label: 'Mar' },
  { value: 'mercredi', label: 'Mer' },
  { value: 'jeudi', label: 'Jeu' },
  { value: 'vendredi', label: 'Ven' },
  { value: 'samedi', label: 'Sam' },
  { value: 'dimanche', label: 'Dim' },
]

const timeOptions: { value: PreferredTime; label: string; icon: React.ReactNode }[] = [
  { value: 'matin', label: 'Matin', icon: <Sun size={18} /> },
  { value: 'midi', label: 'Midi', icon: <CloudSun size={18} /> },
  { value: 'soir', label: 'Soir', icon: <Moon size={18} /> },
]

export function StepCommitment() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  const {
    firstName,
    birthDate,
    city,
    avatarFile,
    practiceLevel,
    goals,
    limitations,
    weeklyRhythm,
    preferredDays,
    preferredTime,
    setWeeklyRhythm,
    togglePreferredDay,
    setPreferredTime,
    setStep,
  } = useOnboardingStore()

  const supabase = createClient()

  async function handleCommit() {
    setIsLoading(true)
    setError('')

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) throw new Error('Non connectée')

      let avatarUrl: string | null = null

      // Upload avatar if provided
      if (avatarFile) {
        const fileExt = avatarFile.name.split('.').pop()
        const filePath = `${user.id}/avatar.${fileExt}`

        const { error: uploadError } = await supabase.storage
          .from('avatars')
          .upload(filePath, avatarFile, { upsert: true })

        if (!uploadError) {
          const { data } = supabase.storage
            .from('avatars')
            .getPublicUrl(filePath)
          avatarUrl = data.publicUrl
        }
      }

      // Upsert profile
      const { error: profileError } = await supabase.from('profiles').upsert({
        id: user.id,
        first_name: firstName,
        avatar_url: avatarUrl,
        birth_date: birthDate || null,
        city: city || null,
        practice_level: practiceLevel,
        goals,
        limitations: limitations || null,
        weekly_rhythm: weeklyRhythm,
        preferred_days: preferredDays,
        preferred_time: preferredTime,
        onboarding_completed: true,
        commitment_signed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })

      if (profileError) throw new Error(profileError.message || JSON.stringify(profileError))

      router.push('/dashboard')
      router.refresh()
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Une erreur est survenue'
      )
    } finally {
      setIsLoading(false)
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
          Ton engagement
        </h2>
        <p className="text-text-secondary">
          Définis ton rythme idéal — tu pourras le modifier à tout moment
        </p>
      </div>

      {/* Rhythm */}
      <div className="space-y-3">
        <label className="text-sm font-medium text-text-secondary">
          Ton rythme idéal
        </label>
        <div className="flex gap-2">
          {rhythmOptions.map((opt) => (
            <motion.button
              key={opt.value}
              type="button"
              whileTap={{ scale: 0.95 }}
              onClick={() => setWeeklyRhythm(opt.value)}
              className={`
                flex-1 py-3 rounded-[var(--radius-lg)] text-sm font-medium
                border transition-all duration-200 cursor-pointer
                ${
                  weeklyRhythm === opt.value
                    ? 'border-primary bg-primary text-white shadow-sm'
                    : 'border-border text-text-secondary hover:border-primary/50'
                }
              `}
            >
              {opt.label}
            </motion.button>
          ))}
        </div>
      </div>

      {/* Preferred days */}
      <div className="space-y-3">
        <label className="text-sm font-medium text-text-secondary">
          Tes jours préférés
        </label>
        <div className="flex gap-1.5">
          {dayOptions.map((day) => (
            <motion.button
              key={day.value}
              type="button"
              whileTap={{ scale: 0.9 }}
              onClick={() => togglePreferredDay(day.value)}
              className={`
                flex-1 py-2.5 rounded-[var(--radius-md)] text-xs font-medium
                border transition-all duration-200 cursor-pointer
                ${
                  preferredDays.includes(day.value)
                    ? 'border-primary bg-primary text-white'
                    : 'border-border text-text-secondary hover:border-primary/50'
                }
              `}
            >
              {day.label}
            </motion.button>
          ))}
        </div>
      </div>

      {/* Preferred time */}
      <div className="space-y-3">
        <label className="text-sm font-medium text-text-secondary">
          Ton moment de la journée
        </label>
        <div className="flex gap-2">
          {timeOptions.map((opt) => (
            <motion.button
              key={opt.value}
              type="button"
              whileTap={{ scale: 0.95 }}
              onClick={() => setPreferredTime(opt.value)}
              className={`
                flex-1 py-3.5 rounded-[var(--radius-lg)] text-sm font-medium
                border transition-all duration-200 cursor-pointer
                flex flex-col items-center gap-1.5
                ${
                  preferredTime === opt.value
                    ? 'border-primary bg-primary/5 text-primary shadow-sm'
                    : 'border-border text-text-secondary hover:border-primary/50'
                }
              `}
            >
              {opt.icon}
              {opt.label}
            </motion.button>
          ))}
        </div>
      </div>

      {error && (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-sm text-error bg-error-light px-4 py-2.5 rounded-[var(--radius-md)]"
        >
          {error}
        </motion.p>
      )}

      {/* Commitment CTA */}
      <div className="space-y-4 pt-4">
        <motion.div
          className="text-center p-6 bg-primary/5 rounded-[var(--radius-xl)] border border-primary/20"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <p className="font-[family-name:var(--font-heading)] text-lg text-text italic mb-1">
            &ldquo;Chaque session est un cadeau que tu te fais.&rdquo;
          </p>
          <p className="text-sm text-text-secondary">— Marjorie, MJ Pilates</p>
        </motion.div>

        <div className="flex gap-3">
          <Button variant="outline" onClick={() => setStep(2)} className="flex-1">
            Retour
          </Button>
          <Button
            onClick={handleCommit}
            isLoading={isLoading}
            className="flex-[2]"
            size="lg"
          >
            <Heart size={18} />
            Je m&apos;engage pour moi
          </Button>
        </div>
      </div>
    </motion.div>
  )
}
