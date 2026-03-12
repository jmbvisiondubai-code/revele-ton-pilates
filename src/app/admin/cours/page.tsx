'use client'

import { ExternalLink } from 'lucide-react'

const VOD_CATEGORIES = [
  { label: 'Programmes', emoji: '🗓️', url: 'https://vod.marjoriejamin.com/categories/programmespilates' },
  { label: 'Nouveaux cours', emoji: '✨', url: 'https://vod.marjoriejamin.com/categories/nouveauxcours' },
  { label: 'Full Body', emoji: '💪', url: 'https://vod.marjoriejamin.com/categories/fullbody' },
  { label: 'Reformer', emoji: '🎯', url: 'https://vod.marjoriejamin.com/categories/reformer' },
  { label: 'Pilates Perfect Time (16 à 30 min)', emoji: '⏱️', url: 'https://vod.marjoriejamin.com/categories/pilatesperfecttime' },
  { label: 'Quick Pilates (15 min max)', emoji: '⚡', url: 'https://vod.marjoriejamin.com/categories/quickpilates' },
  { label: 'Pilates Sessions Longues (35 min à 1h)', emoji: '🕐', url: 'https://vod.marjoriejamin.com/categories/pilatessessionslongues' },
  { label: 'Energy (re)boost & Vitality', emoji: '🌟', url: 'https://vod.marjoriejamin.com/categories/energy-reboost-vitality-pilates' },
  { label: 'Intense & Dynamic', emoji: '🔥', url: 'https://vod.marjoriejamin.com/categories/intense-dynamic-pilates' },
  { label: 'Détente & Stretching', emoji: '🌸', url: 'https://vod.marjoriejamin.com/categories/detente-stretching' },
  { label: 'Basic Pilates — Débutant', emoji: '🌱', url: 'https://vod.marjoriejamin.com/categories/basicpilates' },
  { label: 'Avec Accessoires / Petit matériel Pilates', emoji: '🎽', url: 'https://vod.marjoriejamin.com/categories/pilatesaccessoires' },
  { label: 'Souplesse', emoji: '🤸', url: 'https://vod.marjoriejamin.com/categories/souplesse' },
  { label: 'Prénatal', emoji: '🤰', url: 'https://vod.marjoriejamin.com/categories/prenatal' },
  { label: 'Postnatal', emoji: '👶', url: 'https://vod.marjoriejamin.com/categories/postnatal' },
  { label: 'Abdos', emoji: '🎯', url: 'https://vod.marjoriejamin.com/categories/abdos' },
  { label: 'Bas du corps', emoji: '🦵', url: 'https://vod.marjoriejamin.com/categories/basducorps' },
  { label: 'Haut du corps', emoji: '🏋️', url: 'https://vod.marjoriejamin.com/categories/hautducorps' },
  { label: 'Circuit-Training', emoji: '🏃', url: 'https://vod.marjoriejamin.com/categories/circuit-training' },
]

export default function AdminCoursPage() {
  return (
    <div className="max-w-3xl">
      <div className="mb-6">
        <h1 className="font-serif text-2xl text-[#2C2C2C] mb-1">Cours VOD — Uscreen</h1>
        <p className="text-sm text-[#6B6359]">
          Les cours sont hébergés sur Uscreen. Voici les 19 catégories disponibles dans l'application.
        </p>
        <a
          href="https://vod.marjoriejamin.com"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 mt-3 text-sm font-medium text-[#C6684F] hover:underline"
        >
          <ExternalLink size={14} /> Ouvrir la bibliothèque Uscreen complète
        </a>
      </div>

      <div className="bg-white border border-[#DCCFBF] rounded-xl overflow-hidden">
        {VOD_CATEGORIES.map((cat, i) => (
          <div
            key={cat.url}
            className={`flex items-center gap-3 px-4 py-3 ${i < VOD_CATEGORIES.length - 1 ? 'border-b border-[#F2E8DF]' : ''}`}
          >
            <span className="text-xl w-7 text-center flex-shrink-0">{cat.emoji}</span>
            <p className="flex-1 text-sm text-[#2C2C2C] font-medium">{cat.label}</p>
            <a
              href={cat.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-xs text-[#C6684F] hover:underline flex-shrink-0"
            >
              Voir <ExternalLink size={11} />
            </a>
          </div>
        ))}
      </div>
    </div>
  )
}
