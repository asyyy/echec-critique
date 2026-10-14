import { ref } from 'vue'

export interface CalcHistoryEntry {
  id: number
  expression: string
  result: string
}

const MAX_ENTRIES = 50

/** En mémoire uniquement (partagé entre montages) : effacé quand l'app passe en veille / arrière-plan */
const entries = ref<CalcHistoryEntry[]>([])
let nextId = 1

if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') entries.value = []
  })
}

export function useCalculatorHistory() {
  function add(expression: string, result: string) {
    entries.value = [{ id: nextId++, expression, result }, ...entries.value].slice(0, MAX_ENTRIES)
  }

  function clear() {
    entries.value = []
  }

  return { entries, add, clear }
}
