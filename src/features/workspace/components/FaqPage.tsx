import { FAQ_ITEMS, HOW_USEFUL } from '@/features/workspace/content/faqContent'
import { InfoPageShell } from './InfoPageShell'

export function FaqPage() {
  return (
    <InfoPageShell
      title="FAQ"
      subtitle="How DataCheetah works, what stays on your device, and common gotchas."
    >
      <section className="space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-600 dark:text-muted-foreground">
          How it’s useful
        </h2>
        <ul className="grid gap-3 sm:grid-cols-2">
          {HOW_USEFUL.map((item) => (
            <li
              key={item.title}
              className="rounded-xl border border-neutral-200 px-4 py-3 dark:border-border/60"
            >
              <p className="text-sm font-medium text-black dark:text-foreground">{item.title}</p>
              <p className="mt-1 text-xs leading-relaxed text-neutral-700 dark:text-muted-foreground">
                {item.body}
              </p>
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-600 dark:text-muted-foreground">
          Questions
        </h2>
        <div className="divide-y divide-neutral-200 rounded-xl border border-neutral-200 dark:divide-border/60 dark:border-border/60">
          {FAQ_ITEMS.map((item) => (
            <details key={item.q} className="group px-4 py-3">
              <summary className="cursor-pointer list-none text-sm font-medium text-black outline-none marker:content-none dark:text-foreground [&::-webkit-details-marker]:hidden">
                <span className="flex items-start justify-between gap-3">
                  {item.q}
                  <span className="shrink-0 text-neutral-400 transition group-open:rotate-45">+</span>
                </span>
              </summary>
              <p className="mt-2 text-xs leading-relaxed text-neutral-700 dark:text-muted-foreground">
                {item.a}
              </p>
            </details>
          ))}
        </div>
      </section>
    </InfoPageShell>
  )
}
