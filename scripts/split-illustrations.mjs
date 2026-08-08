import sharp from 'sharp'
import { mkdirSync } from 'fs'
import { join } from 'path'

const SRC =
  'C:/Users/sampa/.cursor/projects/c-documents-opensource-datacheetah/assets/c__Users_sampa_AppData_Roaming_Cursor_User_workspaceStorage_0efea0425af5b1c3807a5eb5bd0134d0_images_image-3a836968-ceca-45e4-bf3e-75f16853a0cd.png'
const OUT = 'src/assets/illustrations'
mkdirSync(OUT, { recursive: true })

const meta = await sharp(SRC).metadata()
const W = meta.width
const H = meta.height

/** Manual crops tuned for the 1024×682 collage (left, top, width, height). */
const crops = [
  { name: 'hero-brand', left: 48, top: 36, width: 300, height: 250 },
  { name: 'collab-dashboard', left: 330, top: 18, width: 370, height: 265 },
  { name: 'data-sources', left: 700, top: 28, width: 300, height: 255 },
  { name: 'data-pipeline', left: 28, top: 275, width: 310, height: 210 },
  { name: 'explore-solo', left: 345, top: 275, width: 330, height: 210 },
  { name: 'inspect', left: 680, top: 268, width: 320, height: 220 },
  { name: 'servers', left: 20, top: 490, width: 270, height: 175 },
  { name: 'security', left: 295, top: 505, width: 155, height: 160 },
  { name: 'cloud-sync', left: 455, top: 500, width: 185, height: 165 },
  { name: 'team', left: 640, top: 485, width: 360, height: 185 },
]

for (const crop of crops) {
  const left = Math.max(0, crop.left)
  const top = Math.max(0, crop.top)
  const width = Math.min(crop.width, W - left)
  const height = Math.min(crop.height, H - top)
  const out = join(OUT, `${crop.name}.png`)
  await sharp(SRC).extract({ left, top, width, height }).png().toFile(out)
  console.log('wrote', crop.name, width, 'x', height)
}
