import { useI18n } from 'vue-i18n'
import { getPreset, type ActiveCondition } from '@/stores/conditions'

/** Nom affiché d'un état : traduit pour un préréglage (avec son niveau), saisi sinon */
export function useConditionLabel() {
  const { t } = useI18n()
  return (cond: ActiveCondition): string => {
    if (!cond.preset) return cond.name
    const name = t(`conditions.presets.${cond.preset}.name`)
    return getPreset(cond.preset)?.maxLevel ? `${name} ${cond.level}` : name
  }
}
