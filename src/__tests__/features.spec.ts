import { describe, expect, it } from 'vitest'
import { useCharacterBundle } from '@/composables/useCharacterBundle'
import { useCharacterStore } from '@/stores/character'
import { useCombatStore } from '@/stores/combat'
import { normalizeFeature, useFeaturesStore, type Feature } from '@/stores/features'
import { decodeBundle, encodeBundle, packBundle, unpackBundle } from '@/utils/characterBundle'
import { buildDemoCharacter } from '@/utils/demoCharacters'

const base: Omit<Feature, 'id' | 'usesSpent'> = {
  name: 'Second souffle',
  origin: 'classe',
  description: '',
  usesMax: 2,
  recharge: 'short',
  modifiers: [],
}

describe('capacités & traits', () => {
  it('rejette une capacité sans nom, borne les utilisations', () => {
    expect(normalizeFeature({ name: '   ' })).toBeNull()
    const f = normalizeFeature({ name: 'Rage', usesMax: 500, usesSpent: -3, origin: 'inconnue' })
    expect(f).toMatchObject({ usesMax: 99, usesSpent: 0, origin: 'autre', recharge: 'long' })
    expect(normalizeFeature({ name: 'Rage', usesMax: 2, usesSpent: 9 })?.usesSpent).toBe(2)
  })

  it('ignore les modificateurs inconnus ou nuls', () => {
    const f = normalizeFeature({
      name: 'Défense',
      modifiers: [
        { type: 'ca', value: 1 },
        { type: 'vol', value: 3 },
        { type: 'attaque', value: 0 },
      ],
    })
    expect(f?.modifiers).toEqual([{ type: 'ca', value: 1 }])
  })

  it('utiliser / récupérer reste entre 0 et le maximum', () => {
    const store = useFeaturesStore()
    const f = store.add(base)!
    store.bumpUses(f.id, -1)
    store.bumpUses(f.id, -1)
    store.bumpUses(f.id, -1)
    expect(store.features[0].usesSpent).toBe(2)
    store.bumpUses(f.id, 1)
    expect(store.features[0].usesSpent).toBe(1)
  })

  it('le repos long recharge toutes les utilisations (repos court compris)', () => {
    const store = useFeaturesStore()
    const short = store.add(base)!
    const long = store.add({ ...base, name: 'Rage', recharge: 'long', usesMax: 3 })!
    store.bumpUses(short.id, -2)
    store.bumpUses(long.id, -1)
    store.longRest()
    expect(store.features.map((f) => f.usesSpent)).toEqual([0, 0])
  })

  it('modifier une capacité garde les utilisations dépensées, bornées au nouveau max', () => {
    const store = useFeaturesStore()
    const f = store.add({ ...base, usesMax: 4 })!
    store.bumpUses(f.id, -3)
    store.update(f.id, { ...base, usesMax: 2 })
    expect(store.features[0].usesSpent).toBe(2)
  })

  it('annuler une suppression remet la capacité à sa place', () => {
    const store = useFeaturesStore()
    store.add({ ...base, name: 'A' })
    const b = store.add({ ...base, name: 'B' })!
    store.add({ ...base, name: 'C' })
    store.remove(b.id)
    store.restore(b, 1)
    expect(store.features.map((f) => f.name)).toEqual(['A', 'B', 'C'])
  })

  it('les modificateurs s’ajoutent à la Fiche et aux Attaques', () => {
    useCharacterBundle().applyBundle(buildDemoCharacter('fighter', 'fr'))
    const char = useCharacterStore()
    const combat = useCombatStore()
    const sword = combat.configs[0]
    const ac = char.armorClass
    const toHit = combat.resolveAttackBonus(sword).total
    useFeaturesStore().add({
      ...base,
      name: 'Style de combat',
      usesMax: 0,
      modifiers: [
        { type: 'ca', value: 1 },
        { type: 'attaque', value: 2 },
        { type: 'force', value: 2 },
      ],
    })
    expect(char.armorClass).toBe(ac + 1)
    // +2 attaque, et For 16 → 18 : +1 au modificateur
    expect(combat.resolveAttackBonus(sword).total).toBe(toHit + 3)
    expect(combat.resolveAttackBonus(sword).features).toBe(2)
  })

  it('Vigilant (démo) : bonus d’initiative', () => {
    useCharacterBundle().applyBundle(buildDemoCharacter('fighter', 'fr'))
    const char = useCharacterStore()
    expect(char.initiative).toBe(char.abilityMod('dex') + char.initiativeBonus + 3)
  })
})

describe('capacités dans l’export .ec1', () => {
  it('aller-retour sans perte', async () => {
    const bundle = buildDemoCharacter('fighter', 'fr')
    const decoded = await decodeBundle(await encodeBundle(bundle))
    // Les ids sont recréés à l'import
    const strip = (list: Feature[] = []) => list.map((f) => ({ ...f, id: '' }))
    expect(strip(decoded.features)).toEqual(strip(bundle.features))
  })

  it('un ancien export sans capacités donne une liste vide', () => {
    const packed = packBundle(buildDemoCharacter('fighter', 'fr'))
    delete packed.f
    expect(unpackBundle(packed).features).toEqual([])
  })

  it('changer de perso remplace les capacités', () => {
    const { applyBundle } = useCharacterBundle()
    applyBundle(buildDemoCharacter('fighter', 'fr'))
    expect(useFeaturesStore().features).toHaveLength(3)
    applyBundle(buildDemoCharacter('wizard', 'fr'))
    expect(useFeaturesStore().features).toHaveLength(0)
  })
})
