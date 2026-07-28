import { useToolsStore } from '@/features/tools/store/toolsStore'
import { useWorkspaceStore } from '@/features/workspace/store/workspaceStore'
import { useAskStore } from '@/features/ask'

/** Return to the home hub. Keeps explore datasets and the loaded LLM for this browser session. */
export function goHome() {
  useToolsStore.getState().close()
  // Clear Insights/Ask UI noise only — do not unload the model or lock the vault.
  useAskStore.getState().clearInsightUi()
  useWorkspaceStore.getState().setAppMode('home')
}
