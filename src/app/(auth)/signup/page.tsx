'use client'

import { Suspense, useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { motion } from 'framer-motion'
import { Lock, CheckCircle, Download, Monitor } from 'lucide-react'
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
  const [downloadLinks, setDownloadLinks] = useState<Record<string, string>>({})

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

      // Fetch download URLs from settings
      const { data: dlSettings } = await supabase
        .from('app_settings')
        .select('key, value')
        .in('key', ['apk_download_url', 'google_play_url', 'apple_store_url', 'desktop_app_url'])
      if (dlSettings) {
        const links: Record<string, string> = {}
        dlSettings.forEach((s: { key: string; value: string | null }) => { if (s.value) links[s.key] = s.value })
        setDownloadLinks(links)
      }

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
    const hasAnyStore = downloadLinks.google_play_url || downloadLinks.apple_store_url
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md text-center"
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
          Télécharge l&apos;application et connecte-toi avec tes identifiants.
        </p>

        {/* ── Store buttons ── */}
        <div className="space-y-3 mb-4">
          {/* Google Play */}
          <a
            href={downloadLinks.google_play_url || '#'}
            target="_blank"
            rel="noopener noreferrer"
            className={`flex items-center gap-3 w-full px-4 py-3.5 rounded-2xl border transition-all ${
              downloadLinks.google_play_url
                ? 'bg-[#2C2C2C] border-[#2C2C2C] hover:bg-[#1a1a1a] shadow-md'
                : 'bg-[#2C2C2C]/60 border-[#2C2C2C]/40 cursor-not-allowed'
            }`}
            onClick={e => { if (!downloadLinks.google_play_url) e.preventDefault() }}
          >
            <svg viewBox="0 0 24 24" width="24" height="24" className="flex-shrink-0">
              <path d="M3.609 1.814L13.792 12 3.61 22.186a.996.996 0 0 1-.61-.92V2.734a1 1 0 0 1 .609-.92zm10.89 10.893l2.302 2.302-10.937 6.333 8.635-8.635zm3.199-3.199l2.807 1.626a1 1 0 0 1 0 1.732l-2.807 1.626L15.206 12l2.492-2.492zM5.864 2.658L16.8 8.99l-2.302 2.302-8.634-8.634z" fill="white"/>
            </svg>
            <div className="text-left flex-1">
              <p className="text-[10px] text-white/70 leading-none">Télécharger sur</p>
              <p className="text-sm font-semibold text-white leading-tight">Google Play</p>
            </div>
            {!downloadLinks.google_play_url && (
              <span className="text-[9px] bg-white/20 text-white/80 px-2 py-0.5 rounded-full">Bientôt</span>
            )}
          </a>

          {/* Apple App Store */}
          <a
            href={downloadLinks.apple_store_url || '#'}
            target="_blank"
            rel="noopener noreferrer"
            className={`flex items-center gap-3 w-full px-4 py-3.5 rounded-2xl border transition-all ${
              downloadLinks.apple_store_url
                ? 'bg-[#2C2C2C] border-[#2C2C2C] hover:bg-[#1a1a1a] shadow-md'
                : 'bg-[#2C2C2C]/60 border-[#2C2C2C]/40 cursor-not-allowed'
            }`}
            onClick={e => { if (!downloadLinks.apple_store_url) e.preventDefault() }}
          >
            <svg viewBox="0 0 24 24" width="22" height="22" className="flex-shrink-0 ml-0.5">
              <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" fill="white"/>
            </svg>
            <div className="text-left flex-1">
              <p className="text-[10px] text-white/70 leading-none">Télécharger sur l&apos;</p>
              <p className="text-sm font-semibold text-white leading-tight">App Store</p>
            </div>
            {!downloadLinks.apple_store_url && (
              <span className="text-[9px] bg-white/20 text-white/80 px-2 py-0.5 rounded-full">Bientôt</span>
            )}
          </a>
        </div>

        {/* ── APK direct download ── */}
        {downloadLinks.apk_download_url && (
          <a
            href={downloadLinks.apk_download_url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 w-full py-3 rounded-2xl bg-[#C6684F] text-white text-sm font-semibold hover:bg-[#b55a43] transition-colors shadow-md shadow-[#C6684F]/20"
          >
            <Download size={16} />
            Télécharger l&apos;APK (Android)
          </a>
        )}

        {/* ── Separator ── */}
        <div className="relative py-5">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-[#EDE5DA]" />
          </div>
          <div className="relative flex justify-center">
            <span className="bg-[#FAF6F1] px-3 text-xs text-text-muted">ou</span>
          </div>
        </div>

        {/* ── Desktop version ── */}
        <a
          href={downloadLinks.desktop_app_url || '/login'}
          className="flex items-center gap-3 w-full px-4 py-3.5 rounded-2xl bg-white border border-[#EDE5DA] hover:border-[#C6684F]/30 hover:shadow-sm transition-all"
        >
          <div className="w-10 h-10 rounded-full bg-[#C6684F]/10 flex items-center justify-center flex-shrink-0">
            <Monitor size={20} className="text-[#C6684F]" />
          </div>
          <div className="text-left flex-1">
            <p className="text-sm font-semibold text-text">Version Desktop</p>
            <p className="text-[11px] text-text-muted">Accède depuis ton navigateur</p>
          </div>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#A09488" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
        </a>

        <p className="text-[11px] text-text-muted mt-6 leading-relaxed">
          Connecte-toi avec ton email et ton mot de passe,<br />
          quelle que soit la plateforme choisie.
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
