import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { DEFAULT_PREFERENCES } from '@/types/preferences'

export type AppMode = 'home' | 'explore' | 'tools' | 'settings' | 'faq' | 'license'

interface WorkspaceState {
  appMode: AppMode
  sidebarSize: number
  bottomSize: number
  rightSize: number
  sidebarCollapsed: boolean
  activeBottomTab: 'results' | 'charts'
  activeRightTab: 'explorer' | 'statistics' | 'ask'
  setAppMode: (mode: AppMode) => void
  setSidebarSize: (size: number) => void
  setBottomSize: (size: number) => void
  setRightSize: (size: number) => void
  toggleSidebar: () => void
  setActiveBottomTab: (tab: 'results' | 'charts') => void
  setActiveRightTab: (tab: 'explorer' | 'statistics' | 'ask') => void
}

export const useWorkspaceStore = create<WorkspaceState>()(
  persist(
    (set) => ({
      appMode: 'home',
      sidebarSize: DEFAULT_PREFERENCES.layout.sidebarSize,
      bottomSize: DEFAULT_PREFERENCES.layout.bottomSize,
      rightSize: DEFAULT_PREFERENCES.layout.rightSize,
      sidebarCollapsed: false,
      activeBottomTab: 'results',
      activeRightTab: 'explorer',
      setAppMode: (mode) => set({ appMode: mode }),
      setSidebarSize: (size) => set({ sidebarSize: size }),
      setBottomSize: (size) => set({ bottomSize: size }),
      setRightSize: (size) => set({ rightSize: size }),
      toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
      setActiveBottomTab: (tab) => set({ activeBottomTab: tab }),
      setActiveRightTab: (tab) => set({ activeRightTab: tab }),
    }),
    {
      name: 'datacheetah-workspace-v4',
      partialize: (s) => ({
        // appMode is not persisted — always start on Home
        sidebarCollapsed: s.sidebarCollapsed,
        activeBottomTab: s.activeBottomTab,
        activeRightTab: s.activeRightTab,
      }),
      onRehydrateStorage: () => (state) => {
        state?.setAppMode('home')
      },
    },
  ),
)
