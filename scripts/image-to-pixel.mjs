#!/usr/bin/env node
/**
 * Convertit une image en pixel art (grille + palette) au format pixelIcons.ts
 *
 * Usage:
 *   npm run pixelize -- chemin/image.png
 *   npm run pixelize -- image.png --size 24 --colors 8 --name personnage
 *   npm run pixelize -- image.png --size 32 --colors 6 --threshold 40 --out preview.png
 *
 * Options:
 *   --size N        Grille N×N (défaut: 24)
 *   --colors N      Nombre max de couleurs hors transparent (défaut: 8)
 *   --name ID       Nom du bloc exporté (défaut: icon)
 *   --threshold N   Alpha < N → transparent (défaut: 128)
 *   --fit MODE      contain (défaut, garde les proportions) | cover | fill
 *   --out FILE      PNG aperçu agrandi (défaut: <input>.pixel.png)
 *   --scale N       Facteur d’agrandissement du PNG aperçu (défaut: 12)
 *   --no-preview    Ne pas écrire de PNG aperçu
 */

import fs from 'node:fs'
import path from 'node:path'

const KEY_POOL = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'

function printHelp() {
  console.log(`Usage: npm run pixelize -- <image> [--size 24] [--colors 8] [--name icon]`)
}

function parseArgs(argv) {
  const args = {
    input: null,
    size: 24,
    colors: 8,
    name: 'icon',
    threshold: 128,
    fit: 'contain',
    out: null,
    scale: 12,
    preview: true,
  }

  const positional = []
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--help' || a === '-h') {
      args.help = true
    } else if (a === '--size') args.size = Number(argv[++i])
    else if (a === '--colors') args.colors = Number(argv[++i])
    else if (a === '--name') args.name = String(argv[++i])
    else if (a === '--threshold') args.threshold = Number(argv[++i])
    else if (a === '--fit') args.fit = String(argv[++i])
    else if (a === '--out') args.out = String(argv[++i])
    else if (a === '--scale') args.scale = Number(argv[++i])
    else if (a === '--no-preview') args.preview = false
    else if (a.startsWith('-')) throw new Error(`Option inconnue: ${a}`)
    else positional.push(a)
  }

  args.input = positional[0] ?? null
  return args
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n))
}

function hexOf([r, g, b]) {
  return `#${[r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')}`
}

/** Distance² RGB */
function dist2(a, b) {
  const dr = a[0] - b[0]
  const dg = a[1] - b[1]
  const db = a[2] - b[2]
  return dr * dr + dg * dg + db * db
}

/**
 * Median-cut : réduit la palette comme beaucoup de convertisseurs pixel art.
 */
function medianCut(pixels, maxColors) {
  if (pixels.length === 0) return []
  if (maxColors <= 1) {
    const avg = averageColor(pixels)
    return [avg]
  }

  const boxes = [{ pixels: pixels.slice() }]

  while (boxes.length < maxColors) {
    let best = -1
    let bestRange = -1
    for (let i = 0; i < boxes.length; i++) {
      const range = channelRange(boxes[i].pixels)
      if (range > bestRange) {
        bestRange = range
        best = i
      }
    }
    if (best < 0 || bestRange <= 0) break

    const box = boxes.splice(best, 1)[0]
    const channel = dominantChannel(box.pixels)
    box.pixels.sort((a, b) => a[channel] - b[channel])
    const mid = Math.floor(box.pixels.length / 2)
    if (mid === 0 || mid === box.pixels.length) {
      boxes.push(box)
      break
    }
    boxes.push({ pixels: box.pixels.slice(0, mid) })
    boxes.push({ pixels: box.pixels.slice(mid) })
  }

  return boxes.map((b) => averageColor(b.pixels))
}

function channelRange(pixels) {
  let rMin = 255,
    rMax = 0,
    gMin = 255,
    gMax = 0,
    bMin = 255,
    bMax = 0
  for (const [r, g, b] of pixels) {
    if (r < rMin) rMin = r
    if (r > rMax) rMax = r
    if (g < gMin) gMin = g
    if (g > gMax) gMax = g
    if (b < bMin) bMin = b
    if (b > bMax) bMax = b
  }
  return Math.max(rMax - rMin, gMax - gMin, bMax - bMin)
}

function dominantChannel(pixels) {
  let rMin = 255,
    rMax = 0,
    gMin = 255,
    gMax = 0,
    bMin = 255,
    bMax = 0
  for (const [r, g, b] of pixels) {
    if (r < rMin) rMin = r
    if (r > rMax) rMax = r
    if (g < gMin) gMin = g
    if (g > gMax) gMax = g
    if (b < bMin) bMin = b
    if (b > bMax) bMax = b
  }
  const ranges = [rMax - rMin, gMax - gMin, bMax - bMin]
  return ranges.indexOf(Math.max(...ranges))
}

function averageColor(pixels) {
  let r = 0,
    g = 0,
    b = 0
  for (const p of pixels) {
    r += p[0]
    g += p[1]
    b += p[2]
  }
  const n = pixels.length || 1
  return [Math.round(r / n), Math.round(g / n), Math.round(b / n)]
}

function nearestColor(rgb, palette) {
  let best = 0
  let bestD = Infinity
  for (let i = 0; i < palette.length; i++) {
    const d = dist2(rgb, palette[i])
    if (d < bestD) {
      bestD = d
      best = i
    }
  }
  return best
}

async function loadSharp() {
  try {
    const mod = await import('sharp')
    return mod.default
  } catch {
    console.error(
      'Le paquet « sharp » est requis.\n  npm install -D sharp\npuis relance la commande.',
    )
    process.exit(1)
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  if (args.help || !args.input) {
    printHelp()
    process.exit(args.help ? 0 : 1)
  }

  const size = clamp(Math.round(args.size), 4, 128)
  const maxColors = clamp(Math.round(args.colors), 2, KEY_POOL.length)
  const threshold = clamp(Math.round(args.threshold), 0, 255)
  const fit = ['contain', 'cover', 'fill'].includes(args.fit) ? args.fit : 'contain'
  const inputPath = path.resolve(args.input)

  if (!fs.existsSync(inputPath)) {
    console.error(`Fichier introuvable: ${inputPath}`)
    process.exit(1)
  }

  const sharp = await loadSharp()

  // 1) Recadrage sur les pixels opaques (alpha), sans forcer de noir
  const meta = await sharp(inputPath).metadata()
  const srcW = meta.width ?? 1
  const srcH = meta.height ?? 1
  const { data: src } = await sharp(inputPath)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })

  let minX = srcW
  let minY = srcH
  let maxX = -1
  let maxY = -1
  for (let y = 0; y < srcH; y++) {
    for (let x = 0; x < srcW; x++) {
      const a = src[(y * srcW + x) * 4 + 3]
      if (a < threshold) continue
      if (x < minX) minX = x
      if (y < minY) minY = y
      if (x > maxX) maxX = x
      if (y > maxY) maxY = y
    }
  }

  let pipeline = sharp(inputPath).ensureAlpha()
  if (maxX >= minX && maxY >= minY) {
    const pad = Math.max(2, Math.round(Math.max(maxX - minX, maxY - minY) * 0.02))
    const left = Math.max(0, minX - pad)
    const top = Math.max(0, minY - pad)
    const width = Math.min(srcW - left, maxX - minX + 1 + pad * 2)
    const height = Math.min(srcH - top, maxY - minY + 1 + pad * 2)
    pipeline = pipeline.extract({ left, top, width, height })
  }

  const { data } = await pipeline
    .resize(size, size, {
      fit,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
      kernel: 'lanczos3',
    })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })

  const opaque = []
  const cells = [] // null = transparent, sinon [r,g,b]

  for (let i = 0; i < size * size; i++) {
    const o = i * 4
    const r = data[o]
    const g = data[o + 1]
    const b = data[o + 2]
    const a = data[o + 3]
    if (a < threshold) {
      cells.push(null)
    } else {
      const rgb = [r, g, b]
      cells.push(rgb)
      opaque.push(rgb)
    }
  }

  // 2) Quantification median-cut
  const paletteRgb = medianCut(opaque, maxColors)

  // 3) Assignation des clés (les plus utilisées d’abord → lettres stables)
  const usage = new Map()
  const indexed = cells.map((rgb) => {
    if (!rgb) return null
    const idx = nearestColor(rgb, paletteRgb)
    usage.set(idx, (usage.get(idx) ?? 0) + 1)
    return idx
  })

  const order = [...usage.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([idx]) => idx)

  // Inclure les couleurs non utilisées pour garder la palette complète
  for (let i = 0; i < paletteRgb.length; i++) {
    if (!order.includes(i)) order.push(i)
  }

  const keyByPaletteIndex = new Map()
  const palette = {}
  order.forEach((paletteIndex, rank) => {
    const key = KEY_POOL[rank]
    keyByPaletteIndex.set(paletteIndex, key)
    palette[key] = hexOf(paletteRgb[paletteIndex])
  })

  const grid = []
  for (let y = 0; y < size; y++) {
    let row = ''
    for (let x = 0; x < size; x++) {
      const idx = indexed[y * size + x]
      row += idx === null ? '.' : keyByPaletteIndex.get(idx)
    }
    grid.push(row)
  }

  // 4) Snippet TypeScript
  const paletteLines = Object.entries(palette)
    .map(([k, v]) => `      ${k}: '${v}',`)
    .join('\n')
  const pixelLines = grid.map((row) => `      '${row}',`).join('\n')
  const snippet = `  ${args.name}: {
    palette: {
${paletteLines}
    },
    pixels: [
${pixelLines}
    ],
  },`

  console.log(snippet)
  console.log('')
  console.log(
    `→ ${size}×${size}, fit=${fit}, ${Object.keys(palette).length} couleurs, transparent si alpha < ${threshold}`,
  )

  // 5) Aperçu PNG agrandi sur damier (le transparent ne passe plus pour du blanc/noir)
  if (args.preview) {
    const outPath =
      args.out ??
      path.join(
        path.dirname(inputPath),
        `${path.basename(inputPath, path.extname(inputPath))}.pixel.png`,
      )
    const scale = clamp(Math.round(args.scale), 1, 64)
    const pw = size * scale
    const ph = size * scale
    const preview = Buffer.alloc(pw * ph * 4)
    const checkA = [0x2a, 0x2a, 0x3a]
    const checkB = [0x1a, 0x1a, 0x28]

    for (let y = 0; y < ph; y++) {
      for (let x = 0; x < pw; x++) {
        const o = (y * pw + x) * 4
        const cx = (x / scale) | 0
        const cy = (y / scale) | 0
        const idx = indexed[cy * size + cx]
        if (idx === null) {
          const cell = (((x / scale) | 0) + ((y / scale) | 0)) % 2 === 0 ? checkA : checkB
          preview[o] = cell[0]
          preview[o + 1] = cell[1]
          preview[o + 2] = cell[2]
          preview[o + 3] = 255
        } else {
          const [r, g, b] = paletteRgb[idx]
          preview[o] = r
          preview[o + 1] = g
          preview[o + 2] = b
          preview[o + 3] = 255
        }
      }
    }

    await sharp(preview, { raw: { width: pw, height: ph, channels: 4 } })
      .png()
      .toFile(outPath)

    console.log(`→ Aperçu (damier): ${outPath}`)
  }

  // Copie presse-papiers si pbcopy dispo (macOS)
  try {
    const { spawnSync } = await import('node:child_process')
    const r = spawnSync('pbcopy', [], { input: snippet, encoding: 'utf8' })
    if (r.status === 0) console.log('→ Snippet copié dans le presse-papiers')
  } catch {
    // ignore
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
})
