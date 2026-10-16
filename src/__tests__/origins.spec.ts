import { describe, expect, it } from 'vitest'
import { useCharacterBundle } from '@/composables/useCharacterBundle'
import { useCharacterStore } from '@/stores/character'
import { useInventoryStore } from '@/stores/inventory'
import { packBundle, unpackBundle } from '@/utils/characterBundle'
import { buildDemoCharacter } from '@/utils/demoCharacters'
import { matchClassId, matchSpeciesId, monkSpeedBonus } from '@/utils/origins'

describe('classes et espèces', () => {
  it('reconnaît une classe / espèce saisie en texte (FR, EN, accents, féminin)', () => {
    expect(matchClassId('Guerrière')).toBe('guerrier')
    expect(matchClassId(' fighter ')).toBe('guerrier')
    expect(matchClassId('Rôdeuse')).toBe('rodeur')
    expect(matchClassId('Artificier')).toBeNull()
    expect(matchSpeciesId('Naine')).toBe('nain')
    expect(matchSpeciesId('Tiefling')).toBe('tieffelin')
  })

  it('Déplacement sans armure du Moine : +3 m au niv. 2, +9 m au niv. 18', () => {
    expect([1, 2, 5, 6, 10, 14, 18, 20].map(monkSpeedBonus)).toEqual([0, 3, 3, 4.5, 6, 7.5, 9, 9])
  })

  it('choisir une classe coche ses sauvegardes, choisir une espèce règle la vitesse', () => {
    const char = useCharacterStore()
    char.toggleSavingThrow('cha')
    char.setClass('magicien', 'Magicien')
    expect(Object.entries(char.savingThrowProficiency).filter(([, v]) => v)).toEqual([
      ['int', true],
      ['wis', true],
    ])
    char.setSpecies('goliath', 'Goliath')
    expect(char.speedBase).toBe(10.5)
  })

  it('re-choisir la même classe ne touche pas aux sauvegardes modifiées', () => {
    const char = useCharacterStore()
    char.setClass('magicien', 'Magicien')
    char.toggleSavingThrow('con')
    char.setClass('magicien', 'Magicien')
    expect(char.savingThrowProficiency.con).toBe(true)
  })

  it('Personnalisé : nom libre, aucun bonus', () => {
    const char = useCharacterStore()
    char.setClass(null, 'Artificier')
    expect(char.classId).toBeNull()
    expect(char.characterClass).toBe('Artificier')
    expect(char.originEffects).toEqual([])
  })

  it('Barbare : Défense sans armure (+ mod. Con), perdue en armure', () => {
    const char = useCharacterStore()
    char.setAbilityScore('con', 16)
    char.setClass('barbare', 'Barbare')
    expect(char.armorClass).toBe(13)
    const inventory = useInventoryStore()
    inventory.addItem({
      name: 'Cuirasse',
      category: 'armure',
      description: '',
      modifiers: [{ type: 'ca', value: 4 }],
      weaponDamage: [],
      equipped: true,
    })
    expect(char.armorClass).toBe(14)
  })

  it('Barbare niv. 5 : Déplacement rapide +3 m', () => {
    const char = useCharacterStore()
    char.setClass('barbare', 'Barbare')
    char.setSpecies('humain', 'Humain')
    expect(char.speed).toBe(9)
    char.level = 5
    expect(char.speed).toBe(12)
  })

  it('Moine : pas de Défense sans armure avec un bouclier', () => {
    const char = useCharacterStore()
    char.setAbilityScore('wis', 14)
    char.setClass('moine', 'Moine')
    expect(char.armorClass).toBe(12)
    useInventoryStore().addItem({
      name: 'Bouclier',
      category: 'bouclier',
      description: '',
      modifiers: [{ type: 'ca', value: 2 }],
      weaponDamage: [],
      equipped: true,
    })
    expect(char.armorClass).toBe(12)
  })
})

describe('classes et espèces dans l’export .ec1', () => {
  it('garde la classe, l’espèce et le « Personnalisé »', () => {
    const bundle = buildDemoCharacter('fighter', 'fr')
    bundle.character.classId = 'guerrier'
    bundle.character.speciesId = null
    const { character } = unpackBundle(packBundle(bundle))
    expect(character.classId).toBe('guerrier')
    expect(character.speciesId).toBeNull()
  })

  it('un ancien export (sans les colonnes) retrouve la classe d’après le texte', () => {
    const { applyBundle } = useCharacterBundle()
    applyBundle(buildDemoCharacter('wizard', 'fr'))
    const char = useCharacterStore()
    expect(char.classId).toBe('magicien')
    expect(char.speciesId).toBe('elfe')
  })

  it('« Personnalisé » explicite n’est pas reconnu d’après le texte', () => {
    const bundle = buildDemoCharacter('wizard', 'fr')
    bundle.character.classId = null
    useCharacterBundle().applyBundle(unpackBundle(packBundle(bundle)))
    expect(useCharacterStore().classId).toBeNull()
  })
})
