import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import JSZip from 'jszip'

const packs = [
  'interactive-sales-studio',
  'product-growth-race',
  'product-line-race',
  'commerce-command-center',
  'market-scroll-voyage',
]
const files = ['meta.json', 'rule.json', 'sample.csv', 'visualization.js', 'README.md']

for (const id of packs) {
  const root = join(process.cwd(), 'public', 'templates', id)
  const output = join(process.cwd(), 'public', 'templates', `${id}.datacheetah-dashboard.zip`)
  const zip = new JSZip()
  for (const file of files) {
    zip.file(file, await readFile(join(root, file)))
  }
  await writeFile(output, await zip.generateAsync({ type: 'nodebuffer' }))
  console.log(`Generated ${output}`)
}
