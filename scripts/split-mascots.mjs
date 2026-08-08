import sharp from 'sharp'
import { mkdirSync } from 'fs'
import { join } from 'path'

const SRC =
  'C:/Users/sampa/.cursor/projects/c-documents-opensource-datacheetah/assets/c__Users_sampa_AppData_Roaming_Cursor_User_workspaceStorage_0efea0425af5b1c3807a5eb5bd0134d0_images_image-68de8f42-e0d9-4b58-86c6-4b08e982fd34.png'
const OUT = 'src/assets/illustrations'
mkdirSync(OUT, { recursive: true })

const meta = await sharp(SRC).metadata()
const W = meta.width ?? 0
const H = meta.height ?? 0
console.log('sheet', W, H)

// Three equal columns (Generate / Visualize / Formatters)
const pad = Math.round(W * 0.01)
const gap = Math.round(W * 0.01)
const usable = W - pad * 2 - gap * 2
const cellW = Math.floor(usable / 3)
const top = Math.round(H * 0.02)
const bottomPad = Math.round(H * 0.02)
// Crop above the outer dark-blue pills if present — keep in-card art
const height = H - top - bottomPad

const crops = [
  { name: 'mascot-generate', left: pad },
  { name: 'mascot-visualize', left: pad + cellW + gap },
  { name: 'mascot-formatters', left: pad + (cellW + gap) * 2 },
]

for (const crop of crops) {
  const left = crop.left
  const width = Math.min(cellW, W - left)
  const out = join(OUT, `${crop.name}.png`)
  await sharp(SRC)
    .extract({ left, top, width, height: Math.min(height, H - top) })
    .png()
    .toFile(out)
  console.log('wrote', crop.name, width, 'x', Math.min(height, H - top))
}
