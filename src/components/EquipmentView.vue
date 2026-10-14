<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  useInventoryStore,
  type EquipmentCategory,
  type EquipmentItem,
  type ModifierType,
} from '@/stores/inventory'
import LeadNote from '@/components/LeadNote.vue'
import { useCategoryLabel } from '@/composables/useCategoryLabel'

const { t, locale } = useI18n()
const store = useInventoryStore()

const props = withDefaults(
  defineProps<{
    section?: 'equipable' | 'capacite' | 'traits'
  }>(),
  { section: 'equipable' },
)

const categoryLabel = useCategoryLabel()

const openAvailable = ref<Set<EquipmentCategory>>(new Set())

const equippedByCategory = computed(() => {
  const map: Partial<Record<EquipmentCategory, EquipmentItem[]>> = {}
  for (const item of store.equippedItems) {
    if (!map[item.category]) map[item.category] = []
    map[item.category]!.push(item)
  }
  return map
})

const availableByCategory = computed(() => {
  const map: Partial<Record<EquipmentCategory, EquipmentItem[]>> = {}
  for (const item of store.unequippedItems) {
    if (!map[item.category]) map[item.category] = []
    map[item.category]!.push(item)
  }
  return map
})

const availableCategories = computed(() =>
  store.allCategories.filter((cat) => (availableByCategory.value[cat]?.length ?? 0) > 0),
)

const activeBonusEntries = computed(() =>
  (Object.entries(store.totalModifiers) as [ModifierType, number][])
    .filter(([, v]) => v !== 0)
    .sort((a, b) => t(`modifiers.${a[0]}`).localeCompare(t(`modifiers.${b[0]}`), locale.value)),
)

function formatMod(type: ModifierType, value: number) {
  const sign = value >= 0 ? '+' : ''
  return `${t(`modifiers.${type}`)} ${sign}${value}`
}

function isAvailableOpen(cat: EquipmentCategory) {
  return openAvailable.value.has(cat)
}

function toggleAvailable(cat: EquipmentCategory) {
  const next = new Set(openAvailable.value)
  if (next.has(cat)) next.delete(cat)
  else next.add(cat)
  openAvailable.value = next
}
</script>

<template>
  <div class="equipment">
    <template v-if="props.section === 'equipable'">
      <LeadNote
        id="equipment"
        :text="t('equipment.intro', { stats: t('tabs.stats'), combat: t('tabs.combat') })"
      />

      <div id="search-equipment" class="equip-stack search-target">
        <!-- Récap bonus actifs -->
        <section id="search-equipment-bonuses" class="equip-section search-target">
          <div class="section-head">
            <h3 class="section-title">{{ t('equipment.activeBonuses') }}</h3>
            <span v-if="!activeBonusEntries.length" class="hint">{{
              t('equipment.noBonuses')
            }}</span>
          </div>
          <div v-if="activeBonusEntries.length" class="bonus-chips">
            <span
              v-for="[type, value] in activeBonusEntries"
              :key="type"
              class="bonus-chip"
              :class="{ positive: value > 0, negative: value < 0 }"
            >
              {{ formatMod(type, value) }}
            </span>
          </div>
        </section>

        <!-- Emplacements équipés -->
        <section id="search-equipment-slots" class="equip-section worn-section search-target">
          <div class="section-head">
            <h3 class="section-title">{{ t('equipment.worn') }}</h3>
            <span v-if="store.equippedItems.length" class="worn-count">
              {{ store.equippedItems.length }}
            </span>
          </div>

          <div v-if="!store.equippedItems.length" class="hint">
            {{ t('equipment.nothingEquipped') }}
          </div>

          <div v-for="cat in store.allCategories" :key="`eq-${cat}`">
            <div v-if="equippedByCategory[cat]?.length" class="slot-group">
              <div class="slot-label">
                <span class="slot-name">{{ categoryLabel(cat) }}</span>
                <span class="slot-rule" aria-hidden="true" />
              </div>
              <div
                v-for="item in equippedByCategory[cat]"
                :key="item.id"
                :id="`search-equipped-${item.id}`"
                class="item-card search-target"
              >
                <div class="item-body">
                  <div class="item-name">{{ item.name }}</div>
                  <div v-if="item.description" class="item-desc">{{ item.description }}</div>
                  <div v-if="item.modifiers.length" class="item-mods">
                    <span
                      v-for="(mod, i) in item.modifiers"
                      :key="i"
                      class="mod-tag"
                      :class="{ positive: mod.value > 0, negative: mod.value < 0 }"
                    >
                      {{ formatMod(mod.type, mod.value) }}
                    </span>
                  </div>
                </div>
                <button
                  class="btn-unequip"
                  type="button"
                  :aria-label="t('equipment.unequipItem', { name: item.name })"
                  @click="store.unequipItem(item.id)"
                >
                  {{ t('equipment.unequip') }}
                </button>
              </div>
            </div>
          </div>
        </section>

        <!-- Disponibles dans l'inventaire -->
        <section id="search-equipment-available" class="equip-section search-target">
          <h3 class="section-title">{{ t('equipment.available') }}</h3>

          <div v-if="!store.unequippedItems.length" class="hint">
            <template v-if="!store.items.length">
              {{ t('equipment.emptyInventory') }}
            </template>
            <template v-else>{{ t('equipment.allEquipped') }}</template>
          </div>

          <div v-else class="accordion">
            <div v-for="cat in availableCategories" :key="`av-${cat}`" class="accordion-item">
              <button
                type="button"
                class="accordion-trigger"
                :aria-expanded="isAvailableOpen(cat)"
                @click="toggleAvailable(cat)"
              >
                <span class="accordion-label">{{ categoryLabel(cat) }}</span>
                <span class="accordion-count">{{ availableByCategory[cat]!.length }}</span>
                <span class="accordion-chevron" :class="{ open: isAvailableOpen(cat) }">›</span>
              </button>
              <div v-show="isAvailableOpen(cat)" class="accordion-panel">
                <div
                  v-for="item in availableByCategory[cat]"
                  :key="item.id"
                  :id="`search-available-${item.id}`"
                  class="item-card search-target"
                >
                  <div class="item-body">
                    <div class="item-name">{{ item.name }}</div>
                    <div v-if="item.description" class="item-desc">{{ item.description }}</div>
                    <div v-if="item.modifiers.length" class="item-mods">
                      <span
                        v-for="(mod, i) in item.modifiers"
                        :key="i"
                        class="mod-tag"
                        :class="{ positive: mod.value > 0, negative: mod.value < 0 }"
                      >
                        {{ formatMod(mod.type, mod.value) }}
                      </span>
                    </div>
                  </div>
                  <button class="btn-equip" type="button" @click="store.equipItem(item.id)">
                    {{ t('equipment.equip') }}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </template>

    <section v-else-if="props.section === 'capacite'" class="placeholder-panel">
      <p class="hint">{{ t('equipment.capacitePlaceholder') }}</p>
    </section>

    <section v-else class="placeholder-panel">
      <p class="hint">{{ t('equipment.traitsPlaceholder') }}</p>
    </section>
  </div>
</template>

<style scoped>
.equipment {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  padding-bottom: 1rem;
}

.equip-stack {
  display: flex;
  flex-direction: column;
}

.equip-section {
  padding: 0.55rem 0 0.5rem;
  border-top: 1px solid var(--color-border);
}

.equip-section:first-child {
  border-top: none;
  padding-top: 0;
}

/* Section « Équipé » : panneau légèrement teinté plutôt qu'un cadre vert par objet */
.worn-section {
  margin: 0.45rem 0 0.55rem;
  padding: 0.6rem 0.65rem 0.65rem;
  border: 1px solid color-mix(in srgb, var(--color-success) 40%, var(--color-border));
  border-radius: var(--radius-md);
  background: color-mix(in srgb, var(--color-success) 9%, transparent);
}
.worn-section + .equip-section {
  border-top: none;
}
.worn-section .section-title {
  border-left-color: var(--color-success);
  color: var(--color-text-primary);
}

.worn-count {
  font-size: 0.7rem;
  font-weight: 800;
  line-height: 1;
  padding: 0.2rem 0.45rem;
  border-radius: 999px;
  color: #0d3d2c;
  background: var(--color-success);
}

.section-title {
  margin: 0 0 0.35rem;
}

.bonus-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 0.3rem;
}

.bonus-chip {
  font-size: 0.78rem;
  font-weight: 700;
  padding: 0.2rem 0.45rem;
  border-radius: var(--radius-sm);
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border);
  color: var(--color-text-secondary);
}

.bonus-chip.positive {
  color: var(--color-success);
}

.bonus-chip.negative {
  color: var(--color-danger);
}

.section-head {
  display: flex;
  align-items: baseline;
  flex-wrap: wrap;
  gap: 0.25rem 0.6rem;
  margin-bottom: 0.35rem;
}
.section-head .section-title {
  margin-bottom: 0;
}

.slot-group {
  margin-bottom: 0.5rem;
}

.slot-group:last-child {
  margin-bottom: 0;
}

.slot-label {
  margin-bottom: 0.35rem;
  display: flex;
  align-items: center;
  gap: 0.45rem;
  min-width: 0;
}

/* Intertitre : nom en majuscules + trait fin jusqu'au bord */
.slot-name {
  flex: 0 1 auto;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 0.75rem;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--color-accent);
}

.slot-rule {
  flex: 1 1 1.5rem;
  min-width: 1.5rem;
  height: 1px;
  background: color-mix(in srgb, var(--color-accent) 45%, var(--color-border));
}

.item-card {
  display: flex;
  gap: 0.6rem;
  align-items: stretch;
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  padding: 0.6rem 0.7rem;
  margin-bottom: 0.35rem;
}

.item-card:last-child {
  margin-bottom: 0;
}

.item-body {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.item-name {
  font-weight: 700;
  font-size: 0.95rem;
}

.item-desc {
  font-size: 0.8rem;
  color: var(--color-text-secondary);
}

.item-mods {
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem;
}

.mod-tag {
  font-size: 0.7rem;
  font-weight: 600;
  padding: 0.12rem 0.4rem;
  border-radius: 3px;
  background: var(--color-bg-card);
  color: var(--color-text-secondary);
}

.mod-tag.positive {
  color: var(--color-success);
}

.mod-tag.negative {
  color: var(--color-danger);
}

.btn-equip,
.btn-unequip {
  flex-shrink: 0;
  align-self: center;
}

.btn-equip,
.btn-unequip {
  padding: 0.55rem 0.7rem;
  border-radius: var(--radius-sm);
  font-size: 0.75rem;
  font-weight: 700;
  white-space: nowrap;
}

.btn-equip {
  background: var(--color-accent);
  color: var(--color-on-accent);
}

/* Action inverse de « Équiper » : même forme, en rouge */
.btn-unequip {
  background: var(--color-danger);
  color: var(--color-on-accent);
}

.accordion {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.accordion-item {
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  overflow: hidden;
}

.accordion-trigger {
  width: 100%;
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto auto;
  align-items: center;
  gap: 0.5rem;
  padding: 0.6rem 0.7rem;
  background: transparent;
  color: var(--color-text-primary);
  text-align: left;
}

.accordion-label {
  font-size: 0.85rem;
  font-weight: 700;
}

.accordion-count {
  min-width: 1.4rem;
  height: 1.4rem;
  padding: 0 0.35rem;
  border-radius: 999px;
  background: var(--color-bg-card);
  border: 1px solid var(--color-border);
  color: var(--color-text-secondary);
  font-size: 0.7rem;
  font-weight: 800;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.accordion-chevron {
  color: var(--color-text-muted);
  font-size: 1.1rem;
  font-weight: 700;
  line-height: 1;
  transition: transform 0.15s ease;
}

.accordion-chevron.open {
  transform: rotate(90deg);
}

.accordion-panel {
  padding: 0 0.5rem 0.5rem;
  border-top: 1px solid var(--color-border);
}

.accordion-panel .item-card {
  margin-top: 0.4rem;
  margin-bottom: 0;
}

.placeholder-panel .hint {
  margin: 0;
}
</style>
