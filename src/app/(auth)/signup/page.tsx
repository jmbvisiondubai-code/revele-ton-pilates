'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { Heart, Lock } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Button, Input } from '@/components/ui'

export default function SignupPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams.get('token')

  const [tokenStatus, setTokenStatus] = useState<'checking' | 'valid' | 'invalid'>('checking')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  const supabase = createClient()

  // Vérifier la validité du token d'invitation
  useEffect(() => {
    async function checkToken() {
      if (!token) {
        setTokenStatus('invalid')
        return
      }
      const { data } = await supabase
        .from('invitations')
        .select('id, email, expires_at, used_at')
        .eq('token', token)
        .single()

      if (!data || data.used_at || new Date(data.expires_at) < new Date()) {
        setTokenStatus('invalid')
        return
      }

      // Pré-remplir l'email si l'invitation est nominative
      if (data.email) setEmail(data.email)
      setTokenStatus('valid')
    }
    checkToken()
  }, [token]) // eslint-disable-line react-hooks/exhaustive-deps

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
      const { data: signupData, error: signupError } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: `${window.location.origin}/callback` },
      })
      if (signupError) throw signupError

      // Marquer le token comme utilisé
      if (signupData.user) {
        await supabase
          .from('invitations')
          .update({ used_at: new Date().toISOString(), used_by: signupData.user.id })
          .eq('token', token)
      }

      router.push('/onboarding')
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Une erreur est survenue')
    } finally {
      setIsLoading(false)
    }
  }

  // Token manquant ou invalide
  if (tokenStatus === 'checking') {
    return (
      <div className="w-full max-w-sm flex items-center justify-center py-20">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (tokenStatus === 'invalid') {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm text-center"
      >
        <div className="w-20 h-20 mx-auto mb-6 bg-error-light rounded-full flex items-center justify-center">
          <Lock className="w-10 h-10 text-error" />
        </div>
        <h1 className="font-[family-name:var(--font-heading)] text-3xl text-text mb-3">
          Accès sur invitation
        </h1>
        <p className="text-text-secondary text-sm leading-relaxed mb-6">
          Cet espace est réservé aux clientes de Marjorie.<br />
          Pour rejoindre la communauté, contacte Marjorie pour recevoir ton lien d&apos;invitation personnalisé.
        </p>
        <Link
          href="/login"
          className="inline-block text-sm font-medium text-primary hover:text-accent transition-colors"
        >
          Déjà un compte ? Se connecter
        </Link>
      </motion.div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="w-full max-w-sm"
    >
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
          Bienvenue<br />dans le cercle
        </h1>
        <p className="text-text-secondary text-sm">
          Crée ton espace personnel Révèle Ton Pilates
        </p>
      </div>

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

      <div className="mt-8 text-center">
        <p className="text-sm text-text-secondary">
          Déjà un compte ?{' '}
          <Link href="/login" className="text-primary font-medium hover:text-accent transition-colors">
            Se connecter
          </Link>
        </p>
      </div>
    </motion.div>
  )
}
