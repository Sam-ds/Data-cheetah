import sharp from 'sharp'
import { mkdirSync } from 'fs'
import { join } from 'path'

const SRC =
  'C:/Users/sampa/.cursor/projects/c-documents-opensource-datacheetah/assets/c__Users_sampa_AppData_Roaming_Cursor_User_workspaceStorage_0efea0425af5b1c3807a5eb5bd0134d0_images_f1cc3541-5aff-4621-8b0c-ebfbd48e70a1-6583ba1c-4109-453c-8505-ae446c54c798.png'
const OUT = 'src/assets/illustrations'
mkdirSync(OUT, { recursive: true })

const meta = await sharp(SRC).metadata()
const W = meta.width ?? 1024
const H = meta.height ?? 559
console.log('sheet', W, H)

const cols = 3
const cellW = Math.floor(W / cols)
const insetX = 8
const top = 4
// Keep cards; exclude bottom pills (~bottom 90px on 559)
const height = Math.min(H - top - 4, Math.floor(H * 0.78))

const names = ['mascot-generate', 'mascot-visualize', 'mascot-formatters']

for (let i = 0; i < cols; i++) {
  const left = i * cellW + insetX
  const width = Math.min(cellW - insetX * 2, W - left)
  const out = join(OUT, `${names[i]}.png`)
  console.log({ name: names[i], left, top, width, height })
  await sharp(SRC).extract({ left, top, width, height }).png().toFile(out)
  console.log('wrote', out)
}
