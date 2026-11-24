<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import InfoTip from '@/components/InfoTip.vue'
import {
  CLASS_FEATURES,
  SUBCLASSES,
  SUBCLASS_FEATURES,
  SUBCLASS_FEATURE_LEVELS,
  classUrl,
  subclassUrl,
  type ClassId,
  type SubclassId,
} from '@/utils/origins'

/**
 * Rappel des capacités d'une classe ou d'une sous-classe : noms par niveau, liens AideDD
 * (jamais le texte hors SRD). Rien n'est ajouté dans Capa & Traits.
 * `level` : grise les niveaux pas encore atteints.
 */
const props = defineProps<
  ({ classId: ClassId; subclassId?: never } | { subclassId: SubclassId; classId?: never }) & {
    level?: number
  }
>()

const { t, locale } = useI18n()

const url = computed(() =>
  props.subclassId
    ? subclassUrl(props.subclassId, locale.value)
    : classUrl(props.classId!, locale.value),
)

const title = computed(() =>
  t(props.subclassId ? 'origins.subclassFeaturesTitle' : 'origins.classFeaturesTitle'),
)

/** Noms regroupés par niveau (vide : sous-classe non détaillée sur AideDD) */
const groups = computed(() => {
  const key = props.subclassId
    ? `origins.subclassFeatures.${props.subclassId}`
    : `origins.classFeatures.${props.classId}`
  const levels = props.subclassId
    ? SUBCLASS_FEATURES[props.subclassId]
    : CLASS_FEATURES[props.classId!]
  const list: { level: number; names: string[] }[] = []
  levels?.forEach((level, i) => {
    const name = t(`${key}.${i}`)
    const last = list[list.length - 1]
    if (last?.level === level) last.names.push(name)
    else list.push({ level, names: [name] })
  })
  return list
})

/** Sous-classe non détaillée : seulement ses niveaux de capacités */
const fallbackLevels = computed(() =>
  props.subclassId ? SUBCLASS_FEATURE_LEVELS[SUBCLASSES[props.subclassId].classId].join(', ') : '',
)
</script>

<template>
  <div class="feature-reminder">
    <h5 class="field-label title-with-tip">
      {{ title }}
      <InfoTip :title="title" :lines="[t('origins.notAuto')]" />
    </h5>

    <ul v-if="groups.length">
      <li
        v-for="group in groups"
        :key="group.level"
        :class="{ later: level !== undefined && level < group.level }"
      >
        <span class="feature-level">{{ t('origins.levelN', { n: group.level }) }}</span>
        <span class="feature-links">
          <a v-for="name in group.names" :key="name" :href="url" target="_blank" rel="noopener">{{
            name
          }}</a>
        </span>
      </li>
    </ul>
    <p v-else class="hint">
      {{ t('origins.featureLevels') }} {{ fallbackLevels }} · {{ t('origins.featuresNoList') }}
    </p>

    <a class="aidedd-link" :href="url" target="_blank" rel="noopener">
      {{ t('origins.aidedd') }} ↗
    </a>
  </div>
</template>

<style scoped>
.feature-reminder {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  min-width: 0;
}

.feature-reminder h5 {
  margin: 0;
}

.title-with-tip {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
}

ul {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  font-size: 0.82rem;
}

li {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 0.15rem 0.5rem;
  min-width: 0;
}

.feature-level {
  font-size: 0.72rem;
  font-weight: 700;
  color: var(--color-text-muted);
}

.feature-links {
  display: flex;
  flex-wrap: wrap;
  gap: 0.15rem 0.6rem;
  min-width: 0;
}
.feature-links a {
  color: var(--color-accent);
  overflow-wrap: anywhere;
}
/* Niveau pas encore atteint */
li.later .feature-links a {
  color: var(--color-text-muted);
}

.aidedd-link {
  align-self: flex-start;
  font-size: 0.82rem;
  font-weight: 600;
  color: var(--color-accent);
}
</style>
