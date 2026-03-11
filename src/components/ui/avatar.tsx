'use client'

import Image from 'next/image'
import { User } from 'lucide-react'

interface AvatarProps {
  src?: string | null
  alt?: string
  size?: 'sm' | 'md' | 'lg' | 'xl'
  fallback?: string
}

const sizeStyles = {
  sm: 'w-8 h-8 text-xs',
  md: 'w-10 h-10 text-sm',
  lg: 'w-14 h-14 text-base',
  xl: 'w-20 h-20 text-lg',
}

const iconSizes = {
  sm: 14,
  md: 18,
  lg: 24,
  xl: 32,
}

export function Avatar({ src, alt = '', size = 'md', fallback }: AvatarProps) {
  const initial = fallback?.charAt(0).toUpperCase()

  if (src) {
    return (
      <div
        className={`
          relative rounded-full overflow-hidden flex-shrink-0
          ring-2 ring-border-light
          ${sizeStyles[size]}
        `}
      >
        <Image
          src={src}
          alt={alt}
          fill
          className="object-cover"
        />
      </div>
    )
  }

  return (
    <div
      className={`
        flex items-center justify-center rounded-full flex-shrink-0
        bg-secondary text-accent font-semibold
        ${sizeStyles[size]}
      `}
    >
      {initial || <User size={iconSizes[size]} />}
    </div>
  )
}
