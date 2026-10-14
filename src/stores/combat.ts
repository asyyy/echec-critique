import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { useCharacterStore } from '@/stores/character'
import { useConditionsStore } from '@/stores/conditions'
import { useInventoryStore } from '@/stores/inventory'
import { ABILITY_SHORT, formatModifier, type Ability } from '@/utils/dnd'
import { i18n } from '@/i18n'
import {
  type AttackConfig,
  type DamagePart,
  type DamageType,
  createEmptyAttackConfig,
  createEmptyDamagePart,
  formatDice,
} from '@/utils/combatTypes'

export interface DiceRoll {
  faces: number
  count: number
  result: number[]
}

export interface DamagePartResult {
  partId: string
  label: string
  damageType: DamageType
  dice: DiceRoll | null
  flatBonus: number
  abilityMod: number
  subtotal: number
  /** Dés doublés (critique) */
  wasCritical: boolean
}

export interface SingleAttackResult {
  index: number
  /** Bonus à ajouter au d20 du joueur (l’app ne tire pas le d20) */
  attackBonus: number
  isCriticalHit: boolean
  /** false = le joueur a indiqué un raté → pas de dégâts */
  hit: boolean
  parts: DamagePartResult[]
  damageTotal: number
  /** true dès que le joueur a indiqué l'issue (touché / critique / raté) */
  outcomeChosen?: boolean
  /** Dégâts déjà tirés par issue : repasser sur touché / critique réaffiche le même jet */
  rolled?: Partial<Record<'hit' | 'crit', { parts: DamagePartResult[]; damageTotal: number }>>
}

export interface CombatRollResult {
  id: string
  timestamp: number
  configId: string
  configName: string
  attackCount: number
  attackBonus: number
  attacks: SingleAttackResult[]
  /** Total tous jets ayant touché */
  grandTotal: number
  /** Agrégat par type de dégâts */
  byType: { type: DamageType; total: number }[]
  hits: number
  crits: number
  misses: number
}

const STORAGE_KEY = 'echec-critique-attack-configs'

function normalizeConfig(cfg: AttackConfig): AttackConfig {
  return {
    ...createEmptyAttackConfig(),
    ...cfg,
    weaponItemId: cfg.weaponItemId ?? null,
    damageParts:
      Array.isArray(cfg.damageParts) && cfg.damageParts.length
        ? cfg.damageParts.map((p) => ({ ...createEmptyDamagePart(), ...p }))
        : [createEmptyDamagePart()],
  }
}

function loadConfigs(): AttackConfig[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as AttackConfig[]
    return Array.isArray(parsed) ? parsed.map(normalizeConfig) : []
  } catch {
    return []
  }
}

function persistConfigs(configs: AttackConfig[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(configs))
  } catch {
    /* ignore */
  }
}

function rollDice(faces: number, count: number): DiceRoll {
  const result: number[] = []
  for (let i = 0; i < count; i++) {
    result.push(Math.floor(Math.random() * faces) + 1)
  }
  return { faces, count, result }
}

let resultId = 1

/** Au-delà de ce délai sans jet (ou app en arrière-plan), on considère qu'une nouvelle séance commence */
const HISTORY_IDLE_MS = 2 * 60 * 60 * 1000

export const useCombatStore = defineStore('combat', () => {
  const configs = ref<AttackConfig[]>(loadConfigs())
  const lastResult = ref<CombatRollResult | null>(null)
  const history = ref<CombatRollResult[]>([])

  // Purge au retour dans l'app après une longue absence (pas à chaque mise en veille de l'écran)
  let hiddenAt: number | null = null
  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        hiddenAt = Date.now()
      } else if (hiddenAt != null) {
        if (Date.now() - hiddenAt > HISTORY_IDLE_MS) clearHistory()
        hiddenAt = null
      }
    })
  }

  const character = useCharacterStore()
  const inventory = useInventoryStore()

  const conditions = useConditionsStore()

  const equipmentAttackBonus = computed(() => inventory.totalModifiers.attaque ?? 0)
  const equipmentDamageBonus = computed(() => inventory.totalModifiers.degats ?? 0)
  /** États temporaires : s'appliquent à toutes les attaques, arme liée ou non */
  const conditionAttackBonus = computed(() => conditions.totalModifiers.attaque ?? 0)
  const conditionDamageBonus = computed(() => conditions.totalModifiers.degats ?? 0)

  /** Bonus attaque : arme liée si présente, sinon total équipé */
  function configEquipmentAttack(config: AttackConfig): number {
    if (!config.useEquipmentAttackBonus) return 0
    if (config.weaponItemId) {
      return inventory.itemModifierTotal(config.weaponItemId, 'attaque')
    }
    return equipmentAttackBonus.value
  }

  /** Bonus dégâts plats : arme liée si présente, sinon total équipé */
  function configEquipmentDamage(config: AttackConfig): number {
    if (!config.useEquipmentDamageBonus) return 0
    if (config.weaponItemId) {
      return inventory.itemModifierTotal(config.weaponItemId, 'degats')
    }
    return equipmentDamageBonus.value
  }

  function resolveAttackBonus(config: AttackConfig): {
    total: number
    abilityMod: number
    proficiency: number
    equipment: number
    conditions: number
    extra: number
  } {
    const abilityMod = character.abilityMod(config.ability)
    const proficiency = config.proficient ? character.profBonus : 0
    const equipment = configEquipmentAttack(config)
    const conditionsBonus = conditionAttackBonus.value
    const extra = config.attackBonusExtra
    return {
      abilityMod,
      proficiency,
      equipment,
      conditions: conditionsBonus,
      extra,
      total: abilityMod + proficiency + equipment + conditionsBonus + extra,
    }
  }

  function damageFormulaPreview(config: AttackConfig): string {
    const tt = i18n.global.t
    const abilityMod = character.abilityMod(config.ability)
    const equipDmg = configEquipmentDamage(config) + conditionDamageBonus.value
    const parts = config.damageParts.map((p, i) => {
      let flat = p.flatBonus
      if (p.includeAbilityMod) flat += abilityMod
      if (i === 0) flat += equipDmg
      const dice = formatDice(p.diceCount, p.diceFaces, flat)
      const typeLabel = tt(`damageTypes.${p.damageType}`)
      return `${dice} ${typeLabel}${p.label ? ` (${p.label})` : ''}`
    })
    return parts.join(' + ')
  }

  function toHitPreview(config: AttackConfig): string {
    const tt = i18n.global.t
    const atk = resolveAttackBonus(config)
    const count = Math.max(1, config.attackCount)
    if (count === 1) {
      return `d20 ${formatModifier(atk.total)} ${tt('combat.toHitShort')}`
    }
    return `${count}× d20 ${formatModifier(atk.total)} ${tt('combat.toHitShort')}`
  }

  function rollDamagePart(
    part: DamagePart,
    abilityMod: number,
    equipmentFlat: number,
    isCritical: boolean,
  ): DamagePartResult {
    // Critique : doubler le nombre de dés de dégâts (pas les modificateurs)
    const diceCount = isCritical ? part.diceCount * 2 : part.diceCount
    const dice = diceCount > 0 ? rollDice(part.diceFaces, diceCount) : null
    const diceSum = dice?.result.reduce((a, b) => a + b, 0) ?? 0
    const ability = part.includeAbilityMod ? abilityMod : 0
    const flat = part.flatBonus + ability + equipmentFlat
    const subtotal = Math.max(0, diceSum + flat)

    return {
      partId: part.id,
      label: part.label,
      damageType: part.damageType,
      dice,
      flatBonus: part.flatBonus + equipmentFlat,
      abilityMod: ability,
      subtotal,
      wasCritical: isCritical && part.diceCount > 0,
    }
  }

  function buildAttackDamage(
    config: AttackConfig,
    index: number,
    attackBonus: number,
    outcome: 'hit' | 'crit' | 'miss',
    previous?: SingleAttackResult,
  ): SingleAttackResult {
    const rolled = { ...previous?.rolled }
    const isCriticalHit = outcome === 'crit'
    const hit = outcome !== 'miss'

    if (hit && !rolled[outcome]) {
      const abilityMod = character.abilityMod(config.ability)
      const equipDmg = configEquipmentDamage(config) + conditionDamageBonus.value
      const parts = config.damageParts.map((part, partIndex) =>
        rollDamagePart(part, abilityMod, partIndex === 0 ? equipDmg : 0, isCriticalHit),
      )
      rolled[outcome] = { parts, damageTotal: parts.reduce((s, p) => s + p.subtotal, 0) }
    }

    const damage = hit ? rolled[outcome]! : { parts: [], damageTotal: 0 }

    return {
      index,
      attackBonus,
      isCriticalHit,
      hit,
      parts: damage.parts,
      damageTotal: damage.damageTotal,
      rolled,
    }
  }

  function summarizeResult(result: CombatRollResult): CombatRollResult {
    const byTypeMap = new Map<DamageType, number>()
    for (const atk of result.attacks) {
      for (const part of atk.parts) {
        byTypeMap.set(part.damageType, (byTypeMap.get(part.damageType) ?? 0) + part.subtotal)
      }
    }
    return {
      ...result,
      grandTotal: result.attacks.reduce((s, a) => s + a.damageTotal, 0),
      byType: [...byTypeMap.entries()].map(([type, total]) => ({ type, total })),
      hits: result.attacks.filter((a) => a.hit).length,
      crits: result.attacks.filter((a) => a.isCriticalHit).length,
      misses: result.attacks.filter((a) => !a.hit).length,
    }
  }

  function persistResult(result: CombatRollResult) {
    const summarized = summarizeResult(result)
    lastResult.value = summarized
    const idx = history.value.findIndex((h) => h.id === summarized.id)
    if (idx >= 0) {
      history.value[idx] = summarized
    } else {
      const latest = history.value[0]
      if (latest && summarized.timestamp - latest.timestamp > HISTORY_IDLE_MS) history.value = []
      history.value.unshift(summarized)
      if (history.value.length > 30) history.value = history.value.slice(0, 30)
    }
    return summarized
  }

  /** Lance les dégâts uniquement — le d20 toucher reste au joueur */
  function rollConfig(configId: string): CombatRollResult | null {
    const config = configs.value.find((c) => c.id === configId)
    if (!config) return null

    const atkBonus = resolveAttackBonus(config)
    const attackCount = Math.max(1, config.attackCount)
    const attacks: SingleAttackResult[] = []

    for (let i = 0; i < attackCount; i++) {
      attacks.push(buildAttackDamage(config, i + 1, atkBonus.total, 'hit'))
    }

    return persistResult({
      id: `roll-${resultId++}`,
      timestamp: Date.now(),
      configId: config.id,
      configName: config.name,
      attackCount,
      attackBonus: atkBonus.total,
      attacks,
      grandTotal: 0,
      byType: [],
      hits: 0,
      crits: 0,
      misses: 0,
    })
  }

  /** Après le d20 du joueur : normal / critique / raté → dégâts de cette attaque (tirés une seule fois par issue) */
  function setAttackOutcome(
    resultId: string,
    attackIndex: number,
    outcome: 'hit' | 'crit' | 'miss',
  ): CombatRollResult | null {
    const current =
      lastResult.value?.id === resultId
        ? lastResult.value
        : history.value.find((h) => h.id === resultId)
    if (!current) return null
    const config = configs.value.find((c) => c.id === current.configId)
    if (!config) return null

    const attacks = current.attacks.map((atk) =>
      atk.index === attackIndex
        ? {
            ...buildAttackDamage(config, atk.index, current.attackBonus, outcome, atk),
            outcomeChosen: true,
          }
        : atk,
    )

    return persistResult({ ...current, attacks })
  }

  function addConfig(config: Omit<AttackConfig, 'id'> | AttackConfig) {
    const full = normalizeConfig({
      ...createEmptyAttackConfig(),
      ...config,
      id: 'id' in config && config.id ? config.id : createEmptyAttackConfig().id,
    } as AttackConfig)
    configs.value.push(full)
    persistConfigs(configs.value)
    return full
  }

  function updateConfig(id: string, patch: Partial<AttackConfig>) {
    const idx = configs.value.findIndex((c) => c.id === id)
    if (idx === -1) return
    configs.value[idx] = { ...configs.value[idx]!, ...patch, id }
    persistConfigs(configs.value)
  }

  function removeConfig(id: string) {
    configs.value = configs.value.filter((c) => c.id !== id)
    persistConfigs(configs.value)
  }

  /** Annulation d'une suppression : la config revient à sa place */
  function restoreConfig(config: AttackConfig, index: number) {
    if (configs.value.some((c) => c.id === config.id)) return
    const next = [...configs.value]
    next.splice(Math.min(index, next.length), 0, config)
    configs.value = next
    persistConfigs(configs.value)
  }

  function replaceConfigs(next: AttackConfig[]) {
    configs.value = next.map((c) => normalizeConfig(c))
    persistConfigs(configs.value)
  }

  function clearConfigs() {
    configs.value = []
    persistConfigs(configs.value)
  }

  function clearHistory() {
    history.value = []
    lastResult.value = null
  }

  function showResult(result: CombatRollResult) {
    lastResult.value = result
  }

  function abilityLabel(ability: Ability): string {
    return ABILITY_SHORT[ability]
  }

  return {
    configs,
    lastResult,
    history,
    equipmentAttackBonus,
    equipmentDamageBonus,
    resolveAttackBonus,
    damageFormulaPreview,
    toHitPreview,
    rollConfig,
    setAttackOutcome,
    addConfig,
    updateConfig,
    removeConfig,
    restoreConfig,
    replaceConfigs,
    clearConfigs,
    clearHistory,
    showResult,
    abilityLabel,
    formatModifier,
  }
})
