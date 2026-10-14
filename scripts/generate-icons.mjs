#!/usr/bin/env node
/**
 * Génère les icônes PWA + Android à partir du logo pixel art (`logo` dans pixelIcons.ts,
 * modifiable dans l'atelier d'icônes). Écrit aussi resources/logo.png (64×64, fond transparent).
 * Usage: npm run icons (Node ≥ 23.6 : import direct du fichier .ts)
 */
import sharp from 'sharp'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { PIXEL_ICONS } from '../src/components/icons/pixelIcons.ts'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const bg = { r: 0x19, g: 0x19, b: 0x19, alpha: 1 }

/** Grille d'une icône pixel → PNG RGBA à sa taille native */
function pixelPng(name) {
  const { pixels, palette } = PIXEL_ICONS[name]
  const w = pixels[0].length
  const h = pixels.length
  const data = Buffer.alloc(w * h * 4)
  pixels.forEach((row, y) => {
    ;[...row].forEach((cell, x) => {
      if (cell === '.') return
      const hex = palette[cell].replace('#', '')
      const i = (y * w + x) * 4
      data[i] = parseInt(hex.slice(0, 2), 16)
      data[i + 1] = parseInt(hex.slice(2, 4), 16)
      data[i + 2] = parseInt(hex.slice(4, 6), 16)
      data[i + 3] = 255
    })
  })
  return sharp(data, { raw: { width: w, height: h, channels: 4 } }).png().toBuffer()
}

const logoSize = PIXEL_ICONS.logo.pixels.length
const src = await pixelPng('logo')
const titleSrc = await pixelPng('logoTitle')
const titleWidth = PIXEL_ICONS.logoTitle.pixels[0].length
const titleHeight = PIXEL_ICONS.logoTitle.pixels.length
fs.mkdirSync(path.join(root, 'resources'), { recursive: true })
fs.writeFileSync(path.join(root, 'resources/logo.png'), src)
// Logo + titre agrandi ×8 (pixels nets) sur fond sombre : README, aperçu des liens
await sharp(titleSrc)
  .resize(titleWidth * 8, titleHeight * 8, { kernel: 'nearest' })
  .flatten({ background: bg })
  .png()
  .toFile(path.join(root, 'resources/logo-title.png'))

/** Agrandissement au plus proche voisin (pixels nets), lissage seulement en réduction */
function resized(size, fit = 'contain') {
  return sharp(src).resize(size, size, {
    fit,
    background: { r: 0, g: 0, b: 0, alpha: 0 },
    kernel: size >= logoSize ? 'nearest' : 'lanczos3',
  })
}

async function square(size, out, { pad = 0, fit = 'contain' } = {}) {
  const inner = Math.max(1, Math.round(size * (1 - pad * 2)))
  const img = await resized(inner, fit).png().toBuffer()
  await sharp({
    create: { width: size, height: size, channels: 4, background: bg },
  })
    .composite([{ input: img, gravity: 'centre' }])
    .png()
    .toFile(out)
}

await square(180, path.join(root, 'public/apple-touch-icon.png'))
await square(192, path.join(root, 'public/pwa-192x192.png'))
await square(512, path.join(root, 'public/pwa-512x512.png'))
// Favicons sur fond sombre : le logo a des bords transparents
await square(32, path.join(root, 'public/favicon.ico'))
await square(64, path.join(root, 'public/favicon.png'))

const launcher = {
  'mipmap-mdpi': 48,
  'mipmap-hdpi': 72,
  'mipmap-xhdpi': 96,
  'mipmap-xxhdpi': 144,
  'mipmap-xxxhdpi': 192,
}
const foreground = {
  'mipmap-mdpi': 108,
  'mipmap-hdpi': 162,
  'mipmap-xhdpi': 216,
  'mipmap-xxhdpi': 324,
  'mipmap-xxxhdpi': 432,
}

for (const [folder, size] of Object.entries(launcher)) {
  const dir = path.join(root, 'android/app/src/main/res', folder)
  // cover = remplit l’icône (meilleur rendu launcher, texte un peu rogné ok)
  await square(size, path.join(dir, 'ic_launcher.png'), { fit: 'cover' })
  await square(size, path.join(dir, 'ic_launcher_round.png'), { fit: 'cover' })
}
for (const [folder, size] of Object.entries(foreground)) {
  const dir = path.join(root, 'android/app/src/main/res', folder)
  await square(size, path.join(dir, 'ic_launcher_foreground.png'), { pad: 0.08, fit: 'cover' })
}

const splashSizes = [
  ['drawable/splash.png', 480],
  ['drawable-port-mdpi/splash.png', 320],
  ['drawable-port-hdpi/splash.png', 480],
  ['drawable-port-xhdpi/splash.png', 720],
  ['drawable-port-xxhdpi/splash.png', 960],
  ['drawable-port-xxxhdpi/splash.png', 1280],
  ['drawable-land-mdpi/splash.png', 480],
  ['drawable-land-hdpi/splash.png', 800],
  ['drawable-land-xhdpi/splash.png', 1280],
  ['drawable-land-xxhdpi/splash.png', 1600],
  ['drawable-land-xxxhdpi/splash.png', 1920],
]
const splashDir = path.join(root, 'android/app/src/main/res')
// Écran de démarrage : logo + titre, agrandi d'un facteur entier (pixels nets) à ~60 % de la largeur
for (const [rel, w] of splashSizes) {
  const h = Math.max(w, Math.round(w * 1.2))
  const scale = Math.max(1, Math.floor(Math.min(w * 0.6 / titleWidth, h * 0.55 / titleHeight)))
  const logoBuf = await sharp(titleSrc)
    .resize(titleWidth * scale, titleHeight * scale, { kernel: 'nearest' })
    .png()
    .toBuffer()
  await sharp({
    create: { width: w, height: h, channels: 4, background: bg },
  })
    .composite([{ input: logoBuf, gravity: 'centre' }])
    .png()
    .toFile(path.join(splashDir, rel))
}

fs.writeFileSync(
  path.join(root, 'android/app/src/main/res/values/ic_launcher_background.xml'),
  `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <color name="ic_launcher_background">#191919</color>
</resources>
`,
)

console.log('Icônes générées depuis le logo pixel art (pixelIcons.ts → logo)')
