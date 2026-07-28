import type { ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils/cn'

interface ToolPaneProps {
  title: string
  description?: string
  actions?: ReactNode
  error?: string | null
  warning?: string | null
  children: ReactNode
  className?: string
}

export function ToolPane({
  title,
  description,
  actions,
  error,
  warning,
  children,
  className,
}: ToolPaneProps) {
  return (
    <div className={cn('flex h-full flex-col gap-4 p-4 sm:p-5', className)}>
      <div className="flex flex-wrap items-start justify-between gap-3 rounded-xl border bg-gradient-to-br from-muted/50 via-background to-background px-4 py-3">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold tracking-tight text-foreground">{title}</h2>
          {description && (
            <p className="mt-1 max-w-2xl text-xs leading-relaxed text-muted-foreground">
              {description}
            </p>
          )}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
      {error && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {error}
        </div>
      )}
      {warning && !error && (
        <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
          {warning}
        </div>
      )}
      <div className="min-h-0 flex-1">{children}</div>
    </div>
  )
}

interface ToolTextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string
}

export function ToolTextarea({ label, className, ...props }: ToolTextareaProps) {
  return (
    <label className="flex h-full min-h-0 flex-col gap-1.5">
      <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <textarea
        spellCheck={false}
        className={cn(
          'min-h-0 flex-1 resize-none rounded-lg border bg-background px-3 py-2.5 text-sm leading-6 tracking-normal text-foreground shadow-sm outline-none transition-shadow placeholder:text-muted-foreground/70 focus:ring-2 focus:ring-ring',
          className,
        )}
        {...props}
      />
    </label>
  )
}

export function ToolActionButton({
  children,
  ...props
}: React.ComponentProps<typeof Button>) {
  return (
    <Button size="sm" className="shadow-sm" {...props}>
      {children}
    </Button>
  )
}

export const SOFT_SIZE_LIMIT = 2 * 1024 * 1024

export function sizeWarning(...parts: string[]): string | null {
  const total = parts.reduce((sum, p) => sum + p.length, 0)
  if (total > SOFT_SIZE_LIMIT) {
    return 'Input is larger than 2MB. Processing may feel slow in the browser.'
  }
  return null
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}
