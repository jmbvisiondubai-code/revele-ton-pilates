'use client'

import { motion } from 'framer-motion'
import { Camera, User } from 'lucide-react'
import { useOnboardingStore } from '@/stores/onboarding-store'
import { Button, Input } from '@/components/ui'
import { useRef, useState } from 'react'

export function StepAbout() {
  const {
    firstName,
    birthDate,
    city,
    avatarFile,
    setFirstName,
    setBirthDate,
    setCity,
    setAvatarFile,
    setStep,
  } = useOnboardingStore()

  const fileInputRef = useRef<HTMLInputElement>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)

  function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) {
      setAvatarFile(file)
      setPreviewUrl(URL.createObjectURL(file))
    }
  }

  function handleNext() {
    if (firstName.trim()) {
      setStep(2)
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
          Parle-moi de toi
        </h2>
        <p className="text-text-secondary">
          Pour que ton expérience soit unique et personnalisée
        </p>
      </div>

      {/* Avatar */}
      <div className="flex justify-center">
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="relative group cursor-pointer"
        >
          <div className="w-24 h-24 rounded-full bg-bg-elevated border-2 border-dashed border-border flex items-center justify-center overflow-hidden transition-all group-hover:border-primary">
            {previewUrl || avatarFile ? (
              <img
                src={previewUrl!}
                alt="Aperçu"
                className="w-full h-full object-cover"
              />
            ) : (
              <User className="w-10 h-10 text-text-muted" />
            )}
          </div>
          <div className="absolute -bottom-1 -right-1 w-8 h-8 bg-primary rounded-full flex items-center justify-center shadow-md">
            <Camera size={14} className="text-white" />
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleAvatarChange}
            className="hidden"
          />
        </button>
      </div>
      <p className="text-center text-xs text-text-muted -mt-4">
        Optionnel — ajoute une photo si tu le souhaites
      </p>

      {/* Form fields */}
      <div className="space-y-4">
        <Input
          label="Ton prénom"
          placeholder="Comment tu t'appelles ?"
          value={firstName}
          onChange={(e) => setFirstName(e.target.value)}
          required
        />
        <Input
          label="Date de naissance"
          type="date"
          value={birthDate}
          onChange={(e) => setBirthDate(e.target.value)}
          hint="Optionnel — pour personnaliser ton expérience"
        />
        <Input
          label="Ville"
          placeholder="Où vis-tu ?"
          value={city}
          onChange={(e) => setCity(e.target.value)}
          hint="Optionnel"
        />
      </div>

      {/* Next */}
      <Button
        fullWidth
        onClick={handleNext}
        disabled={!firstName.trim()}
        size="lg"
      >
        Continuer
      </Button>
    </motion.div>
  )
}
