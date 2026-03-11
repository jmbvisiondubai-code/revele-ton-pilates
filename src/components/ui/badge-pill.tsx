'use client'

interface BadgePillProps {
  children: React.ReactNode
  variant?: 'default' | 'success' | 'alert' | 'accent'
  size?: 'sm' | 'md'
}

const variantStyles = {
  default: 'bg-bg-elevated text-text-secondary',
  success: 'bg-success-light text-success',
  alert: 'bg-alert-light text-alert',
  accent: 'bg-primary/10 text-accent',
}

const sizeStyles = {
  sm: 'px-2.5 py-0.5 text-xs',
  md: 'px-3 py-1 text-sm',
}

export function BadgePill({
  children,
  variant = 'default',
  size = 'sm',
}: BadgePillProps) {
  return (
    <span
      className={`
        inline-flex items-center gap-1
        font-medium rounded-[var(--radius-full)]
        ${variantStyles[variant]}
        ${sizeStyles[size]}
      `}
    >
      {children}
    </span>
  )
}
