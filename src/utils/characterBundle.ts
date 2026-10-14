import { ABILITIES, SKILLS, type Ability, type Skill } from '@/utils/dnd'
import {
  DAMAGE_TYPES,
  createEmptyAttackConfig,
  createEmptyDamagePart,
  createEmptyWeaponDamage,
  type AttackConfig,
  type DamageType,
} from '@/utils/combatTypes'
import type { SkillRank } from '@/stores/character'
import {
  BUILTIN_CATEGORIES,
  isBuiltinCategory,
  normalizeCustomCategories,
  type CustomCategory,
  type EquipmentItem,
  type Modifier,
  type ModifierType,
} from '@/stores/inventory'
import {
  createEmptySpell,
  type Spell,
  type SpellLevel,
  type SpellResource,
  type SpellSlotBag,
  type SpellsSnapshot,
} from '@/stores/spells'
import {
  CONDITION_SOURCES,
  normalizeCondition,
  normalizeSavedConditions,
  type ActiveCondition,
  type SavedCondition,
} from '@/stores/conditions'

const PREFIX = 'EC1.'

// Index figés dans les exports : ne jamais réordonner
const CATEGORIES = BUILTIN_CATEGORIES

const MOD_TYPES: ModifierType[] = [
  'attaque',
  'degats',
  'ca',
  'force',
  'dexterite',
  'constitution',
  'intelligence',
  'sagesse',
  'charisme',
  'initiative',
  'vitesse',
  'autre',
  // Ajouts : toujours en fin de tableau (index figés dans les exports)
  'sauvegardes',
  'competences',
]

export interface CharacterSnapshot {
  name: string
  level: number
  characterClass: string
  species: string
  abilityScores: Record<Ability, number>
  savingThrowProficiency: Record<Ability, boolean>
  skillRank: Record<Skill, SkillRank>
  hpCurrent: number
  hpMax: number
  hpTemp: number
  inspiration: number
  armorClassBase: number
  speedBase: number
  initiativeBonus?: number
  deathSaveSuccesses?: number
  deathSaveFailures?: number
}

export interface CharacterBundle {
  character: CharacterSnapshot
  inventory: EquipmentItem[]
  attacks: AttackConfig[]
  spells?: SpellsSnapshot
  /** Catégories d'inventaire créées par le joueur */
  categories?: CustomCategory[]
  /** États temporaires (conditions, buffs, debuffs) */
  conditions?: ActiveCondition[]
  /** États créés par le joueur et mémorisés (« Mes états ») */
  savedConditions?: SavedCondition[]
}

/** Payload compact v1 (tableaux + omissions) */
type CompactV1 = {
  v: 1
  /** [n,l,k,s, abilities[6], savesMask, skills[[idx,rank]], hpC,hpM,hpT, insp, ac, spd, initBonus, deathOk, deathKo] */
  c: unknown[]
  i?: unknown[]
  a?: unknown[]
  /** sorts : [slots[[max,used]×9], concIdx|null, resources, spells, concRoundsLeft] */
  s?: unknown[]
  /** catégories du joueur : [[id, nom]] */
  k?: unknown[]
  /** états : [[préréglage|null, nom, buff?1:0, sourceIdx, niveau, mods]] */
  e?: unknown[]
  /** états mémorisés : [[nom, buff?1:0, sourceIdx, mods]] */
  m?: unknown[]
}

function toB64Url(bytes: Uint8Array): string {
  let bin = ''
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]!)
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function fromB64Url(text: string): Uint8Array {
  const pad = text.length % 4 === 0 ? '' : '='.repeat(4 - (text.length % 4))
  const b64 = text.replace(/-/g, '+').replace(/_/g, '/') + pad
  const bin = atob(b64)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

async function gzipBytes(data: Uint8Array): Promise<Uint8Array> {
  if (typeof CompressionStream === 'undefined') return data
  const stream = new Blob([data as BlobPart]).stream().pipeThrough(new CompressionStream('gzip'))
  return new Uint8Array(await new Response(stream).arrayBuffer())
}

async function gunzipBytes(data: Uint8Array): Promise<Uint8Array> {
  // gzip magic 1f 8b
  if (data.length < 2 || data[0] !== 0x1f || data[1] !== 0x8b) return data
  if (typeof DecompressionStream === 'undefined') {
    throw new Error('gzip-unsupported')
  }
  const stream = new Blob([data as BlobPart]).stream().pipeThrough(new DecompressionStream('gzip'))
  return new Uint8Array(await new Response(stream).arrayBuffer())
}

function savesMask(saves: Record<Ability, boolean>): number {
  let mask = 0
  ABILITIES.forEach((ab, i) => {
    if (saves[ab]) mask |= 1 << i
  })
  return mask
}

function unpackSaves(mask: number): Record<Ability, boolean> {
  const out = {} as Record<Ability, boolean>
  ABILITIES.forEach((ab, i) => {
    out[ab] = Boolean(mask & (1 << i))
  })
  return out
}

function packSkills(ranks: Record<Skill, SkillRank>): [number, number][] {
  const packed: [number, number][] = []
  SKILLS.forEach((skill, i) => {
    const r = ranks[skill]
    if (r === 'proficient') packed.push([i, 1])
    else if (r === 'expertise') packed.push([i, 2])
  })
  return packed
}

function unpackSkills(packed: unknown): Record<Skill, SkillRank> {
  const out = Object.fromEntries(SKILLS.map((s) => [s, 'none'])) as Record<Skill, SkillRank>
  if (!Array.isArray(packed)) return out
  for (const entry of packed) {
    if (!Array.isArray(entry) || entry.length < 2) continue
    const idx = Number(entry[0])
    const rank = Number(entry[1])
    const skill = SKILLS[idx]
    if (!skill) continue
    if (rank === 1) out[skill] = 'proficient'
    else if (rank === 2) out[skill] = 'expertise'
  }
  return out
}

function packCharacter(c: CharacterSnapshot): unknown[] {
  return [
    c.name || undefined,
    c.level === 1 ? undefined : c.level,
    c.characterClass || undefined,
    c.species || undefined,
    ABILITIES.map((ab) => c.abilityScores[ab]),
    savesMask(c.savingThrowProficiency) || undefined,
    packSkills(c.skillRank),
    c.hpCurrent,
    c.hpMax,
    c.hpTemp || undefined,
    c.inspiration || undefined,
    c.armorClassBase === 10 ? undefined : c.armorClassBase,
    c.speedBase === 9 ? undefined : c.speedBase,
    c.initiativeBonus || undefined,
    c.deathSaveSuccesses || undefined,
    c.deathSaveFailures || undefined,
  ]
}

function unpackCharacter(raw: unknown): CharacterSnapshot {
  const row = Array.isArray(raw) ? raw : []
  const scoresRaw = Array.isArray(row[4]) ? row[4] : []
  const abilityScores = {} as Record<Ability, number>
  ABILITIES.forEach((ab, i) => {
    const v = Number(scoresRaw[i])
    abilityScores[ab] = Number.isFinite(v) ? Math.max(1, Math.min(30, Math.round(v))) : 10
  })
  const hpMax = Math.max(1, Number(row[8]) || 10)
  return {
    name: typeof row[0] === 'string' ? row[0] : '',
    level: Math.max(1, Math.min(20, Math.round(Number(row[1]) || 1))),
    characterClass: typeof row[2] === 'string' ? row[2] : '',
    species: typeof row[3] === 'string' ? row[3] : '',
    abilityScores,
    savingThrowProficiency: unpackSaves(Number(row[5]) || 0),
    skillRank: unpackSkills(row[6]),
    hpCurrent: Math.max(0, Math.min(hpMax, Number(row[7]) || 0)),
    hpMax,
    hpTemp: Math.max(0, Number(row[9]) || 0),
    inspiration: Math.max(0, Math.round(Number(row[10]) || 0)),
    armorClassBase: Math.max(0, Number(row[11] ?? 10)),
    speedBase: Math.max(0, Number(row[12] ?? 9)),
    initiativeBonus: Math.round(Number(row[13]) || 0),
    deathSaveSuccesses: Math.max(0, Math.min(3, Math.round(Number(row[14]) || 0))),
    deathSaveFailures: Math.max(0, Math.min(3, Math.round(Number(row[15]) || 0))),
  }
}

function packMods(mods: Modifier[]): unknown[] | undefined {
  if (!mods.length) return undefined
  return mods.map((m) => {
    const ti = MOD_TYPES.indexOf(m.type)
    return [ti < 0 ? 11 : ti, m.value, m.label || undefined]
  })
}

function unpackMods(raw: unknown): Modifier[] {
  if (!Array.isArray(raw)) return []
  return raw
    .map((entry) => {
      if (!Array.isArray(entry)) return null
      const type = MOD_TYPES[Number(entry[0])] ?? 'autre'
      const value = Number(entry[1]) || 0
      const label = typeof entry[2] === 'string' ? entry[2] : undefined
      return { type, value, label } as Modifier
    })
    .filter(Boolean) as Modifier[]
}

function packWeaponDmg(parts: EquipmentItem['weaponDamage']): unknown[] | undefined {
  if (!parts?.length) return undefined
  return parts.map((p) => {
    const ti = DAMAGE_TYPES.indexOf(p.damageType)
    return [p.diceCount, p.diceFaces, p.flatBonus || undefined, ti < 0 ? 0 : ti]
  })
}

function unpackWeaponDmg(raw: unknown): EquipmentItem['weaponDamage'] {
  if (!Array.isArray(raw)) return []
  return raw.map((entry) => {
    const row = Array.isArray(entry) ? entry : []
    return createEmptyWeaponDamage({
      label: '',
      diceCount: Math.max(0, Number(row[0]) || 0),
      diceFaces: Number(row[1]) || 6,
      flatBonus: Number(row[2]) || 0,
      damageType: DAMAGE_TYPES[Number(row[3])] ?? 'tranchant',
    })
  })
}

function packItem(item: EquipmentItem): unknown[] {
  // Intégrée : index ; catégorie du joueur : son id (les anciennes versions lisent « Autre »)
  const category = isBuiltinCategory(item.category)
    ? CATEGORIES.indexOf(item.category)
    : item.category
  return [
    item.id,
    item.name,
    category,
    item.description || undefined,
    packMods(item.modifiers),
    packWeaponDmg(item.weaponDamage),
    item.equipped ? 1 : undefined,
  ]
}

function unpackItem(raw: unknown): EquipmentItem | null {
  if (!Array.isArray(raw) || raw.length < 2) return null
  const id = typeof raw[0] === 'string' ? raw[0] : `eq-${Date.now()}`
  const name = typeof raw[1] === 'string' ? raw[1] : 'Item'
  const category = typeof raw[2] === 'string' ? raw[2] : (CATEGORIES[Number(raw[2])] ?? 'autre')
  return {
    id,
    name,
    category,
    description: typeof raw[3] === 'string' ? raw[3] : '',
    modifiers: unpackMods(raw[4]),
    weaponDamage: unpackWeaponDmg(raw[5]),
    equipped: Boolean(raw[6]),
  }
}

function packAttack(cfg: AttackConfig): unknown[] {
  const ai = ABILITIES.indexOf(cfg.ability)
  return [
    cfg.id,
    cfg.name,
    ai < 0 ? 0 : ai,
    cfg.proficient ? undefined : 0,
    cfg.attackCount === 1 ? undefined : cfg.attackCount,
    cfg.attackBonusExtra || undefined,
    cfg.useEquipmentAttackBonus ? undefined : 0,
    cfg.useEquipmentDamageBonus ? undefined : 0,
    cfg.weaponItemId || undefined,
    cfg.damageParts.map((p) => {
      const ti = DAMAGE_TYPES.indexOf(p.damageType)
      return [
        p.label || undefined,
        p.diceCount,
        p.diceFaces,
        p.flatBonus || undefined,
        ti < 0 ? 0 : ti,
        p.includeAbilityMod ? undefined : 0,
      ]
    }),
  ]
}

function unpackAttack(raw: unknown): AttackConfig | null {
  if (!Array.isArray(raw)) return null
  const ability = ABILITIES[Number(raw[2])] ?? 'str'
  const partsRaw = Array.isArray(raw[9]) ? raw[9] : []
  const damageParts = partsRaw.map((entry) => {
    const row = Array.isArray(entry) ? entry : []
    return createEmptyDamagePart({
      label: typeof row[0] === 'string' ? row[0] : '',
      diceCount: Math.max(0, Number(row[1]) || 0),
      diceFaces: Number(row[2]) || 6,
      flatBonus: Number(row[3]) || 0,
      damageType: (DAMAGE_TYPES[Number(row[4])] ?? 'tranchant') as DamageType,
      includeAbilityMod: row[5] === 0 ? false : true,
    })
  })
  return createEmptyAttackConfig({
    id: typeof raw[0] === 'string' ? raw[0] : undefined,
    name: typeof raw[1] === 'string' ? raw[1] : 'Attaque',
    ability,
    proficient: raw[3] === 0 ? false : true,
    attackCount: Math.max(1, Number(raw[4] ?? 1)),
    attackBonusExtra: Number(raw[5]) || 0,
    useEquipmentAttackBonus: raw[6] === 0 ? false : true,
    useEquipmentDamageBonus: raw[7] === 0 ? false : true,
    weaponItemId: typeof raw[8] === 'string' ? raw[8] : null,
    damageParts: damageParts.length ? damageParts : undefined,
  })
}

function packSpell(spell: Spell): unknown[] {
  return [
    spell.id,
    spell.name,
    spell.level || undefined,
    spell.school || undefined,
    spell.prepared ? undefined : 0,
    spell.notes || undefined,
    spell.diceCount || undefined,
    spell.diceCount ? spell.diceFaces : undefined,
    spell.flatBonus || undefined,
    spell.consumesSlot === false ? 0 : undefined,
    spell.referenceUrl || undefined,
    spell.concentration ? 1 : undefined,
    spell.durationRounds || undefined,
  ]
}

function unpackSpell(raw: unknown): Spell | null {
  if (!Array.isArray(raw)) return null
  const level = Math.max(0, Math.min(9, Math.round(Number(raw[2]) || 0))) as SpellLevel
  return createEmptySpell({
    id: typeof raw[0] === 'string' ? raw[0] : undefined,
    name: typeof raw[1] === 'string' ? raw[1] : '',
    level,
    school: typeof raw[3] === 'string' ? raw[3] : '',
    prepared: raw[4] === 0 ? false : true,
    notes: typeof raw[5] === 'string' ? raw[5] : '',
    diceCount: Math.max(0, Number(raw[6]) || 0),
    diceFaces: Number(raw[7]) || 8,
    flatBonus: Number(raw[8]) || 0,
    consumesSlot: raw[9] === 0 ? false : level > 0,
    referenceUrl: typeof raw[10] === 'string' ? raw[10] : undefined,
    concentration: raw[11] === 1,
    durationRounds: Math.max(0, Math.round(Number(raw[12]) || 0)),
  })
}

function packSpells(snapshot: SpellsSnapshot): unknown[] {
  const slotRows: unknown[] = []
  for (let lvl = 1; lvl <= 9; lvl++) {
    const row = snapshot.slots[String(lvl)] ?? { max: 0, used: 0 }
    if (!row.max && !row.used) {
      slotRows.push(undefined)
    } else {
      slotRows.push([row.max || undefined, row.used || undefined])
    }
  }
  const spellList = snapshot.spells
  const concIdx =
    snapshot.concentrationSpellId != null
      ? spellList.findIndex((s) => s.id === snapshot.concentrationSpellId)
      : -1
  const resources = snapshot.resources.length
    ? snapshot.resources.map((r) => [
        r.id,
        r.label || undefined,
        r.current || undefined,
        r.max || undefined,
      ])
    : undefined
  return [
    slotRows,
    concIdx >= 0 ? concIdx : undefined,
    resources,
    spellList.length ? spellList.map(packSpell) : undefined,
    concIdx >= 0 ? snapshot.concentrationRoundsLeft || undefined : undefined,
  ]
}

function unpackSpells(raw: unknown): SpellsSnapshot {
  const empty: SpellsSnapshot = {
    spells: [],
    slots: Object.fromEntries(
      [1, 2, 3, 4, 5, 6, 7, 8, 9].map((l) => [String(l), { max: 0, used: 0 }]),
    ),
    concentrationSpellId: null,
    resources: [],
  }
  if (!Array.isArray(raw)) return empty
  const slotsRaw = Array.isArray(raw[0]) ? raw[0] : []
  const slots: Record<string, SpellSlotBag> = { ...empty.slots }
  for (let i = 0; i < 9; i++) {
    const entry = slotsRaw[i]
    const key = String(i + 1)
    if (Array.isArray(entry)) {
      const max = Math.max(0, Number(entry[0]) || 0)
      const used = Math.max(0, Math.min(max, Number(entry[1]) || 0))
      slots[key] = { max, used }
    }
  }
  const spells = Array.isArray(raw[3]) ? (raw[3].map(unpackSpell).filter(Boolean) as Spell[]) : []
  const concIdx = Number(raw[1])
  const concentrationSpellId =
    Number.isFinite(concIdx) && concIdx >= 0 && spells[concIdx] ? spells[concIdx]!.id : null
  const resources: SpellResource[] = Array.isArray(raw[2])
    ? (raw[2]
        .map((entry) => {
          if (!Array.isArray(entry)) return null
          const max = Math.max(0, Number(entry[3]) || 0)
          return {
            id: typeof entry[0] === 'string' ? entry[0] : `res-${Date.now()}`,
            label: typeof entry[1] === 'string' ? entry[1] : '',
            current: Math.max(0, Math.min(max, Number(entry[2]) || 0)),
            max,
          } as SpellResource
        })
        .filter(Boolean) as SpellResource[])
    : []
  const roundsLeft = Math.round(Number(raw[4]) || 0)
  const concentrationRoundsLeft = concentrationSpellId && roundsLeft > 0 ? roundsLeft : null
  return { spells, slots, concentrationSpellId, concentrationRoundsLeft, resources }
}

export function packBundle(bundle: CharacterBundle): CompactV1 {
  const compact: CompactV1 = {
    v: 1,
    c: packCharacter(bundle.character),
  }
  if (bundle.inventory.length) compact.i = bundle.inventory.map(packItem)
  if (bundle.attacks.length) compact.a = bundle.attacks.map(packAttack)
  if (bundle.spells) {
    const packed = packSpells(bundle.spells)
    const hasContent =
      bundle.spells.spells.length ||
      bundle.spells.resources.length ||
      Object.values(bundle.spells.slots).some((s) => s.max > 0 || s.used > 0)
    if (hasContent) compact.s = packed
  }
  if (bundle.categories?.length) compact.k = bundle.categories.map((c) => [c.id, c.name])
  if (bundle.conditions?.length) {
    compact.e = bundle.conditions.map((c) => [
      c.preset,
      c.name || undefined,
      c.kind === 'buff' ? 1 : 0,
      CONDITION_SOURCES.indexOf(c.source),
      c.level === 1 ? undefined : c.level,
      packMods(c.modifiers),
    ])
  }
  if (bundle.savedConditions?.length) {
    compact.m = bundle.savedConditions.map((c) => [
      c.name,
      c.kind === 'buff' ? 1 : 0,
      CONDITION_SOURCES.indexOf(c.source),
      packMods(c.modifiers),
    ])
  }
  return compact
}

export function unpackBundle(data: CompactV1 | Record<string, unknown>): CharacterBundle {
  if (!data || typeof data !== 'object') throw new Error('invalid')
  const v = (data as CompactV1).v
  if (v !== 1) throw new Error('version')
  const character = unpackCharacter((data as CompactV1).c)
  const inventory = Array.isArray((data as CompactV1).i)
    ? ((data as CompactV1).i!.map(unpackItem).filter(Boolean) as EquipmentItem[])
    : []
  const attacks = Array.isArray((data as CompactV1).a)
    ? ((data as CompactV1).a!.map(unpackAttack).filter(Boolean) as AttackConfig[])
    : []
  const spells = (data as CompactV1).s != null ? unpackSpells((data as CompactV1).s) : undefined
  const rawCategories = (data as CompactV1).k
  const categories = normalizeCustomCategories(
    Array.isArray(rawCategories)
      ? rawCategories.map((e) => (Array.isArray(e) ? { id: e[0], name: e[1] } : null))
      : [],
  )
  // Catégorie inconnue (fichier modifié, liste tronquée) → « Autre »
  for (const item of inventory) {
    if (!isBuiltinCategory(item.category) && !categories.some((c) => c.id === item.category)) {
      item.category = 'autre'
    }
  }
  const rawConditions = (data as CompactV1).e
  const conditions = Array.isArray(rawConditions)
    ? (rawConditions
        .map((e) =>
          Array.isArray(e)
            ? normalizeCondition({
                preset: e[0],
                name: e[1],
                kind: e[2] === 1 ? 'buff' : 'debuff',
                source: CONDITION_SOURCES[Number(e[3])],
                level: e[4] ?? 1,
                modifiers: unpackMods(e[5]),
              })
            : null,
        )
        .filter(Boolean) as ActiveCondition[])
    : []
  const rawSaved = (data as CompactV1).m
  const savedConditions = normalizeSavedConditions(
    Array.isArray(rawSaved)
      ? rawSaved.map((e) =>
          Array.isArray(e)
            ? {
                name: e[0],
                kind: e[1] === 1 ? 'buff' : 'debuff',
                source: CONDITION_SOURCES[Number(e[2])],
                modifiers: unpackMods(e[3]),
              }
            : null,
        )
      : [],
  )
  return { character, inventory, attacks, spells, categories, conditions, savedConditions }
}

export async function encodeBundle(bundle: CharacterBundle): Promise<string> {
  const json = JSON.stringify(packBundle(bundle))
  const raw = new TextEncoder().encode(json)
  const compressed = await gzipBytes(raw)
  return PREFIX + toB64Url(compressed)
}

export async function decodeBundle(text: string): Promise<CharacterBundle> {
  const trimmed = text.trim()
  if (trimmed.startsWith(PREFIX)) {
    const bytes = fromB64Url(trimmed.slice(PREFIX.length))
    const inflated = await gunzipBytes(bytes)
    const json = new TextDecoder().decode(inflated)
    return unpackBundle(JSON.parse(json) as CompactV1)
  }
  // Compat : JSON brut éventuel
  const parsed = JSON.parse(trimmed) as CompactV1 | CharacterBundle
  if ('v' in parsed && parsed.v === 1) return unpackBundle(parsed as CompactV1)
  if ('character' in parsed) return parsed as CharacterBundle
  throw new Error('invalid')
}

/** Plusieurs personnages dans un même fichier : un payload EC1 par ligne */
export async function encodeBundles(bundles: CharacterBundle[]): Promise<string> {
  const lines = await Promise.all(bundles.map(encodeBundle))
  return lines.join('\n')
}

/** Lit un fichier d'un ou plusieurs personnages (une ligne EC1 par personnage, ou JSON) */
export async function decodeBundles(text: string): Promise<CharacterBundle[]> {
  const lines = text
    .split(/\s+/)
    .map((l) => l.trim())
    .filter((l) => l.startsWith(PREFIX))
  if (lines.length > 1) return Promise.all(lines.map(decodeBundle))
  return [await decodeBundle(text)]
}

export function bundleFilename(name: string): string {
  const slug =
    name
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 40) || 'personnage'
  return `${slug}.ec1`
}
