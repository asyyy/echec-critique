import { describe, expect, it } from 'vitest'
import { decodeBundle, encodeBundle, packBundle, unpackBundle } from '@/utils/characterBundle'
import { DEMO_IDS, buildDemoCharacter } from '@/utils/demoCharacters'

describe('export compact .ec1', () => {
  it.each(DEMO_IDS)('aller-retour sans perte : démo %s', async (id) => {
    const bundle = buildDemoCharacter(id, 'fr')
    const decoded = await decodeBundle(await encodeBundle(bundle))

    expect(decoded.character).toEqual(bundle.character)
    expect(decoded.inventory.map((i) => [i.name, i.category, i.equipped])).toEqual(
      bundle.inventory.map((i) => [i.name, i.category, i.equipped]),
    )
    expect(decoded.categories).toEqual(bundle.categories ?? [])
    expect(decoded.conditions?.map((c) => [c.preset, c.name, c.kind, c.level])).toEqual(
      bundle.conditions?.map((c) => [c.preset, c.name, c.kind, c.level]),
    )
    expect(decoded.attacks).toHaveLength(bundle.attacks.length)
  })

  it('garde les états mémorisés (« Mes états »)', async () => {
    const bundle = buildDemoCharacter('fighter', 'fr')
    const decoded = await decodeBundle(await encodeBundle(bundle))
    expect(decoded.savedConditions?.map((c) => [c.name, c.kind, c.source, c.modifiers])).toEqual(
      bundle.savedConditions?.map((c) => [c.name, c.kind, c.source, c.modifiers]),
    )
  })

  it('le texte exporté commence par EC1.', async () => {
    expect(await encodeBundle(buildDemoCharacter('dying', 'en'))).toMatch(/^EC1\./)
  })

  it('un objet dans une catégorie inconnue passe en « Autre »', () => {
    const packed = packBundle(buildDemoCharacter('fighter', 'fr'))
    delete packed.k // catégories perso perdues (fichier tronqué, modifié…)
    const potion = unpackBundle(packed).inventory.find((i) => i.name === 'Potion de soins')
    expect(potion?.category).toBe('autre')
  })

  it('relit un ancien export sans les champs ajoutés depuis', () => {
    const packed = packBundle(buildDemoCharacter('wizard', 'fr'))
    delete packed.k
    delete packed.e
    delete packed.m
    const bundle = unpackBundle(packed)
    expect(bundle.conditions).toEqual([])
    expect(bundle.savedConditions).toEqual([])
    expect(bundle.categories).toEqual([])
  })

  it('refuse un texte qui n’est pas un export', async () => {
    await expect(decodeBundle('pas un export')).rejects.toThrow()
  })
})
