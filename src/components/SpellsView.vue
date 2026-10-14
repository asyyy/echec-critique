<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  useSpellsStore,
  createEmptySpell,
  concentrationSaveDc,
  type Spell,
  type SpellLevel,
} from '@/stores/spells'
import { DICE_FACES } from '@/utils/combatTypes'
import { searchCatalog, type CatalogSpell } from '@/utils/spellCatalog'
import { openExternalUrl } from '@/utils/openExternal'
import ActionIconButton from '@/components/ActionIconButton.vue'
import InfoTip from '@/components/InfoTip.vue'
import LeadNote from '@/components/LeadNote.vue'
import { useToast } from '@/composables/useToast'
import { useCharacterStore } from '@/stores/character'

const props = defineProps<{
  panel: 'mine' | 'catalog'
}>()

const { t } = useI18n()
const spells = useSpellsStore()
const { show: showToast } = useToast()

/** Suppression immédiate, annulable quelques secondes (concentration comprise) */
function removeSpell(id: string) {
  const index = spells.spells.findIndex((s) => s.id === id)
  const spell = spells.spells[index]
  if (!spell) return
  const wasConcentrating = spells.concentrationSpellId === id
  const roundsLeft = spells.concentrationRoundsLeft
  spells.removeSpell(id)
  showToast(
    spell.name ? t('common.removedNamed', { name: spell.name }) : t('common.removed'),
    () => {
      spells.restoreSpell(spell, index)
      if (wasConcentrating) spells.restoreConcentration(spell.id, roundsLeft)
    },
  )
}
const character = useCharacterStore()

const concentrationRuleLines = computed(() => [
  t('spells.concentrationRule1'),
  t('spells.concentrationRule2'),
  t('spells.concentrationRule3'),
  t('spells.concentrationRule4'),
])

const conSaveBonus = computed(() => {
  const bonus = character.savingThrowBonus('con')
  return `${bonus >= 0 ? '+' : ''}${bonus}`
})

const showForm = ref(false)
const editingId = ref<string | null>(null)
const expandedId = ref<string | null>(null)
const castError = ref('')
const catalogQuery = ref('')
const catalogLevel = ref('all')
const catalogFeedback = ref('')

const form = reactive(createEmptySpell())
const levels = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9] as const

const catalogLevelFilter = computed(() =>
  catalogLevel.value === 'all' ? 'all' : Number(catalogLevel.value),
)

const catalogResults = computed(() =>
  searchCatalog(catalogQuery.value, catalogLevelFilter.value).slice(0, 80),
)

const catalogTotal = computed(
  () => searchCatalog(catalogQuery.value, catalogLevelFilter.value).length,
)

watch(
  () => props.panel,
  (panel) => {
    if (panel === 'catalog') {
      showForm.value = false
    }
  },
)

function levelLabel(level: number) {
  return level === 0 ? t('spells.cantrip') : t('spells.levelN', { n: level })
}

function resetForm() {
  Object.assign(form, createEmptySpell({ prepared: true, consumesSlot: true, level: 1 }))
  editingId.value = null
}

function openCreate() {
  resetForm()
  showForm.value = true
  expandedId.value = null
}

function openEdit(spell: Spell) {
  editingId.value = spell.id
  Object.assign(form, { ...spell })
  showForm.value = true
  expandedId.value = null
}

function cancelForm() {
  showForm.value = false
  resetForm()
}

function saveForm() {
  const name = form.name.trim() || t('spells.unnamed')
  const level = Math.max(0, Math.min(9, Number(form.level))) as SpellLevel
  const payload: Partial<Spell> = {
    name,
    level,
    school: form.school.trim(),
    prepared: form.prepared,
    notes: form.notes,
    diceCount: form.diceCount,
    diceFaces: form.diceFaces,
    flatBonus: form.flatBonus,
    consumesSlot: level === 0 ? false : form.consumesSlot,
    referenceUrl: form.referenceUrl?.trim() || undefined,
    concentration: form.concentration,
    durationRounds: Math.max(0, Math.round(Number(form.durationRounds) || 0)),
  }
  if (editingId.value) {
    spells.updateSpell(editingId.value, payload)
  } else {
    spells.addSpell(payload)
  }
  showForm.value = false
  resetForm()
}

function toggleExpand(id: string) {
  expandedId.value = expandedId.value === id ? null : id
  castError.value = ''
}

function onCast(spell: Spell) {
  castError.value = ''
  const result = spells.castSpell(spell.id)
  if (!result) {
    castError.value = t('spells.noSlots')
  }
}

function durationLabel(spell: Spell) {
  return spell.durationRounds > 0 ? t('spells.roundsN', { n: spell.durationRounds }) : ''
}

function dicePreview(spell: Spell) {
  if (spell.diceCount <= 0 && !spell.flatBonus) return ''
  const dice = spell.diceCount > 0 ? `${spell.diceCount}d${spell.diceFaces}` : ''
  const flat = spell.flatBonus !== 0 ? `${spell.flatBonus > 0 ? '+' : ''}${spell.flatBonus}` : ''
  return [dice, flat].filter(Boolean).join(' ')
}

async function openRef(url: string) {
  try {
    await openExternalUrl(url)
  } catch {
    catalogFeedback.value = t('spells.openLinkError')
  }
}

function addFromCatalog(entry: CatalogSpell) {
  const already = spells.spells.some(
    (s) => s.name.toLowerCase() === entry.name.toLowerCase() && s.level === entry.level,
  )
  if (already) {
    catalogFeedback.value = t('spells.alreadyInList', { name: entry.name })
    return
  }
  spells.addSpell({
    name: entry.name,
    level: entry.level as SpellLevel,
    school: entry.school,
    prepared: true,
    notes: '',
    consumesSlot: entry.level > 0,
    referenceUrl: entry.url,
  })
  catalogFeedback.value = t('spells.addedFromCatalog', { name: entry.name })
}
</script>

<template>
  <div class="spells">
    <!-- Catalogue AideDD (noms + liens uniquement) -->
    <template v-if="panel === 'catalog'">
      <LeadNote id="spells-catalog" :text="t('spells.catalogIntro')" />

      <div class="catalog-filters">
        <input
          v-model="catalogQuery"
          type="search"
          class="catalog-search"
          :placeholder="t('spells.catalogSearch')"
        />
        <select v-model="catalogLevel" class="catalog-level">
          <option value="all">{{ t('spells.catalogAllLevels') }}</option>
          <option v-for="lvl in levels" :key="lvl" :value="lvl">{{ levelLabel(lvl) }}</option>
        </select>
      </div>

      <p class="catalog-count">
        {{ t('spells.catalogCount', { shown: catalogResults.length, total: catalogTotal }) }}
      </p>
      <p v-if="catalogFeedback" class="catalog-feedback">{{ catalogFeedback }}</p>

      <div class="catalog-list">
        <div v-for="entry in catalogResults" :key="entry.id" class="catalog-row">
          <div class="catalog-info">
            <span class="spell-level-badge">{{ entry.level === 0 ? '0' : entry.level }}</span>
            <div class="spell-info">
              <span class="spell-name">{{ entry.name }}</span>
              <span class="spell-meta">{{ entry.school }} · {{ entry.nameEn }}</span>
            </div>
          </div>
          <div class="catalog-actions">
            <button class="btn-secondary" type="button" @click="openRef(entry.url)">
              {{ t('spells.viewDetail') }}
            </button>
            <button class="btn-add" type="button" @click="addFromCatalog(entry)">
              {{ t('spells.addToMine') }}
            </button>
          </div>
        </div>
      </div>
    </template>

    <!-- Mes sorts -->
    <template v-else>
      <div class="view-lead">
        <LeadNote id="spells-mine" :text="t('spells.combatIntro')" />
        <button class="btn-add" type="button" @click="showForm ? cancelForm() : openCreate()">
          {{ showForm ? '✕' : t('spells.addSpell') }}
        </button>
      </div>

      <div v-if="showForm" class="config-form">
        <h3 class="form-title">{{ editingId ? t('spells.editSpell') : t('spells.newSpell') }}</h3>

        <div class="form-group">
          <label>{{ t('spells.name') }}</label>
          <input v-model="form.name" type="text" :placeholder="t('spells.namePlaceholder')" />
        </div>

        <div class="form-row">
          <div class="form-group">
            <label>{{ t('spells.level') }}</label>
            <select v-model.number="form.level">
              <option v-for="lvl in levels" :key="lvl" :value="lvl">{{ levelLabel(lvl) }}</option>
            </select>
          </div>
          <div class="form-group">
            <label>{{ t('spells.school') }}</label>
            <input v-model="form.school" type="text" :placeholder="t('spells.schoolPlaceholder')" />
          </div>
        </div>

        <label class="check-row">
          <input v-model="form.prepared" type="checkbox" />
          {{ t('spells.prepared') }}
        </label>

        <label v-if="form.level > 0" class="check-row">
          <input v-model="form.consumesSlot" type="checkbox" />
          {{ t('spells.consumesSlot') }}
        </label>

        <div class="section-label">
          {{ t('spells.concentration') }} & {{ t('spells.duration') }}
        </div>
        <label class="check-row">
          <input v-model="form.concentration" type="checkbox" />
          {{ t('spells.requiresConcentration') }}
          <InfoTip :title="t('spells.concentrationRuleTitle')" :lines="concentrationRuleLines" />
        </label>
        <p v-if="form.concentration" class="hint">
          {{
            t('spells.concentrationDcHint', {
              dc: concentrationSaveDc(0),
              bonus: conSaveBonus,
            })
          }}
        </p>
        <div class="form-group">
          <label>{{ t('spells.durationRounds') }}</label>
          <input v-model.number="form.durationRounds" type="number" min="0" max="9999" />
          <p class="hint">{{ t('spells.durationRoundsHint') }}</p>
        </div>

        <div class="form-group">
          <label>{{ t('spells.notes') }}</label>
          <textarea v-model="form.notes" rows="3" :placeholder="t('spells.notesPlaceholder')" />
        </div>

        <div class="section-label">{{ t('spells.quickRoll') }}</div>
        <p class="hint">{{ t('spells.quickRollHint') }}</p>
        <div class="form-row three">
          <div class="form-group">
            <label>{{ t('combat.diceCount') }}</label>
            <input v-model.number="form.diceCount" type="number" min="0" max="40" />
          </div>
          <div class="form-group">
            <label>{{ t('combat.die') }}</label>
            <select v-model.number="form.diceFaces">
              <option v-for="f in DICE_FACES" :key="f" :value="f">d{{ f }}</option>
            </select>
          </div>
          <div class="form-group">
            <label>{{ t('combat.flatBonus') }}</label>
            <input v-model.number="form.flatBonus" type="number" />
          </div>
        </div>

        <div class="form-actions">
          <button class="btn-secondary" type="button" @click="cancelForm">
            {{ t('common.cancel') }}
          </button>
          <button class="btn-primary" type="button" @click="saveForm">
            {{ t('common.save') }}
          </button>
        </div>
      </div>

      <div v-if="spells.lastRoll && !showForm" class="roll-result">
        <div class="roll-title">{{ spells.lastRoll.spellName }}</div>
        <div class="roll-total">{{ spells.lastRoll.total }}</div>
        <div class="roll-detail">
          <template v-if="spells.lastRoll.dice.length">
            {{ spells.lastRoll.dice.length }}d{{ spells.lastRoll.faces }} [{{
              spells.lastRoll.dice.join(', ')
            }}]
          </template>
          <template v-if="spells.lastRoll.flatBonus">
            {{ spells.lastRoll.flatBonus >= 0 ? '+' : '' }}{{ spells.lastRoll.flatBonus }}
          </template>
          <template v-if="spells.lastRoll.slotUsed"> · {{ t('spells.slotConsumed') }}</template>
        </div>
      </div>
      <p v-if="castError" class="cast-error">{{ castError }}</p>

      <div v-if="!showForm && !spells.spells.length" class="empty-state">
        <p>{{ t('spells.emptyTitle') }}</p>
        <p class="hint">{{ t('spells.emptyHint') }}</p>
      </div>

      <section v-if="!showForm && spells.preparedSpells.length" class="spell-section">
        <h3 class="section-title">{{ t('spells.preparedList') }}</h3>
        <div
          v-for="spell in spells.preparedSpells"
          :key="spell.id"
          class="spell-card"
          :class="{ open: expandedId === spell.id }"
        >
          <button class="spell-main" type="button" @click="toggleExpand(spell.id)">
            <span class="spell-level-badge">{{ spell.level === 0 ? '0' : spell.level }}</span>
            <span class="spell-info">
              <span class="spell-name">{{ spell.name }}</span>
              <span class="spell-meta">
                <template v-if="spell.school">{{ spell.school }}</template>
                <template v-if="dicePreview(spell)">
                  <template v-if="spell.school"> · </template>{{ dicePreview(spell) }}
                </template>
                <template v-if="spell.concentration || durationLabel(spell)">
                  <template v-if="spell.school || dicePreview(spell)"> · </template>
                  <template v-if="spell.concentration">{{
                    t('spells.concentrationShort')
                  }}</template>
                  <template v-if="spell.concentration && durationLabel(spell)">, </template>
                  {{ durationLabel(spell) }}
                </template>
              </span>
            </span>
            <span
              v-if="spells.concentrationSpellId === spell.id"
              class="conc-dot"
              :title="t('spells.concentration')"
              >◎</span
            >
          </button>

          <div v-if="expandedId === spell.id" class="spell-detail">
            <p v-if="spell.notes" class="spell-notes">{{ spell.notes }}</p>
            <p v-else class="hint">{{ t('spells.noNotes') }}</p>
            <div class="spell-actions">
              <button class="btn-primary" type="button" @click="onCast(spell)">
                {{ t('spells.cast') }}
              </button>
              <button
                v-if="spell.referenceUrl"
                class="btn-secondary"
                type="button"
                @click="openRef(spell.referenceUrl)"
              >
                {{ t('spells.viewDetail') }}
              </button>
              <button
                class="btn-secondary"
                type="button"
                @click="
                  spells.concentrationSpellId === spell.id
                    ? spells.breakConcentration()
                    : spells.setConcentration(spell.id)
                "
              >
                {{
                  spells.concentrationSpellId === spell.id
                    ? t('spells.breakConcentration')
                    : t('spells.concentrate')
                }}
              </button>
              <ActionIconButton kind="edit" :label="t('common.edit')" @click="openEdit(spell)" />
              <ActionIconButton
                kind="remove"
                :label="t('common.delete')"
                @click="removeSpell(spell.id)"
              />
            </div>
          </div>
        </div>
      </section>

      <section v-if="!showForm && spells.otherSpells.length" class="spell-section">
        <h3 class="section-title">{{ t('spells.knownList') }}</h3>
        <div
          v-for="spell in spells.otherSpells"
          :key="spell.id"
          class="spell-card muted"
          :class="{ open: expandedId === spell.id }"
        >
          <button class="spell-main" type="button" @click="toggleExpand(spell.id)">
            <span class="spell-level-badge">{{ spell.level === 0 ? '0' : spell.level }}</span>
            <span class="spell-info">
              <span class="spell-name">{{ spell.name }}</span>
              <span class="spell-meta">
                <template v-if="spell.school">{{ spell.school }}</template>
                <template v-if="dicePreview(spell)">
                  <template v-if="spell.school"> · </template>{{ dicePreview(spell) }}
                </template>
                <template v-if="spell.concentration || durationLabel(spell)">
                  <template v-if="spell.school || dicePreview(spell)"> · </template>
                  <template v-if="spell.concentration">{{
                    t('spells.concentrationShort')
                  }}</template>
                  <template v-if="spell.concentration && durationLabel(spell)">, </template>
                  {{ durationLabel(spell) }}
                </template>
              </span>
            </span>
          </button>
          <div v-if="expandedId === spell.id" class="spell-detail">
            <p v-if="spell.notes" class="spell-notes">{{ spell.notes }}</p>
            <div class="spell-actions">
              <button class="btn-primary" type="button" @click="onCast(spell)">
                {{ t('spells.cast') }}
              </button>
              <button
                v-if="spell.referenceUrl"
                class="btn-secondary"
                type="button"
                @click="openRef(spell.referenceUrl)"
              >
                {{ t('spells.viewDetail') }}
              </button>
              <button
                class="btn-secondary"
                type="button"
                @click="spells.updateSpell(spell.id, { prepared: true })"
              >
                {{ t('spells.markPrepared') }}
              </button>
              <ActionIconButton kind="edit" :label="t('common.edit')" @click="openEdit(spell)" />
              <ActionIconButton
                kind="remove"
                :label="t('common.delete')"
                @click="removeSpell(spell.id)"
              />
            </div>
          </div>
        </div>
      </section>
    </template>
  </div>
</template>

<style scoped>
.spells {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  padding-bottom: 1rem;
}

.view-lead {
  display: flex;
  /* Haut du conseil et du bouton alignés, même quand le conseil fait plusieurs lignes */
  align-items: flex-start;
  gap: 0.65rem;
}

.view-lead .btn-add {
  flex-shrink: 0;
}

.catalog-filters {
  display: flex;
  gap: 0.45rem;
}

.catalog-search {
  flex: 1;
  min-width: 0;
  padding: 0.5rem 0.65rem;
  border-radius: var(--radius-sm);
  border: 1px solid var(--color-border);
  background: var(--color-bg-card);
  color: var(--color-text-primary);
  font: inherit;
}

.catalog-level {
  max-width: 8.5rem;
  padding: 0.5rem 0.45rem;
  border-radius: var(--radius-sm);
  border: 1px solid var(--color-border);
  background: var(--color-bg-card);
  color: var(--color-text-primary);
  font: inherit;
}

.catalog-count,
.catalog-feedback {
  margin: 0;
  font-size: 0.75rem;
  color: var(--color-text-muted);
}

.catalog-feedback {
  color: var(--color-accent);
  font-weight: 600;
}

.catalog-list {
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
}

.catalog-row {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding: 0.65rem 0.75rem;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-bg-secondary);
}

.catalog-info {
  display: flex;
  align-items: center;
  gap: 0.65rem;
}

.catalog-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
}

.config-form {
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  padding: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.7rem;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.form-group input,
.form-group select,
.form-group textarea {
  padding: 0.45rem 0.55rem;
  border-radius: var(--radius-sm);
  border: 1px solid var(--color-border);
  background: var(--color-bg-card);
  color: var(--color-text-primary);
  font: inherit;
}

.form-row {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.55rem;
}

.form-row.three {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.check-row {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  font-size: 0.85rem;
  font-weight: 600;
}

.roll-result {
  text-align: center;
  padding: 0.85rem;
  border-radius: var(--radius-md);
  border: 1px solid var(--color-border);
  background: var(--color-bg-secondary);
}

.roll-title {
  font-weight: 700;
  font-size: 0.9rem;
}

.roll-total {
  font-size: 2rem;
  font-weight: 800;
  color: var(--color-accent);
  line-height: 1.1;
  margin: 0.2rem 0;
}

.roll-detail,
.cast-error {
  font-size: 0.78rem;
  color: var(--color-text-muted);
}

.cast-error {
  color: var(--color-danger);
  margin: 0;
}

.spell-section {
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
}

.spell-card {
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-bg-secondary);
  overflow: hidden;
}

.spell-card.muted {
  opacity: 0.85;
}

.spell-main {
  display: flex;
  align-items: center;
  gap: 0.65rem;
  width: 100%;
  padding: 0.65rem 0.75rem;
  text-align: left;
  background: transparent;
  color: var(--color-text-primary);
  border: none;
}

.spell-level-badge {
  flex-shrink: 0;
  width: 1.75rem;
  height: 1.75rem;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.75rem;
  font-weight: 800;
  background: color-mix(in srgb, var(--color-accent) 18%, var(--color-bg-card));
  color: var(--color-accent);
}

.spell-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
}

.spell-name {
  font-weight: 800;
  font-size: 0.92rem;
}

.spell-meta {
  font-size: 0.72rem;
  color: var(--color-text-muted);
}

.conc-dot {
  color: var(--color-accent);
  font-size: 1rem;
}

.spell-detail {
  padding: 0.65rem 0.75rem 0.75rem;
  display: flex;
  flex-direction: column;
  gap: 0.55rem;
  border-top: 1px solid var(--color-border);
}

.spell-notes {
  margin: 0;
  font-size: 0.82rem;
  line-height: 1.4;
  white-space: pre-wrap;
  color: var(--color-text-secondary);
}

.spell-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
  align-items: center;
}
</style>
