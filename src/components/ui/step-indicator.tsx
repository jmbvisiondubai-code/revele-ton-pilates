'use client'

import { motion } from 'framer-motion'
import { Check } from 'lucide-react'

interface StepIndicatorProps {
  totalSteps: number
  currentStep: number
}

export function StepIndicator({ totalSteps, currentStep }: StepIndicatorProps) {
  return (
    <div className="flex items-center justify-center gap-3">
      {Array.from({ length: totalSteps }, (_, i) => {
        const step = i + 1
        const isCompleted = step < currentStep
        const isCurrent = step === currentStep

        return (
          <div key={step} className="flex items-center gap-3">
            <motion.div
              initial={false}
              animate={{
                scale: isCurrent ? 1 : 0.85,
                backgroundColor: isCompleted
                  ? 'var(--color-success)'
                  : isCurrent
                  ? 'var(--color-primary)'
                  : 'var(--color-bg-elevated)',
              }}
              className={`
                w-8 h-8 rounded-full flex items-center justify-center
                text-xs font-semibold
                ${
                  isCompleted || isCurrent
                    ? 'text-white'
                    : 'text-text-muted'
                }
              `}
            >
              {isCompleted ? <Check size={14} strokeWidth={3} /> : step}
            </motion.div>
            {step < totalSteps && (
              <div className="w-8 h-0.5 bg-bg-elevated rounded-full overflow-hidden">
                <motion.div
                  initial={false}
                  animate={{
                    width: isCompleted ? '100%' : '0%',
                  }}
                  transition={{ duration: 0.3 }}
                  className="h-full bg-success rounded-full"
                />
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
