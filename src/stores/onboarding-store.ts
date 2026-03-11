import { create } from 'zustand'
import type { Goal, PracticeLevel, PreferredTime } from '@/types/database'

interface OnboardingState {
  step: number
  // Step 1
  firstName: string
  birthDate: string
  city: string
  avatarFile: File | null
  // Step 2
  practiceLevel: PracticeLevel | null
  goals: Goal[]
  limitations: string
  // Step 3
  weeklyRhythm: number
  preferredDays: string[]
  preferredTime: PreferredTime | null

  setStep: (step: number) => void
  setFirstName: (name: string) => void
  setBirthDate: (date: string) => void
  setCity: (city: string) => void
  setAvatarFile: (file: File | null) => void
  setPracticeLevel: (level: PracticeLevel) => void
  toggleGoal: (goal: Goal) => void
  setLimitations: (limitations: string) => void
  setWeeklyRhythm: (rhythm: number) => void
  togglePreferredDay: (day: string) => void
  setPreferredTime: (time: PreferredTime) => void
  reset: () => void
}

const initialState = {
  step: 1,
  firstName: '',
  birthDate: '',
  city: '',
  avatarFile: null,
  practiceLevel: null,
  goals: [] as Goal[],
  limitations: '',
  weeklyRhythm: 3,
  preferredDays: [] as string[],
  preferredTime: null as PreferredTime | null,
}

export const useOnboardingStore = create<OnboardingState>((set) => ({
  ...initialState,
  setStep: (step) => set({ step }),
  setFirstName: (firstName) => set({ firstName }),
  setBirthDate: (birthDate) => set({ birthDate }),
  setCity: (city) => set({ city }),
  setAvatarFile: (avatarFile) => set({ avatarFile }),
  setPracticeLevel: (practiceLevel) => set({ practiceLevel }),
  toggleGoal: (goal) =>
    set((state) => ({
      goals: state.goals.includes(goal)
        ? state.goals.filter((g) => g !== goal)
        : [...state.goals, goal],
    })),
  setLimitations: (limitations) => set({ limitations }),
  setWeeklyRhythm: (weeklyRhythm) => set({ weeklyRhythm }),
  togglePreferredDay: (day) =>
    set((state) => ({
      preferredDays: state.preferredDays.includes(day)
        ? state.preferredDays.filter((d) => d !== day)
        : [...state.preferredDays, day],
    })),
  setPreferredTime: (preferredTime) => set({ preferredTime }),
  reset: () => set(initialState),
}))
