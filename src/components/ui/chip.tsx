'use client'

import { motion } from 'framer-motion'
import { Check } from 'lucide-react'

interface ChipProps {
  label: string
  selected?: boolean
  onClick?: () => void
  icon?: React.ReactNode
}

export function Chip({ label, selected = false, onClick, icon }: ChipProps) {
  return (
    <motion.button
      type="button"
      whileTap={{ scale: 0.95 }}
      onClick={onClick}
      className={`
        inline-flex items-center gap-2
        px-4 py-2.5 rounded-[var(--radius-full)]
        text-sm font-medium
        transition-all duration-200
        cursor-pointer
        ${
          selected
            ? 'bg-primary text-white shadow-sm'
            : 'bg-bg-card border border-border text-text-secondary hover:border-primary hover:text-text'
        }
      `}
    >
      {icon}
      {label}
      {selected && <Check size={14} strokeWidth={3} />}
    </motion.button>
  )
}
