<script setup lang="ts">
import { computed, onDeactivated, onMounted, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useCharacterStore } from '@/stores/character'
import { useInventoryStore, type ModifierType } from '@/stores/inventory'
import {
  ABILITIES,
  SKILLS,
  SKILL_ABILITY,
  formatModifier,
  type Ability,
  type Skill,
} from '@/utils/dnd'
import { useTooltip } from '@/composables/useTooltip'
import { usePressGestures } from '@/composables/usePressGestures'
import InfoTip from '@/components/InfoTip.vue'
import ConditionsBar from '@/components/ConditionsBar.vue'
import { conditionModifiers, useConditionsStore } from '@/stores/conditions'
import { useConditionLabel } from '@/composables/useConditionLabel'

const { t, locale } = useI18n()
const char = useCharacterStore()
const inventory = useInventoryStore()
const conditions = useConditionsStore()
const conditionLabel = useConditionLabel()
const isEditing = ref(false)
const now = ref(Date.now())
let tickId: number | undefined

type CombatStatKey = 'ac' | 'initiative' | 'speed' | 'proficiency' | 'hp' | 'inspiration'

type InfoTarget =
  | { kind: 'ability'; key: Ability }
  | { kind: 'skill'; key: Skill }
  | { kind: 'save'; key: Ability }
  | { kind: 'combat'; key: CombatStatKey }

const { tooltip, close: closeTooltip, toggle: toggleTooltip } = useTooltip<InfoTarget>(160)

const displayName = computed(() => char.name.trim() || t('common.unnamed'))

const sortedSkills = computed(() =>
  [...SKILLS].sort((a, b) => t(`skills.${a}`).localeCompare(t(`skills.${b}`), locale.value)),
)

/** Mapping caractéristique → type de modificateur d’équipement */
const ABILITY_TO_EQUIP: Record<Ability, ModifierType> = {
  str: 'force',
  dex: 'dexterite',
  con: 'constitution',
  int: 'intelligence',
  wis: 'sagesse',
  cha: 'charisme',
}

interface BonusLine {
  name: string
  type: ModifierType
  value: number
}

/** Types de modificateurs qui comptent pour la stat affichée dans la bulle */
function tooltipModifierTypes(target: InfoTarget): ModifierType[] {
  if (target.kind === 'ability') return [ABILITY_TO_EQUIP[target.key]]
  if (target.kind === 'skill') return [ABILITY_TO_EQUIP[SKILL_ABILITY[target.key]], 'competences']
  if (target.kind === 'save') return [ABILITY_TO_EQUIP[target.key], 'sauvegardes']
  if (target.key === 'ac') return ['ca']
  if (target.key === 'initiative') return ['initiative']
  if (target.key === 'speed') return ['vitesse']
  return []
}

/** Une ligne par source et par type (objet équipé ou état) */
function bonusLines(
  sources: { name: string; modifiers: { type: ModifierType; value: number }[] }[],
  types: ModifierType[],
): BonusLine[] {
  const out: BonusLine[] = []
  for (const source of sources) {
    for (const type of types) {
      const value = source.modifiers
        .filter((m) => m.type === type)
        .reduce((sum, m) => sum + m.value, 0)
      if (value !== 0) out.push({ name: source.name, type, value })
    }
  }
  return out
}

function formatBonusLine(line: BonusLine, withType: boolean) {
  const sign = line.value >= 0 ? '+' : '−'
  const n = Math.abs(line.value).toLocaleString(locale.value, { maximumFractionDigits: 1 })
  const unit = line.type === 'vitesse' ? ' m' : ''
  return withType
    ? `${line.name} : ${t(`modifiers.${line.type}`)} ${sign}${n}${unit}`
    : `${line.name} (${sign}${n}${unit})`
}

/** Titre de bloc : total seulement si toutes les lignes portent sur le même type */
function bonusBlockTitle(lines: BonusLine[], titleKey: string, plainKey: string) {
  if (new Set(lines.map((l) => l.type)).size > 1) return t(plainKey)
  const total = lines.reduce((sum, l) => sum + l.value, 0)
  const n = total.toLocaleString(locale.value, { maximumFractionDigits: 1 })
  return t(titleKey, { n: total >= 0 ? `+${n}` : `−${n.replace('-', '')}` })
}

const hasTempHp = computed(() => char.hpTemp > 0)

const hpCurrentTone = computed(() => {
  if (char.hpMax <= 0 || char.hpCurrent <= 0) return 'critical'
  const ratio = char.hpCurrent / char.hpMax
  if (ratio <= 0.2) return 'critical'
  if (ratio <= 0.45) return 'low'
  if (ratio < 1) return 'mid'
  return 'full'
})

const hpTempRemainingMs = computed(() => {
  if (!hasTempHp.value || char.hpTempExpiresAt == null) return 0
  return Math.max(0, char.hpTempExpiresAt - now.value)
})

const hpTempDurationMinutesEdit = computed({
  get() {
    if (!hasTempHp.value || char.hpTempExpiresAt == null) return 0
    return Math.max(0, Math.ceil((char.hpTempExpiresAt - Date.now()) / 60_000))
  },
  set(minutes: number) {
    char.setHpTempDurationMinutes(Number(minutes) || 0)
  },
})

const hpTempRemainingLabel = computed(() => {
  if (!hasTempHp.value || char.hpTempExpiresAt == null) return ''
  const ms = hpTempRemainingMs.value
  if (ms <= 0) return '0m'
  const totalMin = Math.ceil(ms / 60_000)
  const hours = Math.floor(totalMin / 60)
  const minutes = totalMin % 60
  if (hours > 0) return `${hours}h${minutes > 0 ? ` ${minutes}m` : ''}`
  return `${minutes}m`
})

const tooltipTitle = computed(() => {
  if (!tooltip.value) return ''
  const { target } = tooltip.value
  if (target.kind === 'ability') return t(`abilities.${target.key}`)
  if (target.kind === 'skill') return t(`skills.${target.key}`)
  if (target.kind === 'combat') return t(`stats.tips.${target.key}.title`)
  return t('stats.saveOf', { ability: t(`abilities.${target.key}`) })
})

const tooltipMeta = computed(() => {
  if (!tooltip.value) return ''
  const { target } = tooltip.value
  if (target.kind === 'ability') return t(`abilityShort.${target.key}`)
  if (target.kind === 'combat') return combatStatTotal(target.key)
  // Sauvegardes et compétences : pas de sous-titre
  return ''
})

const tooltipBody = computed(() => {
  if (!tooltip.value) return ''
  const { target } = tooltip.value
  if (target.kind === 'ability') return t(`abilityDescriptions.${target.key}`)
  if (target.kind === 'skill') return t(`skillDescriptions.${target.key}`)
  if (target.kind === 'combat') return t(`stats.tips.${target.key}.body`)
  return t(`saveDescriptions.${target.key}`)
})

const tooltipTypes = computed(() =>
  tooltip.value ? tooltipModifierTypes(tooltip.value.target) : [],
)

const tooltipEquipLines = computed(() => bonusLines(inventory.equippedItems, tooltipTypes.value))

const tooltipConditionLines = computed(() =>
  bonusLines(
    conditions.conditions.map((c) => ({
      name: conditionLabel(c),
      modifiers: conditionModifiers(c),
    })),
    tooltipTypes.value,
  ),
)

/** Plusieurs types dans la bulle (score + bonus direct) : on précise le type sur chaque ligne */
const tooltipMultiType = computed(() => tooltipTypes.value.length > 1)

function combatStatTotal(key: CombatStatKey): string {
  switch (key) {
    case 'ac':
      return t('stats.tips.total', { n: char.armorClass })
    case 'initiative':
      return t('stats.tips.total', { n: formatModifier(char.initiative) })
    case 'speed':
      return t('stats.tips.total', { n: `${char.speed} m` })
    case 'proficiency':
      return t('stats.tips.total', { n: formatModifier(char.profBonus) })
    case 'hp':
      return `${char.hpCurrent} / ${char.hpMax}`
    case 'inspiration':
      return t('stats.tips.total', { n: char.inspiration })
  }
}

/** Détail du calcul (hors équipement, listé à part) */
const tooltipBreakdown = computed(() => {
  const target = tooltip.value?.target
  if (!target || target.kind !== 'combat') return [] as { label: string; value: string }[]
  switch (target.key) {
    case 'ac':
      return [{ label: t('stats.tips.base'), value: String(char.armorClassBase) }]
    case 'initiative': {
      const rows = [
        {
          label: t('stats.tips.abilityMod', { ability: t('abilities.dex') }),
          value: formatModifier(char.abilityMod('dex')),
        },
      ]
      if (char.initiativeBonus) {
        rows.push({
          label: t('stats.tips.initiativeBonus'),
          value: formatModifier(char.initiativeBonus),
        })
      }
      const dexEquip = (char.equipmentAbilityBonus.dex ?? 0) + (char.conditionAbilityBonus.dex ?? 0)
      if (dexEquip) {
        rows.push({
          label: t('stats.tips.dexScoreEquip', { score: char.effectiveScore('dex') }),
          value: formatModifier(dexEquip),
        })
      }
      return rows
    }
    case 'speed': {
      const rows = [{ label: t('stats.tips.base'), value: `${char.speedBase} m` }]
      if (conditions.speedZero) {
        rows.push({ label: t('conditions.speedZero'), value: '0 m' })
      } else if (conditions.speedFactor !== 1) {
        rows.push({
          label: t('conditions.speedFactor', {
            n: conditions.speedFactor.toLocaleString(locale.value, { maximumFractionDigits: 1 }),
          }),
          value: `${char.speedBeforeConditions} → ${char.speed} m`,
        })
      }
      return rows
    }
    case 'proficiency':
      return [{ label: t('stats.tips.level'), value: String(char.level) }]
    case 'hp': {
      const rows = [
        { label: t('stats.tips.hpCurrent'), value: String(char.hpCurrent) },
        { label: t('stats.tips.hpMax'), value: String(char.hpMax) },
      ]
      if (hasTempHp.value) {
        rows.push({
          label: t('stats.tips.hpTemp'),
          value: hpTempRemainingLabel.value
            ? `+${char.hpTemp} (${hpTempRemainingLabel.value})`
            : `+${char.hpTemp}`,
        })
      }
      return rows
    }
    default:
      // Inspiration : pas de détail de calcul
      return []
  }
})

function onCombatStatClick(key: CombatStatKey, event: MouseEvent) {
  openTooltip({ kind: 'combat', key }, event)
}

/* PV : double tap → saisie clavier, appui long → boutons − / + */
const hpQuick = ref<'type' | 'stepper' | null>(null)
const hpDraft = ref('')
/** État des PV à l'ouverture : chaque saisie est appliquée comme un écart par rapport à lui */
let hpSnapshot = { current: 0, temp: 0, expiresAt: null as number | null }
const hpTotal = computed(() => char.hpCurrent + char.hpTemp)
const hpQuickRef = ref<HTMLElement | null>(null)
const hpInputRef = ref<HTMLInputElement | null>(null)
const hpDisplay = computed(() => (hpQuick.value ? hpDraft.value : String(char.hpCurrent)))

function takeHpSnapshot() {
  hpSnapshot = { current: char.hpCurrent, temp: char.hpTemp, expiresAt: char.hpTempExpiresAt }
  hpDraft.value = String(hpTotal.value)
}

function openHpQuick(mode: 'type' | 'stepper') {
  closeTooltip()
  hpQuick.value = mode
  takeHpSnapshot()
  const input = hpInputRef.value
  if (mode === 'type' && input) {
    // Focus synchrone, dans le geste utilisateur : sinon le clavier mobile ne s'ouvre pas
    input.readOnly = false
    input.value = hpDraft.value
    input.focus()
    input.select()
  }
  document.addEventListener('pointerdown', onHpOutside, true)
}

function closeHpQuick() {
  if (!hpQuick.value) return
  hpQuick.value = null
  hpInputRef.value?.blur()
  document.removeEventListener('pointerdown', onHpOutside, true)
}

function onHpOutside(event: PointerEvent) {
  if (!hpQuickRef.value?.contains(event.target as Node)) closeHpQuick()
}

function onHpInput(event: Event) {
  const input = event.target as HTMLInputElement
  const digits = input.value.replace(/\D/g, '').slice(0, 4)
  if (input.value !== digits) input.value = digits
  hpDraft.value = digits
  if (!digits) return
  // Repart de l'état d'ouverture pour que les frappes intermédiaires (« 2 » avant « 25 ») ne laissent pas de trace
  char.hpCurrent = hpSnapshot.current
  char.hpTemp = hpSnapshot.temp
  char.hpTempExpiresAt = hpSnapshot.expiresAt
  char.adjustHp(Number(digits) - (hpSnapshot.current + hpSnapshot.temp))
}

function stepHp(delta: number) {
  char.adjustHp(delta)
  takeHpSnapshot()
}

const hpGestures = usePressGestures({
  onTap: (anchor) => {
    if (!isEditing.value) toggleTooltip({ kind: 'combat', key: 'hp' }, anchor, sameTarget)
  },
  onDoubleTap: () => openHpQuick('type'),
  onLongPress: () => openHpQuick('stepper'),
})

onDeactivated(closeHpQuick)

/* Commentaire aléatoire quand on en est à 2 échecs (tiré à chaque fois qu'on y arrive) */
const DEATH_QUIP_COUNT = 10
/** Le message « cheat code » : la bulle d'aide se moque du joueur tant qu'il est affiché */
const CHEAT_QUIP = 10
const randomQuip = () => Math.floor(Math.random() * DEATH_QUIP_COUNT) + 1
const deathQuipIndex = ref(randomQuip())
watch(
  () => char.deathSaveFailures,
  (failures, previous) => {
    if (failures === 2 && previous !== 2) deathQuipIndex.value = randomQuip()
  },
)
const deathQuip = computed(() =>
  char.deathSaveFailures === 2 && !char.isDead
    ? t(`stats.deathSaves.quip${deathQuipIndex.value}`)
    : '',
)

const deathSaveRuleLines = computed(() =>
  deathQuip.value && deathQuipIndex.value === CHEAT_QUIP
    ? [t('stats.deathSaves.cheatTroll')]
    : deathRules.value,
)

const deathRules = computed(() => [
  t('stats.deathSaves.rule1'),
  t('stats.deathSaves.rule2'),
  t('stats.deathSaves.rule3'),
  t('stats.deathSaves.rule4'),
])

function sameTarget(a: InfoTarget, b: InfoTarget) {
  return a.kind === b.kind && a.key === b.key
}

function hasEquipBonus(ability: Ability): boolean {
  return (
    (char.equipmentAbilityBonus[ability] ?? 0) + (char.conditionAbilityBonus[ability] ?? 0) !== 0
  )
}

function setEditing(next: boolean) {
  isEditing.value = next
  closeTooltip()
  closeHpQuick()
}

function openTooltip(target: InfoTarget, event: MouseEvent) {
  if (isEditing.value) return
  toggleTooltip(target, event.currentTarget as HTMLElement, sameTarget)
}

function onAbilityCardClick(ab: Ability, event: MouseEvent) {
  openTooltip({ kind: 'ability', key: ab }, event)
}

function onSaveClick(ab: Ability, event: MouseEvent) {
  if (isEditing.value) {
    char.toggleSavingThrow(ab)
    return
  }
  openTooltip({ kind: 'save', key: ab }, event)
}

function onSkillClick(skill: Skill, event: MouseEvent) {
  if (isEditing.value) {
    char.cycleSkillRank(skill)
    return
  }
  openTooltip({ kind: 'skill', key: skill }, event)
}

onMounted(() => {
  tickId = window.setInterval(() => {
    now.value = Date.now()
    char.clearExpiredHpTemp()
  }, 15_000)
})

onUnmounted(() => {
  if (tickId != null) window.clearInterval(tickId)
  document.removeEventListener('pointerdown', onHpOutside, true)
})
</script>

<template>
  <div class="sheet" :class="{ editing: isEditing }">
    <!-- En-tête personnage -->
    <section id="search-hero" class="hero search-target">
      <div class="hero-top">
        <div class="hero-identity">
          <template v-if="isEditing">
            <input
              v-model="char.name"
              class="hero-name"
              type="text"
              :placeholder="t('stats.namePlaceholder')"
            />
          </template>
          <h2 v-else class="hero-name-read">{{ displayName }}</h2>
          <span v-if="!isEditing" class="hero-chip">{{ t('stats.level') }} {{ char.level }}</span>
          <span v-if="!isEditing && char.characterClass" class="hero-chip">{{
            char.characterClass
          }}</span>
          <span v-if="!isEditing && char.species" class="hero-chip">{{ char.species }}</span>
        </div>
        <button
          class="edit-toggle"
          :class="{ active: isEditing }"
          @click.stop="setEditing(!isEditing)"
        >
          {{ isEditing ? t('common.done') : t('common.edit') }}
        </button>
      </div>

      <div v-if="isEditing" class="hero-meta">
        <label class="meta-field">
          <span>{{ t('stats.level') }}</span>
          <input v-model.number="char.level" type="number" min="1" max="20" />
        </label>
        <input
          v-model="char.characterClass"
          class="meta-text"
          type="text"
          :placeholder="t('stats.classPlaceholder')"
        />
        <input
          v-model="char.species"
          class="meta-text"
          type="text"
          :placeholder="t('stats.speciesPlaceholder')"
        />
      </div>
    </section>

    <!-- Jets contre la mort : uniquement à 0 PV -->
    <section
      v-if="!isEditing && char.isDying"
      id="search-death-saves"
      class="death-saves search-target"
      :class="{ stable: char.isStable, dead: char.isDead }"
    >
      <div class="death-head">
        <h3 class="section-title title-with-tip">
          {{ t('stats.deathSaves.title') }}
          <InfoTip :title="t('stats.deathSaves.title')" :lines="deathSaveRuleLines" />
        </h3>
        <span class="death-quip" aria-live="polite">{{ deathQuip }}</span>
        <button
          v-if="char.deathSaveUndo.length"
          class="death-undo"
          type="button"
          :aria-label="t('stats.deathSaves.undo')"
          :title="t('stats.deathSaves.undo')"
          @click="char.undoDeathSave()"
        >
          ↶
        </button>
      </div>

      <div class="death-tracks">
        <div class="death-track success" :aria-label="t('stats.deathSaves.successes')">
          <span class="death-track-label">{{ t('stats.deathSaves.successes') }}</span>
          <span class="death-pips">
            <span
              v-for="i in 3"
              :key="`ok-${i}`"
              class="death-pip"
              :class="{ filled: i <= char.deathSaveSuccesses }"
            />
          </span>
        </div>
        <div class="death-track failure" :aria-label="t('stats.deathSaves.failures')">
          <span class="death-track-label">{{ t('stats.deathSaves.failures') }}</span>
          <span class="death-pips">
            <span
              v-for="i in 3"
              :key="`ko-${i}`"
              class="death-pip"
              :class="{ filled: i <= char.deathSaveFailures }"
            />
          </span>
        </div>
      </div>

      <p v-if="char.isDead" class="death-status">{{ t('stats.deathSaves.dead') }}</p>
      <p v-else-if="char.isStable" class="death-status">{{ t('stats.deathSaves.stable') }}</p>

      <div v-if="!char.isDead" class="death-actions">
        <template v-if="!char.isStable">
          <div class="death-row">
            <button
              class="death-btn success"
              type="button"
              @click="char.recordDeathSave('success')"
            >
              {{ t('stats.deathSaves.success') }}
            </button>
            <button
              class="death-btn failure"
              type="button"
              @click="char.recordDeathSave('failure')"
            >
              {{ t('stats.deathSaves.failure') }}
            </button>
          </div>
        </template>
        <div class="death-row chips">
          <template v-if="!char.isStable">
            <button class="death-chip" type="button" @click="char.recordDeathSave('nat20')">
              {{ t('stats.deathSaves.nat20') }}
            </button>
            <button class="death-chip" type="button" @click="char.recordDeathSave('nat1')">
              {{ t('stats.deathSaves.nat1') }}
            </button>
          </template>
          <button class="death-chip" type="button" @click="char.recordDeathSave('hit')">
            {{ t('stats.deathSaves.hit') }}
          </button>
          <button class="death-chip" type="button" @click="char.recordDeathSave('crit')">
            {{ t('stats.deathSaves.crit') }}
          </button>
        </div>
      </div>
    </section>

    <!-- États temporaires (conditions, buffs, debuffs) -->
    <ConditionsBar v-if="!isEditing" />

    <!-- Stats de combat (style fiche 2024) -->
    <section class="combat-strip">
      <div
        id="search-ca"
        class="combat-stat search-target"
        :class="{ tippable: !isEditing }"
        @click.stop="onCombatStatClick('ac', $event)"
      >
        <div class="combat-value">{{ char.armorClass }}</div>
        <div class="combat-label">{{ t('stats.ac') }}</div>
        <div v-if="isEditing" class="stat-stepper">
          <button
            class="insp-btn hit-area"
            type="button"
            :aria-label="t('stats.decrease', { stat: t('stats.ac') })"
            @click.stop="char.adjustArmorClassBase(-1)"
          >
            −
          </button>
          <button
            class="insp-btn hit-area"
            type="button"
            :aria-label="t('stats.increase', { stat: t('stats.ac') })"
            @click.stop="char.adjustArmorClassBase(1)"
          >
            +
          </button>
        </div>
      </div>
      <div
        id="search-initiative"
        class="combat-stat search-target"
        :class="{ tippable: !isEditing }"
        @click.stop="onCombatStatClick('initiative', $event)"
      >
        <div class="combat-value">{{ formatModifier(char.initiative) }}</div>
        <div class="combat-label">{{ t('stats.initiative') }}</div>
        <div v-if="isEditing" class="stat-stepper">
          <button
            class="insp-btn hit-area"
            type="button"
            :aria-label="t('stats.decrease', { stat: t('stats.initiative') })"
            @click.stop="char.adjustInitiativeBonus(-1)"
          >
            −
          </button>
          <button
            class="insp-btn hit-area"
            type="button"
            :aria-label="t('stats.increase', { stat: t('stats.initiative') })"
            @click.stop="char.adjustInitiativeBonus(1)"
          >
            +
          </button>
        </div>
      </div>
      <div
        id="search-speed"
        class="combat-stat search-target"
        :class="{ tippable: !isEditing }"
        @click.stop="onCombatStatClick('speed', $event)"
      >
        <div class="combat-value">{{ char.speed }}<small>m</small></div>
        <div class="combat-label">{{ t('stats.speed') }}</div>
        <div v-if="isEditing" class="stat-stepper">
          <button
            class="insp-btn hit-area"
            type="button"
            :aria-label="t('stats.decrease', { stat: t('stats.speed') })"
            @click.stop="char.adjustSpeedBase(-1)"
          >
            −
          </button>
          <button
            class="insp-btn hit-area"
            type="button"
            :aria-label="t('stats.increase', { stat: t('stats.speed') })"
            @click.stop="char.adjustSpeedBase(1)"
          >
            +
          </button>
        </div>
      </div>
      <div
        id="search-proficiency"
        class="combat-stat accent search-target"
        :class="{ tippable: !isEditing }"
        @click.stop="onCombatStatClick('proficiency', $event)"
      >
        <div class="combat-value">{{ formatModifier(char.profBonus) }}</div>
        <div class="combat-label">{{ t('stats.proficiency') }}</div>
      </div>
    </section>

    <!-- Points de vie + inspiration -->
    <div class="hp-row">
      <section id="search-hp" class="hp-block search-target">
        <template v-if="isEditing">
          <div class="hp-line">
            <span class="hp-label">{{ t('stats.hpShort') }}</span>
            <div class="hp-center">
              <button class="hp-btn" @click="char.adjustHp(-1)">−</button>
              <div class="hp-values">
                <input
                  v-model.number="char.hpCurrent"
                  class="hp-current"
                  :class="`tone-${hpCurrentTone}`"
                  type="number"
                  min="0"
                  :max="char.hpMax"
                />
                <span class="hp-sep">/</span>
                <input v-model.number="char.hpMax" class="hp-max" type="number" min="1" />
              </div>
              <button class="hp-btn" @click="char.adjustHp(1)">+</button>
            </div>
          </div>
          <div class="hp-temp-edit">
            <label>
              <span>{{ t('stats.tempHp') }}</span>
              <input
                :value="char.hpTemp"
                type="number"
                min="0"
                @change="
                  char.setHpTemp(
                    Number(($event.target as HTMLInputElement).value) || 0,
                    hpTempDurationMinutesEdit || null,
                  )
                "
              />
            </label>
            <label>
              <span>{{ t('stats.tempHpDuration') }}</span>
              <input v-model.number="hpTempDurationMinutesEdit" type="number" min="0" />
            </label>
          </div>
        </template>
        <div v-else class="hp-line">
          <span class="hp-label">{{ t('stats.hpShort') }}</span>
          <div
            ref="hpQuickRef"
            class="hp-center hp-quick"
            :class="{ active: !!hpQuick, tippable: !hpQuick }"
            v-on="hpQuick ? {} : hpGestures"
          >
            <button
              v-if="hpQuick"
              class="hp-btn"
              type="button"
              :aria-label="t('stats.hpMinus')"
              @click="stepHp(-1)"
            >
              −
            </button>
            <input
              ref="hpInputRef"
              class="hp-current hp-quick-input"
              :class="`tone-${hpCurrentTone}`"
              type="text"
              inputmode="numeric"
              pattern="[0-9]*"
              enterkeyhint="done"
              autocomplete="off"
              :aria-label="t('stats.hitPoints')"
              :readonly="!hpQuick"
              :tabindex="hpQuick ? 0 : -1"
              :value="hpDisplay"
              :style="{ width: `${Math.max(1, hpDisplay.length) + 0.3}ch` }"
              @input="onHpInput"
              @keydown.enter.prevent="closeHpQuick"
              @keydown.esc="closeHpQuick"
            />
            <span class="hp-sep">/</span>
            <span class="hp-max">{{ char.hpMax }}</span>
            <button
              v-if="hpQuick"
              class="hp-btn"
              type="button"
              :aria-label="t('stats.hpPlus')"
              @click="stepHp(1)"
            >
              +
            </button>
            <template v-if="hasTempHp && !hpQuick">
              <span class="hp-temp">+{{ char.hpTemp }}</span>
              <span v-if="hpTempRemainingLabel" class="hp-temp-time">{{
                t('stats.tempHpRemaining', { time: hpTempRemainingLabel })
              }}</span>
            </template>
          </div>
        </div>
        <p v-if="!isEditing && hpQuick" class="hp-quick-caption">
          <template v-if="char.hpTemp > 0">{{
            t('stats.hpQuickSplit', { current: char.hpCurrent, temp: char.hpTemp })
          }}</template>
          <template v-else>{{ t('stats.hpQuickHint') }}</template>
        </p>
      </section>

      <div
        id="search-inspiration"
        class="combat-stat inspiration-stat search-target"
        :class="{ tippable: !isEditing }"
        @click.stop="onCombatStatClick('inspiration', $event)"
      >
        <template v-if="isEditing">
          <div class="inspiration-edit">
            <button class="insp-btn hit-area" @click="char.adjustInspiration(-1)">−</button>
            <div class="combat-value">{{ char.inspiration }}</div>
            <button class="insp-btn hit-area" @click="char.adjustInspiration(1)">+</button>
          </div>
        </template>
        <div v-else class="combat-value">{{ char.inspiration }}</div>
        <div class="combat-label">{{ t('stats.inspirationShort') }}</div>
      </div>
    </div>

    <!-- Caractéristiques -->
    <section id="search-abilities" class="stat-block abilities search-target">
      <h3 class="section-title">{{ t('stats.abilities') }}</h3>
      <div class="ability-grid">
        <div
          v-for="ab in ABILITIES"
          :key="ab"
          :id="`search-ability-${ab}`"
          class="ability-card search-target"
          :class="{ tippable: !isEditing }"
          @click.stop="onAbilityCardClick(ab, $event)"
        >
          <span class="ability-name">{{ t(`abilityShort.${ab}`) }}</span>
          <div class="ability-values">
            <div class="ability-mod-ring">
              <span class="ability-mod">{{ formatModifier(char.abilityMod(ab)) }}</span>
            </div>
            <div class="ability-score-row">
              <template v-if="isEditing">
                <button
                  class="score-btn hit-area"
                  type="button"
                  @click.stop="char.adjustAbility(ab, -1)"
                >
                  −
                </button>
                <span class="ability-score" :class="{ boosted: hasEquipBonus(ab) }">
                  {{ char.effectiveScore(ab) }}
                </span>
                <button
                  class="score-btn hit-area"
                  type="button"
                  @click.stop="char.adjustAbility(ab, 1)"
                >
                  +
                </button>
              </template>
              <span v-else class="ability-score" :class="{ boosted: hasEquipBonus(ab) }">
                {{ char.effectiveScore(ab) }}
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- Jets de sauvegarde -->
    <section id="search-saves" class="stat-block saves search-target">
      <h3 class="section-title">{{ t('stats.savingThrows') }}</h3>
      <div class="check-list">
        <button
          v-for="ab in ABILITIES"
          :key="ab"
          :id="`search-save-${ab}`"
          type="button"
          class="check-row search-target"
          :class="{
            proficient: char.savingThrowProficiency[ab],
            readonly: !isEditing,
            tippable: !isEditing,
          }"
          @click.stop="onSaveClick(ab, $event)"
        >
          <span class="check-dot" />
          <span class="check-abbr">{{ t(`abilityShort.${ab}`) }}</span>
          <span class="check-name">{{ t(`abilities.${ab}`) }}</span>
          <span class="check-bonus">{{ formatModifier(char.savingThrowBonus(ab)) }}</span>
        </button>
      </div>
    </section>

    <!-- Compétences -->
    <section id="search-skills" class="stat-block skills search-target">
      <div class="skills-header">
        <h3 class="section-title">{{ t('stats.skills') }}</h3>
        <span id="search-passive-perception" class="passive-tag search-target">
          {{ t('stats.passivePerception') }}
          <strong>{{ char.passivePerception }}</strong>
        </span>
      </div>
      <p v-if="isEditing" class="skill-cycle-hint">{{ t('stats.skillCycleHint') }}</p>
      <div class="check-list">
        <button
          v-for="skill in sortedSkills"
          :key="skill"
          :id="`search-skill-${skill}`"
          type="button"
          class="check-row search-target"
          :class="{
            proficient: char.skillRank[skill] !== 'none',
            expertise: char.skillRank[skill] === 'expertise',
            readonly: !isEditing,
            tippable: !isEditing,
          }"
          @click.stop="onSkillClick(skill, $event)"
        >
          <span class="check-dot" aria-hidden="true">
            <span v-if="char.skillRank[skill] === 'expertise'" class="check-dot-inner" />
          </span>
          <span class="check-abbr">{{ t(`abilityShort.${SKILL_ABILITY[skill]}`) }}</span>
          <span class="check-name">
            {{ t(`skills.${skill}`) }}
            <span v-if="char.skillRank[skill] === 'expertise'" class="expertise-tag">×2</span>
          </span>
          <span class="check-bonus">{{ formatModifier(char.skillBonus(skill)) }}</span>
        </button>
      </div>
    </section>

    <Teleport to="body">
      <div
        v-if="tooltip"
        class="stat-tooltip"
        :class="{ above: tooltip.above }"
        role="tooltip"
        :style="{ top: `${tooltip.top}px`, left: `${tooltip.left}px` }"
        @click.stop
      >
        <div class="stat-tooltip-title">{{ tooltipTitle }}</div>
        <div v-if="tooltipMeta" class="stat-tooltip-meta">{{ tooltipMeta }}</div>
        <p class="stat-tooltip-body">{{ tooltipBody }}</p>
        <dl v-if="tooltipBreakdown.length" class="stat-tooltip-breakdown">
          <template v-for="(row, i) in tooltipBreakdown" :key="i">
            <dt>{{ row.label }}</dt>
            <dd>{{ row.value }}</dd>
          </template>
        </dl>
        <div v-if="tooltipEquipLines.length" class="stat-tooltip-equip">
          <div class="stat-tooltip-equip-title">
            {{
              bonusBlockTitle(
                tooltipEquipLines,
                'stats.equipTooltipTitle',
                'stats.equipTooltipPlain',
              )
            }}
          </div>
          <ul class="stat-tooltip-equip-list">
            <li v-for="(line, i) in tooltipEquipLines" :key="i">
              {{ formatBonusLine(line, tooltipMultiType) }}
            </li>
          </ul>
        </div>
        <div v-if="tooltipConditionLines.length" class="stat-tooltip-equip conditions">
          <div class="stat-tooltip-equip-title">
            {{
              bonusBlockTitle(
                tooltipConditionLines,
                'stats.conditionsTooltipTitle',
                'stats.conditionsTooltipPlain',
              )
            }}
          </div>
          <ul class="stat-tooltip-equip-list">
            <li v-for="(line, i) in tooltipConditionLines" :key="i">
              {{ formatBonusLine(line, tooltipMultiType) }}
            </li>
          </ul>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.sheet {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  padding-bottom: 1rem;
}

.stat-block {
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  padding: 0.65rem 0.75rem 0.7rem;
}

.stat-block.abilities {
  border-top: 2px solid var(--color-accent);
}

.stat-block.saves {
  border-top: 2px solid var(--color-success);
}

.stat-block.saves .section-title {
  border-left-color: var(--color-success);
}

.stat-block.skills {
  border-top: 2px solid var(--color-warning);
}

.stat-block.skills .section-title {
  border-left-color: var(--color-warning);
}

/* Hero */
.hero {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}

.hero-top {
  display: flex;
  align-items: center;
  gap: 0.6rem;
}

.hero-identity {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 0.55rem;
  flex-wrap: wrap;
}

.hero-name {
  flex: 1;
  min-width: 8rem;
  background: transparent;
  border: none;
  border-bottom: 2px solid var(--color-accent);
  color: var(--color-text-primary);
  font-size: 1.4rem;
  font-weight: 700;
  padding: 0.3rem 0;
}

.hero-name-read {
  font-size: 1.4rem;
  font-weight: 700;
  color: var(--color-text-primary);
  padding: 0.3rem 0;
  border-bottom: 2px solid transparent;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.hero-chip {
  flex-shrink: 0;
  font-size: 0.8rem;
  font-weight: 700;
  color: var(--color-text-secondary);
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  padding: 0.3rem 0.55rem;
  white-space: nowrap;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
}

.edit-toggle {
  flex-shrink: 0;
  /* Calé sur la ligne du nom (pas centré sur le bloc quand les puces passent à la ligne) */
  align-self: flex-start;
  margin-top: 0.35rem;
  padding: 0.45rem 0.75rem;
  border-radius: var(--radius-sm);
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border);
  color: var(--color-text-secondary);
  font-size: 0.75rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  transition: all 0.2s;
}

.edit-toggle.active {
  background: var(--color-accent);
  border-color: var(--color-accent);
  color: var(--color-on-accent);
}

.status-line {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  padding: 0.65rem 0.75rem;
}

.status-line-label {
  font-size: 0.65rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--color-text-muted);
}

.status-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
}

.status-chip {
  font-size: 0.75rem;
  font-weight: 700;
  padding: 0.2rem 0.45rem;
  border-radius: 3px;
  background: var(--color-bg-card);
  color: var(--color-text-secondary);
}

.status-chip.positive {
  color: var(--color-success);
}

.status-chip.negative {
  color: var(--color-danger);
}

.status-empty {
  font-size: 0.8rem;
  color: var(--color-text-muted);
}

.hero-meta-read {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
}

.hero-meta-read span {
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  padding: 0.35rem 0.6rem;
  font-size: 0.8rem;
  color: var(--color-text-secondary);
}

.hero-meta {
  display: flex;
  gap: 0.5rem;
  align-items: center;
}

.meta-field {
  display: flex;
  align-items: center;
  gap: 0.3rem;
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  padding: 0.35rem 0.5rem;
  font-size: 0.8rem;
  color: var(--color-text-secondary);
  flex-shrink: 0;
}

.meta-field input {
  width: 2.2rem;
  background: transparent;
  border: none;
  color: var(--color-text-primary);
  font-weight: 700;
  text-align: center;
  padding: 0;
}

.meta-text {
  flex: 1;
  min-width: 0;
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  padding: 0.4rem 0.6rem;
  color: var(--color-text-primary);
  font-size: 0.85rem;
}

/* Jets contre la mort */
.death-saves {
  background: color-mix(in srgb, var(--color-danger) 8%, var(--color-bg-secondary));
  border: 1px solid color-mix(in srgb, var(--color-danger) 45%, var(--color-border));
  border-radius: var(--radius-md);
  padding: 0.65rem 0.75rem;
  display: flex;
  flex-direction: column;
  gap: 0.55rem;
}

.death-saves.stable {
  background: color-mix(in srgb, var(--color-success) 8%, var(--color-bg-secondary));
  border-color: color-mix(in srgb, var(--color-success) 45%, var(--color-border));
}

.death-saves.dead {
  background: color-mix(in srgb, var(--color-danger) 18%, var(--color-bg-secondary));
  border-color: var(--color-danger);
}

.death-head {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  /* Hauteur fixe (2 lignes de commentaire) : le message n'entraîne aucun décalage */
  height: 2.2rem;
}

.death-head .section-title {
  flex-shrink: 0;
  white-space: nowrap;
}

.death-quip {
  flex: 1;
  min-width: 0;
  font-size: 0.68rem;
  font-style: italic;
  line-height: 1.2;
  text-align: center;
  color: var(--color-text-primary);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.title-with-tip {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  margin: 0;
}

.death-undo {
  flex-shrink: 0;
  width: 2.4rem;
  height: 2.4rem;
  border-radius: 50%;
  background: var(--color-bg-card);
  border: 1px solid var(--color-border);
  color: var(--color-text-secondary);
  font-size: 1rem;
  line-height: 1;
  padding: 0;
}

.death-tracks {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.5rem;
}

.death-track {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.3rem;
  min-width: 0;
}

.death-track-label {
  font-size: 0.68rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--color-text-muted);
}

.death-pips {
  display: flex;
  gap: 0.4rem;
}

.death-pip {
  width: 1.15rem;
  height: 1.15rem;
  border-radius: 50%;
  border: 2px solid var(--pip-color);
  background: transparent;
  transition: background 0.15s;
}

.death-track.success {
  --pip-color: var(--color-success);
}

.death-track.failure {
  --pip-color: var(--color-danger);
}

.death-pip.filled {
  background: var(--pip-color);
}

.death-status {
  margin: 0;
  text-align: center;
  font-weight: 800;
  font-size: 0.95rem;
  color: var(--color-text-primary);
}

.death-actions {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

/* Deux boutons par ligne, toujours côte à côte */
.death-row {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.4rem;
}

.death-btn {
  min-width: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  padding: 0.6rem 0.5rem;
  border-radius: var(--radius-sm);
  font-size: 0.85rem;
  font-weight: 800;
  border: 1px solid transparent;
}

.death-btn.success {
  background: color-mix(in srgb, var(--color-success) 18%, var(--color-bg-card));
  border-color: var(--color-success);
  color: var(--color-text-primary);
}

.death-btn.failure {
  background: color-mix(in srgb, var(--color-danger) 18%, var(--color-bg-card));
  border-color: var(--color-danger);
  color: var(--color-text-primary);
}

.death-row.chips {
  display: flex;
}

/* Une seule ligne de boutons : le texte peut passer sur 2 lignes dans le bouton */
.death-row.chips .death-chip {
  flex: 1 1 0;
}

.death-chip {
  min-width: 0;
  line-height: 1.15;
  text-align: center;
  padding: 0.4rem 0.55rem;
  border-radius: var(--radius-sm);
  background: var(--color-bg-card);
  border: 1px solid var(--color-border);
  color: var(--color-text-secondary);
  font-size: 0.75rem;
  font-weight: 700;
}

/* Combat strip : dernière colonne (Maîtrise) = même largeur que l'Inspiration en dessous */
.combat-strip {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr)) minmax(4.5rem, 22%);
  gap: 0.4rem;
}

.combat-strip + .hp-row {
  margin-top: calc(-1rem + 4px);
}

.combat-stat {
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  padding: 0.6rem 0.3rem;
  text-align: center;
}

.combat-stat.accent {
  border-color: var(--color-accent);
  background: color-mix(in srgb, var(--color-accent) 8%, transparent);
}

.combat-value {
  font-size: 1.3rem;
  font-weight: 800;
  line-height: 1.1;
  color: var(--color-text-primary);
}

.combat-value small {
  font-size: 0.65rem;
  font-weight: 600;
  opacity: 0.7;
}

.combat-label {
  font-size: 0.6rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--color-text-muted);
  margin-top: 0.15rem;
}

/* HP */
.hp-row {
  display: grid;
  grid-template-columns: 1fr minmax(4.5rem, 22%);
  gap: 0.4rem;
  align-items: stretch;
}

.hp-block {
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  padding: 0.7rem 0.9rem;
  min-width: 0;
}

.inspiration-stat {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 100%;
  box-sizing: border-box;
}

.inspiration-edit {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.2rem;
}

.stat-stepper {
  display: flex;
  justify-content: center;
  gap: 0.35rem;
  margin-top: 0.35rem;
}

.insp-btn {
  width: 1.35rem;
  height: 1.35rem;
  border-radius: 50%;
  background: var(--color-bg-card);
  color: var(--color-text-primary);
  font-size: 0.85rem;
  font-weight: 700;
  border: 1px solid var(--color-border);
  line-height: 1;
  padding: 0;
  flex-shrink: 0;
}

.hp-line {
  display: flex;
  align-items: center;
  gap: 0.55rem;
  min-height: 2.8rem;
  min-width: 0;
}

.hp-label {
  flex-shrink: 0;
  margin: 0;
  color: var(--color-text-primary);
  font-size: clamp(1.3rem, 6.5vw, 1.75rem);
  font-weight: 800;
  line-height: 1;
  letter-spacing: 0.02em;
  text-transform: uppercase;
}

.hp-center {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: baseline;
  justify-content: center;
  flex-wrap: nowrap;
  gap: 0.2rem;
  font-size: clamp(1.4rem, 7vw, 2rem);
  font-weight: 800;
  line-height: 1;
}

.hp-current {
  color: var(--color-text-primary);
  transition: color 0.2s ease;
}

.hp-current.tone-critical {
  color: var(--color-danger);
}

.hp-current.tone-low {
  color: #ff8a3d;
}

.hp-current.tone-mid {
  color: #e6c200;
}

.hp-current.tone-full {
  color: var(--color-success);
}

.hp-sep {
  color: var(--color-text-muted);
  font-weight: 600;
}

.hp-max {
  color: var(--color-text-secondary);
}

.hp-temp {
  margin-left: 0.35rem;
  color: var(--color-warning);
  font-size: 0.95rem;
  font-weight: 700;
}

.hp-temp-time {
  color: var(--color-warning);
  font-size: 0.78rem;
  font-weight: 600;
  opacity: 0.9;
}

.hp-quick {
  user-select: none;
  -webkit-user-select: none;
  -webkit-touch-callout: none;
  touch-action: manipulation;
}

.hp-quick.active {
  align-items: center;
}

.hp-quick-input {
  min-width: 1ch;
  background: transparent;
  border: none;
  border-bottom: 2px solid transparent;
  border-radius: 0;
  padding: 0;
  font: inherit;
  text-align: center;
  outline: none;
  pointer-events: none;
}

.hp-quick-caption {
  margin: 0.3rem 0 0;
  font-size: 0.75rem;
  font-weight: 600;
  text-align: center;
  color: var(--color-warning);
}

.hp-quick.active .hp-quick-input {
  pointer-events: auto;
  border-bottom-color: var(--color-accent);
  user-select: text;
  -webkit-user-select: text;
}

.hp-btn {
  width: 2.4rem;
  height: 2.4rem;
  border-radius: 50%;
  background: var(--color-bg-card);
  color: var(--color-text-primary);
  font-size: 1rem;
  font-weight: 700;
  border: 1px solid var(--color-border);
  flex-shrink: 0;
}

.hp-values {
  display: flex;
  align-items: center;
  gap: 0.2rem;
  min-width: 0;
}

.hp-values input {
  width: 2.1em;
  background: transparent;
  border: none;
  font-size: clamp(1.4rem, 7vw, 2rem);
  font-weight: 800;
  text-align: center;
  padding: 0;
}

.hp-values input.hp-current {
  color: var(--color-text-primary);
}

.hp-values input.hp-max {
  color: var(--color-text-secondary);
}

.hp-temp-edit {
  display: flex;
  flex-wrap: wrap;
  gap: 0.6rem 1rem;
  margin-top: 0.55rem;
  font-size: 0.78rem;
  color: var(--color-text-secondary);
}

.hp-temp-edit label {
  display: flex;
  align-items: center;
  gap: 0.35rem;
}

.hp-temp-edit input {
  width: 2.6rem;
  background: var(--color-bg-input);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  color: var(--color-text-primary);
  text-align: center;
  padding: 0.15rem;
}

/* Abilities */
.ability-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0.4rem;
  margin-top: 0.45rem;
}

.ability-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  background: var(--color-bg-card);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  padding: 0.35rem 0.2rem 0.4rem;
  gap: 0.08rem;
}

.ability-card.tippable,
.combat-stat.tippable,
.hp-quick.tippable {
  cursor: help;
}

.ability-name {
  font-size: 0.72rem;
  font-weight: 800;
  letter-spacing: 0.1em;
  color: var(--color-text-secondary);
}

.ability-values {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-wrap: wrap;
  gap: 0.2rem 0.45rem;
  margin-top: 0.1rem;
}

.ability-mod-ring {
  width: clamp(2.3rem, 11vw, 2.8rem);
  height: clamp(2.3rem, 11vw, 2.8rem);
  flex-shrink: 0;
  border-radius: 50%;
  border: 2px solid var(--color-accent);
  display: flex;
  align-items: center;
  justify-content: center;
  background: color-mix(in srgb, var(--color-accent) 12%, transparent);
  margin: 0.05rem 0;
}

.ability-mod {
  /* Centrage optique : hauteur de ligne neutre, chiffres alignés, et rognage aux capitales
     là où text-box est supporté (sinon les polices serif comme Literata décalent vers le bas) */
  display: block;
  line-height: 1;
  font-variant-numeric: lining-nums tabular-nums;
  text-box: trim-both cap alphabetic;
  font-size: clamp(1rem, 4.8vw, 1.2rem);
  font-weight: 800;
  color: var(--color-text-primary);
}

.ability-score-row {
  display: flex;
  align-items: center;
  gap: 0.15rem;
}

.score-btn {
  width: 1.25rem;
  height: 1.25rem;
  border-radius: var(--radius-sm);
  background: var(--color-bg-secondary);
  color: var(--color-text-secondary);
  font-size: 0.8rem;
  font-weight: 700;
  border: 1px solid var(--color-border);
  line-height: 1;
  padding: 0;
}

.ability-score {
  /* Même centrage optique que le modificateur : la valeur tombe pile au milieu de l'anneau */
  display: block;
  line-height: 1;
  font-variant-numeric: lining-nums tabular-nums;
  text-box: trim-both cap alphabetic;
  font-size: clamp(1rem, 4.8vw, 1.25rem);
  font-weight: 800;
  min-width: 1.25rem;
  text-align: center;
  color: var(--color-text-secondary);
}

.ability-score.boosted {
  color: var(--color-success);
}

/* Saves & Skills — colonnes alignées : bonus après le libellé le plus long */
.check-list {
  display: grid;
  grid-template-columns: 1rem 2rem minmax(0, max-content) auto;
  column-gap: 0.4rem;
  row-gap: 0.1rem;
  margin-top: 0.4rem;
  align-items: center;
}

.check-row {
  display: grid;
  grid-column: 1 / -1;
  grid-template-columns: subgrid;
  align-items: center;
  padding: 0.38rem 0.45rem;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--color-text-primary);
  text-align: left;
  transition: background 0.15s;
  border: none;
  font: inherit;
  width: 100%;
}

@supports not (grid-template-columns: subgrid) {
  .check-list {
    display: flex;
    flex-direction: column;
    gap: 0.1rem;
  }

  .check-row {
    grid-column: auto;
    grid-template-columns: 1rem 2rem minmax(0, 1fr) auto;
    gap: 0.4rem;
  }
}

.check-row:active {
  background: var(--color-bg-card);
}

.check-row.readonly {
  cursor: default;
}

.check-row.tippable {
  cursor: help;
}

.check-row.readonly:active {
  background: transparent;
}

.check-row.proficient .check-dot {
  background: var(--color-accent);
  border-color: var(--color-accent);
}

.check-row.expertise .check-dot {
  background: transparent;
  border-color: var(--color-accent);
  border-width: 2px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.check-dot-inner {
  width: 0.28rem;
  height: 0.28rem;
  border-radius: 50%;
  background: var(--color-accent);
}

.check-row.proficient .check-bonus {
  color: var(--color-accent);
  font-weight: 800;
}

.check-row.expertise .check-bonus {
  color: var(--color-warning);
}

.check-dot {
  width: 0.65rem;
  height: 0.65rem;
  border-radius: 50%;
  border: 2px solid var(--color-text-muted);
  flex-shrink: 0;
  box-sizing: border-box;
}

.check-abbr {
  font-size: 0.65rem;
  font-weight: 700;
  color: var(--color-text-muted);
}

.check-bonus {
  justify-self: start;
  font-size: 0.9rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.check-name {
  min-width: 0;
  overflow-wrap: anywhere;
  font-size: 0.85rem;
  color: var(--color-text-secondary);
  display: flex;
  align-items: center;
  gap: 0.35rem;
  text-align: left;
  line-height: 1.3;
}

.expertise-tag {
  font-size: 0.65rem;
  font-weight: 800;
  color: var(--color-warning);
  letter-spacing: 0.02em;
}

.skill-cycle-hint {
  margin: 0.35rem 0 0;
  font-size: 0.7rem;
  color: var(--color-text-muted);
}

.skills-header {
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
}

.passive-tag {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  flex-shrink: 0;
  font-size: 0.7rem;
  font-weight: 600;
  color: var(--color-text-secondary);
  background: var(--color-bg-card);
  border: 1px solid var(--color-border);
  border-radius: 3px;
  padding: 0.2rem 0.5rem;
  white-space: nowrap;
  line-height: 1.2;
}

.passive-tag strong {
  color: var(--color-warning);
  font-size: 0.85rem;
  font-weight: 800;
  font-variant-numeric: tabular-nums;
}

.stat-tooltip {
  position: fixed;
  z-index: 80;
  width: min(280px, calc(100vw - 24px));
  transform: translate(-50%, 0);
  background: var(--color-bg-card);
  border: 1px solid var(--color-border-hover);
  border-radius: var(--radius-md);
  padding: 0.65rem 0.75rem;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.35);
  pointer-events: auto;
}

.stat-tooltip.above {
  transform: translate(-50%, -100%);
}

.stat-tooltip-title {
  font-size: 0.9rem;
  font-weight: 800;
  color: var(--color-text-primary);
  line-height: 1.2;
}

.stat-tooltip-meta {
  margin-top: 0.15rem;
  font-size: 0.68rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--color-text-muted);
}

.stat-tooltip-body {
  margin: 0.45rem 0 0;
  font-size: 0.8rem;
  line-height: 1.35;
  color: var(--color-text-secondary);
}

.stat-tooltip-breakdown {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 0.15rem 0.75rem;
  margin: 0.5rem 0 0;
  font-size: 0.78rem;
  color: var(--color-text-secondary);
}

.stat-tooltip-breakdown dd {
  margin: 0;
  font-weight: 700;
  color: var(--color-text-primary);
  font-variant-numeric: tabular-nums;
  text-align: right;
}

.stat-tooltip-equip {
  margin-top: 0.55rem;
  padding-top: 0.5rem;
  border-top: 1px solid var(--color-border);
}

.stat-tooltip-equip-title {
  font-size: 0.72rem;
  font-weight: 700;
  color: var(--color-success);
  margin-bottom: 0.25rem;
}

.stat-tooltip-equip.conditions .stat-tooltip-equip-title {
  color: var(--color-accent);
}

.stat-tooltip-equip-list {
  margin: 0;
  padding-left: 1rem;
  font-size: 0.75rem;
  line-height: 1.4;
  color: var(--color-text-secondary);
}
</style>
