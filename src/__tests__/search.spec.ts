import { describe, expect, it } from 'vitest'
import {
  featureOriginSearchEntries,
  featureSearchEntries,
  filterSearchEntries,
  inventoryCategorySearchEntries,
  inventorySearchEntries,
} from '@/utils/searchIndex'

const label = (id: string) => ({ arme: 'Armes', 'cat-potions': 'Potions' })[id] ?? id

describe('recherche globale', () => {
  it('une catégorie ouvre l’inventaire filtré sur elle', () => {
    const [entry] = inventoryCategorySearchEntries(['cat-potions'], label)
    expect(entry).toMatchObject({ tab: 'inventaire', categoryFilter: 'cat-potions' })
  })

  it('le nom exact d’une catégorie passe avant les objets qui commencent pareil', () => {
    const entries = [
      ...inventorySearchEntries(
        [{ id: '1', name: 'Potions de soins', description: '', category: 'cat-potions' }],
        label,
      ),
      ...inventoryCategorySearchEntries(['cat-potions'], label),
    ]
    expect(filterSearchEntries(entries, 'potions')[0].categoryFilter).toBe('cat-potions')
  })

  it('ignore les accents et la casse', () => {
    const entries = inventoryCategorySearchEntries(['cat-potions'], () => 'Épées')
    expect(filterSearchEntries(entries, 'epees')).toHaveLength(1)
  })
})

describe('recherche globale : capacités', () => {
  const feature = {
    id: 'ft-1',
    name: 'Second souffle',
    description: 'Action bonus : récupère des PV',
    origin: 'classe' as const,
  }

  it('une capacité ouvre Capa & Traits sur « Toutes », à sa carte', () => {
    const [entry] = featureSearchEntries([feature])
    expect(entry).toMatchObject({
      tab: 'equipements',
      equipmentSection: 'capacite',
      featureOrigin: 'all',
      targetId: 'search-feature-ft-1',
    })
  })

  it('trouve une capacité par sa description', () => {
    expect(filterSearchEntries(featureSearchEntries([feature]), 'recupere')).toHaveLength(1)
  })

  it('une origine ouvre Capa & Traits filtré sur elle', () => {
    const [entry] = featureOriginSearchEntries(['don'])
    expect(entry).toMatchObject({ equipmentSection: 'capacite', featureOrigin: 'don' })
    expect(entry.label).toBe('Don')
  })
})
