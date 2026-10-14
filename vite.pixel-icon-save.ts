import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Plugin } from 'vite'

const ICONS_FILE = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  'src/components/icons/pixelIcons.ts',
)

function readBody(req: import('http').IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    req.on('data', (chunk: Buffer) => chunks.push(chunk))
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    req.on('error', reject)
  })
}

function buildIconBlock(
  name: string,
  palette: Record<string, string>,
  pixels: string[],
): string {
  const paletteLines = Object.entries(palette)
    .map(([k, v]) => `      ${k}: '${v}',`)
    .join('\n')
  const pixelLines = pixels.map((row) => `      '${row}',`).join('\n')
  return `  ${name}: {
    palette: {
${paletteLines}
    },
    pixels: [
${pixelLines}
    ],
  },
`
}

function replaceIconDef(source: string, name: string, block: string): string {
  const marker = `  ${name}: {`
  const start = source.indexOf(marker)
  if (start === -1) {
    throw new Error(`Icône « ${name} » introuvable dans pixelIcons.ts`)
  }

  let depth = 0
  let i = start + marker.length - 1
  for (; i < source.length; i++) {
    const ch = source[i]
    if (ch === '{') depth++
    else if (ch === '}') {
      depth--
      if (depth === 0) {
        let end = i + 1
        if (source[end] === ',') end++
        if (source[end] === '\n') end++
        return source.slice(0, start) + block + source.slice(end)
      }
    }
  }

  throw new Error(`Bloc « ${name} » mal formé dans pixelIcons.ts`)
}

export function pixelIconSavePlugin(): Plugin {
  return {
    name: 'pixel-icon-save',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/__api/save-pixel-icon', async (req, res, next) => {
        if (req.method !== 'POST') {
          next()
          return
        }

        try {
          const raw = await readBody(req)
          const body = JSON.parse(raw) as {
            name?: string
            palette?: Record<string, string>
            pixels?: string[]
          }

          const name = body.name?.trim()
          if (!name || !body.palette || !Array.isArray(body.pixels)) {
            res.statusCode = 400
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ ok: false, error: 'Payload invalide' }))
            return
          }

          const source = fs.readFileSync(ICONS_FILE, 'utf8')
          const block = buildIconBlock(name, body.palette, body.pixels)
          const nextSource = replaceIconDef(source, name, block)
          fs.writeFileSync(ICONS_FILE, nextSource, 'utf8')

          res.statusCode = 200
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ ok: true, name }))
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Erreur inconnue'
          res.statusCode = 500
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ ok: false, error: message }))
        }
      })
    },
  }
}
