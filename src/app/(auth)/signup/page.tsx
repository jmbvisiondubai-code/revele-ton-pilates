'use client'

import { Suspense, useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { motion } from 'framer-motion'
import { Lock, CheckCircle, Download, Smartphone } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Button, Input } from '@/components/ui'

const USERNAME_REGEX = /^[a-zA-Z0-9_-]{3,20}$/

export default function SignupPageWrapper() {
  return (
    <Suspense fallback={<div className="w-full max-w-sm flex items-center justify-center py-20"><div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>}>
      <SignupPage />
    </Suspense>
  )
}

function SignupPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams.get('token')

  const [tokenStatus, setTokenStatus] = useState<'checking' | 'valid' | 'invalid'>('checking')
  const [email, setEmail] = useState('')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [createdFirstName, setCreatedFirstName] = useState('')
  const [apkUrl, setApkUrl] = useState<string | null>(null)

  const supabase = createClient()

  useEffect(() => {
    async function checkToken() {
      if (!token) { setTokenStatus('invalid'); return }
      const { data } = await supabase
        .from('invitations')
        .select('id, email, expires_at, used_at')
        .eq('token', token)
        .single()

      if (!data || data.used_at || new Date(data.expires_at) < new Date()) {
        setTokenStatus('invalid')
        return
      }
      if (data.email) setEmail(data.email)
      setTokenStatus('valid')
    }
    checkToken()
  }, [token]) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (!firstName.trim()) { setError('Le prénom est requis'); return }
    if (!lastName.trim()) { setError('Le nom est requis'); return }
    if (!USERNAME_REGEX.test(username)) {
      setError('Le nom d\'utilisateur doit contenir 3 à 20 caractères (lettres, chiffres, _ ou -)'); return
    }
    if (password !== confirmPassword) { setError('Les mots de passe ne correspondent pas'); return }
    if (password.length < 6) { setError('Le mot de passe doit contenir au moins 6 caractères'); return }

    setIsLoading(true)
    try {
      // Check username uniqueness
      const { data: existing } = await supabase
        .from('profiles')
        .select('id')
        .eq('username', username.toLowerCase())
        .maybeSingle()
      if (existing) { setError('Ce nom d\'utilisateur est déjà pris'); setIsLoading(false); return }

      const { data: signupData, error: signupError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/callback`,
          data: {
            first_name: firstName.trim(),
            last_name: lastName.trim(),
            username: username.toLowerCase(),
          },
        },
      })
      if (signupError) throw signupError

      if (signupData.user) {
        await supabase
          .from('invitations')
          .update({ used_at: new Date().toISOString(), used_by: signupData.user.id })
          .eq('token', token)
      }

      // Fetch APK download URL from settings
      const { data: apkSetting } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', 'apk_download_url')
        .maybeSingle()
      if (apkSetting?.value) setApkUrl(apkSetting.value)

      // Sign out so the user connects fresh in the app
      await supabase.auth.signOut()
      setCreatedFirstName(firstName.trim())
      setSuccess(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Une erreur est survenue')
    } finally {
      setIsLoading(false)
    }
  }

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
        <Link href="/login" className="inline-block text-sm font-medium text-primary hover:text-accent transition-colors">
          Déjà un compte ? Se connecter
        </Link>
      </motion.div>
    )
  }

  if (success) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-sm text-center"
      >
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
          className="w-20 h-20 mx-auto mb-6 bg-[#5B9A6B]/10 rounded-full flex items-center justify-center"
        >
          <CheckCircle size={40} className="text-[#5B9A6B]" />
        </motion.div>

        <h1 className="font-[family-name:var(--font-heading)] text-3xl text-text mb-2">
          Bienvenue {createdFirstName} !
        </h1>
        <p className="text-text-secondary text-sm leading-relaxed mb-8">
          Ton compte a été créé avec succès.<br />
          Il ne te reste plus qu&apos;à télécharger l&apos;application et te connecter avec tes identifiants.
        </p>

        <div className="space-y-3">
          {apkUrl && (
            <>
              <a
                href={apkUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 w-full py-3.5 rounded-2xl bg-[#C6684F] text-white text-sm font-semibold hover:bg-[#b55a43] transition-colors shadow-md shadow-[#C6684F]/20"
              >
                <Download size={18} />
                Télécharger l&apos;application
              </a>

              <div className="relative py-4">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-[#EDE5DA]" />
                </div>
                <div className="relative flex justify-center">
                  <span className="bg-[#FAF6F1] px-3 text-xs text-text-muted">puis</span>
                </div>
              </div>
            </>
          )}

          <div className="bg-white rounded-2xl border border-[#EDE5DA] p-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-full bg-[#C6684F]/10 flex items-center justify-center flex-shrink-0">
                <Smartphone size={20} className="text-[#C6684F]" />
              </div>
              <p className="text-sm font-semibold text-text text-left">Connecte-toi dans l&apos;app</p>
            </div>
            <ol className="text-xs text-[#6B6359] space-y-2 text-left">
              <li className="flex gap-2">
                <span className="w-5 h-5 rounded-full bg-[#C6684F]/10 text-[#C6684F] text-[10px] font-bold flex items-center justify-center flex-shrink-0">1</span>
                Installe l&apos;APK téléchargé sur ton téléphone
              </li>
              <li className="flex gap-2">
                <span className="w-5 h-5 rounded-full bg-[#C6684F]/10 text-[#C6684F] text-[10px] font-bold flex items-center justify-center flex-shrink-0">2</span>
                Ouvre l&apos;application Révèle Ton Pilates
              </li>
              <li className="flex gap-2">
                <span className="w-5 h-5 rounded-full bg-[#C6684F]/10 text-[#C6684F] text-[10px] font-bold flex items-center justify-center flex-shrink-0">3</span>
                Connecte-toi avec ton email et ton mot de passe
              </li>
            </ol>
          </div>
        </div>

        <p className="text-[11px] text-text-muted mt-6 leading-relaxed">
          Tu as déjà l&apos;application ?<br />
          Ouvre-la et connecte-toi directement.
        </p>
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
      <div className="text-center mb-8">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.1, type: 'spring', stiffness: 200 }}
          className="w-24 h-24 mx-auto mb-5 rounded-2xl overflow-hidden shadow-lg shadow-[#C6684F]/15"
        >
          <Image src="/icon-source.png" alt="Révèle Ton Pilates" width={96} height={96} className="w-full h-full object-cover" priority />
        </motion.div>
        <h1 className="font-[family-name:var(--font-heading)] text-4xl text-text mb-2">
          Bienvenue<br />dans le cercle
        </h1>
        <p className="text-text-secondary text-sm">
          Crée ton espace personnel Révèle Ton Pilates
        </p>
      </div>

      <form onSubmit={handleSignup} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Prénom"
            type="text"
            placeholder="Marie"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            required
          />
          <Input
            label="Nom"
            type="text"
            placeholder="Dupont"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            required
          />
        </div>

        <div>
          <Input
            label="Nom d'utilisateur"
            type="text"
            placeholder="marie_pilates"
            value={username}
            onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ''))}
            required
          />
          <p className="text-xs text-text-muted mt-1 ml-1">
            Visible publiquement · 3–20 caractères, lettres, chiffres, _ ou -
          </p>
        </div>

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
