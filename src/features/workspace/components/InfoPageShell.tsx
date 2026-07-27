import type { ReactNode } from 'react'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { goHome } from '@/features/workspace/goHome'

interface InfoPageShellProps {
  title: string
  subtitle?: string
  children: ReactNode
}

export function InfoPageShell({ title, subtitle, children }: InfoPageShellProps) {
  return (
    <div className="flex h-full min-h-0 flex-col overflow-auto bg-white dark:bg-black">
      <div className="mx-auto w-full max-w-3xl px-6 py-8 pb-16">
        <Button variant="ghost" size="sm" className="mb-4 -ml-2 gap-1.5" onClick={goHome}>
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to Home
        </Button>
        <h1 className="text-2xl font-semibold tracking-tight text-black dark:text-foreground">
          {title}
        </h1>
        {subtitle && (
          <p className="mt-2 text-sm text-neutral-700 dark:text-muted-foreground">{subtitle}</p>
        )}
        <div className="mt-8 space-y-8 text-left">{children}</div>
      </div>
    </div>
  )
}
