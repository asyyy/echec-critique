export type ThemeId =
  'crimson' | 'dragon' | 'emerald' | 'forge' | 'jungle' | 'ocean' | 'pixel' | 'terminal' | 'vitrail'

export type ThemePreviewShape =
  'square' | 'round' | 'arch' | 'leaf' | 'pixel' | 'terminal' | 'hex' | 'shield' | 'drop'

export interface ThemeDefinition {
  id: ThemeId
  label: string
  description: string
  preview: [string, string, string] // bg, accent, text
  /** Forme du logo / pastille (au-delà des seules couleurs) */
  previewShape: ThemePreviewShape
  vars: Record<string, string>
}

const DEFAULT_SHAPE_VARS: Record<string, string> = {
  '--radius-sm': '6px',
  '--radius-md': '10px',
  '--radius-lg': '14px',
  '--check-mark-radius': '50%',
  '--control-radius': '4px',
}

export const THEMES: Record<ThemeId, ThemeDefinition> = {
  crimson: {
    id: 'crimson',
    label: 'Nuit carmin',
    description: 'Bleu nuit et accent rouge — thème par défaut',
    preview: ['#1a1a2e', '#e94560', '#eaeaea'],
    previewShape: 'square',
    vars: {
      '--color-bg-primary': '#1a1a2e',
      '--color-bg-secondary': '#16213e',
      '--color-bg-card': '#0f3460',
      '--color-bg-input': '#1a1a3e',
      '--color-accent': '#e94560',
      '--color-accent-hover': '#ff6b81',
      '--color-text-primary': '#eaeaea',
      '--color-text-secondary': '#a0a0b8',
      '--color-text-muted': '#9d9db0',
      '--color-border': '#2a2a4a',
      '--color-border-hover': '#3a3a5a',
      '--color-success': '#4ecca3',
      '--color-warning': '#f0a500',
      '--color-danger': '#e94560',
      '--color-tab-active': '#e94560',
      '--color-tab-inactive': '#16213e',
    },
  },
  dragon: {
    id: 'dragon',
    label: 'Sang de dragon',
    description: 'Rouge sang rehaussé d’or — écailles, braise et trésor',
    preview: ['#1c0b0d', '#e5383b', '#e8b64c'],
    previewShape: 'drop',
    vars: {
      '--color-bg-primary': '#1c0b0d',
      '--color-bg-secondary': '#2e0f13',
      '--color-bg-card': '#46151b',
      '--color-bg-input': '#220d10',
      '--color-accent': '#e5383b',
      '--color-accent-hover': '#ff5c5f',
      '--color-text-primary': '#f5e6e0',
      '--color-text-secondary': '#d6a9a3',
      '--color-text-muted': '#ab8581',
      '--color-border': '#5c1f28',
      '--color-border-hover': '#8a2d38',
      '--color-success': '#5dd39e',
      '--color-warning': '#e8b64c',
      /* Teinte secondaire propre au thème (voir dragon.css) */
      '--color-gold': '#e8b64c',
      '--color-danger': '#ff6b6b',
      '--color-tab-active': '#e5383b',
      '--color-tab-inactive': '#2a1013',
    },
  },
  emerald: {
    id: 'emerald',
    label: 'Sanctuaire vert',
    description: 'Forêt sombre et or antique',
    preview: ['#0f1f17', '#d4a017', '#e8f0eb'],
    previewShape: 'shield',
    vars: {
      '--color-bg-primary': '#0f1f17',
      '--color-bg-secondary': '#152820',
      '--color-bg-card': '#1a3528',
      '--color-bg-input': '#122218',
      '--color-accent': '#d4a017',
      '--color-accent-hover': '#e8b832',
      '--color-text-primary': '#e8f0eb',
      '--color-text-secondary': '#9cb8a8',
      '--color-text-muted': '#83a08e',
      '--color-border': '#243d30',
      '--color-border-hover': '#325242',
      '--color-success': '#5dd39e',
      '--color-warning': '#e8b832',
      '--color-danger': '#e05252',
      '--color-tab-active': '#d4a017',
      '--color-tab-inactive': '#152820',
    },
  },
  ocean: {
    id: 'ocean',
    label: 'Abysses',
    description: 'Bleu profond et corail lumineux',
    preview: ['#0a1628', '#38bdf8', '#e8f1fa'],
    previewShape: 'round',
    vars: {
      '--color-bg-primary': '#0a1628',
      '--color-bg-secondary': '#0f2240',
      '--color-bg-card': '#153058',
      '--color-bg-input': '#0c1a32',
      '--color-accent': '#38bdf8',
      '--color-accent-hover': '#7dd3fc',
      '--color-text-primary': '#e8f1fa',
      '--color-text-secondary': '#94b8d4',
      '--color-text-muted': '#809cb6',
      '--color-border': '#1e3a5f',
      '--color-border-hover': '#2a5080',
      '--color-success': '#34d399',
      '--color-warning': '#fbbf24',
      '--color-danger': '#fb7185',
      '--color-tab-active': '#38bdf8',
      '--color-tab-inactive': '#0f2240',
    },
  },
  forge: {
    id: 'forge',
    label: 'Forge ambre',
    description: 'Charbon chaud et flamme dorée',
    preview: ['#1c1410', '#f59e0b', '#f5ebe0'],
    previewShape: 'hex',
    vars: {
      '--color-bg-primary': '#1c1410',
      '--color-bg-secondary': '#2a1f18',
      '--color-bg-card': '#3d2e24',
      '--color-bg-input': '#221912',
      '--color-accent': '#f59e0b',
      '--color-accent-hover': '#fbbf24',
      '--color-text-primary': '#f5ebe0',
      '--color-text-secondary': '#c4a88a',
      '--color-text-muted': '#ad9681',
      '--color-border': '#4a3828',
      '--color-border-hover': '#5c4836',
      '--color-success': '#6ee7b7',
      '--color-warning': '#fcd34d',
      '--color-danger': '#f87171',
      '--color-tab-active': '#f59e0b',
      '--color-tab-inactive': '#2a1f18',
    },
  },
  jungle: {
    id: 'jungle',
    label: 'Jungle',
    description: 'Canopée dense — mousse, lianes et lumière filtrée',
    preview: ['#0c1a12', '#8fce4a', '#e8f5e0'],
    previewShape: 'leaf',
    vars: {
      '--color-bg-primary': '#0c1a12',
      '--color-bg-secondary': '#13241a',
      '--color-bg-card': '#1a3224',
      '--color-bg-input': '#0e1c14',
      '--color-accent': '#8fce4a',
      '--color-accent-hover': '#b4e070',
      '--color-text-primary': '#e8f5e0',
      '--color-text-secondary': '#9cbc98',
      '--color-text-muted': '#829d80',
      '--color-border': '#2a4834',
      '--color-border-hover': '#3d6648',
      '--color-success': '#6ee7a0',
      '--color-warning': '#e8c547',
      '--color-danger': '#e07060',
      '--color-tab-active': '#8fce4a',
      '--color-tab-inactive': '#13241a',
      '--radius-sm': '8px 14px 10px 12px',
      '--radius-md': '12px 20px 14px 18px',
      '--radius-lg': '16px 26px 18px 22px',
      '--check-mark-radius': '60% 40% 55% 45% / 45% 55% 40% 60%',
      '--control-radius': '8px 12px 8px 12px',
    },
  },
  vitrail: {
    id: 'vitrail',
    label: 'Vitrail',
    description: 'Cathédrale nocturne — verre coloré, plomb et lumière',
    preview: ['#0c0818', '#e8b84a', '#c9b8ff'],
    previewShape: 'arch',
    vars: {
      '--color-bg-primary': '#0c0818',
      '--color-bg-secondary': '#16102a',
      '--color-bg-card': '#1e1638',
      '--color-bg-input': '#120c22',
      '--color-accent': '#e8b84a',
      '--color-accent-hover': '#f5d078',
      '--color-text-primary': '#f2ecff',
      '--color-text-secondary': '#b8a8d8',
      '--color-text-muted': '#8d7fa8',
      '--color-border': '#3a2a58',
      '--color-border-hover': '#5a4080',
      '--color-success': '#4ecb8c',
      '--color-warning': '#e8b84a',
      '--color-danger': '#e85a7a',
      '--color-tab-active': '#e8b84a',
      '--color-tab-inactive': '#1a1230',
      '--radius-sm': '2px',
      '--radius-md': '4px',
      '--radius-lg': '8px',
      '--check-mark-radius': '2px',
      '--control-radius': '2px',
    },
  },
  terminal: {
    id: 'terminal',
    label: 'Terminal',
    description: 'CRT du donjon — phosphore vert, scanlines et monospace',
    preview: ['#020802', '#33ff66', '#33ff66'],
    previewShape: 'terminal',
    vars: {
      '--color-bg-primary': '#020802',
      '--color-bg-secondary': '#041004',
      '--color-bg-card': '#061806',
      '--color-bg-input': '#030a03',
      '--color-accent': '#33ff66',
      '--color-accent-hover': '#66ff99',
      '--color-text-primary': '#b8ffc8',
      '--color-text-secondary': '#5acc70',
      '--color-text-muted': '#39904d',
      '--color-border': '#1a5a28',
      '--color-border-hover': '#33ff66',
      '--color-success': '#33ff66',
      '--color-warning': '#c8ff33',
      '--color-danger': '#ff4466',
      '--color-tab-active': '#33ff66',
      '--color-tab-inactive': '#041004',
      '--radius-sm': '0px',
      '--radius-md': '0px',
      '--radius-lg': '0px',
      '--check-mark-radius': '0px',
      '--control-radius': '0px',
    },
  },
  pixel: {
    id: 'pixel',
    label: 'Pixel',
    description: 'Donjon 8-bit — bordures chunky et ombres dures',
    preview: ['#1a1c2c', '#e85d75', '#f4f0e8'],
    previewShape: 'pixel',
    vars: {
      '--color-bg-primary': '#1a1c2c',
      '--color-bg-secondary': '#262b44',
      '--color-bg-card': '#333a5a',
      '--color-bg-input': '#141628',
      '--color-accent': '#e85d75',
      '--color-accent-hover': '#ff7a90',
      '--color-text-primary': '#f4f0e8',
      '--color-text-secondary': '#a8b0c8',
      '--color-text-muted': '#a3a8b6',
      '--color-border': '#0d0f18',
      '--color-border-hover': '#e85d75',
      '--color-success': '#5dce8a',
      '--color-warning': '#f0c040',
      '--color-danger': '#e85d75',
      '--color-tab-active': '#e85d75',
      '--color-tab-inactive': '#262b44',
      '--radius-sm': '0px',
      '--radius-md': '0px',
      '--radius-lg': '0px',
      '--check-mark-radius': '0px',
      '--control-radius': '0px',
    },
  },
}

export const THEME_LIST = Object.values(THEMES)

const STORAGE_KEY = 'echec-critique-theme'

const LOGO_CLIP: Record<ThemePreviewShape, string> = {
  square: 'M6 6h36v36H6z',
  round: 'M24 4a20 20 0 1 1 0 40a20 20 0 1 1 0-40z',
  arch: 'M6 44V18C6 8 14 4 24 4s18 4 18 14v26H6z',
  leaf: 'M24 4C38 10 46 24 40 38C34 46 14 46 8 38C2 24 10 10 24 4z',
  pixel: 'M6 6h36v36H6z',
  terminal: 'M4 8h40v32H4z',
  hex: 'M24 4l18 10v20L24 44L6 34V14z',
  shield: 'M24 4l18 6v14c0 12-8 20-18 24C14 44 6 36 6 24V10z',
  drop: 'M24 3C24 3 41 21 41 31a17 17 0 0 1-34 0C7 21 24 3 24 3z',
}

function buildLogoSvg(theme: ThemeDefinition): string {
  const bg = theme.vars['--color-bg-primary'] ?? '#1a1a2e'
  const accent = theme.vars['--color-accent'] ?? '#e94560'
  const text = theme.vars['--color-text-primary'] ?? '#eaeaea'
  const clip = LOGO_CLIP[theme.previewShape]
  const isPixel = theme.previewShape === 'pixel'
  const isTerminal = theme.previewShape === 'terminal'
  const font = isTerminal || isPixel ? 'ui-monospace, monospace' : 'system-ui, sans-serif'
  const fontSize = isPixel ? 18 : isTerminal ? 20 : 22
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48">
  <defs><clipPath id="s"><path d="${clip}"/></clipPath></defs>
  <path d="${clip}" fill="${bg}" stroke="${accent}" stroke-width="${isPixel ? 0 : 2}"/>
  <g clip-path="url(#s)">
    <rect width="48" height="48" fill="${bg}"/>
    <text x="24" y="${isPixel ? 30 : 31}" text-anchor="middle" font-family="${font}" font-size="${fontSize}" font-weight="800" fill="${isTerminal ? accent : text}">EC</text>
  </g>
  ${theme.previewShape === 'arch' ? `<path d="M10 44V20c0-6 6-10 14-10s14 4 14 10v24" fill="none" stroke="${accent}" stroke-width="2"/>` : ''}
</svg>`
}

function updateDocumentLogo(theme: ThemeDefinition): void {
  const svg = buildLogoSvg(theme)
  const href = `data:image/svg+xml,${encodeURIComponent(svg)}`
  for (const rel of ['icon', 'apple-touch-icon', 'mask-icon']) {
    let link = document.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`)
    if (!link && rel === 'icon') {
      link = document.createElement('link')
      link.rel = 'icon'
      document.head.appendChild(link)
    }
    if (link) {
      link.href = href
      if (rel === 'mask-icon') link.setAttribute('color', theme.vars['--color-accent'] ?? '#e94560')
    }
  }
}

export function applyTheme(themeId: ThemeId): void {
  const theme = THEMES[themeId]
  const root = document.documentElement
  root.setAttribute('data-theme', themeId)
  root.setAttribute('data-logo-shape', theme.previewShape)
  for (const [key, value] of Object.entries(DEFAULT_SHAPE_VARS)) {
    root.style.setProperty(key, value)
  }
  for (const [key, value] of Object.entries(theme.vars)) {
    root.style.setProperty(key, value)
  }
  const meta = document.querySelector('meta[name="theme-color"]')
  if (meta) meta.setAttribute('content', theme.vars['--color-bg-primary'])
  updateDocumentLogo(theme)
}

export function loadStoredTheme(): ThemeId {
  try {
    const saved = localStorage.getItem(STORAGE_KEY) as ThemeId | null
    if (saved && THEMES[saved]) return saved
  } catch {
    /* ignore */
  }
  return 'crimson'
}

export function persistTheme(themeId: ThemeId): void {
  try {
    localStorage.setItem(STORAGE_KEY, themeId)
  } catch {
    /* ignore */
  }
}
