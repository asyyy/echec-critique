import { describe, expect, it } from 'vitest'
import { useCharacterBundle } from '@/composables/useCharacterBundle'
import { useCombatStore } from '@/stores/combat'
import { useInventoryStore } from '@/stores/inventory'
import { useSpellsStore } from '@/stores/spells'
import { buildDemoCharacter } from '@/utils/demoCharacters'

/** « Supprimé · Annuler » : l'élément revient à sa place, avec ses liens */
describe('annulation des suppressions', () => {
  it('un objet revient à la même position, toujours équipé', () => {
    useCharacterBundle().applyBundle(buildDemoCharacter('fighter', 'fr'))
    const inventory = useInventoryStore()
    const index = 2
    const item = inventory.items[index]
    inventory.removeItem(item.id)
    expect(inventory.items.some((i) => i.id === item.id)).toBe(false)
    inventory.restoreItem(item, index)
    expect(inventory.items[index]).toMatchObject({ id: item.id, equipped: item.equipped })
  })

  it('une attaque revient à la même position', () => {
    useCharacterBundle().applyBundle(buildDemoCharacter('fighter', 'fr'))
    const combat = useCombatStore()
    const config = combat.configs[0]
    combat.removeConfig(config.id)
    combat.restoreConfig(config, 0)
    expect(combat.configs[0].id).toBe(config.id)
  })

  it('un sort concentré revient avec sa concentration et ses rounds', () => {
    useCharacterBundle().applyBundle(buildDemoCharacter('wizard', 'fr'))
    const spells = useSpellsStore()
    const spell = spells.concentrationSpell!
    const index = spells.spells.indexOf(spell)
    const rounds = spells.concentrationRoundsLeft

    spells.removeSpell(spell.id)
    expect(spells.concentrationSpellId).toBeNull()

    spells.restoreSpell(spell, index)
    spells.restoreConcentration(spell.id, rounds)
    expect(spells.spells[index].id).toBe(spell.id)
    expect(spells.concentrationSpellId).toBe(spell.id)
    expect(spells.concentrationRoundsLeft).toBe(rounds)
  })

  it('restaurer deux fois ne crée pas de doublon', () => {
    useCharacterBundle().applyBundle(buildDemoCharacter('fighter', 'fr'))
    const inventory = useInventoryStore()
    const item = inventory.items[0]
    const count = inventory.items.length
    inventory.removeItem(item.id)
    inventory.restoreItem(item, 0)
    inventory.restoreItem(item, 0)
    expect(inventory.items).toHaveLength(count)
  })
})
