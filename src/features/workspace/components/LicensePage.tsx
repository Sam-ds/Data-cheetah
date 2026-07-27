import { OPEN_SOURCE_CREDITS } from '@/features/workspace/content/openSourceCredits'
import { InfoPageShell } from './InfoPageShell'

const MIT_TEXT = `MIT License

Copyright (c) 2026 Sampath

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.`

export function LicensePage() {
  return (
    <InfoPageShell
      title="License"
      subtitle="DataCheetah is MIT-licensed. It is powered by open-source tools that keep their own licenses."
    >
      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-600 dark:text-muted-foreground">
          DataCheetah
        </h2>
        <pre className="overflow-x-auto whitespace-pre-wrap rounded-xl border border-neutral-200 bg-neutral-50 p-4 text-[11px] leading-relaxed text-neutral-800 dark:border-border/60 dark:bg-muted/20 dark:text-muted-foreground">
          {MIT_TEXT}
        </pre>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-600 dark:text-muted-foreground">
          Key open-source dependencies
        </h2>
        <p className="text-xs leading-relaxed text-neutral-700 dark:text-muted-foreground">
          Licenses for the main libraries DataCheetah relies on. Full license text lives with each
          project; this is a summary of the key ones only, not every transitive package.
        </p>
        <div className="overflow-x-auto rounded-xl border border-neutral-200 dark:border-border/60">
          <table className="w-full border-collapse text-left text-xs">
            <thead className="bg-neutral-50 text-[11px] uppercase tracking-wide text-neutral-600 dark:bg-muted/30 dark:text-muted-foreground">
              <tr>
                <th className="px-4 py-2.5 font-semibold">Project</th>
                <th className="px-4 py-2.5 font-semibold">Role</th>
                <th className="px-4 py-2.5 font-semibold">License</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200 dark:divide-border/60">
              {OPEN_SOURCE_CREDITS.map((item) => (
                <tr key={item.name}>
                  <td className="px-4 py-2.5">
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noreferrer"
                      className="font-medium text-[#b45309] underline-offset-2 hover:underline dark:text-[#f2a01f]"
                    >
                      {item.name}
                    </a>
                  </td>
                  <td className="px-4 py-2.5 text-neutral-700 dark:text-muted-foreground">
                    {item.role}
                  </td>
                  <td className="px-4 py-2.5">
                    <span className="rounded-md bg-neutral-100 px-1.5 py-0.5 font-mono text-[11px] text-neutral-800 dark:bg-muted/40 dark:text-foreground">
                      {item.license}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </InfoPageShell>
  )
}
