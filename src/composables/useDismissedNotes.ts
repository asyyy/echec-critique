import { computed, ref } from 'vue'

const STORAGE_KEY = 'echec-critique-dismissed-notes'

function loadDismissed(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    const parsed: unknown = raw ? JSON.parse(raw) : []
    return new Set(Array.isArray(parsed) ? parsed.filter((v) => typeof v === 'string') : [])
  } catch {
    return new Set()
  }
}

/** Partagé par toutes les notes : masquée une fois = masquée partout, jusqu'à réinstallation ou reset */
const dismissed = ref(loadDismissed())

function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...dismissed.value]))
  } catch {
    /* stockage indisponible : effet limité à cette session */
  }
}

export function useDismissedNotes() {
  function isDismissed(id: string) {
    return dismissed.value.has(id)
  }

  function dismiss(id: string) {
    dismissed.value = new Set(dismissed.value).add(id)
    persist()
  }

  /** Réaffiche tous les conseils (Options) */
  function resetAll() {
    dismissed.value = new Set()
    persist()
  }

  const dismissedCount = computed(() => dismissed.value.size)

  return { isDismissed, dismiss, resetAll, dismissedCount }
}
