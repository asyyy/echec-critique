import { describe, expect, it } from 'vitest'
import { useCharacterBundle } from '@/composables/useCharacterBundle'
import { useCharacterStore } from '@/stores/character'
import { useCombatStore } from '@/stores/combat'
import { useConditionsStore, conditionModifiers } from '@/stores/conditions'
import { useSpellsStore, concentrationSaveDc } from '@/stores/spells'
import { buildDemoCharacter } from '@/utils/demoCharacters'

function load(id: 'fighter' | 'wizard' | 'dying') {
  useCharacterBundle().applyBundle(buildDemoCharacter(id, 'fr'))
  return useCharacterStore()
}

describe('fiche : équipement + états temporaires', () => {
  it('CA = base + armure + bouclier + anneau + Bouclier de la foi', () => {
    // 10 + 6 (cotte) + 2 (bouclier) + 1 (anneau) + 2 (Bouclier de la foi)
    expect(load('fighter').armorClass).toBe(21)
  })

  it('attaques : bonus de l’arme liée et des buffs, critique non compris', () => {
    load('fighter')
    const combat = useCombatStore()
    const sword = combat.configs[0]
    // For +3, maîtrise +3, épée +1, Cri de guerre +1
    expect(combat.toHitPreview(sword)).toContain('2× d20 +8')
    // 1d8 + For 3 + épée 1 + Cri de guerre 2
    expect(combat.damageFormulaPreview(sword)).toContain('1d8+6')
  })

  it('Épuisement : −2 par niveau aux tests d20, −1,5 m de vitesse par niveau', () => {
    load('wizard')
    const conditions = useConditionsStore()
    const exhaustion = conditions.conditions.find((c) => c.preset === 'epuisement')!
    conditions.update(exhaustion.id, { ...exhaustion, level: 2 })
    expect(conditionModifiers({ ...exhaustion, level: 2 })).toEqual(
      expect.arrayContaining([expect.objectContaining({ type: 'vitesse', value: -3 })]),
    )
    expect(useCharacterStore().speed).toBe(6)
  })

  it('Inconscient (et Entravé, Agrippé…) : vitesse 0', () => {
    expect(load('dying').speed).toBe(0)
  })

  it('Hâte double la vitesse et donne +2 CA, arrondi à 1,5 m', () => {
    const char = load('wizard')
    const conditions = useConditionsStore()
    for (const c of [...conditions.conditions]) conditions.remove(c.id)
    const before = char.armorClass
    conditions.add({
      preset: 'hate',
      name: '',
      kind: 'buff',
      source: 'sort',
      level: 1,
      modifiers: [],
    })
    expect(char.armorClass).toBe(before + 2)
    expect(char.speed).toBe(18)
  })
})

describe('PV et jets contre la mort', () => {
  it('les dégâts entament d’abord les PV temporaires', () => {
    const char = load('fighter') // 38 / 44, 5 PV temporaires
    char.adjustHp(-7)
    expect(char.hpTemp).toBe(0)
    expect(char.hpCurrent).toBe(36)
  })

  it('un soin au-delà du maximum devient des PV temporaires', () => {
    const char = load('fighter')
    char.adjustHp(-5) // vide les PV temporaires
    char.adjustHp(10) // 38 → 44, il reste 4
    expect(char.hpCurrent).toBe(44)
    expect(char.hpTemp).toBe(4)
  })

  it('1 naturel = 2 échecs, et 3 échecs = mort', () => {
    const char = load('dying') // 1 réussite, 2 échecs
    expect(char.isDead).toBe(false)
    char.recordDeathSave('nat1')
    expect(char.deathSaveFailures).toBe(3)
    expect(char.isDead).toBe(true)
  })

  it('20 naturel : 1 PV et compteurs remis à zéro', async () => {
    const char = load('dying')
    char.recordDeathSave('nat20')
    expect(char.hpCurrent).toBe(1)
    expect(char.isDying).toBe(false)
  })
})

describe('concentration', () => {
  it.each([
    [0, 10],
    [19, 10],
    [22, 11],
    [100, 30],
  ])('DD pour %i dégâts = %i', (damage, dc) => {
    expect(concentrationSaveDc(damage)).toBe(dc)
  })

  it('la démo magicienne est concentrée sur Toile d’araignée', () => {
    load('wizard')
    expect(useSpellsStore().concentrationSpell?.name).toBe('Toile d’araignée')
  })
})
