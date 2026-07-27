import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { DEFAULT_PREFERENCES } from '@/types/preferences'

interface WorkspaceState {
  sidebarSize: number
  bottomSize: number
  rightSize: number
  sidebarCollapsed: boolean
  activeBottomTab: 'results' | 'charts'
  activeRightTab: 'explorer' | 'statistics'
  setSidebarSize: (size: number) => void
  setBottomSize: (size: number) => void
  setRightSize: (size: number) => void
  toggleSidebar: () => void
  setActiveBottomTab: (tab: 'results' | 'charts') => void
  setActiveRightTab: (tab: 'explorer' | 'statistics') => void
}

export const useWorkspaceStore = create<WorkspaceState>()(
  persist(
    (set) => ({
      sidebarSize: DEFAULT_PREFERENCES.layout.sidebarSize,
      bottomSize: DEFAULT_PREFERENCES.layout.bottomSize,
      rightSize: DEFAULT_PREFERENCES.layout.rightSize,
      sidebarCollapsed: false,
      activeBottomTab: 'results',
      activeRightTab: 'explorer',
      setSidebarSize: (size) => set({ sidebarSize: size }),
      setBottomSize: (size) => set({ bottomSize: size }),
      setRightSize: (size) => set({ rightSize: size }),
      toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
      setActiveBottomTab: (tab) => set({ activeBottomTab: tab }),
      setActiveRightTab: (tab) => set({ activeRightTab: tab }),
    }),
    { name: 'datacheetah-workspace-v2' },
  ),
)
