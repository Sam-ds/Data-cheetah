import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const base = path.join(root, 'public', 'templates')
const ids = fs
  .readdirSync(base)
  .filter((d) => fs.existsSync(path.join(base, d, 'meta.json')))
  .sort()

const q = (s) => `'${String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`

const entries = ids.map((id) => {
  const meta = JSON.parse(fs.readFileSync(path.join(base, id, 'meta.json'), 'utf8'))
  const rule = JSON.parse(fs.readFileSync(path.join(base, id, 'rule.json'), 'utf8'))
  const publisher = String(meta.publisher ?? meta.author ?? 'DataCheetah').trim()
  const version = String(meta.version ?? '1.0.0').trim()
  return {
    id,
    name: meta.name,
    category: meta.category,
    description: meta.description,
    publisher,
    version,
    renderer: rule.renderer === 'dynamic' ? 'dynamic' : 'charts',
    chartCount: rule.renderer === 'dynamic' ? 1 : rule.charts.length,
    insights: meta.insights || [],
  }
})

const body = entries
  .map(
    (e) => `  {
    id: ${q(e.id)},
    basePath: templateBase(${q(e.id)}),
    name: ${q(e.name)},
    category: ${q(e.category)},
    description: ${q(e.description)},
    publisher: ${q(e.publisher)},
    version: ${q(e.version)},
    renderer: ${q(e.renderer)},
    chartCount: ${e.chartCount},
    insights: [
${e.insights.map((i) => `      ${q(i)},`).join('\n')}
    ],
  }`,
  )
  .join(',\n')

const out = `/** Catalog of bundled Discover templates (served from /templates). */

export interface BundledTemplateRef {
  id: string
  basePath: string
  name: string
  category: string
  description: string
  publisher: string
  version: string
  renderer: 'charts' | 'dynamic'
  chartCount: number
  insights: string[]
}

function templateBase(id: string): string {
  const root = import.meta.env.BASE_URL || '/'
  const base = root.endsWith('/') ? root : \`\${root}/\`
  return \`\${base}templates/\${id}\`
}

export const BUNDLED_TEMPLATES: BundledTemplateRef[] = [
${body}
]
`

fs.writeFileSync(path.join(root, 'src/features/discover/content/templateCatalog.ts'), out)
console.log('catalog entries', entries.length)
