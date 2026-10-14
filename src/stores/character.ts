import { ref, computed, watch } from 'vue'
import { defineStore } from 'pinia'
import {
  type Ability,
  type Skill,
  ABILITIES,
  SKILLS,
  SKILL_ABILITY,
  abilityModifier,
  proficiencyBonus,
  passiveScore,
} from '@/utils/dnd'
import { useConditionsStore } from '@/stores/conditions'
import { useInventoryStore } from '@/stores/inventory'
import type { ModifierType } from '@/stores/inventory'

const STORAGE_KEY = 'echec-critique-character'

const EQUIP_TO_ABILITY: Partial<Record<ModifierType, Ability>> = {
  force: 'str',
  dexterite: 'dex',
  constitution: 'con',
  intelligence: 'int',
  sagesse: 'wis',
  charisme: 'cha',
}

export type SkillRank = 'none' | 'proficient' | 'expertise'

export interface CharacterPersisted {
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
  hpTempExpiresAt: number | null
  inspiration: number
  armorClassBase: number
  speedBase: number
  /** Bonus d'initiative hors Dex et équipement (dons, capacités…) */
  initiativeBonus: number
  /** Jets contre la mort (0 à 3 chacun), remis à zéro dès qu'on regagne des PV */
  deathSaveSuccesses: number
  deathSaveFailures: number
}

function defaultAbilityScores(): Record<Ability, number> {
  return { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 }
}

function defaultProficiencies(): Record<Ability, boolean> {
  return Object.fromEntries(ABILITIES.map((k) => [k, false])) as Record<Ability, boolean>
}

function defaultSkillRanks(): Record<Skill, SkillRank> {
  return Object.fromEntries(SKILLS.map((k) => [k, 'none'])) as Record<Skill, SkillRank>
}

function mergeAbilityScores(raw?: Partial<Record<Ability, number>>): Record<Ability, number> {
  const base = defaultAbilityScores()
  if (!raw) return base
  for (const ab of ABILITIES) {
    const v = raw[ab]
    if (typeof v === 'number' && Number.isFinite(v)) {
      base[ab] = Math.max(1, Math.min(30, Math.round(v)))
    }
  }
  return base
}

function mergeSavingThrows(raw?: Partial<Record<Ability, boolean>>): Record<Ability, boolean> {
  const base = defaultProficiencies()
  if (!raw) return base
  for (const ab of ABILITIES) {
    if (typeof raw[ab] === 'boolean') base[ab] = raw[ab]!
  }
  return base
}

function mergeSkillRanks(raw?: Partial<Record<Skill, SkillRank>>): Record<Skill, SkillRank> {
  const base = defaultSkillRanks()
  if (!raw) return base
  for (const skill of SKILLS) {
    const rank = raw[skill]
    if (rank === 'none' || rank === 'proficient' || rank === 'expertise') {
      base[skill] = rank
    }
  }
  return base
}

function loadCharacter(): CharacterPersisted {
  const defaults: CharacterPersisted = {
    name: '',
    level: 1,
    characterClass: '',
    species: '',
    abilityScores: defaultAbilityScores(),
    savingThrowProficiency: defaultProficiencies(),
    skillRank: defaultSkillRanks(),
    hpCurrent: 10,
    hpMax: 10,
    hpTemp: 0,
    hpTempExpiresAt: null,
    inspiration: 0,
    armorClassBase: 10,
    speedBase: 9,
    initiativeBonus: 0,
    deathSaveSuccesses: 0,
    deathSaveFailures: 0,
  }

  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return defaults
    const parsed = JSON.parse(raw) as Partial<CharacterPersisted>
    const hpMax = Math.max(1, Number(parsed.hpMax) || defaults.hpMax)
    let hpTemp = Math.max(0, Number(parsed.hpTemp) || 0)
    let hpTempExpiresAt = typeof parsed.hpTempExpiresAt === 'number' ? parsed.hpTempExpiresAt : null
    if (hpTemp > 0 && hpTempExpiresAt != null && hpTempExpiresAt <= Date.now()) {
      hpTemp = 0
      hpTempExpiresAt = null
    }

    return {
      name: typeof parsed.name === 'string' ? parsed.name : defaults.name,
      level: Math.max(1, Math.min(20, Math.round(Number(parsed.level) || 1))),
      characterClass:
        typeof parsed.characterClass === 'string' ? parsed.characterClass : defaults.characterClass,
      species: typeof parsed.species === 'string' ? parsed.species : defaults.species,
      abilityScores: mergeAbilityScores(parsed.abilityScores),
      savingThrowProficiency: mergeSavingThrows(parsed.savingThrowProficiency),
      skillRank: mergeSkillRanks(parsed.skillRank),
      hpMax,
      hpCurrent: Math.max(0, Math.min(hpMax, Number(parsed.hpCurrent) || 0)),
      hpTemp,
      hpTempExpiresAt,
      inspiration: Math.max(0, Math.round(Number(parsed.inspiration) || 0)),
      armorClassBase: Math.max(0, Number(parsed.armorClassBase) || defaults.armorClassBase),
      speedBase: Math.max(0, Number(parsed.speedBase) || defaults.speedBase),
      initiativeBonus: Math.round(Number(parsed.initiativeBonus) || 0),
      deathSaveSuccesses: clampDeathSave(parsed.deathSaveSuccesses),
      deathSaveFailures: clampDeathSave(parsed.deathSaveFailures),
    }
  } catch {
    return defaults
  }
}

function persistCharacter(state: CharacterPersisted) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    /* ignore quota / private mode */
  }
}

function clampDeathSave(value: unknown): number {
  return Math.max(0, Math.min(3, Math.round(Number(value) || 0)))
}

export type DeathSaveEvent = 'success' | 'failure' | 'nat20' | 'nat1' | 'hit' | 'crit'

export const useCharacterStore = defineStore('character', () => {
  const saved = loadCharacter()

  const name = ref(saved.name)
  const level = ref(saved.level)
  const characterClass = ref(saved.characterClass)
  const species = ref(saved.species)
  const abilityScores = ref(saved.abilityScores)
  const savingThrowProficiency = ref(saved.savingThrowProficiency)
  const skillRank = ref(saved.skillRank)
  const hpCurrent = ref(saved.hpCurrent)
  const hpMax = ref(saved.hpMax)
  const hpTemp = ref(saved.hpTemp)
  const hpTempExpiresAt = ref<number | null>(saved.hpTempExpiresAt)
  const inspiration = ref(saved.inspiration)
  const armorClassBase = ref(saved.armorClassBase)
  const speedBase = ref(saved.speedBase)
  const initiativeBonus = ref(saved.initiativeBonus)
  const deathSaveSuccesses = ref(saved.deathSaveSuccesses)
  const deathSaveFailures = ref(saved.deathSaveFailures)

  const inventory = useInventoryStore()
  const conditions = useConditionsStore()

  const profBonus = computed(() => proficiencyBonus(level.value))

  function abilityBonusFrom(totals: Partial<Record<ModifierType, number>>) {
    const bonus: Partial<Record<Ability, number>> = {}
    for (const [equipType, ability] of Object.entries(EQUIP_TO_ABILITY) as [
      ModifierType,
      Ability,
    ][]) {
      const val = totals[equipType]
      if (val) bonus[ability] = (bonus[ability] ?? 0) + val
    }
    return bonus
  }

  const equipmentAbilityBonus = computed(() => abilityBonusFrom(inventory.totalModifiers))
  /** Bonus de score venant des états temporaires */
  const conditionAbilityBonus = computed(() => abilityBonusFrom(conditions.totalModifiers))

  /** Équipement + états temporaires, par type de modificateur */
  function bonus(type: ModifierType): number {
    return (inventory.totalModifiers[type] ?? 0) + (conditions.totalModifiers[type] ?? 0)
  }

  function effectiveScore(ability: Ability): number {
    return (
      abilityScores.value[ability] +
      (equipmentAbilityBonus.value[ability] ?? 0) +
      (conditionAbilityBonus.value[ability] ?? 0)
    )
  }

  function abilityMod(ability: Ability): number {
    return abilityModifier(effectiveScore(ability))
  }

  const armorClass = computed(() => armorClassBase.value + bonus('ca'))

  const initiative = computed(() => abilityMod('dex') + initiativeBonus.value + bonus('initiative'))

  /** Vitesse sans les effets « vitesse 0 » / multiplicateurs des états */
  const speedBeforeConditions = computed(() => Math.max(0, speedBase.value + bonus('vitesse')))

  const speed = computed(() => {
    if (conditions.speedZero) return 0
    // Arrondi au 1,5 m (une case) inférieur
    return Math.floor((speedBeforeConditions.value * conditions.speedFactor) / 1.5 + 1e-9) * 1.5
  })

  function savingThrowBonus(ability: Ability): number {
    const base = abilityMod(ability) + bonus('sauvegardes')
    return savingThrowProficiency.value[ability] ? base + profBonus.value : base
  }

  function skillProficiencyMultiplier(skill: Skill): number {
    const rank = skillRank.value[skill]
    if (rank === 'expertise') return 2
    if (rank === 'proficient') return 1
    return 0
  }

  function skillBonus(skill: Skill): number {
    const ability = SKILL_ABILITY[skill]
    return (
      abilityMod(ability) +
      skillProficiencyMultiplier(skill) * profBonus.value +
      bonus('competences')
    )
  }

  const passivePerception = computed(() => passiveScore(skillBonus('perception')))

  function setAbilityScore(ability: Ability, score: number) {
    abilityScores.value[ability] = Math.max(1, Math.min(30, score))
  }

  function adjustAbility(ability: Ability, delta: number) {
    setAbilityScore(ability, abilityScores.value[ability] + delta)
  }

  function toggleSavingThrow(ability: Ability) {
    savingThrowProficiency.value[ability] = !savingThrowProficiency.value[ability]
  }

  function cycleSkillRank(skill: Skill) {
    const next: Record<SkillRank, SkillRank> = {
      none: 'proficient',
      proficient: 'expertise',
      expertise: 'none',
    }
    skillRank.value[skill] = next[skillRank.value[skill]]
  }

  /**
   * Variation de PV : les dégâts entament d'abord les PV temporaires,
   * et ce qui dépasse le max (soin, saisie) devient des PV temporaires.
   */
  function adjustHp(delta: number) {
    let current = hpCurrent.value
    let temp = hpTemp.value
    if (delta < 0) {
      const absorbed = Math.min(temp, -delta)
      temp -= absorbed
      current = Math.max(0, current + delta + absorbed)
    } else {
      const healed = Math.min(Math.max(0, hpMax.value - current), delta)
      current += healed
      temp += delta - healed
    }
    hpCurrent.value = current
    setHpTemp(temp)
  }

  function adjustInspiration(delta: number) {
    inspiration.value = Math.max(0, inspiration.value + delta)
  }

  const hpTempRemainingMs = computed(() => {
    if (!hpTempExpiresAt.value || hpTemp.value <= 0) return 0
    return Math.max(0, hpTempExpiresAt.value - Date.now())
  })

  function setHpTemp(amount: number, durationMinutes?: number | null) {
    const next = Math.max(0, Math.floor(amount))
    hpTemp.value = next
    if (next <= 0) {
      hpTempExpiresAt.value = null
      return
    }
    if (durationMinutes == null) return
    if (durationMinutes <= 0) {
      hpTempExpiresAt.value = null
      return
    }
    hpTempExpiresAt.value = Date.now() + durationMinutes * 60_000
  }

  function setHpTempDurationMinutes(minutes: number) {
    if (hpTemp.value <= 0) {
      hpTempExpiresAt.value = null
      return
    }
    if (minutes <= 0) {
      hpTempExpiresAt.value = null
      return
    }
    hpTempExpiresAt.value = Date.now() + minutes * 60_000
  }

  function clearExpiredHpTemp() {
    if (hpTemp.value <= 0) return
    if (hpTempExpiresAt.value != null && hpTempExpiresAt.value <= Date.now()) {
      hpTemp.value = 0
      hpTempExpiresAt.value = null
    }
  }

  function exportSnapshot(): CharacterPersisted {
    return {
      name: name.value,
      level: level.value,
      characterClass: characterClass.value,
      species: species.value,
      abilityScores: { ...abilityScores.value },
      savingThrowProficiency: { ...savingThrowProficiency.value },
      skillRank: { ...skillRank.value },
      hpCurrent: hpCurrent.value,
      hpMax: hpMax.value,
      hpTemp: hpTemp.value,
      hpTempExpiresAt: hpTempExpiresAt.value,
      inspiration: inspiration.value,
      armorClassBase: armorClassBase.value,
      speedBase: speedBase.value,
      initiativeBonus: initiativeBonus.value,
      deathSaveSuccesses: deathSaveSuccesses.value,
      deathSaveFailures: deathSaveFailures.value,
    }
  }

  function applySnapshot(data: Partial<CharacterPersisted>) {
    if (data.name !== undefined) name.value = data.name
    if (data.level !== undefined) level.value = data.level
    if (data.characterClass !== undefined) characterClass.value = data.characterClass
    if (data.species !== undefined) species.value = data.species
    if (data.abilityScores !== undefined) {
      abilityScores.value = mergeAbilityScores(data.abilityScores)
    }
    if (data.savingThrowProficiency !== undefined) {
      savingThrowProficiency.value = mergeSavingThrows(data.savingThrowProficiency)
    }
    if (data.skillRank !== undefined) {
      skillRank.value = mergeSkillRanks(data.skillRank)
    }
    if (data.hpMax !== undefined) hpMax.value = Math.max(1, data.hpMax)
    if (data.hpCurrent !== undefined) {
      hpCurrent.value = Math.max(0, Math.min(hpMax.value, data.hpCurrent))
    }
    if (data.hpTemp !== undefined) hpTemp.value = Math.max(0, data.hpTemp)
    if (data.hpTempExpiresAt !== undefined) hpTempExpiresAt.value = data.hpTempExpiresAt
    if (data.inspiration !== undefined) inspiration.value = Math.max(0, data.inspiration)
    if (data.armorClassBase !== undefined) armorClassBase.value = Math.max(0, data.armorClassBase)
    if (data.speedBase !== undefined) speedBase.value = Math.max(0, data.speedBase)
    if (data.initiativeBonus !== undefined)
      initiativeBonus.value = Math.round(Number(data.initiativeBonus) || 0)
    deathSaveSuccesses.value = clampDeathSave(data.deathSaveSuccesses)
    deathSaveFailures.value = clampDeathSave(data.deathSaveFailures)
    deathSaveUndo.value = []
  }

  /** Boutons −/+ du mode édition : CA et initiative par 1, vitesse par case (1,5 m) */
  function adjustArmorClassBase(delta: number) {
    armorClassBase.value = Math.max(0, armorClassBase.value + delta)
  }

  function adjustInitiativeBonus(delta: number) {
    initiativeBonus.value = Math.max(-10, Math.min(20, initiativeBonus.value + delta))
  }

  function adjustSpeedBase(steps: number) {
    speedBase.value = Math.max(0, Math.round((speedBase.value + steps * 1.5) * 10) / 10)
  }

  /* Jets contre la mort (règles 2024) : le joueur lance le d20, l'app tient le compte */
  const isDying = computed(() => hpCurrent.value <= 0)
  const isStable = computed(() => isDying.value && deathSaveSuccesses.value >= 3)
  const isDead = computed(() => isDying.value && deathSaveFailures.value >= 3)
  /** Annulation des dernières saisies (en mémoire seulement) */
  const deathSaveUndo = ref<{ successes: number; failures: number }[]>([])

  function recordDeathSave(event: DeathSaveEvent) {
    if (!isDying.value || isDead.value) return
    if (event === 'nat20') {
      // 20 naturel : on reprend 1 PV, ce qui remet les compteurs à zéro (watch ci-dessous)
      adjustHp(1)
      return
    }
    // Stabilisé : un nouveau coup reçu fait repartir les jets, un jet n'a plus lieu d'être
    if (isStable.value && event !== 'hit' && event !== 'crit') return
    deathSaveUndo.value = [
      ...deathSaveUndo.value,
      { successes: deathSaveSuccesses.value, failures: deathSaveFailures.value },
    ].slice(-10)
    if (isStable.value) deathSaveSuccesses.value = 0
    if (event === 'success') deathSaveSuccesses.value = Math.min(3, deathSaveSuccesses.value + 1)
    const failures =
      { failure: 1, nat1: 2, hit: 1, crit: 2 }[event as 'failure' | 'nat1' | 'hit' | 'crit'] ?? 0
    deathSaveFailures.value = Math.min(3, deathSaveFailures.value + failures)
  }

  function undoDeathSave() {
    const previous = deathSaveUndo.value[deathSaveUndo.value.length - 1]
    if (!previous) return
    deathSaveUndo.value = deathSaveUndo.value.slice(0, -1)
    deathSaveSuccesses.value = previous.successes
    deathSaveFailures.value = previous.failures
  }

  function resetDeathSaves() {
    deathSaveSuccesses.value = 0
    deathSaveFailures.value = 0
    deathSaveUndo.value = []
  }

  // Regagner des PV (soin, 20 naturel, saisie) met fin à l'agonie
  watch(hpCurrent, (hp) => {
    if (hp > 0 && (deathSaveSuccesses.value || deathSaveFailures.value)) resetDeathSaves()
  })

  function resetCharacter() {
    name.value = ''
    level.value = 1
    characterClass.value = ''
    species.value = ''
    abilityScores.value = defaultAbilityScores()
    savingThrowProficiency.value = defaultProficiencies()
    skillRank.value = defaultSkillRanks()
    hpCurrent.value = 10
    hpMax.value = 10
    hpTemp.value = 0
    hpTempExpiresAt.value = null
    inspiration.value = 0
    armorClassBase.value = 10
    speedBase.value = 9
    initiativeBonus.value = 0
    resetDeathSaves()
  }

  watch(
    [
      name,
      level,
      characterClass,
      species,
      abilityScores,
      savingThrowProficiency,
      skillRank,
      hpCurrent,
      hpMax,
      hpTemp,
      hpTempExpiresAt,
      inspiration,
      armorClassBase,
      speedBase,
      initiativeBonus,
      deathSaveSuccesses,
      deathSaveFailures,
    ],
    () => {
      persistCharacter({
        name: name.value,
        level: level.value,
        characterClass: characterClass.value,
        species: species.value,
        abilityScores: { ...abilityScores.value },
        savingThrowProficiency: { ...savingThrowProficiency.value },
        skillRank: { ...skillRank.value },
        hpCurrent: hpCurrent.value,
        hpMax: hpMax.value,
        hpTemp: hpTemp.value,
        hpTempExpiresAt: hpTempExpiresAt.value,
        inspiration: inspiration.value,
        armorClassBase: armorClassBase.value,
        speedBase: speedBase.value,
        initiativeBonus: initiativeBonus.value,
        deathSaveSuccesses: deathSaveSuccesses.value,
        deathSaveFailures: deathSaveFailures.value,
      })
    },
    { deep: true },
  )

  return {
    name,
    level,
    characterClass,
    species,
    abilityScores,
    savingThrowProficiency,
    skillRank,
    hpCurrent,
    hpMax,
    hpTemp,
    hpTempExpiresAt,
    hpTempRemainingMs,
    inspiration,
    armorClassBase,
    speedBase,
    initiativeBonus,
    deathSaveSuccesses,
    deathSaveFailures,
    deathSaveUndo,
    isDying,
    isStable,
    isDead,
    recordDeathSave,
    undoDeathSave,
    resetDeathSaves,
    adjustArmorClassBase,
    adjustInitiativeBonus,
    adjustSpeedBase,
    profBonus,
    equipmentAbilityBonus,
    conditionAbilityBonus,
    speedBeforeConditions,
    effectiveScore,
    abilityMod,
    armorClass,
    initiative,
    speed,
    savingThrowBonus,
    skillBonus,
    skillProficiencyMultiplier,
    passivePerception,
    setAbilityScore,
    adjustAbility,
    toggleSavingThrow,
    cycleSkillRank,
    adjustHp,
    adjustInspiration,
    setHpTemp,
    setHpTempDurationMinutes,
    clearExpiredHpTemp,
    exportSnapshot,
    applySnapshot,
    resetCharacter,
  }
})
