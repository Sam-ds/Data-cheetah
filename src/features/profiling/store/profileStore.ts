import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { TableProfile } from '@/types/profile'

interface ProfileState {
  profile: TableProfile | null
  isLoading: boolean
  setProfile: (profile: TableProfile | null) => void
  setIsLoading: (loading: boolean) => void
}

interface PreferencesState {
  theme: 'light' | 'dark'
  defaultRowLimit: number
  duckdbReady: boolean
  setTheme: (theme: 'light' | 'dark') => void
  setDefaultRowLimit: (limit: number) => void
  setDuckdbReady: (ready: boolean) => void
}

export const useProfileStore = create<ProfileState>((set) => ({
  profile: null,
  isLoading: false,
  setProfile: (profile) => set({ profile, isLoading: false }),
  setIsLoading: (loading) => set({ isLoading: loading }),
}))

export const usePreferencesStore = create<PreferencesState>()(
  persist(
    (set) => ({
      theme: 'light',
      defaultRowLimit: 10000,
      duckdbReady: false,
      setTheme: (theme) => {
        document.documentElement.classList.toggle('dark', theme === 'dark')
        set({ theme })
      },
      setDefaultRowLimit: (limit) => set({ defaultRowLimit: limit }),
      setDuckdbReady: (ready) => set({ duckdbReady: ready }),
    }),
    { name: 'datacheetah-preferences' },
  ),
)
