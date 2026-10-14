import { ABILITIES, SKILLS, SKILL_ABILITY, type Skill } from '@/utils/dnd'
import { MODIFIER_LABELS, CATEGORY_LABELS } from '@/stores/inventory'
import { i18n } from '@/i18n'

export type AppTab = 'stats' | 'combat' | 'inventaire' | 'equipements' | 'calculatrice'

export interface SearchEntry {
  id: string
  label: string
  tab: AppTab
  targetId: string
  keywords: string[]
  section: string
  /** Onglet de catégorie à activer dans l'Inventaire (sinon « Tous ») */
  categoryFilter?: string
}

export function normalizeSearch(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim()
}

function entry(
  id: string,
  label: string,
  tab: AppTab,
  targetId: string,
  section: string,
  extraKeywords: string[] = [],
): SearchEntry {
  return {
    id,
    label,
    tab,
    targetId,
    section,
    keywords: [label, ...extraKeywords].map(normalizeSearch),
  }
}

export function buildStaticSearchIndex(): SearchEntry[] {
  const t = i18n.global.t
  const items: SearchEntry[] = []

  items.push(
    entry('hero', t('search.character'), 'stats', 'search-hero', t('search.sectionStats'), [
      'nom',
      'name',
      'class',
      'classe',
    ]),
    entry('hp', t('search.hitPoints'), 'stats', 'search-hp', t('search.sectionStats'), [
      'pv',
      'hp',
    ]),
    entry(
      'inspiration',
      t('search.inspiration'),
      'stats',
      'search-inspiration',
      t('search.sectionStats'),
      ['insp', 'inspiration'],
    ),
    entry(
      'conditions',
      t('conditions.title'),
      'stats',
      'search-conditions',
      t('search.sectionStats'),
      ['etat', 'condition', 'buff', 'debuff', 'poison', 'empoisonne', 'epuisement'],
    ),
    entry('ca', t('search.armorClass'), 'stats', 'search-ca', t('search.sectionStats'), [
      'ca',
      'ac',
    ]),
    entry(
      'initiative',
      t('search.initiative'),
      'stats',
      'search-initiative',
      t('search.sectionStats'),
      ['init'],
    ),
    entry('speed', t('search.speed'), 'stats', 'search-speed', t('search.sectionStats'), [
      'vitesse',
      'speed',
    ]),
    entry(
      'proficiency',
      t('search.proficiency'),
      'stats',
      'search-proficiency',
      t('search.sectionStats'),
      ['maitrise'],
    ),
    entry(
      'passive-perception',
      t('search.passivePerception'),
      'stats',
      'search-passive-perception',
      t('search.sectionStats'),
      ['passif', 'passive'],
    ),
    entry(
      'abilities',
      t('search.abilities'),
      'stats',
      'search-abilities',
      t('search.sectionStats'),
      ['stats', 'scores'],
    ),
    entry('saves', t('search.saves'), 'stats', 'search-saves', t('search.sectionStats'), [
      'sauvegarde',
      'save',
    ]),
    entry('skills', t('search.skills'), 'stats', 'search-skills', t('search.sectionStats'), [
      'competences',
      'skills',
    ]),
  )

  for (const ab of ABILITIES) {
    const abilityLabel = t(`abilities.${ab}`)
    const short = t(`abilityShort.${ab}`)
    items.push(
      entry(
        `ability-${ab}`,
        abilityLabel,
        'stats',
        `search-ability-${ab}`,
        t('search.sectionStatsAbility'),
        [short, ab],
      ),
      entry(
        `save-${ab}`,
        t('search.saveOf', { ability: abilityLabel }),
        'stats',
        `search-save-${ab}`,
        t('search.sectionStatsSave'),
        [short, 'save'],
      ),
    )
  }

  for (const skill of SKILLS) {
    items.push(
      entry(
        `skill-${skill}`,
        t(`skills.${skill}`),
        'stats',
        `search-skill-${skill}`,
        t('search.sectionStatsSkill'),
        [skill, t(`abilityShort.${SKILL_ABILITY[skill as Skill]}`)],
      ),
    )
  }

  items.push(
    entry(
      'combat-attack',
      t('search.attack'),
      'combat',
      'search-combat-attack',
      t('search.sectionCombat'),
      ['attaque', 'attack'],
    ),
    entry(
      'combat-config',
      t('search.attackConfig'),
      'combat',
      'search-combat-config',
      t('search.sectionCombat'),
      ['config'],
    ),
    entry(
      'combat-history',
      t('search.history'),
      'combat',
      'search-combat-history',
      t('search.sectionCombat'),
      ['historique', 'history'],
    ),
    entry(
      'calculator',
      t('search.calculator'),
      'calculatrice',
      'search-calculator',
      t('search.sectionCalculator'),
      ['calcul', 'calculator'],
    ),
    entry(
      'inventory',
      t('search.inventory'),
      'inventaire',
      'search-inventory',
      t('search.sectionInventory'),
      ['sac', 'items'],
    ),
    entry(
      'inventory-add',
      t('search.addItem'),
      'inventaire',
      'search-inventory-add',
      t('search.sectionInventory'),
      ['ajouter', 'add'],
    ),
    entry(
      'equipment',
      t('search.equipment'),
      'equipements',
      'search-equipment',
      t('search.sectionEquipment'),
      ['equiper', 'gear'],
    ),
    entry(
      'equipment-bonuses',
      t('search.equippedBonuses'),
      'equipements',
      'search-equipment-bonuses',
      t('search.sectionEquipment'),
      ['bonus'],
    ),
  )

  for (const [key] of Object.entries(CATEGORY_LABELS)) {
    items.push(
      entry(
        `cat-${key}`,
        t(`categories.${key}`),
        'inventaire',
        'search-inventory',
        t('search.sectionInventory'),
        [key],
      ),
    )
  }

  for (const [key] of Object.entries(MODIFIER_LABELS)) {
    items.push(
      entry(
        `mod-${key}`,
        t(`modifiers.${key}`),
        'inventaire',
        'search-inventory',
        t('search.sectionInventory'),
        [key],
      ),
    )
  }

  return items
}

export function filterSearchEntries(entries: SearchEntry[], query: string): SearchEntry[] {
  const q = normalizeSearch(query)
  if (!q) return []

  return entries
    .map((e) => {
      const labelNorm = normalizeSearch(e.label)
      let score = 0
      if (labelNorm === q) score = 100
      else if (labelNorm.startsWith(q)) score = 80
      else if (labelNorm.includes(q)) score = 60
      else if (e.keywords.some((k) => k.startsWith(q))) score = 50
      else if (e.keywords.some((k) => k.includes(q))) score = 30
      return { entry: e, score }
    })
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score || a.entry.label.localeCompare(b.entry.label))
    .map(({ entry }) => entry)
    .slice(0, 8)
}

export function inventorySearchEntries(
  items: { id: string; name: string; description: string; category: string }[],
  categoryLabel: (id: string) => string,
): SearchEntry[] {
  const t = i18n.global.t
  return items.map((item) =>
    entry(
      `item-${item.id}`,
      item.name,
      'inventaire',
      `search-item-${item.id}`,
      t('search.sectionInventoryItem'),
      [item.description, item.category, categoryLabel(item.category)],
    ),
  )
}

/** Catégories de l'inventaire (celles qui ont des objets + celles du joueur) → Inventaire filtré */
export function inventoryCategorySearchEntries(
  categories: string[],
  categoryLabel: (id: string) => string,
): SearchEntry[] {
  const t = i18n.global.t
  return categories.map((id) => ({
    ...entry(
      `category-${id}`,
      categoryLabel(id),
      'inventaire',
      'search-inventory',
      t('search.sectionInventoryCategory'),
      ['categorie', 'category'],
    ),
    categoryFilter: id,
  }))
}
