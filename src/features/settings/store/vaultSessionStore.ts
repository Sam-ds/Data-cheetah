import { create } from 'zustand'

/** Session-only: whether the encrypted secrets vault is unlocked in this tab. */
interface VaultSessionState {
  unlocked: boolean
  setUnlocked: (unlocked: boolean) => void
}

export const useVaultSessionStore = create<VaultSessionState>((set) => ({
  unlocked: false,
  setUnlocked: (unlocked) => set({ unlocked }),
}))
