<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  useInventoryStore,
  MODIFIER_LABELS,
  CUSTOM_CATEGORY_MAX,
  CUSTOM_CATEGORY_NAME_MAX,
  type ModifierType,
  type EquipmentCategory,
  type Modifier,
  type EquipmentItem,
} from '@/stores/inventory'
import {
  DAMAGE_TYPES,
  DICE_FACES,
  createEmptyWeaponDamage,
  formatDice,
  type WeaponDamageProfile,
} from '@/utils/combatTypes'
import ActionIconButton from '@/components/ActionIconButton.vue'
import LeadNote from '@/components/LeadNote.vue'
import { useCategoryLabel } from '@/composables/useCategoryLabel'
import { useHorizontalScroll } from '@/composables/useHorizontalScroll'
import { useToast } from '@/composables/useToast'

const { t } = useI18n()
const store = useInventoryStore()
const categoryLabel = useCategoryLabel()
const { show: showToast } = useToast()

/** Suppression immédiate, annulable quelques secondes */
function removeItem(id: string) {
  const index = store.items.findIndex((i) => i.id === id)
  const item = store.items[index]
  if (!item) return
  store.removeItem(id)
  showToast(item.name ? t('common.removedNamed', { name: item.name }) : t('common.removed'), () =>
    store.restoreItem(item, index),
  )
}

const showForm = ref(false)
const editingId = ref<string | null>(null)
const newName = ref('')
const DEFAULT_CATEGORY: EquipmentCategory = 'autre'
const newCategory = ref<EquipmentCategory>(DEFAULT_CATEGORY)
const newDescription = ref('')
const newModifiers = ref<Modifier[]>([])
const newWeaponDamage = ref<WeaponDamageProfile[]>([])

const modifierTypes = Object.keys(MODIFIER_LABELS) as ModifierType[]

/* ── Filtre par catégorie ── */

const categoryCounts = computed(() => {
  const counts: Record<string, number> = {}
  for (const item of store.items) counts[item.category] = (counts[item.category] ?? 0) + 1
  return counts
})

/** Onglets : catégories qui ont des objets, plus celles du joueur (même vides) */
const filterTabs = computed(() =>
  store.allCategories
    .map((id) => ({
      id,
      label: categoryLabel(id),
      count: categoryCounts.value[id] ?? 0,
      custom: store.customCategories.some((c) => c.id === id),
    }))
    .filter((tab) => tab.count > 0 || tab.custom),
)

const tabsEl = ref<HTMLElement | null>(null)
const tabsScroll = useHorizontalScroll(tabsEl)

// Onglets ajoutés / retirés ou onglet actif changé : indicateurs à jour + onglet actif visible
watch([filterTabs, () => store.categoryFilter], async () => {
  await nextTick()
  tabsScroll.update()
  tabsScroll.reveal(tabsEl.value?.querySelector<HTMLElement>('.category-tab.active') ?? null)
})

const visibleItems = computed(() =>
  store.categoryFilter === 'all'
    ? store.items
    : store.items.filter((item) => item.category === store.categoryFilter),
)

// Onglet disparu (dernier objet supprimé ou recatégorisé) → retour à « Tous »
watch(filterTabs, (tabs) => {
  if (store.categoryFilter !== 'all' && !tabs.some((tab) => tab.id === store.categoryFilter)) {
    store.categoryFilter = 'all'
  }
})

function selectFilter(id: EquipmentCategory | 'all') {
  showCategoryForm.value = false
  store.categoryFilter = id
}

/** Onglet surligné : aucun pendant que le menu d'ajout de catégorie est ouvert */
function isTabActive(id: EquipmentCategory | 'all') {
  return !showCategoryForm.value && store.categoryFilter === id
}

// Formulaire de nouvel objet ouvert : sa catégorie suit l'onglet choisi
watch(
  () => store.categoryFilter,
  (filter) => {
    if (showForm.value && !editingId.value && filter !== 'all') newCategory.value = filter
  },
)

/** Nouvel objet : dans la catégorie affichée, sinon « Autre » */
function defaultCategory(): EquipmentCategory {
  return store.categoryFilter === 'all' ? DEFAULT_CATEGORY : store.categoryFilter
}

/* ── Catégories du joueur ── */

const showCategoryForm = ref(false)
const newCategoryName = ref('')

const categoryNameTaken = computed(() => store.isCategoryNameTaken(newCategoryName.value))
const categoryLimitReached = computed(() => store.customCategories.length >= CUSTOM_CATEGORY_MAX)
const canAddCategory = computed(
  () => !!newCategoryName.value.trim() && !categoryNameTaken.value && !categoryLimitReached.value,
)

function toggleCategoryForm() {
  showCategoryForm.value = !showCategoryForm.value
  newCategoryName.value = ''
}

function submitCategory() {
  if (!canAddCategory.value) return
  const id = store.addCategory(newCategoryName.value)
  if (!id) return
  // La nouvelle catégorie devient l'onglet actif et le menu d'ajout se ferme
  selectFilter(id)
}

function removeCategory(id: string) {
  const name = categoryLabel(id)
  const n = categoryCounts.value[id] ?? 0
  if (
    n &&
    !confirm(t('inventory.confirmDeleteCategory', { name, n, other: t('categories.autre') }))
  ) {
    return
  }
  store.removeCategory(id)
}

function resetForm() {
  editingId.value = null
  newName.value = ''
  newCategory.value = DEFAULT_CATEGORY
  newDescription.value = ''
  newModifiers.value = []
  newWeaponDamage.value = []
  showForm.value = false
}

function toggleAddForm() {
  if (showForm.value && !editingId.value) {
    resetForm()
    return
  }
  editingId.value = null
  newName.value = ''
  newCategory.value = defaultCategory()
  newDescription.value = ''
  newModifiers.value = []
  newWeaponDamage.value = []
  if (newCategory.value === 'arme') newWeaponDamage.value = [createEmptyWeaponDamage({ label: '' })]
  showForm.value = true
}

// Une ligne de dégâts n'est proposée que lorsqu'on choisit « Arme » à la création
watch(newCategory, (category) => {
  if (category === 'arme' && !editingId.value && newWeaponDamage.value.length === 0) {
    newWeaponDamage.value = [createEmptyWeaponDamage({ label: '' })]
  }
})

function startEdit(item: EquipmentItem) {
  editingId.value = item.id
  newName.value = item.name
  newCategory.value = item.category
  newDescription.value = item.description
  newModifiers.value = item.modifiers.map((m) => ({ ...m }))
  newWeaponDamage.value = (item.weaponDamage ?? []).map((p) => ({ ...p }))
  showForm.value = true
}

function addModifier() {
  newModifiers.value.push({ type: 'attaque', value: 0 })
}

function removeModifier(index: number) {
  newModifiers.value.splice(index, 1)
}

function addWeaponDamage() {
  newWeaponDamage.value.push(
    createEmptyWeaponDamage({
      label: '',
      diceCount: 1,
      diceFaces: 6,
      damageType: 'froid',
    }),
  )
}

function removeWeaponDamage(index: number) {
  newWeaponDamage.value.splice(index, 1)
}

function submitItem() {
  if (!newName.value.trim()) return

  const isWeapon = newCategory.value === 'arme'
  const payload = {
    name: newName.value.trim(),
    category: newCategory.value,
    description: newDescription.value.trim(),
    modifiers: [...newModifiers.value],
    weaponDamage: isWeapon
      ? newWeaponDamage.value.map((p) => ({
          ...p,
          label: '',
          diceCount: Math.max(0, Number(p.diceCount) || 0),
          diceFaces: Number(p.diceFaces) || 6,
          flatBonus: Number(p.flatBonus) || 0,
        }))
      : [],
  }

  if (editingId.value) {
    store.updateItem(editingId.value, payload)
  } else {
    store.addItem({ ...payload, equipped: false })
  }

  resetForm()
}

function formatModifier(mod: Modifier): string {
  const sign = mod.value >= 0 ? '+' : ''
  return `${t(`modifiers.${mod.type}`)} ${sign}${mod.value}`
}

function formatWeaponPart(part: WeaponDamageProfile): string {
  return `${formatDice(part.diceCount, part.diceFaces, part.flatBonus)} ${t(`damageTypes.${part.damageType}`)}`
}
</script>

<template>
  <div class="inventory">
    <LeadNote id="inventory" :text="t('inventory.hint', { character: t('tabs.character') })" />

    <div id="search-inventory" class="view-lead search-target">
      <div
        class="category-tabs-wrap"
        :class="{
          'fade-left': tabsScroll.canScrollLeft.value,
          'fade-right': tabsScroll.canScrollRight.value,
        }"
      >
        <div
          ref="tabsEl"
          class="category-tabs"
          role="group"
          :aria-label="t('inventory.filterLabel')"
        >
          <button
            type="button"
            class="category-tab"
            :class="{ active: isTabActive('all') }"
            :aria-pressed="isTabActive('all')"
            @click="selectFilter('all')"
          >
            {{ t('inventory.filterAll') }}
            <span class="tab-count">{{ store.items.length }}</span>
          </button>
          <button
            v-for="tab in filterTabs"
            :key="tab.id"
            type="button"
            class="category-tab"
            :class="{ active: isTabActive(tab.id) }"
            :aria-pressed="isTabActive(tab.id)"
            @click="selectFilter(tab.id)"
          >
            {{ tab.label }}
            <span class="tab-count">{{ tab.count }}</span>
          </button>
          <button
            type="button"
            class="category-tab add-tab"
            :class="{ active: showCategoryForm }"
            :aria-expanded="showCategoryForm"
            :aria-label="t('inventory.manageCategories')"
            @click="toggleCategoryForm"
          >
            {{ showCategoryForm ? '✕' : '+' }}
          </button>
        </div>
      </div>
      <button id="search-inventory-add" class="btn-add search-target" @click="toggleAddForm">
        {{ showForm && !editingId ? '✕' : t('common.add') }}
      </button>
    </div>

    <Transition name="slide">
      <div v-if="showCategoryForm" class="category-form">
        <form class="category-add-row" @submit.prevent="submitCategory">
          <input
            v-model="newCategoryName"
            type="text"
            :maxlength="CUSTOM_CATEGORY_NAME_MAX"
            :placeholder="t('inventory.categoryNamePlaceholder')"
            :aria-label="t('inventory.categoryNamePlaceholder')"
            :disabled="categoryLimitReached"
          />
          <button class="btn-add" type="submit" :disabled="!canAddCategory">
            {{ t('common.add') }}
          </button>
        </form>
        <p v-if="categoryNameTaken" class="category-error">{{ t('inventory.categoryTaken') }}</p>
        <p v-else-if="categoryLimitReached" class="category-error">
          {{ t('inventory.categoryLimit', { n: CUSTOM_CATEGORY_MAX }) }}
        </p>
        <ul v-if="store.customCategories.length" class="custom-category-list">
          <li v-for="cat in store.customCategories" :key="cat.id" class="custom-category-row">
            <span class="custom-category-name">{{ cat.name }}</span>
            <span class="tab-count">{{ categoryCounts[cat.id] ?? 0 }}</span>
            <ActionIconButton
              kind="remove"
              compact
              :label="t('inventory.deleteCategory', { name: cat.name })"
              @click="removeCategory(cat.id)"
            />
          </li>
        </ul>
      </div>
    </Transition>

    <Transition name="slide">
      <div v-if="showForm" class="add-form">
        <div class="form-group">
          <label>{{ t('inventory.name') }}</label>
          <input v-model="newName" type="text" :placeholder="t('inventory.namePlaceholder')" />
        </div>

        <div class="form-group">
          <label>{{ t('inventory.category') }}</label>
          <div class="select-field">
            <select v-model="newCategory">
              <option v-for="value in store.allCategories" :key="value" :value="value">
                {{ categoryLabel(value) }}
              </option>
            </select>
          </div>
        </div>

        <div class="form-group">
          <label>{{ t('inventory.description') }}</label>
          <input
            v-model="newDescription"
            type="text"
            :placeholder="t('inventory.descriptionPlaceholder')"
          />
        </div>

        <div class="form-group">
          <div class="modifiers-header">
            <label>{{ t('inventory.modifiers') }}</label>
            <button class="btn-add compact" type="button" @click="addModifier">
              {{ t('inventory.addModifier') }}
            </button>
          </div>

          <div v-for="(mod, index) in newModifiers" :key="index" class="modifier-row">
            <select v-model="mod.type">
              <option v-for="value in modifierTypes" :key="value" :value="value">
                {{ t(`modifiers.${value}`) }}
              </option>
            </select>
            <input v-model.number="mod.value" type="number" placeholder="0" />
            <ActionIconButton
              kind="remove"
              compact
              :label="t('common.delete')"
              @click="removeModifier(index)"
            />
          </div>
        </div>

        <div v-if="newCategory === 'arme'" class="form-group weapon-damage-section">
          <div class="modifiers-header">
            <label>{{ t('inventory.weaponDamage') }}</label>
            <button class="btn-add compact" type="button" @click="addWeaponDamage">
              {{ t('inventory.addWeaponDamage') }}
            </button>
          </div>

          <div v-for="(part, index) in newWeaponDamage" :key="part.id" class="weapon-damage-block">
            <div class="weapon-damage-row">
              <input
                v-model.number="part.diceCount"
                type="number"
                min="0"
                max="20"
                class="weapon-dice-count"
                :aria-label="t('combat.diceCount')"
              />
              <select
                v-model.number="part.diceFaces"
                class="weapon-die-select"
                :aria-label="t('combat.die')"
              >
                <option v-for="d in DICE_FACES" :key="d" :value="d">d{{ d }}</option>
              </select>
              <input
                v-model.number="part.flatBonus"
                type="number"
                class="weapon-flat"
                :title="t('combat.flatBonus')"
                :aria-label="t('combat.flatBonus')"
                placeholder="+0"
              />
              <select
                v-model="part.damageType"
                class="weapon-type-select"
                :aria-label="t('combat.type')"
              >
                <option v-for="dtype in DAMAGE_TYPES" :key="dtype" :value="dtype">
                  {{ t(`damageTypes.${dtype}`) }}
                </option>
              </select>
              <ActionIconButton
                kind="remove"
                compact
                :label="t('common.delete')"
                @click="removeWeaponDamage(index)"
              />
            </div>
          </div>
        </div>

        <div class="form-actions">
          <button v-if="editingId" class="btn-secondary" type="button" @click="resetForm">
            {{ t('common.cancel') }}
          </button>
          <button class="btn-primary" type="button" :disabled="!newName.trim()" @click="submitItem">
            {{ editingId ? t('common.save') : t('inventory.submit') }}
          </button>
        </div>
      </div>
    </Transition>

    <div v-if="store.items.length === 0 && !showForm" class="empty-state">
      <p>{{ t('inventory.emptyTitle') }}</p>
      <p class="hint">{{ t('inventory.emptyHint') }}</p>
    </div>

    <p v-else-if="store.items.length && !visibleItems.length" class="empty-state">
      {{ t('inventory.emptyCategory') }}
    </p>

    <TransitionGroup name="list" tag="div" class="items-list">
      <div
        v-for="item in visibleItems"
        :key="item.id"
        :id="`search-item-${item.id}`"
        class="item-card search-target"
        :class="{ equipped: item.equipped }"
      >
        <div class="item-main">
          <div class="item-info">
            <div class="item-name">
              <span class="category-badge">{{ categoryLabel(item.category) }}</span>
              {{ item.name }}
              <span v-if="item.equipped" class="equipped-badge">{{ t('inventory.equipped') }}</span>
            </div>
            <div v-if="item.description" class="item-desc">{{ item.description }}</div>
            <div v-if="item.modifiers.length" class="item-modifiers">
              <span
                v-for="(mod, i) in item.modifiers"
                :key="i"
                class="modifier-tag"
                :class="{ positive: mod.value > 0, negative: mod.value < 0 }"
              >
                {{ formatModifier(mod) }}
              </span>
            </div>
            <div
              v-if="item.category === 'arme' && item.weaponDamage?.length"
              class="item-weapon-damage"
            >
              <span v-for="part in item.weaponDamage" :key="part.id" class="weapon-dmg-tag">
                {{ formatWeaponPart(part) }}
              </span>
            </div>
          </div>
          <div class="item-side-actions">
            <ActionIconButton kind="edit" :label="t('common.edit')" @click.stop="startEdit(item)" />
            <ActionIconButton
              kind="remove"
              :label="t('common.delete')"
              @click.stop="removeItem(item.id)"
            />
          </div>
        </div>
      </div>
    </TransitionGroup>
  </div>
</template>

<style scoped>
.inventory {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.view-lead {
  display: flex;
  align-items: center;
  gap: 0.65rem;
}

.view-lead .btn-add {
  flex-shrink: 0;
}

.category-tabs-wrap {
  flex: 1 1 0;
  min-width: 0;
  position: relative;
}
/* Fondu au bord quand des onglets sont masqués : on devine qu'il y a de la suite */
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
  /* Défilement horizontal interne : la page ne déborde jamais */
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
  /* Hauteur fixe + line-height 1 : texte centré quelle que soit la police */
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
.category-tab.add-tab {
  min-width: 2.2rem;
  justify-content: center;
  font-size: 1rem;
  padding-inline: 0.6rem;
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

.category-form {
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  padding: 0.75rem;
  display: flex;
  flex-direction: column;
  gap: 0.55rem;
  min-width: 0;
}

.category-add-row {
  display: flex;
  gap: 0.5rem;
  min-width: 0;
}
.category-add-row input {
  flex: 1 1 auto;
  min-width: 0;
  background: var(--color-bg-input);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  padding: 0.5rem 0.7rem;
  color: var(--color-text-primary);
  font-size: 0.9rem;
}
.category-add-row input:focus {
  border-color: var(--color-accent);
}
.category-add-row .btn-add {
  flex-shrink: 0;
}
.category-add-row .btn-add:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.category-error {
  font-size: 0.78rem;
  color: var(--color-danger);
}

.custom-category-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.custom-category-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  min-width: 0;
}

.custom-category-name {
  flex: 1 1 auto;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 0.9rem;
}

.add-form {
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  padding: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.8rem;
  min-width: 0;
  max-width: 100%;
  box-sizing: border-box;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  min-width: 0;
}
.form-group input,
.form-group select {
  background: var(--color-bg-input);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  padding: 0.6rem 0.8rem;
  color: var(--color-text-primary);
  font-size: 0.95rem;
}
.form-group input:focus,
.form-group select:focus {
  border-color: var(--color-accent);
}

.select-field {
  position: relative;
}

.select-field::after {
  content: '';
  position: absolute;
  right: 0.95rem;
  top: 50%;
  width: 0.42rem;
  height: 0.42rem;
  border-right: 2px solid var(--color-text-secondary);
  border-bottom: 2px solid var(--color-text-secondary);
  transform: translateY(-70%) rotate(45deg);
  pointer-events: none;
}

.select-field select {
  width: 100%;
  appearance: none;
  -webkit-appearance: none;
  padding-right: 2.35rem;
}

.modifiers-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 0.5rem;
}

.modifiers-header .btn-add {
  flex-shrink: 0;
}

.modifier-row {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  align-items: center;
  margin-top: 0.4rem;
  min-width: 0;
}
.modifier-row select {
  flex: 1 1 8rem;
  min-width: 0;
  background: var(--color-bg-input);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  padding: 0.5rem;
  color: var(--color-text-primary);
  font-size: 0.85rem;
}
.modifier-row input {
  flex: 0 1 4.5rem;
  min-width: 0;
  background: var(--color-bg-input);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  padding: 0.5rem;
  color: var(--color-text-primary);
  text-align: center;
  font-size: 0.85rem;
}

.weapon-damage-section {
  margin-top: 0.25rem;
  min-width: 0;
}

.weapon-damage-block {
  background: var(--color-bg-card);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  padding: 0.55rem;
  margin-top: 0.45rem;
  min-width: 0;
  overflow: hidden;
}

.weapon-damage-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.4rem;
  min-width: 0;
}

.weapon-damage-row input,
.weapon-damage-row select {
  min-width: 0;
  box-sizing: border-box;
  background: var(--color-bg-input);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  padding: 0.45rem 0.35rem;
  color: var(--color-text-primary);
  font-size: 0.85rem;
}

.weapon-damage-row input {
  text-align: center;
}

.weapon-dice-count {
  width: 2.75rem;
  flex: 0 0 auto;
}

.weapon-die-select {
  width: 3.75rem;
  flex: 0 0 auto;
}

.weapon-flat {
  width: 3rem;
  flex: 0 0 auto;
}

.weapon-type-select {
  width: 7.75rem;
  flex: 0 0 auto;
  padding-right: 1.35rem;
}

.item-weapon-damage {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
  margin-top: 0.4rem;
}

.weapon-dmg-tag {
  font-size: 0.72rem;
  padding: 0.15rem 0.45rem;
  border-radius: var(--radius-sm);
  background: color-mix(in srgb, var(--color-accent) 18%, transparent);
  color: var(--color-text-secondary);
  border: 1px solid color-mix(in srgb, var(--color-accent) 35%, transparent);
}

.form-actions {
  margin-top: 0.3rem;
}

.items-list {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}

.item-card {
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  overflow: hidden;
  transition: border-color 0.2s;
}
.item-main {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 0.55rem;
  padding: 0.75rem 0.85rem;
}

.item-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  padding-top: 0.15rem;
}

.item-name {
  font-weight: 600;
  font-size: 1rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.category-badge {
  font-size: 0.65rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  background: var(--color-bg-card);
  color: var(--color-text-secondary);
  padding: 0.15rem 0.4rem;
  border-radius: 3px;
}

.item-desc {
  font-size: 0.8rem;
  color: var(--color-text-secondary);
}

.item-modifiers {
  display: flex;
  flex-wrap: wrap;
  gap: 0.3rem;
  margin-top: 0.2rem;
}

.modifier-tag {
  font-size: 0.75rem;
  font-weight: 600;
  padding: 0.15rem 0.45rem;
  border-radius: 3px;
  background: var(--color-bg-card);
  color: var(--color-text-secondary);
}
.modifier-tag.positive {
  color: var(--color-success);
}
.modifier-tag.negative {
  color: var(--color-danger);
}

.equipped-badge {
  font-size: 0.65rem;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  white-space: nowrap;
  color: #0d3d2c;
  background: var(--color-success);
  padding: 0.15rem 0.45rem;
  border-radius: 3px;
}

.item-side-actions {
  display: flex;
  flex-direction: column;
  justify-content: flex-start;
  align-items: center;
  flex-shrink: 0;
  width: 2.25rem;
  gap: 0.65rem;
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

.list-enter-active,
.list-leave-active {
  transition: all 0.3s ease;
}
.list-enter-from,
.list-leave-to {
  opacity: 0;
  transform: translateX(-20px);
}
</style>
