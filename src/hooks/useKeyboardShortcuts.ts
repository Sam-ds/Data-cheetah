import { useEffect } from 'react'
import { useSqlEditor } from '@/features/sql/hooks/useSqlEditor'

export function useKeyboardShortcuts() {
  const { runQuery, formatSql } = useSqlEditor()

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault()
        runQuery()
      }
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'F') {
        e.preventDefault()
        formatSql()
      }
    }

    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [runQuery, formatSql])
}
