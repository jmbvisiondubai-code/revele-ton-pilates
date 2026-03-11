'use client'

import { type ReactNode } from 'react'
import { motion } from 'framer-motion'

interface CardProps {
  hover?: boolean
  padding?: 'sm' | 'md' | 'lg'
  className?: string
  onClick?: () => void
  children: ReactNode
}

const paddingStyles = {
  sm: 'p-4',
  md: 'p-5',
  lg: 'p-6',
}

export function Card({
  hover = false,
  padding = 'md',
  className = '',
  onClick,
  children,
}: CardProps) {
  const classes = `
    bg-bg-card
    rounded-[var(--radius-lg)]
    border border-border-light
    shadow-[0_2px_12px_rgba(0,0,0,0.04)]
    ${paddingStyles[padding]}
    ${className}
  `

  if (hover) {
    return (
      <motion.div
        whileHover={{ y: -2, boxShadow: '0 8px 30px rgba(0,0,0,0.08)' }}
        transition={{ type: 'spring' as const, stiffness: 300, damping: 25 }}
        className={classes}
        onClick={onClick}
      >
        {children}
      </motion.div>
    )
  }

  return <div className={classes} onClick={onClick}>{children}</div>
}
