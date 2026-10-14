import catalog from '@/data/spellCatalog.json'

/** Entrée catalogue : nom + métadonnées légères + lien externe (détail hors app) */
export interface CatalogSpell {
  id: string
  name: string
  nameAlt?: string
  nameEn: string
  level: number
  school: string
  url: string
}

export const SPELL_CATALOG = catalog as CatalogSpell[]

export function searchCatalog(query: string, levelFilter: number | 'all' = 'all'): CatalogSpell[] {
  const q = query
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
  return SPELL_CATALOG.filter((s) => {
    if (levelFilter !== 'all' && s.level !== levelFilter) return false
    if (!q) return true
    const hay = `${s.name} ${s.nameAlt ?? ''} ${s.nameEn} ${s.school}`
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
    return hay.includes(q)
  })
}
