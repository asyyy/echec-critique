import { beforeEach, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { i18n } from '@/i18n'

/** localStorage en mémoire, vidé avant chaque test (les stores lisent leur état au démarrage) */
const memory = new Map<string, string>()
vi.stubGlobal('localStorage', {
  getItem: (key: string) => memory.get(key) ?? null,
  setItem: (key: string, value: string) => void memory.set(key, String(value)),
  removeItem: (key: string) => void memory.delete(key),
  clear: () => memory.clear(),
  key: (index: number) => [...memory.keys()][index] ?? null,
  get length() {
    return memory.size
  },
})

beforeEach(() => {
  memory.clear()
  setActivePinia(createPinia())
  i18n.global.locale.value = 'fr'
})
