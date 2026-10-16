import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { MODIFIER_LABELS, type Modifier, type ModifierType } from '@/stores/inventory'

/**
 * Capacités & traits du personnage (classe, sous-classe, espèce, historique, dons…).
 * Saisis par le joueur pour l'instant ; le catalogue SRD 5.2.1 viendra s'y brancher.
 * Leurs modificateurs s'ajoutent à ceux de l'équipement et des états (Fiche et Attaques).
 */

export const FEATURE_ORIGINS = [
  'classe',
  'sousClasse',
  'espece',
  'historique',
  'don',
  'autre',
] as const

export type FeatureOrigin = (typeof FEATURE_ORIGINS)[number]

/** Recharge des utilisations ; « court » se recharge aussi au repos long */
export const FEATURE_RECHARGES = ['long', 'short'] as const

export type FeatureRecharge = (typeof FEATURE_RECHARGES)[number]

export const FEATURE_NAME_MAX = 60
export const FEATURE_DESCRIPTION_MAX = 2000
export const FEATURE_USES_MAX = 99

export interface Feature {
  id: string
  name: string
  origin: FeatureOrigin
  description: string
  /** Nombre d'utilisations ; 0 = capacité sans compteur (passive) */
  usesMax: number
  /** Utilisations dépensées depuis la dernière recharge */
  usesSpent: number
  recharge: FeatureRecharge
  /** Toujours appliqués (style de combat, don…) ; un effet temporaire passe par les états */
  modifiers: Modifier[]
}

export function newFeatureId(): string {
  return `ft-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
}

function clampInt(value: unknown, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.round(Number(value) || 0)))
}

export function normalizeFeature(raw: unknown): Feature | null {
  const f = raw as Partial<Feature> | null
  if (!f || typeof f !== 'object') return null
  const name = typeof f.name === 'string' ? f.name.trim().slice(0, FEATURE_NAME_MAX) : ''
  if (!name) return null
  const usesMax = clampInt(f.usesMax, 0, FEATURE_USES_MAX)
  return {
    id: typeof f.id === 'string' ? f.id : newFeatureId(),
    name,
    origin: FEATURE_ORIGINS.includes(f.origin as FeatureOrigin)
      ? (f.origin as FeatureOrigin)
      : 'autre',
    description:
      typeof f.description === 'string' ? f.description.slice(0, FEATURE_DESCRIPTION_MAX) : '',
    usesMax,
    usesSpent: clampInt(f.usesSpent, 0, usesMax),
    recharge: f.recharge === 'short' ? 'short' : 'long',
    modifiers: Array.isArray(f.modifiers)
      ? f.modifiers
          .filter((m) => m && typeof m.type === 'string' && m.type in MODIFIER_LABELS)
          .map((m) => ({ type: m.type, value: Number(m.value) || 0 }))
          .filter((m) => m.value !== 0)
      : [],
  }
}

export function normalizeFeatures(raw: unknown): Feature[] {
  return Array.isArray(raw) ? (raw.map(normalizeFeature).filter(Boolean) as Feature[]) : []
}

const STORAGE_KEY = 'echec-critique-features'

function loadFeatures(): Feature[] {
  try {
    return normalizeFeatures(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]'))
  } catch {
    return []
  }
}

function persistFeatures(list: Feature[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list))
  } catch {
    /* ignore */
  }
}

export const useFeaturesStore = defineStore('features', () => {
  const features = ref<Feature[]>(loadFeatures())
  /** Onglet de filtre affiché (origine ou toutes) */
  const originFilter = ref<FeatureOrigin | 'all'>('all')

  const totalModifiers = computed(() => {
    const totals: Partial<Record<ModifierType, number>> = {}
    for (const feature of features.value) {
      for (const mod of feature.modifiers) {
        totals[mod.type] = (totals[mod.type] ?? 0) + mod.value
      }
    }
    return totals
  })

  function save() {
    persistFeatures(features.value)
  }

  function add(feature: Omit<Feature, 'id' | 'usesSpent'>): Feature | null {
    const clean = normalizeFeature({ ...feature, id: newFeatureId(), usesSpent: 0 })
    if (!clean) return null
    features.value = [...features.value, clean]
    save()
    return clean
  }

  /** Modifier une capacité garde les utilisations déjà dépensées (bornées au nouveau max) */
  function update(id: string, patch: Omit<Feature, 'id' | 'usesSpent'>) {
    const current = features.value.find((f) => f.id === id)
    if (!current) return
    const clean = normalizeFeature({ ...patch, id, usesSpent: current.usesSpent })
    if (!clean) return
    features.value = features.value.map((f) => (f.id === id ? clean : f))
    save()
  }

  function remove(id: string) {
    features.value = features.value.filter((f) => f.id !== id)
    save()
  }

  /** Annulation d'une suppression : remise à sa place d'origine */
  function restore(feature: Feature, index: number) {
    if (features.value.some((f) => f.id === feature.id)) return
    const next = [...features.value]
    next.splice(Math.max(0, Math.min(index, next.length)), 0, feature)
    features.value = next
    save()
  }

  /** delta < 0 : dépense une utilisation ; delta > 0 : en récupère une */
  function bumpUses(id: string, delta: number) {
    features.value = features.value.map((f) =>
      f.id === id ? { ...f, usesSpent: Math.max(0, Math.min(f.usesMax, f.usesSpent - delta)) } : f,
    )
    save()
  }

  /** Repos long : toutes les utilisations reviennent (repos court compris) */
  function longRest() {
    features.value = features.value.map((f) => (f.usesSpent ? { ...f, usesSpent: 0 } : f))
    save()
  }

  function replaceAll(next: Feature[] | undefined) {
    features.value = normalizeFeatures(next ?? [])
    originFilter.value = 'all'
    save()
  }

  return {
    features,
    originFilter,
    totalModifiers,
    add,
    update,
    remove,
    restore,
    bumpUses,
    longRest,
    replaceAll,
  }
})
