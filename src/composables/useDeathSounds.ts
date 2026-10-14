import { ref } from 'vue'

/**
 * Sons de mort ajoutés par l'utilisateur : stockés dans IndexedDB sur l'appareil,
 * jamais inclus dans l'export .ec1 ni envoyés ailleurs (l'app ne fournit aucun son).
 */

export interface DeathSoundMeta {
  id: string
  name: string
  /** Durée en secondes, mesurée au décodage */
  duration: number
  size: number
}

interface DeathSoundRecord extends DeathSoundMeta {
  blob: Blob
}

export type DeathSoundError = 'format' | 'tooLong' | 'tooBig' | 'tooMany' | 'storage'

export const DEATH_SOUND_MAX_SECONDS = 5
export const DEATH_SOUND_MAX_BYTES = 2 * 1024 * 1024
export const DEATH_SOUND_MAX_COUNT = 10

const DB_NAME = 'echec-critique-sounds'
const STORE = 'death'
const ENABLED_KEY = 'echec-critique-death-sounds-enabled'
const AUDIO_EXTENSIONS = /\.(mp3|ogg|oga|opus|wav|m4a|aac|webm|flac)$/i

const sounds = ref<DeathSoundMeta[]>([])
const enabled = ref(readEnabled())
let loaded: Promise<void> | null = null

function readEnabled(): boolean {
  try {
    return localStorage.getItem(ENABLED_KEY) !== '0'
  } catch {
    return true
  }
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1)
    request.onupgradeneeded = () => request.result.createObjectStore(STORE, { keyPath: 'id' })
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

async function withStore<T>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const db = await openDb()
  try {
    return await new Promise<T>((resolve, reject) => {
      const request = run(db.transaction(STORE, mode).objectStore(STORE))
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
  } finally {
    db.close()
  }
}

function toMeta({ id, name, duration, size }: DeathSoundRecord): DeathSoundMeta {
  return { id, name, duration, size }
}

function ensureLoaded(): Promise<void> {
  loaded ??= withStore<DeathSoundRecord[]>('readonly', (store) => store.getAll())
    .then((records) => {
      sounds.value = records.map(toMeta).sort((a, b) => a.name.localeCompare(b.name))
    })
    .catch(() => {
      sounds.value = []
    })
  return loaded
}

/** Durée réelle du fichier : le décodage valide aussi le format (le type MIME est souvent vide sur Android) */
async function measureDuration(file: Blob): Promise<number> {
  const Ctx =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!Ctx) throw new Error('format')
  const ctx = new Ctx()
  try {
    const buffer = await ctx.decodeAudioData(await file.arrayBuffer())
    return buffer.duration
  } catch {
    throw new Error('format')
  } finally {
    void ctx.close()
  }
}

async function add(file: File): Promise<void> {
  await ensureLoaded()
  if (sounds.value.length >= DEATH_SOUND_MAX_COUNT) throw new Error('tooMany')
  if (!file.type.startsWith('audio/') && !AUDIO_EXTENSIONS.test(file.name))
    throw new Error('format')
  if (file.size > DEATH_SOUND_MAX_BYTES) throw new Error('tooBig')
  const duration = await measureDuration(file)
  // Petite marge pour les encodeurs qui ajoutent quelques millisecondes de silence
  if (duration > DEATH_SOUND_MAX_SECONDS + 0.1) throw new Error('tooLong')

  const record: DeathSoundRecord = {
    id: `snd-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    name: file.name.replace(/\.[^.]+$/, '').slice(0, 40) || 'Son',
    duration,
    size: file.size,
    blob: file,
  }
  try {
    await withStore('readwrite', (store) => store.put(record))
  } catch {
    throw new Error('storage')
  }
  sounds.value = [...sounds.value, toMeta(record)].sort((a, b) => a.name.localeCompare(b.name))
}

async function remove(id: string): Promise<void> {
  await withStore('readwrite', (store) => store.delete(id))
  sounds.value = sounds.value.filter((s) => s.id !== id)
}

let current: HTMLAudioElement | null = null

async function play(id: string): Promise<void> {
  const record = await withStore<DeathSoundRecord | undefined>('readonly', (store) => store.get(id))
  if (!record) return
  current?.pause()
  const url = URL.createObjectURL(record.blob)
  const audio = new Audio(url)
  const release = () => URL.revokeObjectURL(url)
  audio.addEventListener('ended', release, { once: true })
  audio.addEventListener('error', release, { once: true })
  current = audio
  try {
    await audio.play()
  } catch {
    release()
  }
}

/** Au passage à « RIP » : un son au hasard, si activé */
async function playRandom(): Promise<void> {
  await ensureLoaded()
  if (!enabled.value || !sounds.value.length) return
  const pick = sounds.value[Math.floor(Math.random() * sounds.value.length)]!
  await play(pick.id)
}

function setEnabled(value: boolean) {
  enabled.value = value
  try {
    localStorage.setItem(ENABLED_KEY, value ? '1' : '0')
  } catch {
    /* ignore */
  }
}

export function useDeathSounds() {
  void ensureLoaded()
  return { sounds, enabled, add, remove, play, playRandom, setEnabled }
}
