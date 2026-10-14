import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import { type WeaponDamageProfile, createEmptyWeaponDamage } from '@/utils/combatTypes'

export type ModifierType =
  | 'attaque'
  | 'degats'
  | 'ca'
  | 'force'
  | 'dexterite'
  | 'constitution'
  | 'intelligence'
  | 'sagesse'
  | 'charisme'
  | 'initiative'
  | 'vitesse'
  | 'sauvegardes'
  | 'competences'
  | 'autre'

export interface Modifier {
  type: ModifierType
  value: number
  label?: string
}

/** Catégories fournies par l'app (libellés traduits, comportements dédiés : arme, emplacements uniques) */
export const BUILTIN_CATEGORIES = [
  'arme',
  'armure',
  'bouclier',
  'accessoire',
  'consommable',
  'autre',
] as const

export type BuiltinCategory = (typeof BUILTIN_CATEGORIES)[number]

/** Catégorie intégrée ou id d'une catégorie créée par le joueur (`cat-…`) */
export type EquipmentCategory = string

/** Catégorie créée par le joueur, propre au personnage (exportée avec lui) */
export interface CustomCategory {
  id: string
  name: string
}

export const CUSTOM_CATEGORY_MAX = 20
export const CUSTOM_CATEGORY_NAME_MAX = 24

export function isBuiltinCategory(id: string): id is BuiltinCategory {
  return (BUILTIN_CATEGORIES as readonly string[]).includes(id)
}

export interface EquipmentItem {
  id: string
  name: string
  category: EquipmentCategory
  description: string
  modifiers: Modifier[]
  /** Dés / types de dégâts de l’arme (ex. 1d8 tranchant + 1d6 froid) */
  weaponDamage: WeaponDamageProfile[]
  equipped: boolean
}

export const MODIFIER_LABELS: Record<ModifierType, string> = {
  attaque: 'Attaque',
  degats: 'Dégâts',
  ca: "Classe d'Armure",
  force: 'Force',
  dexterite: 'Dextérité',
  constitution: 'Constitution',
  intelligence: 'Intelligence',
  sagesse: 'Sagesse',
  charisme: 'Charisme',
  initiative: 'Initiative',
  vitesse: 'Vitesse',
  sauvegardes: 'Sauvegardes',
  competences: 'Compétences',
  autre: 'Autre',
}

export const CATEGORY_LABELS: Record<BuiltinCategory, string> = {
  arme: 'Arme',
  armure: 'Armure',
  bouclier: 'Bouclier',
  accessoire: 'Accessoire',
  consommable: 'Consommable',
  autre: 'Autre',
}

const STORAGE_KEY = 'echec-critique-inventory'
const CATEGORIES_KEY = 'echec-critique-inventory-categories'

let nextId = 1

function normalizeItem(item: EquipmentItem): EquipmentItem {
  return {
    ...item,
    modifiers: Array.isArray(item.modifiers) ? item.modifiers : [],
    weaponDamage: Array.isArray(item.weaponDamage)
      ? item.weaponDamage.map((p) => createEmptyWeaponDamage(p))
      : [],
  }
}

function loadItems(): EquipmentItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as EquipmentItem[]
    if (!Array.isArray(parsed)) return []
    for (const item of parsed) {
      const num = Number(String(item.id).replace(/\D/g, ''))
      if (Number.isFinite(num) && num >= nextId) nextId = num + 1
    }
    return parsed.map(normalizeItem)
  } catch {
    return []
  }
}

function persistItems(items: EquipmentItem[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
  } catch {
    /* ignore */
  }
}

export function normalizeCustomCategories(raw: unknown): CustomCategory[] {
  if (!Array.isArray(raw)) return []
  const seen = new Set<string>()
  const out: CustomCategory[] = []
  for (const entry of raw) {
    const c = entry as Partial<CustomCategory> | null
    if (!c || typeof c.id !== 'string' || typeof c.name !== 'string') continue
    const name = c.name.trim().slice(0, CUSTOM_CATEGORY_NAME_MAX)
    if (!name || isBuiltinCategory(c.id) || seen.has(c.id)) continue
    seen.add(c.id)
    out.push({ id: c.id, name })
  }
  return out.slice(0, CUSTOM_CATEGORY_MAX)
}

function loadCategories(): CustomCategory[] {
  try {
    const raw = localStorage.getItem(CATEGORIES_KEY)
    return raw ? normalizeCustomCategories(JSON.parse(raw)) : []
  } catch {
    return []
  }
}

function persistCategories(categories: CustomCategory[]) {
  try {
    localStorage.setItem(CATEGORIES_KEY, JSON.stringify(categories))
  } catch {
    /* ignore */
  }
}

/** Objet dont la catégorie n'existe plus (supprimée, import incomplet) → « Autre » */
function withKnownCategory(item: EquipmentItem, categories: CustomCategory[]): EquipmentItem {
  if (isBuiltinCategory(item.category) || categories.some((c) => c.id === item.category)) {
    return item
  }
  return { ...item, category: 'autre' }
}

export const useInventoryStore = defineStore('inventory', () => {
  const customCategories = ref<CustomCategory[]>(loadCategories())
  const items = ref<EquipmentItem[]>(
    loadItems().map((item) => withKnownCategory(item, customCategories.value)),
  )
  /** Filtre de l'onglet Inventaire : 'all' ou un id de catégorie */
  const categoryFilter = ref<EquipmentCategory | 'all'>('all')

  /** Ordre d'affichage : intégrées, puis celles du joueur, « Autre » en dernier */
  const allCategories = computed<EquipmentCategory[]>(() => [
    ...BUILTIN_CATEGORIES.filter((c) => c !== 'autre'),
    ...customCategories.value.map((c) => c.id),
    'autre',
  ])

  const equippedItems = computed(() => items.value.filter((i) => i.equipped))
  const unequippedItems = computed(() => items.value.filter((i) => !i.equipped))
  const weapons = computed(() => items.value.filter((i) => i.category === 'arme'))

  const totalModifiers = computed(() => {
    const totals: Partial<Record<ModifierType, number>> = {}
    for (const item of equippedItems.value) {
      for (const mod of item.modifiers) {
        totals[mod.type] = (totals[mod.type] ?? 0) + mod.value
      }
    }
    return totals
  })

  const hasActiveBonuses = computed(() => Object.keys(totalModifiers.value).length > 0)

  function getItem(id: string): EquipmentItem | undefined {
    return items.value.find((i) => i.id === id)
  }

  function itemModifierTotal(id: string, type: ModifierType): number {
    const item = getItem(id)
    if (!item) return 0
    return item.modifiers.filter((m) => m.type === type).reduce((sum, m) => sum + m.value, 0)
  }

  function save() {
    persistItems(items.value)
  }

  function customCategoryName(id: string): string | null {
    return customCategories.value.find((c) => c.id === id)?.name ?? null
  }

  function isCategoryNameTaken(name: string): boolean {
    const key = name.trim().toLocaleLowerCase()
    return customCategories.value.some((c) => c.name.toLocaleLowerCase() === key)
  }

  /** Crée une catégorie et renvoie son id (null si nom vide, doublon ou limite atteinte) */
  function addCategory(name: string): string | null {
    const clean = name.trim().slice(0, CUSTOM_CATEGORY_NAME_MAX)
    if (!clean || isCategoryNameTaken(clean)) return null
    if (customCategories.value.length >= CUSTOM_CATEGORY_MAX) return null
    const id = `cat-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
    customCategories.value = [...customCategories.value, { id, name: clean }]
    persistCategories(customCategories.value)
    return id
  }

  /** Supprime une catégorie du joueur : ses objets passent dans « Autre » */
  function removeCategory(id: string) {
    if (isBuiltinCategory(id)) return
    customCategories.value = customCategories.value.filter((c) => c.id !== id)
    persistCategories(customCategories.value)
    for (const item of items.value) {
      if (item.category === id) item.category = 'autre'
    }
    if (categoryFilter.value === id) categoryFilter.value = 'all'
    save()
  }

  function addItem(item: Omit<EquipmentItem, 'id'>) {
    items.value.push(
      normalizeItem({
        ...item,
        id: `eq-${nextId++}`,
        weaponDamage: item.weaponDamage ?? [],
      }),
    )
    save()
  }

  function removeItem(id: string) {
    items.value = items.value.filter((i) => i.id !== id)
    save()
  }

  /** Annulation d'une suppression : l'objet revient à sa place */
  function restoreItem(item: EquipmentItem, index: number) {
    if (items.value.some((i) => i.id === item.id)) return
    const next = [...items.value]
    next.splice(Math.min(index, next.length), 0, withKnownCategory(item, customCategories.value))
    items.value = next
    save()
  }

  function updateItem(id: string, patch: Partial<Omit<EquipmentItem, 'id' | 'equipped'>>) {
    const item = items.value.find((i) => i.id === id)
    if (!item) return
    if (patch.name !== undefined) item.name = patch.name
    if (patch.category !== undefined) item.category = patch.category
    if (patch.description !== undefined) item.description = patch.description
    if (patch.modifiers !== undefined) item.modifiers = patch.modifiers
    if (patch.weaponDamage !== undefined) item.weaponDamage = patch.weaponDamage
    save()
  }

  function equipItem(id: string) {
    const item = items.value.find((i) => i.id === id)
    // Aucune limite par catégorie : le joueur reste responsable de ce qu'il porte
    if (!item || item.equipped) return
    item.equipped = true
    save()
  }

  function unequipItem(id: string) {
    const item = items.value.find((i) => i.id === id)
    if (!item) return
    item.equipped = false
    save()
  }

  function toggleEquipped(id: string) {
    const item = items.value.find((i) => i.id === id)
    if (!item) return
    if (item.equipped) unequipItem(id)
    else equipItem(id)
  }

  function unequipAll() {
    for (const item of items.value) item.equipped = false
    save()
  }

  function replaceAll(next: EquipmentItem[], categories: CustomCategory[] = []) {
    customCategories.value = normalizeCustomCategories(categories)
    persistCategories(customCategories.value)
    categoryFilter.value = 'all'
    items.value = next.map((item) => withKnownCategory(normalizeItem(item), customCategories.value))
    for (const item of items.value) {
      const num = Number(String(item.id).replace(/\D/g, ''))
      if (Number.isFinite(num) && num >= nextId) nextId = num + 1
    }
    save()
  }

  function clearAll() {
    items.value = []
    customCategories.value = []
    persistCategories([])
    categoryFilter.value = 'all'
    save()
  }

  return {
    items,
    customCategories,
    categoryFilter,
    allCategories,
    customCategoryName,
    isCategoryNameTaken,
    addCategory,
    removeCategory,
    equippedItems,
    unequippedItems,
    weapons,
    totalModifiers,
    hasActiveBonuses,
    getItem,
    itemModifierTotal,
    addItem,
    removeItem,
    restoreItem,
    updateItem,
    equipItem,
    unequipItem,
    toggleEquipped,
    unequipAll,
    replaceAll,
    clearAll,
  }
})
