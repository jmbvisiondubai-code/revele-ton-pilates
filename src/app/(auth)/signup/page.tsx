'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { Heart } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Button, Input } from '@/components/ui'

export default function SignupPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  const supabase = createClient()

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (password !== confirmPassword) {
      setError('Les mots de passe ne correspondent pas')
      return
    }

    if (password.length < 6) {
      setError('Le mot de passe doit contenir au moins 6 caractères')
      return
    }

    setIsLoading(true)

    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/callback`,
        },
      })

      if (error) throw error

      // After signup, create initial profile and redirect to onboarding
      router.push('/onboarding')
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
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="w-full max-w-sm"
    >
      {/* Header */}
      <div className="text-center mb-10">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.1, type: 'spring', stiffness: 200 }}
          className="w-20 h-20 mx-auto mb-5 bg-success-light rounded-full flex items-center justify-center"
        >
          <Heart className="w-10 h-10 text-success" />
        </motion.div>
        <h1 className="font-[family-name:var(--font-heading)] text-4xl text-text mb-2">
          Commence ton
          <br />
          parcours
        </h1>
        <p className="text-text-secondary">
          Crée ton espace personnel Révèle Ton Pilates
        </p>
      </div>

      {/* Form */}
      <form onSubmit={handleSignup} className="space-y-4">
        <Input
          label="Email"
          type="email"
          placeholder="ton@email.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <Input
          label="Mot de passe"
          type="password"
          placeholder="Au moins 6 caractères"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <Input
          label="Confirmer le mot de passe"
          type="password"
          placeholder="Confirme ton mot de passe"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          required
        />

        {error && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-sm text-error bg-error-light px-4 py-2.5 rounded-[var(--radius-md)]"
          >
            {error}
          </motion.p>
        )}

        <Button type="submit" fullWidth isLoading={isLoading}>
          Créer mon espace
        </Button>
      </form>

      {/* Login link */}
      <div className="mt-8 text-center">
        <p className="text-sm text-text-secondary">
          Déjà un compte ?{' '}
          <Link
            href="/login"
            className="text-primary font-medium hover:text-accent transition-colors"
          >
            Se connecter
          </Link>
        </p>
      </div>
    </motion.div>
  )
}
