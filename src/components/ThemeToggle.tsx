import { Moon, Sun } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { usePreferencesStore } from '@/features/profiling/store/profileStore'
import { savePreferences } from '@/services/storageService'

export function ThemeToggle() {
  const { theme, setTheme } = usePreferencesStore()

  const toggle = () => {
    const next = theme === 'light' ? 'dark' : 'light'
    setTheme(next)
    savePreferences({ theme: next }).catch(console.error)
  }

  return (
    <Button variant="ghost" size="icon" onClick={toggle} title="Toggle theme">
      {theme === 'light' ? <Moon className="h-3.5 w-3.5" /> : <Sun className="h-3.5 w-3.5" />}
    </Button>
  )
}
