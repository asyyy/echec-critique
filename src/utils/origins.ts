import type { Modifier } from '@/stores/inventory'
import type { Ability } from '@/utils/dnd'

/**
 * Classes et espèces du SRD 5.2.1 (règles 2024) : données chiffrées seulement.
 * Noms, armes et traits (noms seulement) : i18n (`origins.*`). Ordre des tableaux figé (index exportés).
 */

export const CLASS_IDS = [
  'barbare',
  'barde',
  'clerc',
  'druide',
  'ensorceleur',
  'guerrier',
  'magicien',
  'moine',
  'occultiste',
  'paladin',
  'rodeur',
  'roublard',
] as const

export type ClassId = (typeof CLASS_IDS)[number]

export const SPECIES_IDS = [
  'drakeide',
  'elfe',
  'gnome',
  'goliath',
  'halfelin',
  'humain',
  'nain',
  'orc',
  'tieffelin',
] as const

export type SpeciesId = (typeof SPECIES_IDS)[number]

export type ArmorTraining = 'legere' | 'intermediaire' | 'lourde' | 'bouclier'

export interface ClassInfo {
  hitDie: number
  /** Caractéristiques principales ; `primaryOr` : l'une ou l'autre (Guerrier) */
  primary: Ability[]
  primaryOr?: boolean
  saves: [Ability, Ability]
  /** Nombre de compétences au choix */
  skillChoices: number
  armor: ArmorTraining[]
  /** Caractéristique d'incantation (lanceurs de sorts) */
  spellcasting?: Ability
  /** Effets chiffrés calculés par l'app, avec leur niveau d'obtention */
  effects: OriginEffectId[]
}

export const CLASSES: Record<ClassId, ClassInfo> = {
  barbare: {
    hitDie: 12,
    primary: ['str'],
    saves: ['str', 'con'],
    skillChoices: 2,
    armor: ['legere', 'intermediaire', 'bouclier'],
    effects: ['barbareDefense', 'barbareDeplacement'],
  },
  barde: {
    hitDie: 8,
    primary: ['cha'],
    saves: ['dex', 'cha'],
    skillChoices: 3,
    armor: ['legere'],
    spellcasting: 'cha',
    effects: [],
  },
  clerc: {
    hitDie: 8,
    primary: ['wis'],
    saves: ['wis', 'cha'],
    skillChoices: 2,
    armor: ['legere', 'intermediaire', 'bouclier'],
    spellcasting: 'wis',
    effects: [],
  },
  druide: {
    hitDie: 8,
    primary: ['wis'],
    saves: ['int', 'wis'],
    skillChoices: 2,
    armor: ['legere', 'bouclier'],
    spellcasting: 'wis',
    effects: [],
  },
  ensorceleur: {
    hitDie: 6,
    primary: ['cha'],
    saves: ['con', 'cha'],
    skillChoices: 2,
    armor: [],
    spellcasting: 'cha',
    effects: [],
  },
  guerrier: {
    hitDie: 10,
    primary: ['str', 'dex'],
    primaryOr: true,
    saves: ['str', 'con'],
    skillChoices: 2,
    armor: ['legere', 'intermediaire', 'lourde', 'bouclier'],
    effects: [],
  },
  magicien: {
    hitDie: 6,
    primary: ['int'],
    saves: ['int', 'wis'],
    skillChoices: 2,
    armor: [],
    spellcasting: 'int',
    effects: [],
  },
  moine: {
    hitDie: 8,
    primary: ['dex', 'wis'],
    saves: ['str', 'dex'],
    skillChoices: 2,
    armor: [],
    effects: ['moineDefense', 'moineDeplacement'],
  },
  occultiste: {
    hitDie: 8,
    primary: ['cha'],
    saves: ['wis', 'cha'],
    skillChoices: 2,
    armor: ['legere'],
    spellcasting: 'cha',
    effects: [],
  },
  paladin: {
    hitDie: 10,
    primary: ['str', 'cha'],
    saves: ['wis', 'cha'],
    skillChoices: 2,
    armor: ['legere', 'intermediaire', 'lourde', 'bouclier'],
    spellcasting: 'cha',
    effects: [],
  },
  rodeur: {
    hitDie: 10,
    primary: ['dex', 'wis'],
    saves: ['str', 'dex'],
    skillChoices: 3,
    armor: ['legere', 'intermediaire', 'bouclier'],
    spellcasting: 'wis',
    effects: ['rodeurArpenteur'],
  },
  roublard: {
    hitDie: 8,
    primary: ['dex'],
    saves: ['dex', 'int'],
    skillChoices: 4,
    armor: ['legere'],
    effects: [],
  },
}

/** Taille : M, P, ou au choix (Humain, Tieffelin) */
export type SpeciesSize = 'M' | 'P' | 'MP'

export interface SpeciesInfo {
  size: SpeciesSize
  /** Vitesse en mètres */
  speed: number
  /** Vision dans le noir en mètres (0 = aucune) */
  darkvision: number
  effects: OriginEffectId[]
}

export const SPECIES: Record<SpeciesId, SpeciesInfo> = {
  drakeide: { size: 'M', speed: 9, darkvision: 18, effects: [] },
  elfe: { size: 'M', speed: 9, darkvision: 18, effects: [] },
  gnome: { size: 'P', speed: 9, darkvision: 18, effects: [] },
  goliath: { size: 'M', speed: 10.5, darkvision: 0, effects: [] },
  halfelin: { size: 'P', speed: 9, darkvision: 0, effects: [] },
  humain: { size: 'MP', speed: 9, darkvision: 0, effects: [] },
  nain: { size: 'M', speed: 9, darkvision: 36, effects: ['nainTenacite'] },
  orc: { size: 'M', speed: 9, darkvision: 36, effects: [] },
  tieffelin: { size: 'MP', speed: 9, darkvision: 18, effects: [] },
}

/* ── Effets chiffrés ── */

export type OriginEffectId =
  | 'barbareDefense'
  | 'barbareDeplacement'
  | 'moineDefense'
  | 'moineDeplacement'
  | 'rodeurArpenteur'
  | 'nainTenacite'

/** Ce que l'effet doit savoir du perso */
export interface OriginEffectContext {
  level: number
  /** Armure portée (objet équipé de la catégorie Armure) */
  wearsArmor: boolean
  wearsShield: boolean
  abilityMod: (ability: Ability) => number
}

interface OriginEffectDef {
  /** Niveau d'obtention */
  level: number
  /** Modificateurs appliqués (vide = conditions non remplies) */
  modifiers: (ctx: OriginEffectContext) => Modifier[]
  /** PV max en plus (Ténacité naine) */
  hpMax?: (ctx: OriginEffectContext) => number
}

/** Déplacement sans armure du Moine : +3 m au niv. 2, puis +1,5 m aux niv. 6, 10, 14 et 18 */
export function monkSpeedBonus(level: number): number {
  if (level < 2) return 0
  return 3 + 1.5 * [6, 10, 14, 18].filter((l) => level >= l).length
}

export const ORIGIN_EFFECTS: Record<OriginEffectId, OriginEffectDef> = {
  // Sans armure (bouclier permis) : CA de base 10 + Dex + Con → + mod. Con sur la base de l'app
  barbareDefense: {
    level: 1,
    modifiers: (c) => (c.wearsArmor ? [] : [{ type: 'ca', value: c.abilityMod('con') }]),
  },
  // Sans armure lourde : l'app ne distingue pas les armures, l'effet s'applique toujours
  barbareDeplacement: { level: 5, modifiers: () => [{ type: 'vitesse', value: 3 }] },
  // Ni armure ni bouclier : CA de base 10 + Dex + Sag
  moineDefense: {
    level: 1,
    modifiers: (c) =>
      c.wearsArmor || c.wearsShield ? [] : [{ type: 'ca', value: c.abilityMod('wis') }],
  },
  moineDeplacement: {
    level: 2,
    modifiers: (c) =>
      c.wearsArmor || c.wearsShield ? [] : [{ type: 'vitesse', value: monkSpeedBonus(c.level) }],
  },
  rodeurArpenteur: { level: 6, modifiers: () => [{ type: 'vitesse', value: 3 }] },
  // +1 PV max par niveau : rappel, les PV max restent saisis par le joueur
  nainTenacite: { level: 1, modifiers: () => [], hpMax: (c) => c.level },
}

/** Effets actifs (niveau atteint) d'une classe et d'une espèce */
export function activeOriginEffects(
  classId: ClassId | null,
  speciesId: SpeciesId | null,
  ctx: OriginEffectContext,
): { id: OriginEffectId; modifiers: Modifier[] }[] {
  const ids = [
    ...(classId ? CLASSES[classId].effects : []),
    ...(speciesId ? SPECIES[speciesId].effects : []),
  ]
  return ids
    .filter((id) => ctx.level >= ORIGIN_EFFECTS[id].level)
    .map((id) => ({
      id,
      modifiers: ORIGIN_EFFECTS[id].modifiers(ctx).filter((m) => m.value !== 0),
    }))
}

/* ── Reconnaissance d'un texte libre (anciennes sauvegardes) ── */

const CLASS_ALIASES: Record<ClassId, string[]> = {
  barbare: ['barbare', 'barbarian'],
  barde: ['barde', 'bard'],
  clerc: ['clerc', 'cleric', 'pretre'],
  druide: ['druide', 'druid'],
  ensorceleur: ['ensorceleur', 'ensorceleuse', 'sorcerer'],
  guerrier: ['guerrier', 'guerriere', 'fighter'],
  magicien: ['magicien', 'magicienne', 'wizard', 'mage'],
  moine: ['moine', 'moniale', 'monk'],
  occultiste: ['occultiste', 'sorcier', 'sorciere', 'warlock'],
  paladin: ['paladin', 'paladine'],
  rodeur: ['rodeur', 'rodeuse', 'ranger'],
  roublard: ['roublard', 'roublarde', 'rogue', 'voleur'],
}

const SPECIES_ALIASES: Record<SpeciesId, string[]> = {
  drakeide: ['drakeide', 'dragonborn', 'sang-dragon'],
  elfe: ['elfe', 'elf', 'haut-elfe', 'drow', 'elfe sylvestre', 'high elf', 'wood elf'],
  gnome: ['gnome'],
  goliath: ['goliath'],
  halfelin: ['halfelin', 'halfeline', 'halfling'],
  humain: ['humain', 'humaine', 'human'],
  nain: ['nain', 'naine', 'dwarf'],
  orc: ['orc', 'orque', 'demi-orc', 'half-orc'],
  tieffelin: ['tieffelin', 'tieffeline', 'tiefling'],
}

function normalizeName(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .trim()
    .toLowerCase()
}

export function matchClassId(text: string): ClassId | null {
  const key = normalizeName(text)
  return CLASS_IDS.find((id) => CLASS_ALIASES[id].includes(key)) ?? null
}

export function matchSpeciesId(text: string): SpeciesId | null {
  const key = normalizeName(text)
  return SPECIES_IDS.find((id) => SPECIES_ALIASES[id].includes(key)) ?? null
}

export function isClassId(value: unknown): value is ClassId {
  return typeof value === 'string' && (CLASS_IDS as readonly string[]).includes(value)
}

export function isSpeciesId(value: unknown): value is SpeciesId {
  return typeof value === 'string' && (SPECIES_IDS as readonly string[]).includes(value)
}
