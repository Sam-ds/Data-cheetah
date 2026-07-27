import { useAskStore, resetAskLlmSession } from '@/features/ask'
import { useToolsStore } from '@/features/tools/store/toolsStore'
import { useWorkspaceStore } from '@/features/workspace/store/workspaceStore'
import { lockVault } from '@/features/settings/services/secretsVault'

/** Return to the home hub. Keeps explore datasets cached for when you come back. */
export function goHome() {
  useToolsStore.getState().close()
  useAskStore.getState().resetSession()
  void resetAskLlmSession()
  lockVault()
  useWorkspaceStore.getState().setAppMode('home')
}
