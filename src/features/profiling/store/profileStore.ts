import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { TableProfile } from '@/types/profile'
import type { DuckDbMemoryLimit } from '@/types/preferences'
import type { AskProviderId } from '@/types/askSettings'
import { DEFAULT_PREFERENCES } from '@/types/preferences'
import { coerceAskProvider, defaultRemoteModelFor } from '@/types/askSettings'

interface ProfileState {
  profile: TableProfile | null
  isLoading: boolean
  setProfile: (profile: TableProfile | null) => void
  setIsLoading: (loading: boolean) => void
}

interface PreferencesState {
  theme: 'light' | 'dark'
  defaultRowLimit: number
  duckdbMemoryLimit: DuckDbMemoryLimit
  askProvider: AskProviderId
  askRemoteModelId: string
  openrouterApiKey: string
  duckdbReady: boolean
  duckdbStatus: 'idle' | 'loading' | 'ready' | 'error'
  setTheme: (theme: 'light' | 'dark') => void
  setDefaultRowLimit: (limit: number) => void
  setDuckdbMemoryLimit: (limit: DuckDbMemoryLimit) => void
  setAskProvider: (provider: AskProviderId) => void
  setAskRemoteModelId: (id: string) => void
  setOpenrouterApiKey: (key: string) => void
  setDuckdbReady: (ready: boolean) => void
  setDuckdbStatus: (status: 'idle' | 'loading' | 'ready' | 'error') => void
  hydrateFromPreferences: (p: {
    theme?: 'light' | 'dark'
    defaultRowLimit?: number
    duckdbMemoryLimit?: DuckDbMemoryLimit
    askProvider?: AskProviderId | string
    askRemoteModelId?: string
    openrouterApiKey?: string
  }) => void
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
      theme: DEFAULT_PREFERENCES.theme,
      defaultRowLimit: DEFAULT_PREFERENCES.defaultRowLimit,
      duckdbMemoryLimit: DEFAULT_PREFERENCES.duckdbMemoryLimit,
      askProvider: DEFAULT_PREFERENCES.askProvider,
      askRemoteModelId: DEFAULT_PREFERENCES.askRemoteModelId,
      openrouterApiKey: DEFAULT_PREFERENCES.openrouterApiKey,
      duckdbReady: false,
      duckdbStatus: 'idle',
      setTheme: (theme) => {
        document.documentElement.classList.toggle('dark', theme === 'dark')
        set({ theme })
      },
      setDefaultRowLimit: (limit) => set({ defaultRowLimit: limit }),
      setDuckdbMemoryLimit: (limit) => set({ duckdbMemoryLimit: limit }),
      setAskProvider: (provider) =>
        set((s) => ({
          askProvider: provider,
          askRemoteModelId:
            provider === 'local' ? s.askRemoteModelId : defaultRemoteModelFor(provider),
        })),
      setAskRemoteModelId: (id) => set({ askRemoteModelId: id }),
      setOpenrouterApiKey: (key) => set({ openrouterApiKey: key }),
      setDuckdbReady: (ready) => set({ duckdbReady: ready }),
      setDuckdbStatus: (status) => set({ duckdbStatus: status }),
      hydrateFromPreferences: (p) =>
        set((s) => {
          const nextProvider =
            p.askProvider != null ? coerceAskProvider(p.askProvider) : coerceAskProvider(s.askProvider)
          return {
            theme: p.theme ?? s.theme,
            defaultRowLimit: p.defaultRowLimit ?? s.defaultRowLimit,
            duckdbMemoryLimit: p.duckdbMemoryLimit ?? s.duckdbMemoryLimit,
            askProvider: nextProvider,
            askRemoteModelId: p.askRemoteModelId ?? s.askRemoteModelId,
            openrouterApiKey: p.openrouterApiKey ?? s.openrouterApiKey,
          }
        }),
    }),
    {
      name: 'datacheetah-preferences',
      partialize: (state) => ({
        theme: state.theme,
        defaultRowLimit: state.defaultRowLimit,
        duckdbMemoryLimit: state.duckdbMemoryLimit,
        askProvider: state.askProvider,
        askRemoteModelId: state.askRemoteModelId,
        openrouterApiKey: state.openrouterApiKey,
      }),
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<PreferencesState>
        return {
          ...current,
          ...p,
          askProvider: coerceAskProvider(p.askProvider ?? current.askProvider),
          openrouterApiKey: p.openrouterApiKey ?? current.openrouterApiKey ?? '',
        }
      },
    },
  ),
)
