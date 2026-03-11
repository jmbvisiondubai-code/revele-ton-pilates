'use client'

import { motion } from 'framer-motion'
import { Flame } from 'lucide-react'

interface StreakBadgeProps {
  count: number
  size?: 'sm' | 'md' | 'lg'
}

const sizeConfig = {
  sm: { container: 'gap-1 text-sm', icon: 14 },
  md: { container: 'gap-1.5 text-base', icon: 18 },
  lg: { container: 'gap-2 text-xl', icon: 24 },
}

export function StreakBadge({ count, size = 'md' }: StreakBadgeProps) {
  const config = sizeConfig[size]

  return (
    <div className={`inline-flex items-center ${config.container}`}>
      <motion.div
        animate={{
          scale: [1, 1.15, 1],
        }}
        transition={{
          duration: 1.5,
          repeat: Infinity,
          repeatType: 'loop',
        }}
      >
        <Flame
          size={config.icon}
          className="text-alert fill-alert"
        />
      </motion.div>
      <span className="font-bold text-text">{count}</span>
      <span className="text-text-secondary font-normal">
        {count === 1 ? 'jour' : 'jours'}
      </span>
    </div>
  )
}
