<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useCharacterStore } from '@/stores/character'
import {
  CLASSES,
  CLASS_IDS,
  ORIGIN_EFFECTS,
  SPECIES,
  SPECIES_IDS,
  type ClassId,
  type OriginEffectId,
  type SpeciesId,
} from '@/utils/origins'
import type { Ability } from '@/utils/dnd'

/**
 * Choix de la classe ou de l'espèce : liste à gauche, ce que le choix apporte à droite.
 * « Personnalisé » garde un nom libre, sans bonus automatique.
 */
const props = defineProps<{ kind: 'class' | 'species' }>()

const emit = defineEmits<{
  close: []
  pick: [id: string | null, label: string]
}>()

const { t, locale } = useI18n()
const char = useCharacterStore()

const ids = computed<readonly string[]>(() => (props.kind === 'class' ? CLASS_IDS : SPECIES_IDS))
const currentId = computed(() => (props.kind === 'class' ? char.classId : char.speciesId))

const selected = ref<string>(currentId.value ?? 'custom')
const customName = ref(
  currentId.value ? '' : props.kind === 'class' ? char.characterClass : char.species,
)

function nameOf(id: string) {
  return t(`origins.${props.kind === 'class' ? 'classes' : 'species'}.${id}.name`)
}

/** Liste triée par nom dans la langue affichée */
const sortedIds = computed(() =>
  [...ids.value].sort((a, b) => nameOf(a).localeCompare(nameOf(b), locale.value)),
)

const classInfo = computed(() =>
  props.kind === 'class' && selected.value !== 'custom'
    ? { id: selected.value as ClassId, ...CLASSES[selected.value as ClassId] }
    : null,
)

const speciesInfo = computed(() =>
  props.kind === 'species' && selected.value !== 'custom'
    ? { id: selected.value as SpeciesId, ...SPECIES[selected.value as SpeciesId] }
    : null,
)

function signed(n: number) {
  return n >= 0 ? `+${n}` : `−${Math.abs(n)}`
}

function meters(n: number) {
  return `${n.toLocaleString(locale.value, { maximumFractionDigits: 1 })} m`
}

function abilityList(list: Ability[], joiner: 'and' | 'or') {
  return list.map((ab) => t(`abilities.${ab}`)).join(t(`origins.${joiner}`))
}

/** PV au niveau 1 : maximum du dé + mod. de Con actuel */
const hpLevel1 = computed(() => {
  if (!classInfo.value) return ''
  const con = char.abilityMod('con')
  return `${classInfo.value.hitDie} ${signed(con)} = ${classInfo.value.hitDie + con}`
})

const armorText = computed(() => {
  const armor = classInfo.value?.armor ?? []
  if (!armor.length) return t('origins.none')
  const text = armor.map((a) => t(`origins.armorTypes.${a}`)).join(', ')
  return text.charAt(0).toUpperCase() + text.slice(1)
})

const effects = computed(() => {
  const list: OriginEffectId[] = classInfo.value?.effects ?? speciesInfo.value?.effects ?? []
  return list.map((id) => ({
    id,
    level: ORIGIN_EFFECTS[id].level,
    reached: char.level >= ORIGIN_EFFECTS[id].level,
  }))
})

function confirm() {
  if (selected.value === 'custom') emit('pick', null, customName.value)
  else emit('pick', selected.value, nameOf(selected.value))
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') emit('close')
}

onMounted(() => document.addEventListener('keydown', onKeydown))
onUnmounted(() => document.removeEventListener('keydown', onKeydown))
</script>

<template>
  <Teleport to="body">
    <div class="origin-backdrop" @click.self="emit('close')">
      <div
        class="origin-dialog"
        role="dialog"
        aria-modal="true"
        :aria-label="t(`origins.${kind}Title`)"
      >
        <header class="origin-head">
          <h3 class="form-title">{{ t(`origins.${kind}Title`) }}</h3>
          <button
            type="button"
            class="origin-close hit-area"
            :aria-label="t('common.cancel')"
            @click="emit('close')"
          >
            ✕
          </button>
        </header>

        <div class="origin-body">
          <ul class="origin-list" role="listbox" :aria-label="t(`origins.${kind}Title`)">
            <li v-for="id in sortedIds" :key="id">
              <button
                type="button"
                class="origin-option"
                role="option"
                :aria-selected="selected === id"
                :class="{ active: selected === id, current: currentId === id }"
                @click="selected = id"
              >
                {{ nameOf(id) }}
              </button>
            </li>
            <li>
              <button
                type="button"
                class="origin-option custom"
                role="option"
                :aria-selected="selected === 'custom'"
                :class="{ active: selected === 'custom' }"
                @click="selected = 'custom'"
              >
                {{ t('origins.custom') }}
              </button>
            </li>
          </ul>

          <div class="origin-detail" aria-live="polite">
            <!-- Personnalisé -->
            <template v-if="selected === 'custom'">
              <h4 class="form-title">{{ t('origins.custom') }}</h4>
              <label class="field">
                <span>{{ t('origins.customName') }}</span>
                <input
                  v-model="customName"
                  type="text"
                  maxlength="40"
                  :placeholder="t(`origins.${kind}CustomPlaceholder`)"
                />
              </label>
              <p class="hint">{{ t('origins.customNoBonus') }}</p>
            </template>

            <!-- Classe -->
            <template v-else-if="classInfo">
              <h4 class="form-title">{{ nameOf(classInfo.id) }}</h4>
              <dl class="detail-rows">
                <dt>{{ t('origins.hitDie') }}</dt>
                <dd>d{{ classInfo.hitDie }}</dd>
                <dt>{{ t('origins.hpLevel1') }}</dt>
                <dd>{{ hpLevel1 }}</dd>
                <dt>{{ t('origins.primary') }}</dt>
                <dd>{{ abilityList(classInfo.primary, classInfo.primaryOr ? 'or' : 'and') }}</dd>
                <dt>{{ t('origins.saves') }}</dt>
                <dd>{{ abilityList(classInfo.saves, 'and') }}</dd>
                <dt>{{ t('origins.skills') }}</dt>
                <dd>{{ t('origins.skillsN', { n: classInfo.skillChoices }) }}</dd>
                <dt>{{ t('origins.armor') }}</dt>
                <dd>{{ armorText }}</dd>
                <dt>{{ t('origins.weapons') }}</dt>
                <dd>{{ t(`origins.classes.${classInfo.id}.weapons`) }}</dd>
                <template v-if="classInfo.spellcasting">
                  <dt>{{ t('origins.spellcasting') }}</dt>
                  <dd>{{ t(`abilities.${classInfo.spellcasting}`) }}</dd>
                </template>
              </dl>

              <section class="detail-block">
                <h5 class="field-label">{{ t('origins.applied') }}</h5>
                <ul>
                  <li>
                    {{
                      t('origins.appliedSaves', {
                        list: classInfo.saves.map((ab) => t(`abilityShort.${ab}`)).join(', '),
                      })
                    }}
                  </li>
                </ul>
              </section>
            </template>

            <!-- Espèce -->
            <template v-else-if="speciesInfo">
              <h4 class="form-title">{{ nameOf(speciesInfo.id) }}</h4>
              <dl class="detail-rows">
                <dt>{{ t('origins.size') }}</dt>
                <dd>{{ t(`origins.sizes.${speciesInfo.size}`) }}</dd>
                <dt>{{ t('origins.speed') }}</dt>
                <dd>{{ meters(speciesInfo.speed) }}</dd>
                <dt>{{ t('origins.darkvision') }}</dt>
                <dd>
                  {{ speciesInfo.darkvision ? meters(speciesInfo.darkvision) : t('origins.none') }}
                </dd>
                <dt>{{ t('origins.traits') }}</dt>
                <dd>{{ t(`origins.species.${speciesInfo.id}.traits`) }}</dd>
              </dl>

              <section class="detail-block">
                <h5 class="field-label">{{ t('origins.applied') }}</h5>
                <ul>
                  <li>{{ t('origins.appliedSpeed', { n: meters(speciesInfo.speed) }) }}</li>
                </ul>
              </section>
            </template>

            <section v-if="effects.length" class="detail-block">
              <h5 class="field-label">{{ t('origins.computed') }}</h5>
              <ul>
                <li v-for="effect in effects" :key="effect.id" :class="{ later: !effect.reached }">
                  <strong>{{ t(`origins.effects.${effect.id}.name`) }}</strong>
                  <span class="effect-level">{{ t('origins.levelN', { n: effect.level }) }}</span>
                  <span class="effect-detail">{{ t(`origins.effects.${effect.id}.detail`) }}</span>
                </li>
              </ul>
            </section>
          </div>
        </div>

        <footer class="origin-actions">
          <button class="btn-secondary" type="button" @click="emit('close')">
            {{ t('common.cancel') }}
          </button>
          <button class="btn-primary" type="button" @click="confirm">
            {{ t('origins.choose') }}
          </button>
        </footer>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.origin-backdrop {
  position: fixed;
  inset: 0;
  z-index: 300;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
  background: rgb(0 0 0 / 55%);
}

.origin-dialog {
  display: flex;
  flex-direction: column;
  width: min(100%, 42rem);
  max-height: calc(100dvh - 2rem);
  min-width: 0;
  background: var(--color-bg-primary);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  box-shadow: 0 12px 40px rgb(0 0 0 / 35%);
  overflow: hidden;
}

.origin-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  padding: 0.75rem 0.85rem;
  border-bottom: 1px solid var(--color-border);
}

.origin-close {
  border: none;
  background: none;
  color: var(--color-text-secondary);
  font-size: 1rem;
  line-height: 1;
  padding: 0.25rem;
}

/* Deux colonnes, chacune défile seule */
.origin-body {
  display: grid;
  grid-template-columns: minmax(0, 0.8fr) minmax(0, 1.6fr);
  flex: 1 1 auto;
  min-height: 0;
}

.origin-list {
  list-style: none;
  margin: 0;
  padding: 0.4rem;
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  overflow-y: auto;
  overscroll-behavior: contain;
  border-right: 1px solid var(--color-border);
  background: var(--color-bg-secondary);
}

.origin-option {
  width: 100%;
  text-align: left;
  padding: 0.5rem 0.55rem;
  border: 1px solid transparent;
  border-radius: var(--radius-sm);
  background: none;
  color: var(--color-text-secondary);
  font-size: 0.85rem;
  font-weight: 600;
  overflow-wrap: anywhere;
}
.origin-option.current {
  color: var(--color-text-primary);
}
.origin-option.active {
  border-color: var(--color-accent);
  background: color-mix(in srgb, var(--color-accent) 22%, var(--color-bg-secondary));
  color: var(--color-text-primary);
}
.origin-option.custom {
  font-style: italic;
}

.origin-detail {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  padding: 0.75rem 0.85rem;
  overflow-y: auto;
  overscroll-behavior: contain;
  min-width: 0;
}

.detail-rows {
  display: grid;
  grid-template-columns: minmax(0, auto) minmax(0, 1fr);
  gap: 0.35rem 0.6rem;
  margin: 0;
  font-size: 0.82rem;
}
.detail-rows dt {
  color: var(--color-text-muted);
}
.detail-rows dd {
  margin: 0;
  color: var(--color-text-primary);
  font-weight: 600;
  overflow-wrap: anywhere;
}

.detail-block {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}
.detail-block h5 {
  margin: 0;
}
.detail-block ul {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  font-size: 0.82rem;
  color: var(--color-text-primary);
}
.detail-block li {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 0.15rem 0.4rem;
  min-width: 0;
}
/* Effet d'un niveau pas encore atteint */
.detail-block li.later {
  color: var(--color-text-muted);
}

.effect-level {
  font-size: 0.72rem;
  font-weight: 700;
  color: var(--color-text-muted);
}

.effect-detail {
  flex-basis: 100%;
  color: var(--color-text-secondary);
}
.detail-block li.later .effect-detail {
  color: var(--color-text-muted);
}

.field {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  min-width: 0;
}
.field input {
  background: var(--color-bg-input);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  padding: 0.5rem 0.6rem;
  color: var(--color-text-primary);
  font-size: 0.9rem;
  min-width: 0;
}

.origin-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
  padding: 0.65rem 0.85rem;
  border-top: 1px solid var(--color-border);
}
</style>
