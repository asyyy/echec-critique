export type FontId = 'inter' | 'merriweather' | 'nunito' | 'jetbrains' | 'literata' | 'comic'

export interface FontDefinition {
  id: FontId
  label: string
  description: string
  family: string
  sample: string
}

export const FONTS: Record<FontId, FontDefinition> = {
  inter: {
    id: 'inter',
    label: 'Inter',
    description: 'Sans-serif moderne, très lisible',
    family: "'Inter', system-ui, sans-serif",
    sample: 'Ag',
  },
  merriweather: {
    id: 'merriweather',
    label: 'Merriweather',
    description: 'Serif classique, esprit parchemin',
    family: "'Merriweather', Georgia, serif",
    sample: 'Ag',
  },
  nunito: {
    id: 'nunito',
    label: 'Nunito',
    description: 'Sans-serif arrondie et accueillante',
    family: "'Nunito', system-ui, sans-serif",
    sample: 'Ag',
  },
  jetbrains: {
    id: 'jetbrains',
    label: 'JetBrains Mono',
    description: 'Monospace, idéale pour les chiffres',
    family: "'JetBrains Mono', ui-monospace, monospace",
    sample: '+3',
  },
  literata: {
    id: 'literata',
    label: 'Literata',
    description: 'Optimisée pour la lecture prolongée',
    family: "'Literata', Georgia, serif",
    sample: 'Ag',
  },
  comic: {
    id: 'comic',
    label: 'Comic Sans MS',
    description: "Parce que mon ami me l'a demandé",
    // Comic Sans MS n'existe pas sur Android : Comic Neue (libre, embarquée dans l'app) prend le relais
    family: "'Comic Sans MS', 'Comic Neue', 'Chalkboard SE', cursive",
    sample: 'Ag',
  },
}

export const FONT_LIST = Object.values(FONTS)

const STORAGE_KEY = 'echec-critique-font'

export function applyFont(fontId: FontId): void {
  const font = FONTS[fontId]
  document.documentElement.style.setProperty('--font-family', font.family)
  document.documentElement.setAttribute('data-font', fontId)
}

export function loadStoredFont(): FontId {
  try {
    const saved = localStorage.getItem(STORAGE_KEY) as FontId | null
    if (saved && FONTS[saved]) return saved
  } catch {
    /* ignore */
  }
  return 'literata'
}

export function persistFont(fontId: FontId): void {
  try {
    localStorage.setItem(STORAGE_KEY, fontId)
  } catch {
    /* ignore */
  }
}
