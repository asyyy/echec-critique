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

/* ── Sous-classes (règles 2024) ── */

/** Niveau où toutes les classes choisissent leur sous-classe */
export const SUBCLASS_LEVEL = 3

/**
 * Les 4 sous-classes de chaque classe (Manuel des joueurs 2024). Une seule par classe est dans
 * le SRD 5.2.1 (`srd`) ; les autres : nom + lien AideDD, jamais leur texte.
 * Ordre figé (index exportés) : ajouts en fin de tableau.
 */
export const SUBCLASS_IDS = [
  'arbreMonde',
  'berserker',
  'coeurSauvage',
  'zelateur',
  'danse',
  'savoir',
  'seduction',
  'vaillance',
  'guerre',
  'lumiere',
  'ruse',
  'vie',
  'astres',
  'lune',
  'mers',
  'terre',
  'aberrante',
  'draconique',
  'mecanique',
  'sauvage',
  'champion',
  'chevalierOcculte',
  'maitreGuerre',
  'soldatPsi',
  'abjurateur',
  'devin',
  'evocateur',
  'illusionniste',
  'elements',
  'misericorde',
  'ombre',
  'paume',
  'archifee',
  'celeste',
  'fielon',
  'grandAncien',
  'anciens',
  'devotion',
  'gloire',
  'vengeance',
  'belluaire',
  'chasseur',
  'traqueurTenebres',
  'vagabondFeerique',
  'ameAceree',
  'arnaqueurArcanique',
  'assassin',
  'voleur',
] as const

export type SubclassId = (typeof SUBCLASS_IDS)[number]

export interface SubclassInfo {
  classId: ClassId
  /** Sous-classe reprise dans le SRD 5.2.1 */
  srd?: true
  /** Ancres de la page de la classe sur AideDD (FR, EN) */
  anchor: [fr: string, en: string]
}

export const SUBCLASSES: Record<SubclassId, SubclassInfo> = {
  arbreMonde: { classId: 'barbare', anchor: ['arbre-monde', 'world-tree'] },
  berserker: { classId: 'barbare', srd: true, anchor: ['berserker', 'berserker'] },
  coeurSauvage: { classId: 'barbare', anchor: ['coeur-sauvage', 'wild-heart'] },
  zelateur: { classId: 'barbare', anchor: ['zelateur', 'zealot'] },
  danse: { classId: 'barde', anchor: ['danse', 'dance'] },
  savoir: { classId: 'barde', srd: true, anchor: ['savoir', 'lore'] },
  seduction: { classId: 'barde', anchor: ['seduction', 'glamour'] },
  vaillance: { classId: 'barde', anchor: ['vaillance', 'valor'] },
  guerre: { classId: 'clerc', anchor: ['guerre', 'war'] },
  lumiere: { classId: 'clerc', anchor: ['lumière', 'light'] },
  ruse: { classId: 'clerc', anchor: ['ruse', 'trickery'] },
  vie: { classId: 'clerc', srd: true, anchor: ['vie', 'life'] },
  astres: { classId: 'druide', anchor: ['astres', 'stars'] },
  lune: { classId: 'druide', anchor: ['lune', 'moon'] },
  mers: { classId: 'druide', anchor: ['mers', 'sea'] },
  terre: { classId: 'druide', srd: true, anchor: ['terre', 'land'] },
  aberrante: { classId: 'ensorceleur', anchor: ['aberrante', 'aberrant'] },
  draconique: { classId: 'ensorceleur', srd: true, anchor: ['draconique', 'draconic'] },
  mecanique: { classId: 'ensorceleur', anchor: ['mécanique', 'clockwork'] },
  sauvage: { classId: 'ensorceleur', anchor: ['sauvage', 'wild-magic'] },
  champion: { classId: 'guerrier', srd: true, anchor: ['champion', 'champion'] },
  chevalierOcculte: { classId: 'guerrier', anchor: ['chevalier-occulte', 'eldritch-knight'] },
  maitreGuerre: { classId: 'guerrier', anchor: ['maitre-guerre', 'battle-master'] },
  soldatPsi: { classId: 'guerrier', anchor: ['soldat-psi', 'psi-warrior'] },
  abjurateur: { classId: 'magicien', anchor: ['abjurateur', 'abjurer'] },
  devin: { classId: 'magicien', anchor: ['devin', 'diviner'] },
  evocateur: { classId: 'magicien', srd: true, anchor: ['evocateur', 'evoker'] },
  illusionniste: { classId: 'magicien', anchor: ['illusionniste', 'illusionist'] },
  elements: { classId: 'moine', anchor: ['element', 'element'] },
  misericorde: { classId: 'moine', anchor: ['misericorde', 'mercy'] },
  ombre: { classId: 'moine', anchor: ['ombre', 'shadow'] },
  paume: { classId: 'moine', srd: true, anchor: ['paume', 'open-hand'] },
  archifee: { classId: 'occultiste', anchor: ['archifee', 'archfey'] },
  celeste: { classId: 'occultiste', anchor: ['celeste', 'celestial'] },
  fielon: { classId: 'occultiste', srd: true, anchor: ['fielon', 'fiend'] },
  grandAncien: { classId: 'occultiste', anchor: ['grand-ancien', 'great-old-one'] },
  anciens: { classId: 'paladin', anchor: ['anciens', 'ancients'] },
  devotion: { classId: 'paladin', srd: true, anchor: ['devotion', 'devotion'] },
  gloire: { classId: 'paladin', anchor: ['gloire', 'glory'] },
  vengeance: { classId: 'paladin', anchor: ['vengeance', 'vengeance'] },
  belluaire: { classId: 'rodeur', anchor: ['belluaire', 'beast-master'] },
  chasseur: { classId: 'rodeur', srd: true, anchor: ['chasseur', 'hunter'] },
  traqueurTenebres: { classId: 'rodeur', anchor: ['traqueur-tenebres', 'gloom-stalker'] },
  vagabondFeerique: { classId: 'rodeur', anchor: ['vagabond-feerique', 'fey-wanderer'] },
  ameAceree: { classId: 'roublard', anchor: ['ame-aceree', 'soulknife'] },
  arnaqueurArcanique: { classId: 'roublard', anchor: ['arnaqueur-arcanique', 'arcane-trickster'] },
  assassin: { classId: 'roublard', anchor: ['assassin', 'assassin'] },
  voleur: { classId: 'roublard', srd: true, anchor: ['voleur', 'thief'] },
}

/** Niveaux où la sous-classe apporte des capacités (2024) */
export const SUBCLASS_FEATURE_LEVELS: Record<ClassId, number[]> = {
  barbare: [3, 6, 10, 14],
  barde: [3, 6, 14],
  clerc: [3, 6, 17],
  druide: [3, 6, 10, 14],
  ensorceleur: [3, 6, 14, 18],
  guerrier: [3, 7, 10, 15, 18],
  magicien: [3, 6, 10, 14],
  moine: [3, 6, 11, 17],
  occultiste: [3, 6, 10, 14],
  paladin: [3, 7, 15, 20],
  rodeur: [3, 7, 11, 15],
  roublard: [3, 9, 13, 17],
}

/**
 * Niveau de chaque capacité de sous-classe, dans l'ordre des noms (`origins.subclassFeatures.*`,
 * repris d'AideDD : noms seulement). Absente : AideDD ne détaille pas la sous-classe.
 */
export const SUBCLASS_FEATURES: Partial<Record<SubclassId, number[]>> = {
  arbreMonde: [3, 6, 10, 14],
  berserker: [3, 6, 10, 14],
  coeurSauvage: [3, 3, 6, 10, 14],
  danse: [3, 6, 6, 14],
  savoir: [3, 3, 6, 14],
  seduction: [3, 3, 6, 14],
  vaillance: [3, 3, 6, 14],
  guerre: [3, 3, 3, 6, 17],
  lumiere: [3, 3, 3, 6, 17],
  ruse: [3, 3, 3, 6, 17],
  vie: [3, 3, 3, 6, 17],
  lune: [3, 3, 6, 10, 14],
  mers: [3, 3, 6, 10, 14],
  terre: [3, 3, 6, 10, 14],
  draconique: [3, 3, 6, 14, 18],
  sauvage: [3, 3, 6, 14, 18],
  champion: [3, 3, 7, 10, 15, 18],
  chevalierOcculte: [3, 3, 7, 10, 15, 18],
  maitreGuerre: [3, 3, 7, 10, 15, 18],
  abjurateur: [3, 3, 6, 10, 14],
  devin: [3, 3, 6, 10, 14],
  evocateur: [3, 3, 6, 10, 14],
  illusionniste: [3, 3, 6, 10, 14],
  elements: [3, 3, 6, 11, 17],
  ombre: [3, 6, 11, 17],
  paume: [3, 6, 11, 17],
  archifee: [3, 3, 6, 10, 14],
  celeste: [3, 3, 6, 10, 14],
  fielon: [3, 3, 6, 10, 14],
  grandAncien: [3, 3, 3, 6, 10, 10, 14],
  anciens: [3, 3, 7, 15, 20],
  devotion: [3, 3, 7, 15, 20],
  gloire: [3, 3, 3, 7, 15, 20],
  vengeance: [3, 3, 7, 15, 20],
  belluaire: [3, 7, 11, 15],
  chasseur: [3, 3, 7, 11, 15],
  traqueurTenebres: [3, 3, 3, 7, 11, 15],
  arnaqueurArcanique: [3, 3, 9, 13, 17],
  assassin: [3, 3, 9, 13, 17],
  voleur: [3, 3, 9, 13, 17],
}

/** Pages anglaises d'AideDD : nom anglais de la classe */
const AIDEDD_EN_CLASS: Record<ClassId, string> = {
  barbare: 'barbarian',
  barde: 'bard',
  clerc: 'cleric',
  druide: 'druid',
  ensorceleur: 'sorcerer',
  guerrier: 'fighter',
  magicien: 'wizard',
  moine: 'monk',
  occultiste: 'warlock',
  paladin: 'paladin',
  rodeur: 'ranger',
  roublard: 'rogue',
}

export function subclassesOf(classId: ClassId): SubclassId[] {
  return SUBCLASS_IDS.filter((id) => SUBCLASSES[id].classId === classId)
}

/** Lien AideDD (règles 2024) vers la sous-classe, en français ou en anglais */
export function subclassUrl(id: SubclassId, lang: string): string {
  const { classId, anchor } = SUBCLASSES[id]
  return lang.startsWith('fr')
    ? `https://www.aidedd.org/regles-24/classes/${classId}/#${encodeURIComponent(anchor[0])}`
    : `https://www.aidedd.org/en/${AIDEDD_EN_CLASS[classId]}-2024/#${anchor[1]}`
}

export function isSubclassId(value: unknown): value is SubclassId {
  return typeof value === 'string' && (SUBCLASS_IDS as readonly string[]).includes(value)
}

/** Sous-classe enregistrée, gardée seulement si elle appartient à la classe */
export function subclassOfClass(raw: unknown, classId: ClassId | null): SubclassId | null {
  return isSubclassId(raw) && classId != null && SUBCLASSES[raw].classId === classId ? raw : null
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
