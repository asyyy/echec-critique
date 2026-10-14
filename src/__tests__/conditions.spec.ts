import { describe, expect, it } from 'vitest'
import { normalizeCondition, useConditionsStore } from '@/stores/conditions'

describe('états temporaires', () => {
  it('rejette un état sans préréglage ni nom', () => {
    expect(normalizeCondition({ preset: null, name: '  ' })).toBeNull()
    expect(normalizeCondition({ preset: 'inconnu', name: '' })).toBeNull()
  })

  it('borne le niveau d’Épuisement entre 1 et 6', () => {
    expect(normalizeCondition({ preset: 'epuisement', level: 9 })?.level).toBe(6)
    expect(normalizeCondition({ preset: 'epuisement', level: 0 })?.level).toBe(1)
  })

  it('« Mes états » : même nom (casse, accents) = une seule entrée, remontée en tête', () => {
    const store = useConditionsStore()
    store.remember({ name: 'Rage', kind: 'buff', source: 'autre', modifiers: [] })
    store.remember({ name: 'Bénédiction maison', kind: 'buff', source: 'allie', modifiers: [] })
    store.remember({
      name: 'rage',
      kind: 'buff',
      source: 'sort',
      modifiers: [{ type: 'degats', value: 2 }],
    })
    expect(store.saved.map((s) => s.name)).toEqual(['rage', 'Bénédiction maison'])
    expect(store.saved[0].modifiers).toEqual([{ type: 'degats', value: 2 }])
  })

  it('oublier un état mémorisé ne retire pas l’état actif', () => {
    const store = useConditionsStore()
    const cond = { name: 'Rage', kind: 'buff', source: 'autre', modifiers: [] } as const
    store.add({ ...cond, preset: null, level: 1, modifiers: [] })
    store.remember({ ...cond, modifiers: [] })
    store.forget(store.saved[0].id)
    expect(store.saved).toHaveLength(0)
    expect(store.conditions).toHaveLength(1)
  })
})
