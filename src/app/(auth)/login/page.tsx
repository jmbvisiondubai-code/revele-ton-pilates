'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { motion } from 'framer-motion'
import { createClient } from '@/lib/supabase/client'
import { Button, Input } from '@/components/ui'

export default function LoginPage() {
  const router = useRouter()
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  const supabase = createClient()

  async function resolveEmail(input: string): Promise<string | null> {
    if (input.includes('@')) return input
    const { data } = await supabase.rpc('get_email_by_username', { p_username: input.toLowerCase() })
    return data ?? null
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setIsLoading(true)

    try {
      const email = await resolveEmail(identifier)
      if (!email) { setError('Email ou nom d\'utilisateur introuvable'); setIsLoading(false); return }
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) throw error
      router.push('/dashboard')
      router.refresh()
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

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="w-full max-w-sm"
    >
      {/* Logo + Header */}
      <div className="text-center mb-10">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.1, type: 'spring', stiffness: 200 }}
          className="w-28 h-28 mx-auto mb-6 rounded-3xl overflow-hidden shadow-lg shadow-[#C6684F]/15"
        >
          <Image
            src="/icon-source.png"
            alt="Révèle Ton Pilates"
            width={112}
            height={112}
            className="w-full h-full object-cover"
            priority
          />
        </motion.div>
        <motion.h1
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.4 }}
          className="font-[family-name:var(--font-heading)] text-3xl text-text mb-2"
        >
          Ravie de te revoir
        </motion.h1>
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3, duration: 0.4 }}
          className="text-sm text-text-secondary"
        >
          Connecte-toi à ton espace privé
        </motion.p>
      </div>

      {/* Login form */}
      <form onSubmit={handleLogin} className="space-y-4">
        <Input
          label="Email ou nom d'utilisateur"
          type="text"
          inputMode="text"
          placeholder="ton@email.com ou @pseudo"
          value={identifier}
          onChange={(e) => setIdentifier(e.target.value)}
          autoComplete="username"
          autoCapitalize="off"
          autoCorrect="off"
          required
        />

        <Input
          label="Mot de passe"
          type="password"
          placeholder="••••••••"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
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
          Se connecter
        </Button>
      </form>

      {/* Footer */}
      <div className="mt-10 text-center">
        <div className="w-8 h-px bg-[#DCCFBF] mx-auto mb-4" />
        <p className="text-xs text-text-muted leading-relaxed">
          Cet espace est réservé aux clientes de Marjorie.
          <br />
          Tu n&apos;as pas encore de compte ? Contacte Marjorie
          <br />
          pour recevoir ton invitation personnalisée.
        </p>
      </div>
    </motion.div>
  )
}
