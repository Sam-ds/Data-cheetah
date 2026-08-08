import { useWorkspaceStore } from '@/features/workspace/store/workspaceStore'
import { cn } from '@/lib/utils/cn'

/** Site footer shown on every app mode (Home, Explore, Tools, Settings, FAQ, License). */
export function AppFooter() {
  const setAppMode = useWorkspaceStore((s) => s.setAppMode)
  const appMode = useWorkspaceStore((s) => s.appMode)

  return (
    <footer className="shrink-0 border-t border-border bg-background/80 px-4 py-2.5 backdrop-blur-sm">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-4 gap-y-1.5">
        <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
          DataCheetah · Apache 2.0
        </p>
        <nav className="flex items-center gap-4 text-xs">
          <button
            type="button"
            onClick={() => setAppMode('faq')}
            className={cn(
              'font-medium underline-offset-2 transition hover:text-foreground hover:underline',
              appMode === 'faq' ? 'text-foreground' : 'text-muted-foreground',
            )}
          >
            FAQ
          </button>
          <button
            type="button"
            onClick={() => setAppMode('license')}
            className={cn(
              'font-medium underline-offset-2 transition hover:text-foreground hover:underline',
              appMode === 'license' ? 'text-foreground' : 'text-muted-foreground',
            )}
          >
            License
          </button>
        </nav>
      </div>
    </footer>
  )
}
