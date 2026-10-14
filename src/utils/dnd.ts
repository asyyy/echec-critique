export type Ability = 'str' | 'dex' | 'con' | 'int' | 'wis' | 'cha'

export type Skill =
  | 'acrobatics'
  | 'animalHandling'
  | 'arcana'
  | 'athletics'
  | 'deception'
  | 'history'
  | 'insight'
  | 'intimidation'
  | 'investigation'
  | 'medicine'
  | 'nature'
  | 'perception'
  | 'performance'
  | 'persuasion'
  | 'religion'
  | 'sleightOfHand'
  | 'stealth'
  | 'survival'

export const ABILITIES: Ability[] = ['str', 'dex', 'con', 'int', 'wis', 'cha']

export const ABILITY_LABELS: Record<Ability, string> = {
  str: 'Force',
  dex: 'Dextérité',
  con: 'Constitution',
  int: 'Intelligence',
  wis: 'Sagesse',
  cha: 'Charisme',
}

export const ABILITY_SHORT: Record<Ability, string> = {
  str: 'FOR',
  dex: 'DEX',
  con: 'CON',
  int: 'INT',
  wis: 'SAG',
  cha: 'CHA',
}

export const SKILL_ABILITY: Record<Skill, Ability> = {
  acrobatics: 'dex',
  animalHandling: 'wis',
  arcana: 'int',
  athletics: 'str',
  deception: 'cha',
  history: 'int',
  insight: 'wis',
  intimidation: 'cha',
  investigation: 'int',
  medicine: 'wis',
  nature: 'int',
  perception: 'wis',
  performance: 'cha',
  persuasion: 'cha',
  religion: 'int',
  sleightOfHand: 'dex',
  stealth: 'dex',
  survival: 'wis',
}

export const SKILL_LABELS: Record<Skill, string> = {
  acrobatics: 'Acrobaties',
  animalHandling: 'Dressage',
  arcana: 'Arcanes',
  athletics: 'Athlétisme',
  deception: 'Tromperie',
  history: 'Histoire',
  insight: 'Intuition',
  intimidation: 'Intimidation',
  investigation: 'Investigation',
  medicine: 'Médecine',
  nature: 'Nature',
  perception: 'Perception',
  performance: 'Représentation',
  persuasion: 'Persuasion',
  religion: 'Religion',
  sleightOfHand: 'Escamotage',
  stealth: 'Discrétion',
  survival: 'Survie',
}

export const SKILLS: Skill[] = Object.keys(SKILL_LABELS) as Skill[]

/** Bonus de maîtrise selon le niveau du personnage */
export function proficiencyBonus(level: number): number {
  return Math.ceil(level / 4) + 1
}

/** Modificateur de caractéristique */
export function abilityModifier(score: number): number {
  return Math.floor((score - 10) / 2)
}

export function formatModifier(value: number): string {
  return value >= 0 ? `+${value}` : `${value}`
}

/** Point de compétence passive (ex. Perception passive) */
export function passiveScore(totalBonus: number): number {
  return 10 + totalBonus
}
