<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useCharacterRosterStore } from '@/stores/characterRoster'
import { useSettingsStore } from '@/stores/settings'
import { useCharacterBundle } from '@/composables/useCharacterBundle'
import { DEMO_IDS, buildDemoCharacter, type DemoId } from '@/utils/demoCharacters'
import LeadNote from '@/components/LeadNote.vue'

const emit = defineEmits<{ created: [] }>()

const { t } = useI18n()
const roster = useCharacterRosterStore()
const settings = useSettingsStore()
const { collectBundle, applyBundle } = useCharacterBundle()

const busy = ref(false)
const feedback = ref('')

/** Fonctionnalités montrées, séparées par « · » dans la traduction */
function features(id: DemoId): string[] {
  return t(`debug.demos.${id}.features`)
    .split('·')
    .map((f) => f.trim())
    .filter(Boolean)
}

/** Crée un nouveau perso (l'actuel est gardé dans la liste des persos) et l'active */
async function createDemo(id: DemoId) {
  if (busy.value) return
  busy.value = true
  feedback.value = ''
  try {
    const bundle = buildDemoCharacter(id, settings.locale)
    await roster.createNew(bundle, collectBundle())
    applyBundle(bundle)
    emit('created')
  } catch {
    feedback.value = t('debug.error')
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div class="debug">
    <LeadNote id="debug" :text="t('debug.intro')" />

    <article v-for="id in DEMO_IDS" :key="id" class="demo-card">
      <div class="demo-head">
        <div class="demo-text">
          <h3 class="demo-title">{{ t(`debug.demos.${id}.title`) }}</h3>
          <p class="demo-subtitle">{{ t(`debug.demos.${id}.subtitle`) }}</p>
        </div>
        <button class="btn-add" type="button" :disabled="busy" @click="createDemo(id)">
          {{ t('debug.create') }}
        </button>
      </div>
      <ul class="demo-features">
        <li v-for="(feature, i) in features(id)" :key="i">{{ feature }}</li>
      </ul>
    </article>

    <p v-if="feedback" class="debug-feedback">{{ feedback }}</p>
  </div>
</template>

<style scoped>
.debug {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  padding-bottom: 1rem;
}

.demo-card {
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  padding: 0.75rem 0.85rem;
  min-width: 0;
}

.demo-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.65rem;
  min-width: 0;
}

.demo-text {
  min-width: 0;
}

.demo-title {
  margin: 0;
  font-size: 1rem;
  font-weight: 800;
}

.demo-subtitle {
  margin: 0.15rem 0 0;
  font-size: 0.78rem;
  color: var(--color-text-muted);
}

.demo-head .btn-add {
  flex-shrink: 0;
}

.demo-head .btn-add:disabled {
  opacity: 0.5;
}

.demo-features {
  display: flex;
  flex-wrap: wrap;
  gap: 0.3rem;
  list-style: none;
  margin: 0.6rem 0 0;
  padding: 0;
}

.demo-features li {
  font-size: 0.72rem;
  font-weight: 600;
  padding: 0.2rem 0.5rem;
  border-radius: 999px;
  background: var(--color-bg-card);
  color: var(--color-text-secondary);
}

.debug-feedback {
  margin: 0;
  font-size: 0.8rem;
  color: var(--color-danger);
}
</style>
