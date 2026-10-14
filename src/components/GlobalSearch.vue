<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useInventoryStore } from '@/stores/inventory'
import { useSettingsStore } from '@/stores/settings'
import { useCategoryLabel } from '@/composables/useCategoryLabel'
import {
  buildStaticSearchIndex,
  filterSearchEntries,
  inventoryCategorySearchEntries,
  inventorySearchEntries,
  normalizeSearch,
  type SearchEntry,
} from '@/utils/searchIndex'

const emit = defineEmits<{
  select: [entry: SearchEntry]
}>()

const { t } = useI18n()
const inventory = useInventoryStore()
const settings = useSettingsStore()
const categoryLabel = useCategoryLabel()
const query = ref('')
const isFocused = ref(false)

/** Mêmes catégories que les onglets de l'Inventaire */
const searchableCategories = computed(() => {
  const used = new Set(inventory.items.map((item) => item.category))
  return inventory.allCategories.filter(
    (id) => used.has(id) || inventory.customCategories.some((c) => c.id === id),
  )
})

const allEntries = computed(() => {
  void settings.locale
  const entries = [
    ...buildStaticSearchIndex(),
    ...inventoryCategorySearchEntries(searchableCategories.value, categoryLabel),
    ...inventorySearchEntries(inventory.items, categoryLabel),
  ]
  if (!settings.showCalculator) {
    return entries.filter((e) => e.tab !== 'calculatrice')
  }
  return entries
})

const results = computed(() => filterSearchEntries(allEntries.value, query.value))

const showResults = computed(
  () => isFocused.value && query.value.trim().length > 0 && results.value.length > 0,
)

let debounceTimer: ReturnType<typeof setTimeout> | null = null

watch(query, (value) => {
  if (debounceTimer) clearTimeout(debounceTimer)
  const trimmed = value.trim()
  if (trimmed.length < 2) return

  debounceTimer = setTimeout(() => {
    const matches = filterSearchEntries(allEntries.value, trimmed)
    const exact = matches.filter((m) => normalizeSearch(m.label) === normalizeSearch(trimmed))
    if (exact.length === 1) {
      selectEntry(exact[0])
    }
  }, 500)
})

function selectEntry(entry: SearchEntry) {
  // Catégorie → son onglet ; objet → « Tous » (le filtre pourrait le masquer)
  if (entry.tab === 'inventaire') inventory.categoryFilter = entry.categoryFilter ?? 'all'
  emit('select', entry)
  query.value = ''
  isFocused.value = false
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter' && results.value.length > 0) {
    e.preventDefault()
    selectEntry(results.value[0])
    return
  }
  if (e.key === 'Escape') {
    query.value = ''
    isFocused.value = false
    ;(e.target as HTMLInputElement).blur()
  }
}

function onBlur() {
  window.setTimeout(() => {
    isFocused.value = false
  }, 150)
}
</script>

<template>
  <div class="global-search">
    <div class="search-input-wrap">
      <!-- SVG plutôt que « ⌕ » : centrage indépendant des métriques de la police -->
      <svg class="search-icon" viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="10.5" cy="10.5" r="6.5" />
        <path d="M15.5 15.5 21 21" />
      </svg>
      <input
        v-model="query"
        class="search-input"
        type="search"
        enterkeyhint="search"
        autocomplete="off"
        autocapitalize="off"
        spellcheck="false"
        :placeholder="t('common.search')"
        @focus="isFocused = true"
        @blur="onBlur"
        @keydown="onKeydown"
      />
      <button
        v-if="query"
        class="search-clear hit-area"
        type="button"
        :aria-label="t('common.clear')"
        @mousedown.prevent
        @click="query = ''"
      >
        ✕
      </button>
    </div>

    <Transition name="results">
      <ul v-if="showResults" class="search-results">
        <li v-for="item in results" :key="item.id">
          <button class="search-result" type="button" @mousedown.prevent @click="selectEntry(item)">
            <span class="result-label">{{ item.label }}</span>
            <span class="result-section">{{ item.section }}</span>
          </button>
        </li>
      </ul>
    </Transition>
  </div>
</template>

<style scoped>
.global-search {
  position: relative;
  padding: 0;
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  justify-content: center;
}

.search-input-wrap {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  height: 2.75rem;
  box-sizing: border-box;
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  padding: 0 0.65rem;
  transition: border-color 0.2s;
}

.search-input-wrap:focus-within {
  border-color: var(--color-accent);
}

.search-icon {
  display: block;
  width: 1.15rem;
  height: 1.15rem;
  flex-shrink: 0;
  fill: none;
  stroke: var(--color-text-muted);
  stroke-width: 2.4;
  stroke-linecap: round;
}

.search-input {
  flex: 1;
  min-width: 0;
  height: 100%;
  background: transparent;
  border: none;
  color: var(--color-text-primary);
  font-size: 0.95rem;
  padding: 0;
  -webkit-appearance: none;
  appearance: none;
}

.search-input::placeholder {
  color: var(--color-text-muted);
  font-size: 0.85rem;
}

.search-input::-webkit-search-cancel-button {
  display: none;
}

.search-clear {
  background: var(--color-bg-card);
  color: var(--color-text-muted);
  width: 1.5rem;
  height: 1.5rem;
  border-radius: 50%;
  font-size: 0.65rem;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.search-results {
  position: absolute;
  left: 0.6rem;
  right: 0.6rem;
  top: calc(100% - 0.15rem);
  z-index: 200;
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.35);
  max-height: min(50vh, 320px);
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  list-style: none;
}

.search-result {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  width: 100%;
  padding: 0.65rem 0.85rem;
  background: transparent;
  color: var(--color-text-primary);
  border-bottom: 1px solid var(--color-border);
  text-align: left;
}

.search-result:last-child {
  border-bottom: none;
}

.search-result:active {
  background: var(--color-bg-card);
}

.result-label {
  font-weight: 600;
  font-size: 0.95rem;
}

.result-section {
  font-size: 0.7rem;
  color: var(--color-text-muted);
  margin-top: 0.1rem;
}

.results-enter-active,
.results-leave-active {
  transition:
    opacity 0.15s ease,
    transform 0.15s ease;
}

.results-enter-from,
.results-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}
</style>
