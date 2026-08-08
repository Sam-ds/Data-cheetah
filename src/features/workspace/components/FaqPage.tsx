import { FAQ_ITEMS, HOW_USEFUL } from '@/features/workspace/content/faqContent'
import { InfoPageShell } from './InfoPageShell'

export function FaqPage() {
  return (
    <InfoPageShell
      title="FAQ"
      subtitle="How DataCheetah works, what stays on your device, and common gotchas."
    >
      <section className="space-y-4">
        <h2 className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
          How it’s useful
        </h2>
        <ul className="divide-y divide-border border-y border-border">
          {HOW_USEFUL.map((item) => (
            <li key={item.title} className="py-4">
              <p className="text-sm font-semibold text-foreground">{item.title}</p>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{item.body}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-4">
        <h2 className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
          Questions
        </h2>
        <div className="divide-y divide-border border-y border-border">
          {FAQ_ITEMS.map((item) => (
            <details key={item.q} className="group py-3.5">
              <summary className="cursor-pointer list-none text-sm font-medium text-foreground outline-none marker:content-none [&::-webkit-details-marker]:hidden">
                <span className="flex items-start justify-between gap-3">
                  {item.q}
                  <span className="shrink-0 font-mono text-muted-foreground transition group-open:rotate-45">
                    +
                  </span>
                </span>
              </summary>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{item.a}</p>
            </details>
          ))}
        </div>
      </section>
    </InfoPageShell>
  )
}
