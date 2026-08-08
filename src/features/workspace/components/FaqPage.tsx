import { FAQ_ITEMS } from '@/features/workspace/content/faqContent'
import { InfoPageShell } from './InfoPageShell'

export function FaqPage() {
  return (
    <InfoPageShell
      title="FAQ"
      subtitle="How DataCheetah works, what stays on your device, and common gotchas."
    >
      <section className="page-panel space-y-4 p-5 sm:p-6">
        <h2 className="page-eyebrow">
          Questions
        </h2>
        <div className="space-y-2">
          {FAQ_ITEMS.map((item) => (
            <details key={item.q} className="faq-item group">
              <summary className="cursor-pointer list-none text-sm font-medium text-foreground outline-none marker:content-none [&::-webkit-details-marker]:hidden">
                <span className="flex items-start justify-between gap-3">
                  {item.q}
                  <span className="shrink-0 font-mono text-muted-foreground transition group-open:rotate-45">
                    +
                  </span>
                </span>
              </summary>
              <p className="mt-3 border-t border-border/60 pt-3 text-sm leading-relaxed text-muted-foreground">{item.a}</p>
            </details>
          ))}
        </div>
      </section>
    </InfoPageShell>
  )
}
