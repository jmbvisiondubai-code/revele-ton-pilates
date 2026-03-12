'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { Mail, Lock, Sparkles } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Button, Input } from '@/components/ui'

export default function LoginPage() {
  const router = useRouter()
  const [identifier, setIdentifier] = useState('') // email or username
  const [password, setPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isMagicLink, setIsMagicLink] = useState(false)
  const [error, setError] = useState('')
  const [magicLinkSent, setMagicLinkSent] = useState(false)

  const supabase = createClient()

  async function resolveEmail(input: string): Promise<string | null> {
    if (input.includes('@')) return input
    // It's a username — look up the email via RPC
    const { data } = await supabase.rpc('get_email_by_username', { p_username: input.toLowerCase() })
    return data ?? null
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setIsLoading(true)

    try {
      if (isMagicLink) {
        const email = await resolveEmail(identifier)
        if (!email) { setError('Email ou nom d\'utilisateur introuvable'); setIsLoading(false); return }
        const { error } = await supabase.auth.signInWithOtp({
          email,
          options: { emailRedirectTo: `${window.location.origin}/callback` },
        })
        if (error) throw error
        setMagicLinkSent(true)
      } else {
        const email = await resolveEmail(identifier)
        if (!email) { setError('Email ou nom d\'utilisateur introuvable'); setIsLoading(false); return }
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
        router.push('/dashboard')
        router.refresh()
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message === 'Invalid login credentials'
            ? 'Identifiant ou mot de passe incorrect'
            : err.message
          : 'Une erreur est survenue'
      )
    } finally {
      setIsLoading(false)
    }
  }

  if (magicLinkSent) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm text-center"
      >
        <div className="mb-6">
          <div className="w-16 h-16 mx-auto mb-4 bg-success-light rounded-full flex items-center justify-center">
            <Mail className="w-8 h-8 text-success" />
          </div>
          <h1 className="font-[family-name:var(--font-heading)] text-3xl text-text mb-2">
            Vérifie ta boîte mail
          </h1>
          <p className="text-text-secondary">
            Un lien de connexion a été envoyé à{' '}
            <span className="font-medium text-text">{identifier}</span>
          </p>
        </div>
        <Button variant="ghost" onClick={() => { setMagicLinkSent(false); setIsMagicLink(false) }}>
          Retour à la connexion
        </Button>
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
          className="w-20 h-20 mx-auto mb-5 bg-primary/10 rounded-full flex items-center justify-center"
        >
          <Sparkles className="w-10 h-10 text-primary" />
        </motion.div>
        <h1 className="font-[family-name:var(--font-heading)] text-4xl text-text mb-2">
          Bienvenue dans
          <br />
          ton espace
        </h1>
        <p className="text-text-secondary">
          Révèle Ton Pilates — par MJ Pilates
        </p>
      </div>

      <form onSubmit={handleLogin} className="space-y-4">
        <Input
          label="Email ou nom d'utilisateur"
          type="text"
          placeholder="ton@email.com ou @nom_utilisateur"
          value={identifier}
          onChange={(e) => setIdentifier(e.target.value)}
          required
        />

        {!isMagicLink && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
          >
            <Input
              label="Mot de passe"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required={!isMagicLink}
            />
          </motion.div>
        )}

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
          {isMagicLink ? 'Recevoir le lien magique' : 'Se connecter'}
        </Button>
      </form>

      <div className="mt-4 text-center">
        <button
          type="button"
          onClick={() => { setIsMagicLink(!isMagicLink); setError('') }}
          className="text-sm text-primary hover:text-accent transition-colors cursor-pointer"
        >
          {isMagicLink ? (
            <span className="flex items-center justify-center gap-1.5">
              <Lock size={14} />
              Se connecter avec un mot de passe
            </span>
          ) : (
            <span className="flex items-center justify-center gap-1.5">
              <Mail size={14} />
              Se connecter avec un lien magique
            </span>
          )}
        </button>
      </div>

      <div className="mt-8 text-center">
        <p className="text-sm text-text-secondary">
          Pas encore de compte ?{' '}
          <Link href="/signup" className="text-primary font-medium hover:text-accent transition-colors">
            Créer mon espace
          </Link>
        </p>
      </div>
    </motion.div>
  )
}
