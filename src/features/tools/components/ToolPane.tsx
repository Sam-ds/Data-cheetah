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
    <div className={cn('tool-pane flex h-full flex-col gap-4 p-4 sm:p-5', className)}>
      <div className="tool-pane-header flex flex-wrap items-start justify-between gap-3 px-4 py-3.5">
        <div className="tool-pane-header-glow" aria-hidden />
        <div className="relative min-w-0">
          <span className="page-eyebrow">Active tool</span>
          <h2 className="tool-pane-title mt-1 text-base font-semibold tracking-tight">{title}</h2>
          {description && (
            <p className="tool-pane-desc mt-1 max-w-2xl text-xs leading-relaxed">
              {description}
            </p>
          )}
        </div>
        {actions && (
          <div className="relative flex flex-wrap items-center gap-2">{actions}</div>
        )}
      </div>
      {error && (
        <div className="tool-pane-banner tool-pane-banner--error rounded-lg px-3 py-2 text-xs">
          {error}
        </div>
      )}
      {warning && !error && (
        <div className="tool-pane-banner tool-pane-banner--warn rounded-lg px-3 py-2 text-xs">
          {warning}
        </div>
      )}
      <div className="tool-pane-body min-h-0 flex-1">{children}</div>
    </div>
  )
}

export function ToolEmptyState({
  icon,
  title,
  description,
}: {
  icon: ReactNode
  title: string
  description: ReactNode
}) {
  return (
    <div className="tool-empty-state">
      <span className="tool-empty-state-icon" aria-hidden>{icon}</span>
      <p className="mt-3 text-sm font-semibold text-foreground">{title}</p>
      <div className="mt-1 max-w-md text-xs leading-relaxed text-muted-foreground">{description}</div>
    </div>
  )
}

export type ToolFieldTone = 'sky' | 'amber' | 'emerald' | 'violet' | 'rose' | 'neutral'

interface ToolTextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string
  tone?: ToolFieldTone
  containerClassName?: string
}

export function ToolTextarea({
  label,
  tone = 'neutral',
  className,
  containerClassName,
  ...props
}: ToolTextareaProps) {
  return (
    <label
      className={cn(
        'tool-field flex h-full min-h-0 flex-col gap-1.5',
        `tool-field--${tone}`,
        containerClassName,
      )}
    >
      <span className="tool-field-label text-[11px] font-medium uppercase tracking-wide">
        {label}
      </span>
      <textarea
        spellCheck={false}
        className={cn('tool-field-input min-h-0 flex-1 resize-none px-3 py-2.5 text-sm leading-6', className)}
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
