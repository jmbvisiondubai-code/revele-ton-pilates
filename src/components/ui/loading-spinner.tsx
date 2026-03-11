'use client'

import { motion } from 'framer-motion'

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg'
  message?: string
}

const sizeStyles = {
  sm: 'w-5 h-5',
  md: 'w-8 h-8',
  lg: 'w-12 h-12',
}

export function LoadingSpinner({ size = 'md', message }: LoadingSpinnerProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-3">
      <motion.div
        className={`${sizeStyles[size]} border-2 border-border border-t-primary rounded-full`}
        animate={{ rotate: 360 }}
        transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
      />
      {message && (
        <p className="text-sm text-text-secondary animate-pulse-soft">
          {message}
        </p>
      )}
    </div>
  )
}

export function FullPageLoader({ message }: { message?: string }) {
  return (
    <div className="fixed inset-0 bg-bg flex items-center justify-center z-50">
      <div className="flex flex-col items-center gap-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center"
        >
          <h2 className="font-[family-name:var(--font-heading)] text-2xl text-primary mb-2">
            Révèle Ton Pilates
          </h2>
          <LoadingSpinner size="md" message={message} />
        </motion.div>
      </div>
    </div>
  )
}
