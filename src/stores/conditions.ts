import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { MODIFIER_LABELS, type Modifier, type ModifierType } from '@/stores/inventory'

/**
 * États temporaires (conditions 2024, sorts courants, buffs / debuffs du joueur).
 * Pas de durée : l'état reste jusqu'à ce que le joueur le retire.
 * Leurs modificateurs s'ajoutent à ceux de l'équipement (Fiche et Attaques).
 */

export type ConditionKind = 'buff' | 'debuff'
export type ConditionSource = 'sort' | 'allie' | 'ennemi' | 'autre'

export const CONDITION_SOURCES: ConditionSource[] = ['sort', 'allie', 'ennemi', 'autre']

export interface ActiveCondition {
  id: string
  /** Préréglage (libellé, rappel et effets intégrés) ; null = état créé par le joueur */
  preset: ConditionPresetId | null
  /** Nom saisi (états du joueur) */
  name: string
  kind: ConditionKind
  source: ConditionSource
  /** Niveau (Épuisement : 1 à 6) */
  level: number
  /** Modificateurs ajoutés par le joueur, en plus des effets du préréglage */
  modifiers: Modifier[]
}

interface ConditionPreset {
  group: 'condition' | 'spell'
  kind: ConditionKind
  source: ConditionSource
  /** Effets chiffrés intégrés ; le reste (avantage, désavantage…) est un rappel dans la bulle */
  effects?: (level: number) => Modifier[]
  /** Vitesse ramenée à 0 */
  speedZero?: boolean
  /** Vitesse multipliée (Hâte ×2, Lenteur ÷2) */
  speedFactor?: number
  /** Niveau réglable (1..max) */
  maxLevel?: number
}

/** Épuisement 2024 : −2 par niveau aux tests d20, −1,5 m de vitesse par niveau */
function exhaustionEffects(level: number): Modifier[] {
  const d20 = -2 * level
  return [
    { type: 'attaque', value: d20 },
    { type: 'sauvegardes', value: d20 },
    { type: 'competences', value: d20 },
    { type: 'initiative', value: d20 },
    { type: 'vitesse', value: -1.5 * level },
  ]
}

export const CONDITION_PRESETS = {
  aveugle: { group: 'condition', kind: 'debuff', source: 'ennemi' },
  charme: { group: 'condition', kind: 'debuff', source: 'ennemi' },
  assourdi: { group: 'condition', kind: 'debuff', source: 'ennemi' },
  epuisement: {
    group: 'condition',
    kind: 'debuff',
    source: 'autre',
    effects: exhaustionEffects,
    maxLevel: 6,
  },
  effraye: { group: 'condition', kind: 'debuff', source: 'ennemi' },
  agrippe: { group: 'condition', kind: 'debuff', source: 'ennemi', speedZero: true },
  neutralise: { group: 'condition', kind: 'debuff', source: 'ennemi' },
  invisible: { group: 'condition', kind: 'buff', source: 'sort' },
  paralyse: { group: 'condition', kind: 'debuff', source: 'ennemi', speedZero: true },
  petrifie: { group: 'condition', kind: 'debuff', source: 'ennemi', speedZero: true },
  empoisonne: { group: 'condition', kind: 'debuff', source: 'ennemi' },
  aTerre: { group: 'condition', kind: 'debuff', source: 'ennemi' },
  entrave: { group: 'condition', kind: 'debuff', source: 'ennemi', speedZero: true },
  etourdi: { group: 'condition', kind: 'debuff', source: 'ennemi' },
  inconscient: { group: 'condition', kind: 'debuff', source: 'ennemi', speedZero: true },
  benediction: { group: 'spell', kind: 'buff', source: 'sort' },
  fleau: { group: 'spell', kind: 'debuff', source: 'sort' },
  bouclierFoi: {
    group: 'spell',
    kind: 'buff',
    source: 'sort',
    effects: () => [{ type: 'ca', value: 2 }],
  },
  bouclier: {
    group: 'spell',
    kind: 'buff',
    source: 'sort',
    effects: () => [{ type: 'ca', value: 5 }],
  },
  hate: {
    group: 'spell',
    kind: 'buff',
    source: 'sort',
    effects: () => [{ type: 'ca', value: 2 }],
    speedFactor: 2,
  },
  lenteur: {
    group: 'spell',
    kind: 'debuff',
    source: 'sort',
    effects: () => [{ type: 'ca', value: -2 }],
    speedFactor: 0.5,
  },
} satisfies Record<string, ConditionPreset>

export type ConditionPresetId = keyof typeof CONDITION_PRESETS

export const CONDITION_PRESET_IDS = Object.keys(CONDITION_PRESETS) as ConditionPresetId[]

export function getPreset(id: ConditionPresetId | null): ConditionPreset | null {
  return id ? (CONDITION_PRESETS[id] as ConditionPreset) : null
}

export function isPresetId(id: unknown): id is ConditionPresetId {
  return typeof id === 'string' && id in CONDITION_PRESETS
}

/** Effets chiffrés d'un état : ceux du préréglage + ceux ajoutés par le joueur */
export function conditionModifiers(cond: ActiveCondition): Modifier[] {
  const preset = getPreset(cond.preset)
  return [...(preset?.effects?.(cond.level) ?? []), ...cond.modifiers]
}

export function normalizeCondition(raw: unknown): ActiveCondition | null {
  const c = raw as Partial<ActiveCondition> | null
  if (!c || typeof c !== 'object') return null
  const preset = isPresetId(c.preset) ? c.preset : null
  const name = typeof c.name === 'string' ? c.name.trim().slice(0, 40) : ''
  if (!preset && !name) return null
  const maxLevel = getPreset(preset)?.maxLevel ?? 1
  return {
    id: typeof c.id === 'string' ? c.id : newConditionId(),
    preset,
    name,
    kind: c.kind === 'buff' || c.kind === 'debuff' ? c.kind : (getPreset(preset)?.kind ?? 'debuff'),
    source: CONDITION_SOURCES.includes(c.source as ConditionSource)
      ? (c.source as ConditionSource)
      : 'autre',
    level: Math.max(1, Math.min(maxLevel, Math.round(Number(c.level) || 1))),
    modifiers: Array.isArray(c.modifiers)
      ? c.modifiers
          .filter((m) => m && typeof m.type === 'string' && m.type in MODIFIER_LABELS)
          .map((m) => ({ type: m.type, value: Number(m.value) || 0 }))
      : [],
  }
}

/** État créé par le joueur, gardé pour le remettre en un tap (« Mes états ») */
export interface SavedCondition {
  id: string
  name: string
  kind: ConditionKind
  source: ConditionSource
  modifiers: Modifier[]
}

export const SAVED_CONDITION_MAX = 30

export function normalizeSavedCondition(raw: unknown): SavedCondition | null {
  const c = normalizeCondition({ ...(raw as object), preset: null, level: 1 })
  if (!c) return null
  const id = (raw as { id?: unknown }).id
  return {
    id: typeof id === 'string' ? id : newSavedConditionId(),
    name: c.name,
    kind: c.kind,
    source: c.source,
    modifiers: c.modifiers,
  }
}

/** Liste propre : sans doublon de nom (insensible à la casse et aux accents), plafonnée */
export function normalizeSavedConditions(raw: unknown): SavedCondition[] {
  if (!Array.isArray(raw)) return []
  const seen = new Set<string>()
  const out: SavedCondition[] = []
  for (const entry of raw) {
    const clean = normalizeSavedCondition(entry)
    if (!clean || seen.has(savedNameKey(clean.name))) continue
    seen.add(savedNameKey(clean.name))
    out.push(clean)
    if (out.length >= SAVED_CONDITION_MAX) break
  }
  return out
}

function savedNameKey(name: string): string {
  return name
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .trim()
    .toLowerCase()
}

function newSavedConditionId(): string {
  return `sv-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
}

export function newConditionId(): string {
  return `st-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
}

const STORAGE_KEY = 'echec-critique-conditions'
const SAVED_STORAGE_KEY = 'echec-critique-conditions-saved'

function loadSaved(): SavedCondition[] {
  try {
    return normalizeSavedConditions(JSON.parse(localStorage.getItem(SAVED_STORAGE_KEY) ?? '[]'))
  } catch {
    return []
  }
}

function persistSaved(list: SavedCondition[]) {
  try {
    localStorage.setItem(SAVED_STORAGE_KEY, JSON.stringify(list))
  } catch {
    /* ignore */
  }
}

function loadConditions(): ActiveCondition[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed)
      ? (parsed.map(normalizeCondition).filter(Boolean) as ActiveCondition[])
      : []
  } catch {
    return []
  }
}

function persistConditions(list: ActiveCondition[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list))
  } catch {
    /* ignore */
  }
}

export const useConditionsStore = defineStore('conditions', () => {
  const conditions = ref<ActiveCondition[]>(loadConditions())
  /** États créés par le joueur, proposés en tête de liste (le plus récent d'abord) */
  const saved = ref<SavedCondition[]>(loadSaved())

  const totalModifiers = computed(() => {
    const totals: Partial<Record<ModifierType, number>> = {}
    for (const cond of conditions.value) {
      for (const mod of conditionModifiers(cond)) {
        totals[mod.type] = (totals[mod.type] ?? 0) + mod.value
      }
    }
    return totals
  })

  const speedZero = computed(() => conditions.value.some((c) => getPreset(c.preset)?.speedZero))

  const speedFactor = computed(() =>
    conditions.value.reduce((f, c) => f * (getPreset(c.preset)?.speedFactor ?? 1), 1),
  )

  function save() {
    persistConditions(conditions.value)
  }

  function add(cond: Omit<ActiveCondition, 'id'>) {
    const clean = normalizeCondition({ ...cond, id: newConditionId() })
    if (!clean) return
    conditions.value = [...conditions.value, clean]
    save()
  }

  function update(id: string, patch: Omit<ActiveCondition, 'id'>) {
    const clean = normalizeCondition({ ...patch, id })
    if (!clean) return
    conditions.value = conditions.value.map((c) => (c.id === id ? clean : c))
    save()
  }

  function remove(id: string) {
    conditions.value = conditions.value.filter((c) => c.id !== id)
    save()
  }

  /** Mémorise un état perso : même nom → mis à jour et remonté en tête */
  function remember(cond: Pick<ActiveCondition, 'name' | 'kind' | 'source' | 'modifiers'>) {
    const key = savedNameKey(cond.name)
    if (!key) return
    const existing = saved.value.find((s) => savedNameKey(s.name) === key)
    const clean = normalizeSavedCondition({ ...cond, id: existing?.id })
    if (!clean) return
    saved.value = [clean, ...saved.value.filter((s) => s.id !== clean.id)].slice(
      0,
      SAVED_CONDITION_MAX,
    )
    persistSaved(saved.value)
  }

  function forget(id: string) {
    saved.value = saved.value.filter((s) => s.id !== id)
    persistSaved(saved.value)
  }

  function replaceAll(next: ActiveCondition[] | undefined, nextSaved: SavedCondition[] = []) {
    conditions.value = (next ?? []).map(normalizeCondition).filter(Boolean) as ActiveCondition[]
    saved.value = normalizeSavedConditions(nextSaved)
    save()
    persistSaved(saved.value)
  }

  return {
    conditions,
    saved,
    totalModifiers,
    speedZero,
    speedFactor,
    add,
    update,
    remove,
    remember,
    forget,
    replaceAll,
  }
})
