import { useWorkspaceStore } from '@/features/workspace/store/workspaceStore'

/** Site footer shown on every app mode (Home, Explore, Tools, Settings, FAQ, License). */
export function AppFooter() {
  const setAppMode = useWorkspaceStore((s) => s.setAppMode)
  const appMode = useWorkspaceStore((s) => s.appMode)

  return (
    <footer className="shrink-0 border-t border-neutral-200 bg-white px-4 py-2.5 dark:border-border/60 dark:bg-background">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-4 gap-y-1.5">
        <p className="text-[11px] text-neutral-600 dark:text-muted-foreground">
          DataCheetah · Apache 2.0 · powered by open source
        </p>
        <nav className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
          <button
            type="button"
            onClick={() => setAppMode('faq')}
            className={
              appMode === 'faq'
                ? 'font-semibold text-[#b45309] dark:text-[#f2a01f]'
                : 'font-medium text-[#b45309] underline-offset-2 hover:underline dark:text-[#f2a01f]'
            }
          >
            FAQ
          </button>
          <span className="text-neutral-300 dark:text-border" aria-hidden>
            |
          </span>
          <button
            type="button"
            onClick={() => setAppMode('license')}
            className={
              appMode === 'license'
                ? 'font-semibold text-[#b45309] dark:text-[#f2a01f]'
                : 'font-medium text-[#b45309] underline-offset-2 hover:underline dark:text-[#f2a01f]'
            }
          >
            License
          </button>
        </nav>
      </div>
    </footer>
  )
}
