import type { ReactNode } from 'react'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { goHome } from '@/features/workspace/goHome'
import { PageStage } from './PageStage'

interface InfoPageShellProps {
  title: string
  subtitle?: string
  children: ReactNode
}

export function InfoPageShell({ title, subtitle, children }: InfoPageShellProps) {
  return (
    <PageStage enterKey={title} contentClassName="mx-auto w-full max-w-3xl px-6 py-8 pb-16">
      <Button variant="ghost" size="sm" className="mb-6 -ml-2 gap-1.5" onClick={goHome}>
        <ArrowLeft className="h-3.5 w-3.5" />
        Back
      </Button>
      <h1 className="page-title">{title}</h1>
      {subtitle && (
        <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground">{subtitle}</p>
      )}
      <div className="page-stagger mt-10 space-y-6 text-left">{children}</div>
    </PageStage>
  )
}
