'use client'

import { type ReactNode, type MouseEventHandler } from 'react'
import { motion } from 'framer-motion'
import { Loader2 } from 'lucide-react'

type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'accent'
type ButtonSize = 'sm' | 'md' | 'lg'

interface ButtonProps {
  variant?: ButtonVariant
  size?: ButtonSize
  isLoading?: boolean
  fullWidth?: boolean
  disabled?: boolean
  type?: 'button' | 'submit' | 'reset'
  className?: string
  children: ReactNode
  onClick?: MouseEventHandler<HTMLButtonElement>
}

const variantStyles: Record<ButtonVariant, string> = {
  primary:
    'bg-primary text-white hover:bg-primary-dark active:bg-accent shadow-sm',
  secondary:
    'bg-secondary text-text hover:bg-secondary-light active:bg-primary',
  outline:
    'border-2 border-primary text-primary hover:bg-primary hover:text-white',
  ghost:
    'text-text-secondary hover:bg-bg-elevated hover:text-text',
  accent:
    'bg-accent text-white hover:bg-accent-light active:bg-primary-dark shadow-sm',
}

const sizeStyles: Record<ButtonSize, string> = {
  sm: 'px-4 py-2 text-sm rounded-[var(--radius-md)]',
  md: 'px-6 py-3 text-base rounded-[var(--radius-lg)]',
  lg: 'px-8 py-4 text-lg rounded-[var(--radius-xl)]',
}

export function Button({
  variant = 'primary',
  size = 'md',
  isLoading = false,
  fullWidth = false,
  disabled,
  type = 'button',
  className = '',
  children,
  onClick,
}: ButtonProps) {
  return (
    <motion.button
      type={type}
      whileTap={{ scale: 0.97 }}
      whileHover={{ scale: 1.01 }}
      transition={{ type: 'spring', stiffness: 400, damping: 25 }}
      className={`
        inline-flex items-center justify-center gap-2
        font-medium transition-colors duration-200
        disabled:opacity-50 disabled:pointer-events-none
        cursor-pointer
        ${variantStyles[variant]}
        ${sizeStyles[size]}
        ${fullWidth ? 'w-full' : ''}
        ${className}
      `}
      disabled={disabled || isLoading}
      onClick={onClick}
    >
      {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
      {children}
    </motion.button>
  )
}
