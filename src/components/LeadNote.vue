<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useDismissedNotes } from '@/composables/useDismissedNotes'

const props = defineProps<{
  /** Identifiant stable de la note (ne pas le changer, sinon elle réapparaît) */
  id: string
  text: string
}>()

const { t } = useI18n()
const { isDismissed, dismiss } = useDismissedNotes()
</script>

<template>
  <button
    v-if="!isDismissed(props.id)"
    type="button"
    class="lead-note lead-note-dismiss"
    :title="t('common.hideNote')"
    @click="dismiss(props.id)"
  >
    <span class="lead-note-text">{{ props.text }}</span>
    <span class="lead-note-close" aria-hidden="true">✕</span>
    <span class="visually-hidden">{{ t('common.hideNote') }}</span>
  </button>
</template>

<style scoped>
.lead-note-dismiss {
  width: 100%;
  font-family: inherit;
  text-align: left;
  cursor: pointer;
}

.lead-note-text {
  flex: 1;
  min-width: 0;
}

.lead-note-close {
  flex-shrink: 0;
  align-self: flex-start;
  font-style: normal;
  font-size: 0.7rem;
  opacity: 0.55;
}

.visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
}
</style>
