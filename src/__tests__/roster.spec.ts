import { describe, expect, it } from 'vitest'
import { useCharacterRosterStore } from '@/stores/characterRoster'
import { buildDemoCharacter } from '@/utils/demoCharacters'

describe('liste des persos', () => {
  it('changer de perso ne réordonne pas la liste (ordre de création)', async () => {
    const roster = useCharacterRosterStore()
    const fighter = buildDemoCharacter('fighter', 'fr')
    const wizard = buildDemoCharacter('wizard', 'fr')
    const dying = buildDemoCharacter('dying', 'fr')

    await roster.ensureSeeded(fighter)
    await roster.createNew(wizard, fighter)
    await roster.createNew(dying, wizard)
    const order = roster.visibleSlots.map((s) => s.displayName)
    expect(order).toEqual(['Brunhilde (démo)', 'Ysolde (démo)', 'Pip (démo)'])

    // Retour sur le premier perso : le perso quitté est enregistré, mais ne bouge pas
    await roster.switchTo(roster.visibleSlots[0].id, dying)
    expect(roster.visibleSlots.map((s) => s.displayName)).toEqual(order)
  })

  it('le perso actif ne peut pas être supprimé', async () => {
    const roster = useCharacterRosterStore()
    await roster.ensureSeeded(buildDemoCharacter('fighter', 'fr'))
    expect(roster.softDelete(roster.activeId)).toBe(false)
  })
})
