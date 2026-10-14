<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  CONDITION_PRESET_IDS,
  CONDITION_PRESETS,
  CONDITION_SOURCES,
  getPreset,
  useConditionsStore,
  type ActiveCondition,
  type ConditionKind,
  type ConditionPresetId,
  type ConditionSource,
} from '@/stores/conditions'
import { MODIFIER_LABELS, type Modifier, type ModifierType } from '@/stores/inventory'
import { useTooltip } from '@/composables/useTooltip'
import { useConditionLabel } from '@/composables/useConditionLabel'
import ActionIconButton from '@/components/ActionIconButton.vue'
import { useToast } from '@/composables/useToast'

const { t, locale } = useI18n()
const store = useConditionsStore()
const conditionLabel = useConditionLabel()
const { tooltip, close: closeTooltip, toggle: toggleTooltip } = useTooltip<string>(260)

const presetGroups = computed(() => [
  {
    label: t('conditions.groupConditions'),
    ids: CONDITION_PRESET_IDS.filter((id) => CONDITION_PRESETS[id].group === 'condition'),
  },
  {
    label: t('conditions.groupSpells'),
    ids: CONDITION_PRESET_IDS.filter((id) => CONDITION_PRESETS[id].group === 'spell'),
  },
])

/** « Autre » n'a pas d'effet calculé : inutile pour un état */
const modifierTypes = (Object.keys(MODIFIER_LABELS) as ModifierType[]).filter((m) => m !== 'autre')

/* ── Ordre d'affichage (préférence de l'appareil) ── */

/** Buffs avant débuffs, ou ancienneté (le plus ancien / le plus récent d'abord) */
type SortMode = 'kind' | 'oldest' | 'newest'
const SORT_MODES: SortMode[] = ['kind', 'oldest', 'newest']
const SORT_STORAGE_KEY = 'echec-critique-conditions-sort'

function loadSortMode(): SortMode {
  try {
    const raw = localStorage.getItem(SORT_STORAGE_KEY)
    return SORT_MODES.includes(raw as SortMode) ? (raw as SortMode) : 'kind'
  } catch {
    return 'kind'
  }
}

const sortMode = ref<SortMode>(loadSortMode())
const { show: showToast } = useToast()

/** La liste du store est dans l'ordre d'ajout : l'ancienneté en découle directement */
const sortedConditions = computed(() => {
  const list = store.conditions
  if (sortMode.value === 'newest') return [...list].reverse()
  if (sortMode.value === 'kind') {
    return [...list.filter((c) => c.kind === 'buff'), ...list.filter((c) => c.kind !== 'buff')]
  }
  return list
})

function cycleSortMode() {
  const next = SORT_MODES[(SORT_MODES.indexOf(sortMode.value) + 1) % SORT_MODES.length]
  sortMode.value = next
  try {
    localStorage.setItem(SORT_STORAGE_KEY, next)
  } catch {
    /* ignore */
  }
  showToast(t(`conditions.sort.${next}`))
}

/* ── Bulle de détail ── */

const openCondition = computed(() =>
  tooltip.value ? (store.conditions.find((c) => c.id === tooltip.value!.target) ?? null) : null,
)

function formatNumber(value: number) {
  return value.toLocaleString(locale.value, { maximumFractionDigits: 1 })
}

function formatMod(mod: Modifier) {
  const sign = mod.value >= 0 ? '+' : '−'
  const unit = mod.type === 'vitesse' ? ' m' : ''
  return `${t(`modifiers.${mod.type}`)} ${sign}${formatNumber(Math.abs(mod.value))}${unit}`
}

/** Effets appliqués automatiquement par le préréglage */
function builtInLines(cond: ActiveCondition): string[] {
  const preset = getPreset(cond.preset)
  if (!preset) return []
  const lines = (preset.effects?.(cond.level) ?? []).map(formatMod)
  if (preset.speedZero) lines.push(t('conditions.speedZero'))
  if (preset.speedFactor)
    lines.push(t('conditions.speedFactor', { n: formatNumber(preset.speedFactor) }))
  return lines
}

function onChipClick(cond: ActiveCondition, event: MouseEvent) {
  toggleTooltip(cond.id, event.currentTarget as HTMLElement)
}

function removeCondition(id: string) {
  closeTooltip()
  store.remove(id)
}

/* ── Formulaire ajout / édition ── */

const showForm = ref(false)
const editingId = ref<string | null>(null)
/** Préréglage, état perso mémorisé (`saved:<id>`) ou nouvel état perso */
type Choice = ConditionPresetId | 'custom' | `saved:${string}`
const choice = ref<Choice>('aveugle')
const name = ref('')
const kind = ref<ConditionKind>('debuff')
const source = ref<ConditionSource>('ennemi')
const level = ref(1)
const modifiers = ref<Modifier[]>([])

function savedId(value: Choice): string | null {
  return value.startsWith('saved:') ? value.slice('saved:'.length) : null
}

/** État perso (nouveau ou mémorisé) : nom, effet et modifs saisis par le joueur */
const isCustomChoice = computed(() => choice.value === 'custom' || !!savedId(choice.value))
const choicePreset = computed(() =>
  isCustomChoice.value ? null : getPreset(choice.value as ConditionPresetId),
)
const canSubmit = computed(() => !isCustomChoice.value || !!name.value.trim())

// Nouveau choix : on reprend le type, la source (et les modifs d'un état mémorisé)
watch(choice, (value) => {
  if (editingId.value) return
  const saved = store.saved.find((s) => s.id === savedId(value))
  if (saved) {
    name.value = saved.name
    kind.value = saved.kind
    source.value = saved.source
    modifiers.value = saved.modifiers.map((m) => ({ ...m }))
  } else {
    const preset = value === 'custom' ? null : getPreset(value as ConditionPresetId)
    if (value === 'custom') name.value = ''
    kind.value = preset?.kind ?? 'buff'
    source.value = preset?.source ?? 'autre'
    modifiers.value = []
  }
  level.value = 1
})

/** Retire un état de « Mes états » (sans toucher aux états actifs) */
function forgetSaved() {
  const id = savedId(choice.value)
  if (!id) return
  store.forget(id)
  choice.value = 'custom'
}

function defaultChoice(): Choice {
  return store.saved.length ? `saved:${store.saved[0].id}` : 'aveugle'
}

function openAdd() {
  closeTooltip()
  if (showForm.value && !editingId.value) {
    showForm.value = false
    return
  }
  editingId.value = null
  choice.value = defaultChoice()
  const saved = store.saved.find((s) => s.id === savedId(choice.value))
  name.value = saved?.name ?? ''
  kind.value = saved?.kind ?? CONDITION_PRESETS.aveugle.kind
  source.value = saved?.source ?? CONDITION_PRESETS.aveugle.source
  level.value = 1
  modifiers.value = saved?.modifiers.map((m) => ({ ...m })) ?? []
  showForm.value = true
}

function openEdit(cond: ActiveCondition) {
  closeTooltip()
  editingId.value = cond.id
  choice.value = cond.preset ?? 'custom'
  name.value = cond.name
  kind.value = cond.kind
  source.value = cond.source
  level.value = cond.level
  modifiers.value = cond.modifiers.map((m) => ({ ...m }))
  showForm.value = true
}

function cancelForm() {
  showForm.value = false
  editingId.value = null
}

function addModifier() {
  modifiers.value.push({ type: 'ca', value: 0 })
}

function removeModifier(index: number) {
  modifiers.value.splice(index, 1)
}

function submit() {
  if (!canSubmit.value) return
  const custom = isCustomChoice.value
  const payload = {
    preset: custom ? null : (choice.value as ConditionPresetId),
    name: custom ? name.value.trim() : '',
    kind: kind.value,
    source: source.value,
    level: level.value,
    modifiers: modifiers.value
      .map((m) => ({ type: m.type, value: Number(m.value) || 0 }))
      .filter((m) => m.value !== 0),
  }
  if (editingId.value) store.update(editingId.value, payload)
  else store.add(payload)
  // État perso : mémorisé pour le retrouver en tête de liste la prochaine fois
  if (custom) store.remember(payload)
  cancelForm()
}
</script>

<template>
  <section id="search-conditions" class="conditions search-target">
    <div class="conditions-bar">
      <!-- Bouton d'ordre calé à gauche : ne bouge pas quand les états changent -->
      <button
        v-if="store.conditions.length"
        type="button"
        class="sort-toggle hit-area"
        :aria-label="t('conditions.sort.label', { mode: t(`conditions.sort.${sortMode}`) })"
        :title="t(`conditions.sort.${sortMode}`)"
        @click="cycleSortMode"
      >
        <!-- Buffs d'abord : pastille verte au-dessus de la rouge -->
        <svg v-if="sortMode === 'kind'" viewBox="0 0 16 16" aria-hidden="true">
          <circle class="dot-buff" cx="8" cy="4.5" r="3" />
          <circle class="dot-debuff" cx="8" cy="11.5" r="3" />
        </svg>
        <!-- Ancienneté : barres + flèche (vers le bas = plus ancien d'abord) -->
        <svg v-else viewBox="0 0 16 16" aria-hidden="true" class="sort-lines">
          <path d="M2 4h6M2 8h4.5M2 12h3" />
          <path
            :d="
              sortMode === 'oldest'
                ? 'M12 3v10M9.5 10.5 12 13l2.5-2.5'
                : 'M12 13V3M9.5 5.5 12 3l2.5 2.5'
            "
          />
        </svg>
      </button>
      <div class="conditions-row" role="group" :aria-label="t('conditions.title')">
        <button
          v-for="cond in sortedConditions"
          :key="cond.id"
          type="button"
          class="condition-chip"
          :class="[cond.kind, { open: tooltip?.target === cond.id }]"
          @click.stop="onChipClick(cond, $event)"
        >
          {{ conditionLabel(cond) }}
        </button>
        <button
          type="button"
          class="condition-chip add"
          :class="{ open: showForm && !editingId }"
          :aria-label="t('conditions.addAria')"
          :aria-expanded="showForm && !editingId"
          @click="openAdd"
        >
          <!-- Icône dessinée (pas un caractère) : centrée quelle que soit la police -->
          <svg
            v-if="(showForm && !editingId) || store.conditions.length"
            class="add-icon"
            :class="{ close: showForm && !editingId }"
            viewBox="0 0 16 16"
            aria-hidden="true"
          >
            <path d="M8 3v10M3 8h10" />
          </svg>
          <template v-else>{{ t('conditions.add') }}</template>
        </button>
      </div>
    </div>

    <Transition name="slide">
      <form v-if="showForm" class="condition-form" @submit.prevent="submit">
        <h3 class="form-title">
          {{ editingId ? t('conditions.editTitle') : t('conditions.newTitle') }}
        </h3>

        <div class="field">
          <span>{{ t('conditions.type') }}</span>
          <div class="choice-row">
            <select v-model="choice" :disabled="!!editingId" :aria-label="t('conditions.type')">
              <option value="custom">{{ t('conditions.custom') }}</option>
              <optgroup v-if="store.saved.length" :label="t('conditions.groupSaved')">
                <option v-for="s in store.saved" :key="s.id" :value="`saved:${s.id}`">
                  {{ s.name }}
                </option>
              </optgroup>
              <optgroup v-for="group in presetGroups" :key="group.label" :label="group.label">
                <option v-for="id in group.ids" :key="id" :value="id">
                  {{ t(`conditions.presets.${id}.name`) }}
                </option>
              </optgroup>
            </select>
            <ActionIconButton
              v-if="!editingId && savedId(choice)"
              kind="remove"
              :label="t('conditions.forgetSaved')"
              @click="forgetSaved"
            />
          </div>
        </div>

        <label v-if="isCustomChoice" class="field">
          <span>{{ t('conditions.name') }}</span>
          <input
            v-model="name"
            type="text"
            maxlength="40"
            :placeholder="t('conditions.namePlaceholder')"
          />
        </label>

        <div class="field-row">
          <label v-if="choicePreset?.maxLevel" class="field level-field">
            <span>{{ t('conditions.level') }}</span>
            <select v-model.number="level">
              <option v-for="n in choicePreset.maxLevel" :key="n" :value="n">{{ n }}</option>
            </select>
          </label>
          <label v-if="isCustomChoice" class="field">
            <span>{{ t('conditions.kind') }}</span>
            <select v-model="kind">
              <option value="buff">{{ t('conditions.buff') }}</option>
              <option value="debuff">{{ t('conditions.debuff') }}</option>
            </select>
          </label>
          <label class="field">
            <span>{{ t('conditions.source') }}</span>
            <select v-model="source">
              <option v-for="s in CONDITION_SOURCES" :key="s" :value="s">
                {{ t(`conditions.sources.${s}`) }}
              </option>
            </select>
          </label>
        </div>

        <div class="field">
          <div class="modifiers-head">
            <span class="field-label">{{ t('conditions.modifiers') }}</span>
            <button class="btn-add compact" type="button" @click="addModifier">
              {{ t('conditions.addModifier') }}
            </button>
          </div>
          <div v-for="(mod, index) in modifiers" :key="index" class="modifier-row">
            <select v-model="mod.type">
              <option v-for="type in modifierTypes" :key="type" :value="type">
                {{ t(`modifiers.${type}`) }}
              </option>
            </select>
            <input v-model.number="mod.value" type="number" step="1" placeholder="0" />
            <ActionIconButton
              kind="remove"
              compact
              :label="t('common.delete')"
              @click="removeModifier(index)"
            />
          </div>
        </div>

        <div class="form-actions">
          <button class="btn-secondary" type="button" @click="cancelForm">
            {{ t('common.cancel') }}
          </button>
          <button class="btn-primary" type="submit" :disabled="!canSubmit">
            {{ editingId ? t('common.save') : t('conditions.submit') }}
          </button>
        </div>
      </form>
    </Transition>

    <Teleport to="body">
      <div
        v-if="tooltip && openCondition"
        class="condition-tip"
        :class="{ above: tooltip.above }"
        role="tooltip"
        :style="{ top: `${tooltip.top}px`, left: `${tooltip.left}px` }"
        @click.stop
      >
        <div class="tip-head">
          <div class="tip-title">{{ conditionLabel(openCondition) }}</div>
          <div class="tip-actions">
            <ActionIconButton
              kind="edit"
              compact
              :label="t('conditions.editTitle')"
              @click="openEdit(openCondition)"
            />
            <ActionIconButton
              kind="remove"
              compact
              :label="t('conditions.remove', { name: conditionLabel(openCondition) })"
              @click="removeCondition(openCondition.id)"
            />
          </div>
        </div>
        <div class="tip-meta">
          {{ t(`conditions.${openCondition.kind}`) }} ·
          {{ t(`conditions.sources.${openCondition.source}`) }}
        </div>
        <p v-if="openCondition.preset" class="tip-body">
          {{ t(`conditions.presets.${openCondition.preset}.summary`) }}
        </p>
        <div
          v-if="builtInLines(openCondition).length || openCondition.modifiers.length"
          class="tip-effects"
        >
          <div class="tip-effects-title">
            {{ t('conditions.builtIn') }}
          </div>
          <ul>
            <li v-for="(line, i) in builtInLines(openCondition)" :key="`b${i}`">{{ line }}</li>
            <li v-for="(mod, i) in openCondition.modifiers" :key="`m${i}`">{{ formatMod(mod) }}</li>
          </ul>
        </div>
      </div>
    </Teleport>
  </section>
</template>

<style scoped>
.conditions {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
  min-width: 0;
}

/* Bouton d'ordre fixe à gauche, les états occupent toute la largeur restante */
.conditions-bar {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  align-items: start;
  gap: 0.4rem;
}

.conditions-row {
  grid-column: 2;
  display: flex;
  flex-wrap: wrap;
  gap: 0.3rem;
  min-width: 0;
}

.condition-chip {
  display: inline-flex;
  align-items: center;
  max-width: 100%;
  height: 1.9rem;
  box-sizing: border-box;
  padding: 0 0.6rem;
  line-height: 1;
  border-radius: 999px;
  border: 1px solid var(--color-border);
  background: var(--color-bg-secondary);
  color: var(--color-text-primary);
  font-family: inherit;
  font-size: 0.8rem;
  font-weight: 700;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  cursor: pointer;
}

/* Badges pleins : vert = buff, rouge = débuff */
.condition-chip.buff,
.condition-chip.debuff {
  color: var(--color-on-accent);
  text-shadow: 0 1px 1px rgb(0 0 0 / 0.25);
  box-shadow: inset 0 -2px 0 rgb(0 0 0 / 0.18);
}

/* Fonds assombris pour que le texte blanc reste lisible (le vert du thème est clair) */
.condition-chip.buff {
  border-color: color-mix(in srgb, var(--color-success) 50%, #000);
  background: color-mix(in srgb, var(--color-success) 65%, #000);
}

.condition-chip.debuff {
  border-color: color-mix(in srgb, var(--color-danger) 65%, #000);
  background: color-mix(in srgb, var(--color-danger) 85%, #000);
}

.condition-chip.buff:active,
.condition-chip.debuff:active {
  filter: brightness(0.92);
}

.condition-chip.open {
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--color-accent) 55%, transparent);
}
.condition-chip.buff.open,
.condition-chip.debuff.open {
  box-shadow:
    inset 0 -2px 0 rgb(0 0 0 / 0.18),
    0 0 0 2px color-mix(in srgb, var(--color-accent) 55%, transparent);
}

.condition-chip.add {
  justify-content: center;
  min-width: 1.9rem;
  border-style: dashed;
  color: var(--color-text-secondary);
}

.sort-toggle {
  grid-column: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.9rem;
  height: 1.9rem;
  padding: 0;
  box-sizing: border-box;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-bg-secondary);
  color: var(--color-text-secondary);
  cursor: pointer;
}

.sort-toggle:active {
  background: var(--color-bg-card);
}

.sort-toggle svg {
  width: 0.95rem;
  height: 0.95rem;
}

.sort-toggle .dot-buff {
  fill: color-mix(in srgb, var(--color-success) 65%, #000);
}

.sort-toggle .dot-debuff {
  fill: color-mix(in srgb, var(--color-danger) 85%, #000);
}

.sort-lines path {
  fill: none;
  stroke: currentColor;
  stroke-width: 1.6;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.add-icon {
  width: 0.85rem;
  height: 0.85rem;
  fill: none;
  stroke: currentColor;
  stroke-width: 2;
  stroke-linecap: round;
  transition: transform 0.15s ease;
}

/* Le « + » tourné de 45° devient la croix de fermeture */
.add-icon.close {
  transform: rotate(45deg);
}

/* ── Formulaire ── */

.choice-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  min-width: 0;
}

.choice-row select {
  flex: 1;
  min-width: 0;
}

.condition-form {
  display: flex;
  flex-direction: column;
  gap: 0.7rem;
  padding: 0.85rem;
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  min-width: 0;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  min-width: 0;
  flex: 1 1 0;
}

.field-row {
  display: flex;
  gap: 0.6rem;
  min-width: 0;
}

.level-field {
  flex: 0 0 4.5rem;
}

.field input,
.field select,
.modifier-row input,
.modifier-row select {
  background: var(--color-bg-input);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  padding: 0.5rem 0.6rem;
  color: var(--color-text-primary);
  font-size: 0.9rem;
  min-width: 0;
}

.modifiers-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
}

.modifier-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-top: 0.35rem;
  min-width: 0;
}

.modifier-row select {
  flex: 1 1 auto;
}

.modifier-row input {
  flex: 0 0 4rem;
  width: 4rem;
  text-align: center;
}

/* ── Bulle ── */

.condition-tip {
  position: fixed;
  z-index: 80;
  width: min(280px, calc(100vw - 24px));
  transform: translate(-50%, 0);
  background: var(--color-bg-card);
  border: 1px solid var(--color-border-hover);
  border-radius: var(--radius-md);
  padding: 0.65rem 0.75rem;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.35);
}

.condition-tip.above {
  transform: translate(-50%, -100%);
}

.tip-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.5rem;
}

.tip-title {
  font-size: 0.9rem;
  font-weight: 800;
  color: var(--color-text-primary);
  line-height: 1.2;
  min-width: 0;
  overflow-wrap: anywhere;
}

.tip-actions {
  display: flex;
  gap: 0.35rem;
  flex-shrink: 0;
}

.tip-meta {
  margin-top: 0.15rem;
  font-size: 0.68rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--color-text-muted);
}

.tip-body {
  margin: 0.45rem 0 0;
  font-size: 0.8rem;
  line-height: 1.35;
  color: var(--color-text-secondary);
}

.tip-effects {
  margin-top: 0.5rem;
  padding-top: 0.45rem;
  border-top: 1px solid var(--color-border);
}

.tip-effects-title {
  font-size: 0.72rem;
  font-weight: 700;
  color: var(--color-accent);
  margin-bottom: 0.2rem;
}

.tip-effects ul {
  margin: 0;
  padding-left: 1rem;
  font-size: 0.75rem;
  line-height: 1.4;
  color: var(--color-text-secondary);
}

.slide-enter-active,
.slide-leave-active {
  transition: all 0.2s ease;
}
.slide-enter-from,
.slide-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}
</style>
