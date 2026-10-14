<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useCalculatorHistory, type CalcHistoryEntry } from '@/composables/useCalculatorHistory'
import ActionIconButton from '@/components/ActionIconButton.vue'

const { t } = useI18n()
const history = useCalculatorHistory()
const showHistory = ref(false)

const expression = ref('')
const result = ref<string | null>(null)
const error = ref<string | null>(null)

/** Affichage lisible : opérateurs typographiques et virgule décimale */
function pretty(expr: string) {
  return expr.replace(/\*/g, '×').replace(/\//g, '÷').replace(/-/g, '−').replace(/\./g, ',')
}

const display = computed(() => pretty(expression.value) || '0')

function clearAll() {
  expression.value = ''
  result.value = null
  error.value = null
}

function backspace() {
  expression.value = expression.value.slice(0, -1)
  result.value = null
  error.value = null
}

function append(token: string) {
  expression.value += token
  result.value = null
  error.value = null
}

function safeEval(expr: string): number {
  const cleaned = expr.replace(/\s+/g, '')
  if (!cleaned) return 0
  if (!/^[0-9+\-*/().,]+$/.test(cleaned)) {
    throw new Error('invalid')
  }
  // Normalize comma decimals to dot
  const normalized = cleaned.replace(/,/g, '.')
  const fn = new Function(`return (${normalized})`)
  const value = fn()
  if (typeof value !== 'number' || Number.isNaN(value) || !Number.isFinite(value)) {
    throw new Error('impossible')
  }
  return value
}

function equals() {
  try {
    const value = safeEval(expression.value)
    const source = expression.value
    result.value = String(value)
    error.value = null
    expression.value = String(value)
    if (source && source !== result.value) history.add(pretty(source), pretty(result.value))
  } catch (e) {
    result.value = null
    if (e instanceof Error && e.message === 'invalid') {
      error.value = t('calculator.invalid')
    } else {
      error.value = t('calculator.impossible')
    }
  }
}

const keys: { label: string; value?: string; kind?: 'op' | 'main' | 'danger' }[] = [
  { label: 'C', kind: 'danger' },
  { label: '⌫', kind: 'op' },
  { label: '(', kind: 'op', value: '(' },
  { label: ')', kind: 'op', value: ')' },

  { label: '7' },
  { label: '8' },
  { label: '9' },
  { label: '÷', kind: 'op', value: '/' },

  { label: '4' },
  { label: '5' },
  { label: '6' },
  { label: '×', kind: 'op', value: '*' },

  { label: '1' },
  { label: '2' },
  { label: '3' },
  { label: '−', kind: 'op', value: '-' },

  { label: '0' },
  { label: ',', value: ',' },
  { label: '+', kind: 'op', value: '+' },
  { label: '=', kind: 'main' },
]

/** Reprend le résultat d'un calcul précédent */
function reuse(entry: CalcHistoryEntry) {
  expression.value = entry.result.replace(/−/g, '-')
  result.value = null
  error.value = null
  showHistory.value = false
}

function onKeyPress(k: (typeof keys)[number]) {
  if (k.label === 'C') return clearAll()
  if (k.label === '⌫') return backspace()
  if (k.label === '=') return equals()
  append(k.value ?? k.label)
}
</script>

<template>
  <div class="calc">
    <div class="calc-display" :aria-label="t('calculator.title')">
      <div class="calc-expression">{{ display }}</div>
      <div v-if="error" class="calc-error">{{ error }}</div>
    </div>

    <div class="calc-history">
      <div class="calc-history-bar">
        <button
          class="calc-history-toggle"
          type="button"
          :aria-expanded="showHistory"
          @click="showHistory = !showHistory"
        >
          {{ t('calculator.history') }}
          <span v-if="history.entries.value.length" class="calc-history-count">{{
            history.entries.value.length
          }}</span>
          <span aria-hidden="true">{{ showHistory ? '▴' : '▾' }}</span>
        </button>
        <ActionIconButton
          v-if="showHistory && history.entries.value.length"
          kind="remove"
          compact
          :label="t('calculator.historyClear')"
          @click="history.clear()"
        />
      </div>
      <div v-if="showHistory" class="calc-history-panel">
        <p v-if="!history.entries.value.length" class="calc-history-empty">
          {{ t('calculator.historyEmpty') }}
        </p>
        <ul v-else class="calc-history-list">
          <li v-for="entry in history.entries.value" :key="entry.id">
            <button class="calc-history-entry" type="button" @click="reuse(entry)">
              <span class="calc-history-expr">{{ entry.expression }}</span>
              <span class="calc-history-result">= {{ entry.result }}</span>
            </button>
          </li>
        </ul>
      </div>
    </div>

    <div class="calc-keys">
      <button
        v-for="k in keys"
        :key="k.label"
        class="calc-key"
        :class="k.kind ?? 'num'"
        type="button"
        @click="onKeyPress(k)"
      >
        {{ k.label }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.calc {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.calc-display {
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  padding: 0.8rem 0.9rem;
}

.calc-expression {
  font-size: 1.4rem;
  font-weight: 800;
  text-align: right;
  color: var(--color-text-primary);
  font-variant-numeric: tabular-nums;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.calc-error {
  margin-top: 0.35rem;
  font-size: 0.8rem;
  color: var(--color-danger);
  text-align: right;
}

.calc-history-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
}

.calc-history-toggle {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  background: transparent;
  color: var(--color-text-secondary);
  font-size: 0.8rem;
  font-weight: 700;
  padding: 0.25rem 0;
}

.calc-history-count {
  min-width: 1.2rem;
  padding: 0 0.3rem;
  border-radius: 999px;
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border);
  font-size: 0.7rem;
  line-height: 1.2rem;
  text-align: center;
}

.calc-history-panel {
  margin-top: 0.35rem;
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  padding: 0.4rem;
}

.calc-history-list {
  list-style: none;
  margin: 0;
  padding: 0;
  max-height: 14rem;
  overflow-y: auto;
}

.calc-history-entry {
  width: 100%;
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.45rem 0.5rem;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--color-text-secondary);
  font-variant-numeric: tabular-nums;
  text-align: left;
}

.calc-history-entry:active {
  background: var(--color-bg-card);
}

.calc-history-expr {
  min-width: 0;
  overflow-wrap: anywhere;
  font-size: 0.85rem;
}

.calc-history-result {
  flex-shrink: 0;
  font-weight: 800;
  color: var(--color-text-primary);
}

.calc-history-empty {
  margin: 0;
  padding: 0.35rem 0.5rem;
  font-size: 0.75rem;
  color: var(--color-text-muted);
}

.calc-keys {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 0.5rem;
}

.calc-key {
  background: var(--color-bg-card);
  border: 1px solid var(--color-border);
  color: var(--color-text-primary);
  border-radius: var(--radius-md);
  padding: 0.95rem 0;
  font-size: 1.05rem;
  font-weight: 800;
  line-height: 1;
  -webkit-user-select: none;
  user-select: none;
}

.calc-key:active {
  transform: scale(0.99);
  border-color: var(--color-border-hover);
}

.calc-key.op {
  background: var(--color-bg-secondary);
  color: var(--color-text-secondary);
}

.calc-key.main {
  background: var(--color-accent);
  border-color: var(--color-accent);
  color: var(--color-on-accent);
}

.calc-key.danger {
  background: color-mix(in srgb, var(--color-accent) 12%, transparent);
  border-color: color-mix(in srgb, var(--color-accent) 35%, transparent);
  color: var(--color-accent);
}
</style>
