import { useI18n } from 'vue-i18n'
import { isBuiltinCategory, useInventoryStore } from '@/stores/inventory'

/** Libellé d'une catégorie : traduit si intégrée, nom saisi si créée par le joueur */
export function useCategoryLabel() {
  const { t } = useI18n()
  const store = useInventoryStore()
  return (id: string): string =>
    isBuiltinCategory(id)
      ? t(`categories.${id}`)
      : (store.customCategoryName(id) ?? t('categories.autre'))
}
