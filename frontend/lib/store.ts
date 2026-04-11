import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface User {
  id: string
  name: string
  email: string
  height_cm: number
  weight_kg: number
  age: number
  gender: string
  dietary_preferences: string[]
  allergies: string[]
  health_goal: string
  bmi: number
  bmi_category: string
  daily_calorie_target: number
  macros: { protein_g: number; carbs_g: number; fat_g: number }
  meal_split: { breakfast: number; lunch: number; dinner: number; snack: number }
  cuisine_preference: string[]
  avatar_url: string
  created_at: string
}

interface AuthStore {
  user: User | null
  accessToken: string | null
  refreshToken: string | null
  setAuth: (user: User, access: string, refresh: string) => void
  updateUser: (u: Partial<User>) => void
  logout: () => void
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      setAuth: (user, accessToken, refreshToken) => {
        localStorage.setItem('access_token', accessToken)
        localStorage.setItem('refresh_token', refreshToken)
        set({ user, accessToken, refreshToken })
      },
      updateUser: (u) => set((s) => ({ user: s.user ? { ...s.user, ...u } : s.user })),
      logout: () => {
        localStorage.removeItem('access_token')
        localStorage.removeItem('refresh_token')
        set({ user: null, accessToken: null, refreshToken: null })
      },
    }),
    { name: 'wk-auth', partialize: (s) => ({ user: s.user, accessToken: s.accessToken, refreshToken: s.refreshToken }) }
  )
)
