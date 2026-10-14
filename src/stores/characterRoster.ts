import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import {
  encodeBundle,
  decodeBundle,
  bundleFilename,
  type CharacterBundle,
} from '@/utils/characterBundle'

const ROSTER_KEY = 'echec-critique-character-roster'
const TRASH_PREFIX = '.trash.'

export interface RosterSlotMeta {
  id: string
  fileName: string
  displayName: string
  level: number
  characterClass: string
  updatedAt: number
}

interface RosterSlot extends RosterSlotMeta {
  payload: string
}

interface RosterPersisted {
  version: 1
  activeId: string
  slots: RosterSlot[]
}

function isTrashed(fileName: string): boolean {
  return fileName.startsWith(TRASH_PREFIX)
}

function toTrashName(fileName: string): string {
  if (isTrashed(fileName)) return fileName
  return `${TRASH_PREFIX}${fileName}`
}

function fromTrashName(fileName: string): string {
  if (!isTrashed(fileName)) return fileName
  return fileName.slice(TRASH_PREFIX.length)
}

function uniqueFileName(
  desired: string,
  slots: { id: string; fileName: string }[],
  exceptId?: string,
): string {
  const taken = new Set(slots.filter((s) => s.id !== exceptId).map((s) => s.fileName))
  if (!taken.has(desired)) return desired
  const base = desired.replace(/\.ec1$/i, '')
  let n = 2
  while (taken.has(`${base}-${n}.ec1`)) n += 1
  return `${base}-${n}.ec1`
}

function newId(): string {
  return `pc-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

function metaFromBundle(bundle: CharacterBundle, fileName: string, id: string): RosterSlotMeta {
  return {
    id,
    fileName,
    displayName: bundle.character.name.trim() || '',
    level: bundle.character.level,
    characterClass: bundle.character.characterClass,
    updatedAt: Date.now(),
  }
}

function loadRoster(): RosterPersisted | null {
  try {
    const raw = localStorage.getItem(ROSTER_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<RosterPersisted>
    if (
      parsed.version !== 1 ||
      !Array.isArray(parsed.slots) ||
      typeof parsed.activeId !== 'string'
    ) {
      return null
    }
    const slots = parsed.slots.filter(
      (s): s is RosterSlot =>
        !!s &&
        typeof s.id === 'string' &&
        typeof s.fileName === 'string' &&
        typeof s.payload === 'string',
    )
    if (!slots.length) return null
    const activeId = slots.some((s) => s.id === parsed.activeId)
      ? parsed.activeId
      : (slots.find((s) => !isTrashed(s.fileName))?.id ?? slots[0]!.id)
    return { version: 1, activeId, slots }
  } catch {
    return null
  }
}

function persistRoster(state: RosterPersisted) {
  try {
    localStorage.setItem(ROSTER_KEY, JSON.stringify(state))
  } catch {
    /* ignore */
  }
}

export const useCharacterRosterStore = defineStore('characterRoster', () => {
  const loaded = loadRoster()
  const slots = ref<RosterSlot[]>(loaded?.slots ?? [])
  const activeId = ref<string>(loaded?.activeId ?? '')
  const archivesUnlocked = ref(false)

  const activeSlot = computed(() => slots.value.find((s) => s.id === activeId.value) ?? null)

  /** Ordre de création, stable : changer de perso (qui l'enregistre) ne le fait pas bouger */
  const visibleSlots = computed(() => slots.value.filter((s) => !isTrashed(s.fileName)))

  const archivedSlots = computed(() =>
    slots.value.filter((s) => isTrashed(s.fileName)).sort((a, b) => b.updatedAt - a.updatedAt),
  )

  function flush() {
    if (!slots.value.length || !activeId.value) return
    persistRoster({
      version: 1,
      activeId: activeId.value,
      slots: slots.value,
    })
  }

  async function ensureSeeded(bundle: CharacterBundle) {
    if (slots.value.length && activeId.value) return
    const id = newId()
    const fileName = bundleFilename(bundle.character.name || 'personnage')
    const payload = await encodeBundle(bundle)
    const slot: RosterSlot = {
      ...metaFromBundle(bundle, fileName, id),
      payload,
    }
    slots.value = [slot]
    activeId.value = id
    flush()
  }

  async function saveActive(bundle: CharacterBundle) {
    await ensureSeeded(bundle)
    const current = slots.value.find((s) => s.id === activeId.value)
    if (!current || isTrashed(current.fileName)) return

    const preferred = bundleFilename(
      bundle.character.name || current.fileName.replace(/\.ec1$/i, ''),
    )
    const fileName = uniqueFileName(
      preferred,
      slots.value.filter((s) => !isTrashed(s.fileName)),
      current.id,
    )
    const payload = await encodeBundle(bundle)
    Object.assign(current, metaFromBundle(bundle, fileName, current.id), { payload })
    flush()
  }

  async function createNew(emptyBundle: CharacterBundle, currentBundle: CharacterBundle) {
    await saveActive(currentBundle)
    const id = newId()
    const fileName = uniqueFileName(
      bundleFilename(emptyBundle.character.name || 'personnage'),
      slots.value.filter((s) => !isTrashed(s.fileName)),
    )
    const payload = await encodeBundle(emptyBundle)
    const slot: RosterSlot = {
      ...metaFromBundle(emptyBundle, fileName, id),
      payload,
    }
    slots.value = [...slots.value, slot]
    activeId.value = id
    flush()
    return slot
  }

  async function loadSlot(id: string): Promise<CharacterBundle | null> {
    const slot = slots.value.find((s) => s.id === id)
    if (!slot || isTrashed(slot.fileName)) return null
    try {
      return await decodeBundle(slot.payload)
    } catch {
      return null
    }
  }

  async function switchTo(
    id: string,
    currentBundle: CharacterBundle,
  ): Promise<CharacterBundle | null> {
    if (id === activeId.value) return null
    const target = slots.value.find((s) => s.id === id)
    if (!target || isTrashed(target.fileName)) return null
    await saveActive(currentBundle)
    const bundle = await decodeBundle(target.payload)
    activeId.value = id
    flush()
    return bundle
  }

  async function importAsActive(
    imported: CharacterBundle,
    currentBundle: CharacterBundle,
    replaceCurrent: boolean,
  ) {
    await saveActive(currentBundle)
    if (replaceCurrent && activeId.value) {
      const current = slots.value.find((s) => s.id === activeId.value)
      if (current && !isTrashed(current.fileName)) {
        const preferred = bundleFilename(imported.character.name || 'personnage')
        const fileName = uniqueFileName(
          preferred,
          slots.value.filter((s) => !isTrashed(s.fileName)),
          current.id,
        )
        const payload = await encodeBundle(imported)
        Object.assign(current, metaFromBundle(imported, fileName, current.id), { payload })
        flush()
        return
      }
    }
    const id = newId()
    const fileName = uniqueFileName(
      bundleFilename(imported.character.name || 'personnage'),
      slots.value.filter((s) => !isTrashed(s.fileName)),
    )
    const payload = await encodeBundle(imported)
    slots.value = [...slots.value, { ...metaFromBundle(imported, fileName, id), payload }]
    activeId.value = id
    flush()
  }

  function softDelete(id: string): boolean {
    if (id === activeId.value) return false
    const slot = slots.value.find((s) => s.id === id)
    if (!slot || isTrashed(slot.fileName)) return false
    slot.fileName = toTrashName(slot.fileName)
    slot.updatedAt = Date.now()
    flush()
    return true
  }

  function restore(id: string): boolean {
    const slot = slots.value.find((s) => s.id === id)
    if (!slot || !isTrashed(slot.fileName)) return false
    const restored = fromTrashName(slot.fileName)
    slot.fileName = uniqueFileName(
      restored,
      slots.value.filter((s) => !isTrashed(s.fileName)),
      slot.id,
    )
    slot.updatedAt = Date.now()
    flush()
    return true
  }

  function unlockArchives() {
    archivesUnlocked.value = true
  }

  function lockArchives() {
    archivesUnlocked.value = false
  }

  return {
    activeId,
    activeSlot,
    visibleSlots,
    archivedSlots,
    archivesUnlocked,
    ensureSeeded,
    saveActive,
    createNew,
    loadSlot,
    switchTo,
    importAsActive,
    softDelete,
    restore,
    unlockArchives,
    lockArchives,
  }
})
