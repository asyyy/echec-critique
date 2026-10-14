import type { Ability } from '@/utils/dnd'

/** Types de dégâts */
export type DamageType =
  | 'tranchant'
  | 'perforant'
  | 'contondant'
  | 'feu'
  | 'froid'
  | 'foudre'
  | 'acide'
  | 'poison'
  | 'necrotique'
  | 'radiant'
  | 'psychique'
  | 'force'
  | 'tonnerre'

export const DAMAGE_TYPES: DamageType[] = [
  'tranchant',
  'perforant',
  'contondant',
  'feu',
  'froid',
  'foudre',
  'acide',
  'poison',
  'necrotique',
  'radiant',
  'psychique',
  'force',
  'tonnerre',
]

export const DAMAGE_TYPE_LABELS: Record<DamageType, string> = {
  tranchant: 'Tranchant',
  perforant: 'Perforant',
  contondant: 'Contondant',
  feu: 'Feu',
  froid: 'Froid',
  foudre: 'Foudre',
  acide: 'Acide',
  poison: 'Poison',
  necrotique: 'Nécrotique',
  radiant: 'Radiant',
  psychique: 'Psychique',
  force: 'Force',
  tonnerre: 'Tonnerre',
}

export const DICE_FACES = [4, 6, 8, 10, 12, 20] as const

export interface DamagePart {
  id: string
  /** Ex. « Épée », « Froid » */
  label: string
  diceCount: number
  diceFaces: number
  flatBonus: number
  damageType: DamageType
  /** Modificateur de caractéristique (généralement l’arme principale uniquement) */
  includeAbilityMod: boolean
}

/** Profil de dégâts stocké sur un objet d’inventaire (arme) */
export interface WeaponDamageProfile {
  id: string
  label: string
  diceCount: number
  diceFaces: number
  flatBonus: number
  damageType: DamageType
}

export interface AttackConfig {
  id: string
  name: string
  /** Caractéristique utilisée pour l’attaque et le mod. de dégâts */
  ability: Ability
  proficient: boolean
  /** Nombre d’attaques à lancer (Extra Attack, etc.) */
  attackCount: number
  /** Bonus d’attaque additionnel (arme +1, etc.) — hors équipement inventaire */
  attackBonusExtra: number
  /** Inclure les bonus d’attaque de l’équipement / arme liée */
  useEquipmentAttackBonus: boolean
  /** Inclure les bonus de dégâts plats de l’équipement / arme liée */
  useEquipmentDamageBonus: boolean
  /** Arme d’inventaire liée (dés + bonus auto) */
  weaponItemId: string | null
  damageParts: DamagePart[]
}

export function createEmptyDamagePart(partial?: Partial<DamagePart>): DamagePart {
  return {
    id: `part-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    label: 'Arme',
    diceCount: 1,
    diceFaces: 8,
    flatBonus: 0,
    damageType: 'tranchant',
    includeAbilityMod: true,
    ...partial,
  }
}

export function createEmptyWeaponDamage(
  partial?: Partial<WeaponDamageProfile>,
): WeaponDamageProfile {
  return {
    id: `wdmg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    label: 'Arme',
    diceCount: 1,
    diceFaces: 8,
    flatBonus: 0,
    damageType: 'tranchant',
    ...partial,
  }
}

export function weaponDamageToParts(
  profiles: WeaponDamageProfile[],
  weaponName?: string,
): DamagePart[] {
  if (!profiles.length) {
    return [
      createEmptyDamagePart({
        label: weaponName || 'Arme',
        includeAbilityMod: true,
      }),
    ]
  }
  return profiles.map((p, i) =>
    createEmptyDamagePart({
      label: p.label || (i === 0 ? weaponName || 'Arme' : p.damageType),
      diceCount: p.diceCount,
      diceFaces: p.diceFaces,
      flatBonus: p.flatBonus,
      damageType: p.damageType,
      includeAbilityMod: i === 0,
    }),
  )
}

export function createEmptyAttackConfig(partial?: Partial<AttackConfig>): AttackConfig {
  return {
    id: `cfg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    name: 'Attaque de base',
    ability: 'str',
    proficient: true,
    attackCount: 1,
    attackBonusExtra: 0,
    useEquipmentAttackBonus: true,
    useEquipmentDamageBonus: true,
    weaponItemId: null,
    damageParts: [createEmptyDamagePart({ label: 'Arme', includeAbilityMod: true })],
    ...partial,
  }
}

export function formatDice(count: number, faces: number, flat = 0): string {
  const dice = count > 0 ? `${count}d${faces}` : ''
  if (flat === 0) return dice || '0'
  const sign = flat > 0 ? '+' : ''
  return dice ? `${dice}${sign}${flat}` : `${flat}`
}
