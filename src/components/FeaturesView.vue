<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  FEATURE_DESCRIPTION_MAX,
  FEATURE_NAME_MAX,
  FEATURE_ORIGINS,
  FEATURE_RECHARGES,
  FEATURE_USES_MAX,
  useFeaturesStore,
  type Feature,
  type FeatureOrigin,
  type FeatureRecharge,
} from '@/stores/features'
import { MODIFIER_LABELS, type Modifier, type ModifierType } from '@/stores/inventory'
import ActionIconButton from '@/components/ActionIconButton.vue'
import InfoTip from '@/components/InfoTip.vue'
import { useHorizontalScroll } from '@/composables/useHorizontalScroll'
import { useToast } from '@/composables/useToast'

const { t, locale } = useI18n()
const store = useFeaturesStore()
const { show: showToast } = useToast()

/** « Autre » n'a pas d'effet calculé : inutile pour une capacité */
const modifierTypes = (Object.keys(MODIFIER_LABELS) as ModifierType[]).filter((m) => m !== 'autre')

/* ── Onglets de filtre par origine ── */

const originCounts = computed(() => {
  const counts: Partial<Record<FeatureOrigin, number>> = {}
  for (const f of store.features) counts[f.origin] = (counts[f.origin] ?? 0) + 1
  return counts
})

/** Seulement les origines qui ont des capacités */
const filterTabs = computed(() =>
  FEATURE_ORIGINS.filter((o) => originCounts.value[o]).map((o) => ({
    id: o,
    count: originCounts.value[o]!,
  })),
)

const tabsEl = ref<HTMLElement | null>(null)
const tabsScroll = useHorizontalScroll(tabsEl)

watch([filterTabs, () => store.originFilter], async () => {
  await nextTick()
  tabsScroll.update()
  tabsScroll.reveal(tabsEl.value?.querySelector<HTMLElement>('.category-tab.active') ?? null)
})

// Onglet disparu (dernière capacité de l'origine supprimée) → retour à « Toutes »
watch(filterTabs, (tabs) => {
  if (store.originFilter !== 'all' && !tabs.some((tab) => tab.id === store.originFilter)) {
    store.originFilter = 'all'
  }
})

const visibleFeatures = computed(() =>
  store.originFilter === 'all'
    ? store.features
    : store.features.filter((f) => f.origin === store.originFilter),
)

/* ── Cartes ── */

/** Descriptions dépliées (tap sur la carte) */
const expanded = ref<Set<string>>(new Set())

function toggleExpanded(id: string) {
  const next = new Set(expanded.value)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  expanded.value = next
}

function formatMod(mod: Modifier) {
  const sign = mod.value >= 0 ? '+' : '−'
  const n = Math.abs(mod.value).toLocaleString(locale.value, { maximumFractionDigits: 1 })
  const unit = mod.type === 'vitesse' ? ' m' : ''
  return `${t(`modifiers.${mod.type}`)} ${sign}${n}${unit}`
}

function removeFeature(feature: Feature) {
  const index = store.features.findIndex((f) => f.id === feature.id)
  if (index < 0) return
  if (editingId.value === feature.id) cancelForm()
  store.remove(feature.id)
  showToast(t('common.removedNamed', { name: feature.name }), () => store.restore(feature, index))
}

/* ── Formulaire ajout / édition ── */

const showForm = ref(false)
const editingId = ref<string | null>(null)
const name = ref('')
const origin = ref<FeatureOrigin>('classe')
const description = ref('')
const usesMax = ref(0)
const recharge = ref<FeatureRecharge>('long')
const modifiers = ref<Modifier[]>([])

const canSubmit = computed(() => !!name.value.trim())

function toggleAddForm() {
  if (showForm.value && !editingId.value) {
    cancelForm()
    return
  }
  editingId.value = null
  name.value = ''
  // Nouvelle capacité : l'origine suit l'onglet affiché
  origin.value = store.originFilter === 'all' ? 'classe' : store.originFilter
  description.value = ''
  usesMax.value = 0
  recharge.value = 'long'
  modifiers.value = []
  showForm.value = true
}

function openEdit(feature: Feature) {
  editingId.value = feature.id
  name.value = feature.name
  origin.value = feature.origin
  description.value = feature.description
  usesMax.value = feature.usesMax
  recharge.value = feature.recharge
  modifiers.value = feature.modifiers.map((m) => ({ ...m }))
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
  const payload = {
    name: name.value.trim(),
    origin: origin.value,
    description: description.value.trim(),
    usesMax: Number(usesMax.value) || 0,
    recharge: recharge.value,
    modifiers: modifiers.value
      .map((m) => ({ type: m.type, value: Number(m.value) || 0 }))
      .filter((m) => m.value !== 0),
  }
  if (editingId.value) store.update(editingId.value, payload)
  else store.add(payload)
  cancelForm()
}
</script>

<template>
  <div id="search-features" class="features search-target">
    <div class="view-lead">
      <div
        class="category-tabs-wrap"
        :class="{
          'fade-left': tabsScroll.canScrollLeft.value,
          'fade-right': tabsScroll.canScrollRight.value,
        }"
      >
        <div
          v-if="store.features.length"
          ref="tabsEl"
          class="category-tabs"
          role="group"
          :aria-label="t('features.filterLabel')"
        >
          <button
            type="button"
            class="category-tab"
            :class="{ active: store.originFilter === 'all' }"
            :aria-pressed="store.originFilter === 'all'"
            @click="store.originFilter = 'all'"
          >
            {{ t('features.filterAll') }}
            <span class="tab-count">{{ store.features.length }}</span>
          </button>
          <button
            v-for="tab in filterTabs"
            :key="tab.id"
            type="button"
            class="category-tab"
            :class="{ active: store.originFilter === tab.id }"
            :aria-pressed="store.originFilter === tab.id"
            @click="store.originFilter = tab.id"
          >
            {{ t(`features.origins.${tab.id}`) }}
            <span class="tab-count">{{ tab.count }}</span>
          </button>
        </div>
      </div>
      <button
        class="btn-add"
        type="button"
        :aria-label="t('features.addAria')"
        :aria-expanded="showForm && !editingId"
        @click="toggleAddForm"
      >
        {{ showForm && !editingId ? '✕' : t('common.add') }}
      </button>
    </div>

    <Transition name="slide">
      <form v-if="showForm" class="feature-form" @submit.prevent="submit">
        <h3 class="form-title">
          {{ editingId ? t('features.editTitle') : t('features.newTitle') }}
        </h3>

        <label class="field">
          <span>{{ t('features.name') }}</span>
          <input
            v-model="name"
            type="text"
            :maxlength="FEATURE_NAME_MAX"
            :placeholder="t('features.namePlaceholder')"
          />
        </label>

        <label class="field">
          <span>{{ t('features.origin') }}</span>
          <select v-model="origin">
            <option v-for="o in FEATURE_ORIGINS" :key="o" :value="o">
              {{ t(`features.origins.${o}`) }}
            </option>
          </select>
        </label>

        <div class="field-row">
          <div class="field uses-field">
            <span class="field-label title-with-tip">
              {{ t('features.uses') }}
              <InfoTip :title="t('features.uses')" :lines="[t('features.usesTip')]" />
            </span>
            <input
              v-model.number="usesMax"
              type="number"
              min="0"
              :max="FEATURE_USES_MAX"
              step="1"
              inputmode="numeric"
              :aria-label="t('features.uses')"
            />
          </div>
          <label class="field">
            <span>{{ t('features.recharge') }}</span>
            <select v-model="recharge" :disabled="!usesMax">
              <option v-for="r in FEATURE_RECHARGES" :key="r" :value="r">
                {{ t(`features.recharges.${r}`) }}
              </option>
            </select>
          </label>
        </div>

        <label class="field">
          <span>{{ t('features.description') }}</span>
          <textarea v-model="description" rows="1" :maxlength="FEATURE_DESCRIPTION_MAX" />
        </label>

        <div class="field">
          <div class="modifiers-head">
            <span class="field-label title-with-tip">
              {{ t('features.modifiers') }}
              <InfoTip :title="t('features.modifiers')" :lines="[t('features.modifiersTip')]" />
            </span>
            <button class="btn-add compact" type="button" @click="addModifier">
              {{ t('features.addModifier') }}
            </button>
          </div>
          <div v-for="(mod, index) in modifiers" :key="index" class="modifier-row">
            <select v-model="mod.type" :aria-label="t('features.modifiers')">
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
            {{ editingId ? t('common.save') : t('features.submit') }}
          </button>
        </div>
      </form>
    </Transition>

    <div v-if="!store.features.length" class="empty-state">
      <p>{{ t('features.empty') }}</p>
    </div>
    <div v-else-if="!visibleFeatures.length" class="empty-state">
      <p>{{ t('features.emptyFilter') }}</p>
    </div>

    <ul v-else class="feature-list">
      <li
        v-for="feature in visibleFeatures"
        :key="feature.id"
        :id="`search-feature-${feature.id}`"
        class="feature-card search-target"
        :class="{ editing: editingId === feature.id }"
      >
        <div class="feature-head">
          <button
            type="button"
            class="feature-title"
            :aria-expanded="feature.description ? expanded.has(feature.id) : undefined"
            @click="toggleExpanded(feature.id)"
          >
            <span class="feature-name">{{ feature.name }}</span>
            <span class="feature-meta">
              {{ t(`features.origins.${feature.origin}`) }}
              <template v-if="feature.usesMax">
                · {{ t(`features.recharges.${feature.recharge}`) }}</template
              >
            </span>
          </button>
          <div class="feature-actions">
            <ActionIconButton
              kind="edit"
              compact
              :label="t('features.editTitle')"
              @click="openEdit(feature)"
            />
            <ActionIconButton
              kind="remove"
              compact
              :label="t('features.remove', { name: feature.name })"
              @click="removeFeature(feature)"
            />
          </div>
        </div>

        <div v-if="feature.usesMax || feature.modifiers.length" class="feature-row">
          <div v-if="feature.usesMax" class="uses-counter">
            <button
              type="button"
              class="uses-btn hit-area"
              :disabled="feature.usesSpent >= feature.usesMax"
              :aria-label="t('features.spend', { name: feature.name })"
              @click="store.bumpUses(feature.id, -1)"
            >
              −
            </button>
            <span class="uses-value">{{
              t('features.usesLeft', {
                left: feature.usesMax - feature.usesSpent,
                max: feature.usesMax,
              })
            }}</span>
            <button
              type="button"
              class="uses-btn hit-area"
              :disabled="!feature.usesSpent"
              :aria-label="t('features.recover', { name: feature.name })"
              @click="store.bumpUses(feature.id, 1)"
            >
              +
            </button>
          </div>
          <div v-if="feature.modifiers.length" class="feature-mods">
            <span
              v-for="(mod, i) in feature.modifiers"
              :key="i"
              class="mod-tag"
              :class="{ positive: mod.value > 0, negative: mod.value < 0 }"
            >
              {{ formatMod(mod) }}
            </span>
          </div>
        </div>

        <p
          v-if="feature.description"
          class="feature-desc"
          :class="{ clamped: !expanded.has(feature.id) }"
          @click="toggleExpanded(feature.id)"
        >
          {{ feature.description }}
        </p>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.features {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  min-width: 0;
}

.view-lead {
  display: flex;
  align-items: center;
  gap: 0.65rem;
}

.view-lead .btn-add {
  flex-shrink: 0;
  margin-left: auto;
}

/* Onglets de filtre : mêmes que ceux de l'Inventaire */
.category-tabs-wrap {
  flex: 1 1 0;
  min-width: 0;
  position: relative;
}
.category-tabs-wrap::before,
.category-tabs-wrap::after {
  content: '';
  position: absolute;
  top: 0;
  bottom: 0;
  width: 1.5rem;
  pointer-events: none;
  opacity: 0;
  transition: opacity 0.15s;
  z-index: 1;
}
.category-tabs-wrap::before {
  left: 0;
  background: linear-gradient(to right, var(--color-bg-primary), transparent);
}
.category-tabs-wrap::after {
  right: 0;
  background: linear-gradient(to left, var(--color-bg-primary), transparent);
}
.category-tabs-wrap.fade-left::before,
.category-tabs-wrap.fade-right::after {
  opacity: 1;
}

.category-tabs {
  display: flex;
  cursor: grab;
  gap: 0.4rem;
  overflow-x: auto;
  overscroll-behavior-x: contain;
  scrollbar-width: none;
  padding-bottom: 0.1rem;
  min-width: 0;
}
.category-tabs::-webkit-scrollbar {
  display: none;
}

.category-tab {
  flex: 0 0 auto;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.35rem;
  white-space: nowrap;
  height: 2rem;
  box-sizing: border-box;
  padding: 0 0.7rem;
  line-height: 1;
  border-radius: 999px;
  border: 1px solid var(--color-border);
  background: var(--color-bg-secondary);
  color: var(--color-text-secondary);
  font-size: 0.82rem;
  font-weight: 600;
}
.category-tab.active {
  border-color: var(--color-accent);
  background: color-mix(in srgb, var(--color-accent) 22%, var(--color-bg-secondary));
  color: var(--color-text-primary);
}

.tab-count {
  line-height: 1;
  font-size: 0.7rem;
  font-weight: 700;
  color: var(--color-text-muted);
}
.category-tab.active .tab-count {
  color: var(--color-text-secondary);
}

/* Formulaire */
.feature-form {
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

.uses-field {
  flex: 0 0 auto;
  width: 7.5rem;
}

.title-with-tip {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
}

.field input,
.field select,
.field textarea,
.modifier-row input,
.modifier-row select {
  background: var(--color-bg-input);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  padding: 0.5rem 0.6rem;
  color: var(--color-text-primary);
  font-size: 0.9rem;
  font-family: inherit;
  min-width: 0;
}

.field textarea {
  /* Une ligne au départ, agrandie par la poignée en bas à droite (jamais sous une ligne) */
  resize: vertical;
  line-height: 1.4;
  min-height: calc(1.4em + 1rem + 2px);
}

.field select:disabled {
  opacity: 0.5;
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

.form-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
}

/* Cartes */
.feature-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.55rem;
}

.feature-card {
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
  padding: 0.6rem 0.7rem;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-bg-card);
  min-width: 0;
}
.feature-card.editing {
  border-color: var(--color-accent);
}

.feature-head {
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
  min-width: 0;
}

.feature-title {
  flex: 1 1 auto;
  min-width: 0;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.1rem;
  padding: 0;
  border: none;
  background: none;
  color: inherit;
  text-align: left;
  font: inherit;
}

.feature-name {
  font-weight: 700;
  font-size: 0.95rem;
  color: var(--color-text-primary);
  overflow-wrap: anywhere;
}

.feature-meta {
  font-size: 0.72rem;
  color: var(--color-text-muted);
}

.feature-actions {
  display: flex;
  gap: 0.35rem;
  flex-shrink: 0;
}

.feature-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem;
  min-width: 0;
}

.uses-counter {
  display: flex;
  align-items: center;
  gap: 0.25rem;
}

.uses-btn {
  width: 2rem;
  height: 2rem;
  border-radius: var(--radius-sm);
  border: 1px solid var(--color-border);
  background: var(--color-bg-secondary);
  color: var(--color-text-primary);
  font-weight: 800;
  line-height: 1;
}
.uses-btn:disabled {
  opacity: 0.35;
}

.uses-value {
  font-size: 0.85rem;
  font-weight: 800;
  min-width: 2.6rem;
  text-align: center;
}

.feature-mods {
  display: flex;
  flex-wrap: wrap;
  gap: 0.3rem;
  min-width: 0;
}

/* Mêmes étiquettes que l'Équipement, sur le fond de la carte */
.mod-tag {
  font-size: 0.7rem;
  font-weight: 600;
  padding: 0.12rem 0.4rem;
  border-radius: 3px;
  background: var(--color-bg-secondary);
  color: var(--color-text-secondary);
}
.mod-tag.positive {
  color: var(--color-success);
}
.mod-tag.negative {
  color: var(--color-danger);
}

.feature-desc {
  margin: 0;
  font-size: 0.85rem;
  line-height: 1.45;
  color: var(--color-text-secondary);
  white-space: pre-line;
  overflow-wrap: anywhere;
}
/* Description repliée : 3 lignes, le tap sur la carte la déplie */
.feature-desc.clamped {
  display: -webkit-box;
  -webkit-line-clamp: 3;
  line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.slide-enter-active,
.slide-leave-active {
  transition: all 0.25s ease;
}
.slide-enter-from,
.slide-leave-to {
  opacity: 0;
  transform: translateY(-10px);
}
</style>
