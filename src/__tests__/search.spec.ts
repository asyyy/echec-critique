import { describe, expect, it } from 'vitest'
import {
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
