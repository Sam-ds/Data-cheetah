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
  duckdbStatus: 'idle' | 'loading' | 'ready' | 'error'
  setTheme: (theme: 'light' | 'dark') => void
  setDefaultRowLimit: (limit: number) => void
  setDuckdbReady: (ready: boolean) => void
  setDuckdbStatus: (status: 'idle' | 'loading' | 'ready' | 'error') => void
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
      duckdbStatus: 'idle',
      setTheme: (theme) => {
        document.documentElement.classList.toggle('dark', theme === 'dark')
        set({ theme })
      },
      setDefaultRowLimit: (limit) => set({ defaultRowLimit: limit }),
      setDuckdbReady: (ready) => set({ duckdbReady: ready }),
      setDuckdbStatus: (status) => set({ duckdbStatus: status }),
    }),
    {
      name: 'datacheetah-preferences',
      // Don't persist engine status — WASM must re-init after refresh
      partialize: (state) => ({
        theme: state.theme,
        defaultRowLimit: state.defaultRowLimit,
      }),
    },
  ),
)
