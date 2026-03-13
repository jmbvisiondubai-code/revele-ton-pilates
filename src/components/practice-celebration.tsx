'use client'

import { useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Flame, Trophy, Sparkles } from 'lucide-react'
import type { PracticeLogResult } from '@/lib/practice-log'

interface Props {
  result: PracticeLogResult | null
  onDismiss: () => void
}

export function PracticeCelebration({ result, onDismiss }: Props) {
  useEffect(() => {
    if (!result) return
    const t = setTimeout(onDismiss, 5000)
    return () => clearTimeout(t)
  }, [result, onDismiss])

  return (
    <AnimatePresence>
      {result && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/30 backdrop-blur-sm px-6"
          onClick={onDismiss}
        >
          <motion.div
            initial={{ scale: 0.8, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            className="bg-white rounded-3xl p-6 max-w-xs w-full shadow-2xl text-center relative overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            {/* Sparkle decorations */}
            <motion.div
              className="absolute top-3 left-6 text-amber-400"
              animate={{ rotate: [0, 15, -15, 0], scale: [1, 1.2, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              <Sparkles size={16} />
            </motion.div>
            <motion.div
              className="absolute top-5 right-8 text-[#C6684F]/40"
              animate={{ rotate: [0, -10, 10, 0], scale: [1, 1.3, 1] }}
              transition={{ duration: 2.5, repeat: Infinity, delay: 0.5 }}
            >
              <Sparkles size={12} />
            </motion.div>

            {/* Main icon */}
            <motion.div
              className="w-16 h-16 mx-auto mb-4 bg-gradient-to-br from-[#C6684F] to-[#D4956B] rounded-full flex items-center justify-center shadow-lg"
              initial={{ scale: 0 }}
              animate={{ scale: [0, 1.2, 1] }}
              transition={{ delay: 0.2, duration: 0.5 }}
            >
              <motion.span
                className="text-2xl"
                animate={{ scale: [1, 1.15, 1] }}
                transition={{ duration: 1.5, repeat: Infinity }}
              >
                {result.newBadges.length > 0 ? '🏆' : '🎉'}
              </motion.span>
            </motion.div>

            <motion.h3
              className="font-[family-name:var(--font-heading)] text-xl text-[#2C2C2C] mb-1"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
            >
              Bravo !
            </motion.h3>

            <motion.p
              className="text-sm text-[#6B6359] mb-4"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4 }}
            >
              Session enregistrée avec succès
            </motion.p>

            {/* Stats row */}
            <motion.div
              className="flex justify-center gap-4 mb-4"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
            >
              <div className="text-center">
                <div className="flex items-center justify-center gap-1 text-[#C6684F]">
                  <Flame size={16} />
                  <span className="text-xl font-bold">{result.stats.current_streak}</span>
                </div>
                <p className="text-[10px] text-[#A09488] mt-0.5">jour{result.stats.current_streak !== 1 ? 's' : ''} consécutif{result.stats.current_streak !== 1 ? 's' : ''}</p>
              </div>
              <div className="w-px bg-[#DCCFBF]" />
              <div className="text-center">
                <span className="text-xl font-bold text-[#2C2C2C]">{result.stats.total_sessions}</span>
                <p className="text-[10px] text-[#A09488] mt-0.5">sessions</p>
              </div>
              <div className="w-px bg-[#DCCFBF]" />
              <div className="text-center">
                <span className="text-xl font-bold text-[#2C2C2C]">{Math.round(result.stats.total_practice_minutes / 60)}</span>
                <p className="text-[10px] text-[#A09488] mt-0.5">heures</p>
              </div>
            </motion.div>

            {/* New badges */}
            {result.newBadges.length > 0 && (
              <motion.div
                className="bg-[#F2E8DF] rounded-2xl p-3 mb-3"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.7 }}
              >
                <div className="flex items-center justify-center gap-1.5 mb-1.5">
                  <Trophy size={14} className="text-[#C6684F]" />
                  <span className="text-xs font-semibold text-[#C6684F]">Nouveau badge !</span>
                </div>
                {result.newBadges.map(badge => (
                  <div key={badge.id} className="flex items-center gap-2 mt-1">
                    <span className="text-xl">{badge.icon}</span>
                    <div className="text-left">
                      <p className="text-sm font-medium text-[#2C2C2C]">{badge.name}</p>
                      {badge.description && <p className="text-[10px] text-[#6B6359]">{badge.description}</p>}
                    </div>
                  </div>
                ))}
              </motion.div>
            )}

            <motion.button
              onClick={onDismiss}
              className="text-sm font-medium text-[#C6684F] hover:text-[#b05a42] transition-colors"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.8 }}
            >
              Continuer
            </motion.button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
