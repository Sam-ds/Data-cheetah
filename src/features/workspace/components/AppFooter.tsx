import { useWorkspaceStore } from '@/features/workspace/store/workspaceStore'
import { cn } from '@/lib/utils/cn'

/** Site footer shown on every app mode (Home, Explore, Tools, Settings, FAQ, License). */
export function AppFooter() {
  const setAppMode = useWorkspaceStore((s) => s.setAppMode)
  const appMode = useWorkspaceStore((s) => s.appMode)

  return (
    <footer className="app-footer shrink-0">
      <div className="app-footer-inner">
        <button
          type="button"
          className="app-footer-brand"
          onClick={() => setAppMode('home')}
          aria-label="DataCheetah home"
        >
          <span className="app-footer-name" aria-hidden>
            <span className="app-footer-data">data</span>
            <span className="app-footer-cheetah">cheetah</span>
          </span>
        </button>
        <nav className="app-footer-nav" aria-label="Site">
          <button
            type="button"
            onClick={() => setAppMode('template-design')}
            className={cn('app-footer-link', appMode === 'template-design' && 'app-footer-link--active')}
          >
            For developers
          </button>
          <button
            type="button"
            onClick={() => setAppMode('faq')}
            className={cn('app-footer-link', appMode === 'faq' && 'app-footer-link--active')}
          >
            FAQ
          </button>
          <button
            type="button"
            onClick={() => setAppMode('license')}
            className={cn('app-footer-link', appMode === 'license' && 'app-footer-link--active')}
          >
            License
          </button>
        </nav>
      </div>
    </footer>
  )
}
