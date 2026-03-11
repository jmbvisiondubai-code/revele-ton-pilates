'use client'

import { useOnboardingStore } from '@/stores/onboarding-store'
import { StepIndicator } from '@/components/ui'
import { StepAbout } from '@/components/onboarding/step-about'
import { StepBody } from '@/components/onboarding/step-body'
import { StepCommitment } from '@/components/onboarding/step-commitment'
import { AnimatePresence } from 'framer-motion'

export default function OnboardingPage() {
  const step = useOnboardingStore((s) => s.step)

  return (
    <div className="min-h-dvh bg-bg flex flex-col">
      {/* Header with step indicator */}
      <div className="sticky top-0 z-10 bg-bg/80 backdrop-blur-md border-b border-border-light px-6 py-4">
        <StepIndicator totalSteps={3} currentStep={step} />
      </div>

      {/* Content */}
      <div className="flex-1 px-6 py-8 max-w-lg mx-auto w-full">
        <AnimatePresence mode="wait">
          {step === 1 && <StepAbout key="step1" />}
          {step === 2 && <StepBody key="step2" />}
          {step === 3 && <StepCommitment key="step3" />}
        </AnimatePresence>
      </div>
    </div>
  )
}
