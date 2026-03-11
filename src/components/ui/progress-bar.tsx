'use client'

import { motion } from 'framer-motion'

interface ProgressBarProps {
  value: number // 0-100
  label?: string
  showValue?: boolean
  size?: 'sm' | 'md' | 'lg'
  color?: 'primary' | 'success' | 'accent'
}

const sizeStyles = {
  sm: 'h-1.5',
  md: 'h-2.5',
  lg: 'h-4',
}

const colorStyles = {
  primary: 'bg-primary',
  success: 'bg-success',
  accent: 'bg-accent',
}

export function ProgressBar({
  value,
  label,
  showValue = false,
  size = 'md',
  color = 'primary',
}: ProgressBarProps) {
  const clampedValue = Math.min(100, Math.max(0, value))

  return (
    <div className="w-full">
      {(label || showValue) && (
        <div className="flex justify-between items-center mb-1.5">
          {label && (
            <span className="text-sm text-text-secondary">{label}</span>
          )}
          {showValue && (
            <span className="text-sm font-medium text-text-secondary">
              {Math.round(clampedValue)}%
            </span>
          )}
        </div>
      )}
      <div
        className={`
          w-full bg-bg-elevated rounded-[var(--radius-full)] overflow-hidden
          ${sizeStyles[size]}
        `}
      >
        <motion.div
          className={`h-full rounded-[var(--radius-full)] ${colorStyles[color]}`}
          initial={{ width: 0 }}
          animate={{ width: `${clampedValue}%` }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
        />
      </div>
    </div>
  )
}
