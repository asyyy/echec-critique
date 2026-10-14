import { computed, ref, watch } from 'vue'
import { defineStore } from 'pinia'

export type SpellLevel = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9

export interface Spell {
  id: string
  name: string
  level: SpellLevel
  school: string
  prepared: boolean
  notes: string
  diceCount: number
  diceFaces: number
  flatBonus: number
  /** Si true, « Lancer » consomme un emplacement du niveau du sort (sauf cantrip) */
  consumesSlot: boolean
  /** Lien externe (AideDD, etc.) pour le détail — aucun texte de règles stocké */
  referenceUrl?: string
  /** Sort à concentration : le lancer démarre la concentration */
  concentration: boolean
  /** Durée en tours de combat (0 = non suivie) */
  durationRounds: number
}

export interface SpellSlotBag {
  max: number
  used: number
}

export interface SpellResource {
  id: string
  label: string
  current: number
  max: number
}

export interface SpellRollResult {
  id: string
  timestamp: number
  spellId: string
  spellName: string
  dice: number[]
  faces: number
  flatBonus: number
  total: number
  slotUsed: boolean
}

export interface SpellsSnapshot {
  spells: Spell[]
  slots: Record<string, SpellSlotBag>
  concentrationSpellId: string | null
  /** Tours restants de la concentration en cours (null = pas de décompte) */
  concentrationRoundsLeft?: number | null
  resources: SpellResource[]
}

const STORAGE_KEY = 'echec-critique-spells'
const SLOT_LEVELS = [1, 2, 3, 4, 5, 6, 7, 8, 9] as const

function newId(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
}

export function createEmptySpell(partial?: Partial<Spell>): Spell {
  const id = typeof partial?.id === 'string' && partial.id ? partial.id : newId('spl')
  return {
    name: '',
    level: 1,
    school: '',
    prepared: true,
    notes: '',
    diceCount: 0,
    diceFaces: 8,
    flatBonus: 0,
    consumesSlot: true,
    referenceUrl: undefined,
    concentration: false,
    durationRounds: 0,
    ...partial,
    id,
  }
}

function defaultSlots(): Record<string, SpellSlotBag> {
  const out: Record<string, SpellSlotBag> = {}
  for (const lvl of SLOT_LEVELS) {
    out[String(lvl)] = { max: 0, used: 0 }
  }
  return out
}

function normalizeSlots(
  raw?: Partial<Record<string, Partial<SpellSlotBag>>>,
): Record<string, SpellSlotBag> {
  const slots = defaultSlots()
  if (!raw) return slots
  for (const lvl of SLOT_LEVELS) {
    const key = String(lvl)
    const row = raw[key]
    if (!row) continue
    const max = Math.max(0, Math.min(20, Math.round(Number(row.max) || 0)))
    const used = Math.max(0, Math.min(max, Math.round(Number(row.used) || 0)))
    slots[key] = { max, used }
  }
  return slots
}

function normalizeSpell(raw: Partial<Spell>): Spell {
  const level = Math.max(0, Math.min(9, Math.round(Number(raw.level) || 0))) as SpellLevel
  return createEmptySpell({
    ...raw,
    id: typeof raw.id === 'string' ? raw.id : newId('spl'),
    name: typeof raw.name === 'string' ? raw.name : '',
    level,
    school: typeof raw.school === 'string' ? raw.school : '',
    prepared: Boolean(raw.prepared),
    notes: typeof raw.notes === 'string' ? raw.notes : '',
    diceCount: Math.max(0, Math.min(40, Math.round(Number(raw.diceCount) || 0))),
    diceFaces: Math.max(2, Math.round(Number(raw.diceFaces) || 8)),
    flatBonus: Math.round(Number(raw.flatBonus) || 0),
    consumesSlot: raw.consumesSlot === false ? false : level > 0,
    referenceUrl: typeof raw.referenceUrl === 'string' ? raw.referenceUrl : undefined,
    concentration: Boolean(raw.concentration),
    durationRounds: clampRounds(raw.durationRounds),
  })
}

const MAX_ROUNDS = 9999

function clampRounds(value: unknown): number {
  return Math.max(0, Math.min(MAX_ROUNDS, Math.round(Number(value) || 0)))
}

function normalizeRoundsLeft(value: unknown, concentrationSpellId: string | null): number | null {
  if (!concentrationSpellId || value == null) return null
  const rounds = clampRounds(value)
  return rounds > 0 ? rounds : null
}

/** DD du jet de sauvegarde de Constitution pour maintenir la concentration (plafonné à 30) */
export function concentrationSaveDc(damage: number): number {
  return Math.min(30, Math.max(10, Math.floor(Math.max(0, damage) / 2)))
}

function normalizeResource(raw: Partial<SpellResource>): SpellResource {
  const max = Math.max(0, Math.min(99, Math.round(Number(raw.max) || 0)))
  return {
    id: typeof raw.id === 'string' ? raw.id : newId('res'),
    label: typeof raw.label === 'string' ? raw.label : '',
    max,
    current: Math.max(0, Math.min(max, Math.round(Number(raw.current) || 0))),
  }
}

function loadState(): SpellsSnapshot {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) {
      return { spells: [], slots: defaultSlots(), concentrationSpellId: null, resources: [] }
    }
    const parsed = JSON.parse(raw) as Partial<SpellsSnapshot>
    const spells = Array.isArray(parsed.spells) ? parsed.spells.map(normalizeSpell) : []
    const concentrationSpellId =
      typeof parsed.concentrationSpellId === 'string' &&
      spells.some((s) => s.id === parsed.concentrationSpellId)
        ? parsed.concentrationSpellId
        : null
    return {
      spells,
      slots: normalizeSlots(parsed.slots),
      concentrationSpellId,
      concentrationRoundsLeft: normalizeRoundsLeft(
        parsed.concentrationRoundsLeft,
        concentrationSpellId,
      ),
      resources: Array.isArray(parsed.resources) ? parsed.resources.map(normalizeResource) : [],
    }
  } catch {
    return { spells: [], slots: defaultSlots(), concentrationSpellId: null, resources: [] }
  }
}

function persistState(state: SpellsSnapshot) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    /* ignore */
  }
}

function rollDice(faces: number, count: number): number[] {
  const out: number[] = []
  for (let i = 0; i < count; i++) out.push(Math.floor(Math.random() * faces) + 1)
  return out
}

export const useSpellsStore = defineStore('spells', () => {
  const saved = loadState()
  const spells = ref<Spell[]>(saved.spells)
  const slots = ref<Record<string, SpellSlotBag>>(saved.slots)
  const concentrationSpellId = ref<string | null>(saved.concentrationSpellId)
  const concentrationRoundsLeft = ref<number | null>(saved.concentrationRoundsLeft ?? null)
  const resources = ref<SpellResource[]>(saved.resources)
  const lastRoll = ref<SpellRollResult | null>(null)

  watch(
    [spells, slots, concentrationSpellId, concentrationRoundsLeft, resources],
    () => {
      persistState({
        spells: spells.value,
        slots: slots.value,
        concentrationSpellId: concentrationSpellId.value,
        concentrationRoundsLeft: concentrationRoundsLeft.value,
        resources: resources.value,
      })
    },
    { deep: true },
  )

  const concentrationSpell = computed(
    () => spells.value.find((s) => s.id === concentrationSpellId.value) ?? null,
  )

  const preparedSpells = computed(() =>
    spells.value
      .filter((s) => s.prepared)
      .sort((a, b) => a.level - b.level || a.name.localeCompare(b.name)),
  )

  const otherSpells = computed(() =>
    spells.value
      .filter((s) => !s.prepared)
      .sort((a, b) => a.level - b.level || a.name.localeCompare(b.name)),
  )

  const activeSlotLevels = computed(() =>
    SLOT_LEVELS.filter((lvl) => (slots.value[String(lvl)]?.max ?? 0) > 0),
  )

  function remaining(level: number): number {
    const row = slots.value[String(level)]
    if (!row) return 0
    return Math.max(0, row.max - row.used)
  }

  function setSlotMax(level: number, max: number) {
    const key = String(level)
    const row = slots.value[key] ?? { max: 0, used: 0 }
    const nextMax = Math.max(0, Math.min(20, Math.round(max)))
    slots.value = {
      ...slots.value,
      [key]: { max: nextMax, used: Math.min(row.used, nextMax) },
    }
  }

  function useSlot(level: number): boolean {
    if (level < 1 || level > 9) return false
    const key = String(level)
    const row = slots.value[key]
    if (!row || row.used >= row.max) return false
    slots.value = { ...slots.value, [key]: { ...row, used: row.used + 1 } }
    return true
  }

  function recoverSlot(level: number) {
    if (level < 1 || level > 9) return
    const key = String(level)
    const row = slots.value[key]
    if (!row || row.used <= 0) return
    slots.value = { ...slots.value, [key]: { ...row, used: row.used - 1 } }
  }

  function longRest() {
    const next = { ...slots.value }
    for (const lvl of SLOT_LEVELS) {
      const key = String(lvl)
      const row = next[key]
      if (row) next[key] = { ...row, used: 0 }
    }
    slots.value = next
    resources.value = resources.value.map((r) => ({ ...r, current: r.max }))
    breakConcentration()
  }

  function addSpell(partial?: Partial<Spell>) {
    const spell = createEmptySpell(partial)
    spells.value = [...spells.value, spell]
    return spell
  }

  function updateSpell(id: string, patch: Partial<Spell>) {
    spells.value = spells.value.map((s) =>
      s.id === id ? normalizeSpell({ ...s, ...patch, id: s.id }) : s,
    )
  }

  function removeSpell(id: string) {
    spells.value = spells.value.filter((s) => s.id !== id)
    if (concentrationSpellId.value === id) breakConcentration()
  }

  function setConcentration(spellId: string | null) {
    const spell = spellId ? spells.value.find((s) => s.id === spellId) : null
    if (!spell) {
      breakConcentration()
      return
    }
    concentrationSpellId.value = spell.id
    concentrationRoundsLeft.value = spell.durationRounds > 0 ? spell.durationRounds : null
  }

  function breakConcentration() {
    concentrationSpellId.value = null
    concentrationRoundsLeft.value = null
  }

  /** Passe au tour suivant ; la concentration s'arrête quand la durée est écoulée */
  function advanceConcentrationRound() {
    if (concentrationRoundsLeft.value == null) return
    const next = concentrationRoundsLeft.value - 1
    if (next <= 0) breakConcentration()
    else concentrationRoundsLeft.value = next
  }

  function addResource(label = '') {
    resources.value = [...resources.value, { id: newId('res'), label, current: 0, max: 1 }]
  }

  function updateResource(id: string, patch: Partial<SpellResource>) {
    resources.value = resources.value.map((r) =>
      r.id === id ? normalizeResource({ ...r, ...patch, id: r.id }) : r,
    )
  }

  function removeResource(id: string) {
    resources.value = resources.value.filter((r) => r.id !== id)
  }

  /* ── Annulation d'une suppression : l'élément revient à sa place ── */

  function restoreSpell(spell: Spell, index: number) {
    if (spells.value.some((s) => s.id === spell.id)) return
    const next = [...spells.value]
    next.splice(Math.min(index, next.length), 0, spell)
    spells.value = next
  }

  function restoreResource(resource: SpellResource, index: number) {
    if (resources.value.some((r) => r.id === resource.id)) return
    const next = [...resources.value]
    next.splice(Math.min(index, next.length), 0, resource)
    resources.value = next
  }

  /** Remet une concentration rompue (si le sort existe toujours) */
  function restoreConcentration(spellId: string, roundsLeft: number | null) {
    if (!spells.value.some((s) => s.id === spellId)) return
    concentrationSpellId.value = spellId
    concentrationRoundsLeft.value = roundsLeft
  }

  function bumpResource(id: string, delta: number) {
    const r = resources.value.find((x) => x.id === id)
    if (!r) return
    updateResource(id, { current: r.current + delta })
  }

  function castSpell(spellId: string): SpellRollResult | null {
    const spell = spells.value.find((s) => s.id === spellId)
    if (!spell) return null

    let slotUsed = false
    if (spell.consumesSlot && spell.level >= 1) {
      if (remaining(spell.level) <= 0) return null
      useSlot(spell.level)
      slotUsed = true
    }

    if (spell.concentration) setConcentration(spell.id)

    const count = spell.diceCount
    const dice = count > 0 ? rollDice(spell.diceFaces, count) : []
    const diceSum = dice.reduce((a, b) => a + b, 0)
    const total = diceSum + spell.flatBonus

    const result: SpellRollResult = {
      id: newId('roll'),
      timestamp: Date.now(),
      spellId: spell.id,
      spellName: spell.name,
      dice,
      faces: spell.diceFaces,
      flatBonus: spell.flatBonus,
      total,
      slotUsed,
    }
    lastRoll.value = result
    return result
  }

  function exportSnapshot(): SpellsSnapshot {
    return {
      spells: spells.value.map((s) => ({ ...s })),
      slots: { ...slots.value },
      concentrationSpellId: concentrationSpellId.value,
      concentrationRoundsLeft: concentrationRoundsLeft.value,
      resources: resources.value.map((r) => ({ ...r })),
    }
  }

  function applySnapshot(data: Partial<SpellsSnapshot> | null | undefined) {
    if (!data) {
      clearAll()
      return
    }
    spells.value = Array.isArray(data.spells) ? data.spells.map(normalizeSpell) : []
    slots.value = normalizeSlots(data.slots)
    concentrationSpellId.value =
      typeof data.concentrationSpellId === 'string' &&
      spells.value.some((s) => s.id === data.concentrationSpellId)
        ? data.concentrationSpellId
        : null
    concentrationRoundsLeft.value = normalizeRoundsLeft(
      data.concentrationRoundsLeft,
      concentrationSpellId.value,
    )
    resources.value = Array.isArray(data.resources) ? data.resources.map(normalizeResource) : []
    lastRoll.value = null
  }

  function clearAll() {
    spells.value = []
    slots.value = defaultSlots()
    breakConcentration()
    resources.value = []
    lastRoll.value = null
  }

  return {
    spells,
    slots,
    concentrationSpellId,
    concentrationRoundsLeft,
    concentrationSpell,
    resources,
    lastRoll,
    preparedSpells,
    otherSpells,
    activeSlotLevels,
    SLOT_LEVELS,
    remaining,
    setSlotMax,
    useSlot,
    recoverSlot,
    longRest,
    addSpell,
    updateSpell,
    removeSpell,
    setConcentration,
    breakConcentration,
    advanceConcentrationRound,
    addResource,
    updateResource,
    removeResource,
    restoreSpell,
    restoreResource,
    restoreConcentration,
    bumpResource,
    castSpell,
    exportSnapshot,
    applySnapshot,
    clearAll,
  }
})
