<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useSpellsStore, concentrationSaveDc } from '@/stores/spells'
import { useCharacterStore } from '@/stores/character'
import { useCombatStore } from '@/stores/combat'
import ActionIconButton from '@/components/ActionIconButton.vue'
import InfoTip from '@/components/InfoTip.vue'
import LeadNote from '@/components/LeadNote.vue'
import { useToast } from '@/composables/useToast'

const { t } = useI18n()
const { show: showToast } = useToast()
const spells = useSpellsStore()
const character = useCharacterStore()
const combat = useCombatStore()

/** Repos long = nouvelle journée d'aventure : on repart aussi d'un historique d'attaques vide */
function onLongRest() {
  spells.longRest()
  combat.clearHistory()
}

/** Rompre la concentration : immédiat, annulable quelques secondes */
function breakConcentration() {
  const spell = spells.concentrationSpell
  if (!spell) return
  const roundsLeft = spells.concentrationRoundsLeft
  spells.breakConcentration()
  showToast(t('common.concentrationBroken', { name: spell.name }), () =>
    spells.restoreConcentration(spell.id, roundsLeft),
  )
}

function removeResource(id: string) {
  const index = spells.resources.findIndex((r) => r.id === id)
  const resource = spells.resources[index]
  if (!resource) return
  spells.removeResource(id)
  showToast(
    resource.label ? t('common.removedNamed', { name: resource.label }) : t('common.removed'),
    () => spells.restoreResource(resource, index),
  )
}

/** Repos court : pas encore géré → on le dit au tap plutôt qu'un bouton inerte */
function onShortRest() {
  showToast(t('spells.shortRestSoonLong'))
}

const showSlotEditor = ref(false)
const damageTaken = ref<number | null>(null)

const concentrationRuleLines = computed(() => [
  t('spells.concentrationRule1'),
  t('spells.concentrationRule2'),
  t('spells.concentrationRule3'),
  t('spells.concentrationRule4'),
])

const concentrationDc = computed(() => concentrationSaveDc(Number(damageTaken.value) || 0))
const conSaveBonus = computed(() => {
  const bonus = character.savingThrowBonus('con')
  return `${bonus >= 0 ? '+' : ''}${bonus}`
})

const hasAnySlotsConfigured = computed(() =>
  spells.SLOT_LEVELS.some((lvl) => (spells.slots[String(lvl)]?.max ?? 0) > 0),
)

const preparedCount = computed(() => spells.preparedSpells.length)
</script>

<template>
  <div class="spell-status">
    <div class="view-lead">
      <LeadNote id="spells-status" :text="t('spells.statusIntro')" />
      <div class="rest-actions">
        <button class="btn-long-rest" type="button" @click="onLongRest">
          <span class="zzz" aria-hidden="true">ZzZ</span>
          {{ t('spells.longRest') }}
        </button>
        <button
          class="btn-short-rest"
          type="button"
          aria-disabled="true"
          :title="t('spells.shortRestSoon')"
          @click="onShortRest"
        >
          <span class="zzz" aria-hidden="true">Z</span>
          {{ t('spells.shortRest') }}
        </button>
      </div>
    </div>

    <!-- Concentration -->
    <section class="panel concentration" :class="{ active: !!spells.concentrationSpell }">
      <div class="panel-head">
        <h3 class="section-title title-with-tip">
          {{ t('spells.concentration') }}
          <InfoTip :title="t('spells.concentrationRuleTitle')" :lines="concentrationRuleLines" />
        </h3>
      </div>
      <div v-if="spells.concentrationSpell" class="concentration-body">
        <div class="concentration-text">
          <strong>{{ spells.concentrationSpell.name }}</strong>
          <span class="meta">{{
            spells.concentrationSpell.level === 0
              ? t('spells.cantrip')
              : t('spells.levelN', { n: spells.concentrationSpell.level })
          }}</span>
        </div>
        <button class="btn-ghost danger" type="button" @click="breakConcentration">
          {{ t('spells.breakConcentration') }}
        </button>
      </div>
      <div v-if="spells.concentrationSpell" class="concentration-extra">
        <div v-if="spells.concentrationRoundsLeft != null" class="rounds-row">
          <span class="rounds-left">{{
            t('spells.roundsLeft', { n: spells.concentrationRoundsLeft })
          }}</span>
          <button class="btn-ghost" type="button" @click="spells.advanceConcentrationRound()">
            {{ t('spells.nextRound') }}
          </button>
        </div>
        <div class="conc-check">
          <label class="conc-damage">
            {{ t('spells.damageTaken') }}
            <input v-model.number="damageTaken" type="number" min="0" inputmode="numeric" />
          </label>
          <div class="conc-dc">
            <span class="conc-dc-value">{{ t('spells.dcN', { n: concentrationDc }) }}</span>
            <span class="meta">{{ t('spells.conSave', { bonus: conSaveBonus }) }}</span>
          </div>
        </div>
      </div>
      <p v-else class="hint">{{ t('spells.noConcentration') }}</p>
    </section>

    <!-- Emplacements -->
    <section class="panel">
      <div class="panel-head">
        <h3 class="section-title">{{ t('spells.slots') }}</h3>
        <button class="btn-add compact" type="button" @click="showSlotEditor = !showSlotEditor">
          {{ showSlotEditor ? t('common.done') : t('spells.editSlots') }}
        </button>
      </div>

      <div v-if="showSlotEditor" class="slot-editor">
        <p class="hint">{{ t('spells.slotsHint') }}</p>
        <div v-for="lvl in spells.SLOT_LEVELS" :key="`edit-${lvl}`" class="slot-edit-row">
          <span class="slot-lvl">{{ t('spells.levelN', { n: lvl }) }}</span>
          <label class="slot-max-label">
            {{ t('spells.max') }}
            <input
              type="number"
              min="0"
              max="20"
              :value="spells.slots[String(lvl)]?.max ?? 0"
              @change="
                spells.setSlotMax(lvl, Number(($event.target as HTMLInputElement).value) || 0)
              "
            />
          </label>
        </div>
      </div>

      <div v-else-if="!hasAnySlotsConfigured" class="hint">
        {{ t('spells.noSlotsConfigured') }}
      </div>

      <div v-else class="slots-row">
        <div v-for="lvl in spells.activeSlotLevels" :key="`slot-${lvl}`" class="slot-chip">
          <div class="slot-chip-top">
            <span class="slot-chip-lvl">{{ lvl }}</span>
            <span class="slot-chip-count"
              >{{ spells.remaining(lvl) }}/{{ spells.slots[String(lvl)]?.max ?? 0 }}</span
            >
          </div>
          <div class="slot-pips" aria-hidden="true">
            <span
              v-for="i in spells.slots[String(lvl)]?.max ?? 0"
              :key="i"
              class="pip"
              :class="{ used: i <= (spells.slots[String(lvl)]?.used ?? 0) }"
            />
          </div>
          <div class="slot-chip-actions">
            <button
              type="button"
              class="slot-btn hit-area"
              :disabled="spells.remaining(lvl) <= 0"
              :title="t('spells.useSlot')"
              @click="spells.useSlot(lvl)"
            >
              −
            </button>
            <button
              type="button"
              class="slot-btn hit-area"
              :disabled="(spells.slots[String(lvl)]?.used ?? 0) <= 0"
              :title="t('spells.recoverSlot')"
              @click="spells.recoverSlot(lvl)"
            >
              +
            </button>
          </div>
        </div>
      </div>
    </section>

    <!-- Ressources -->
    <section class="panel">
      <div class="panel-head">
        <h3 class="section-title">{{ t('spells.resources') }}</h3>
        <button
          class="btn-add compact"
          type="button"
          @click="spells.addResource(t('spells.resourceDefault'))"
        >
          {{ t('spells.addResource') }}
        </button>
      </div>
      <div v-if="!spells.resources.length" class="hint">{{ t('spells.resourcesHint') }}</div>
      <div v-else class="resources-list">
        <div v-for="res in spells.resources" :key="res.id" class="resource-row">
          <input
            class="resource-label"
            type="text"
            :value="res.label"
            :placeholder="t('spells.resourceName')"
            @change="
              spells.updateResource(res.id, {
                label: ($event.target as HTMLInputElement).value,
              })
            "
          />
          <div class="resource-counter">
            <button
              type="button"
              class="slot-btn hit-area"
              @click="spells.bumpResource(res.id, -1)"
            >
              −
            </button>
            <span class="resource-value">{{ res.current }}/{{ res.max }}</span>
            <button type="button" class="slot-btn hit-area" @click="spells.bumpResource(res.id, 1)">
              +
            </button>
          </div>
          <label class="resource-max">
            {{ t('spells.max') }}
            <input
              type="number"
              min="0"
              max="99"
              :value="res.max"
              @change="
                spells.updateResource(res.id, {
                  max: Number(($event.target as HTMLInputElement).value) || 0,
                })
              "
            />
          </label>
          <ActionIconButton
            kind="remove"
            compact
            :label="t('common.delete')"
            @click="removeResource(res.id)"
          />
        </div>
      </div>
    </section>

    <p v-if="preparedCount" class="hint footer-hint">
      {{ t('spells.preparedCount', { n: preparedCount }) }}
    </p>
  </div>
</template>

<style scoped>
.spell-status {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  padding-bottom: 1rem;
}

.view-lead {
  display: flex;
  align-items: center;
  gap: 0.65rem;
}

.rest-actions {
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.btn-long-rest,
.btn-short-rest {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.4rem;
  padding: 0.45rem 0.75rem;
  border-radius: var(--radius-sm);
  font-size: 0.78rem;
  font-weight: 700;
  white-space: nowrap;
}

.btn-long-rest {
  /* Teinte du thème (plus de bleu nuit fixe) : reste l'action mise en avant du panneau */
  background: color-mix(in srgb, var(--color-accent) 16%, var(--color-bg-secondary));
  border: 1px solid color-mix(in srgb, var(--color-accent) 50%, var(--color-border));
  color: var(--color-text-primary);
}

.btn-long-rest:active {
  filter: brightness(1.08);
}

.btn-long-rest .zzz {
  font-size: 0.7rem;
  font-weight: 800;
  letter-spacing: 0.02em;
  line-height: 1;
  color: var(--color-accent);
}

.btn-short-rest {
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border);
  color: var(--color-text-muted);
  opacity: 0.55;
}

.btn-short-rest .zzz {
  font-size: 0.75rem;
  font-weight: 800;
  line-height: 1;
  color: var(--color-text-muted);
}

.panel {
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  padding: 0.75rem 0.85rem;
}

.panel.concentration.active {
  border-color: color-mix(in srgb, var(--color-accent) 45%, var(--color-border));
  background: color-mix(in srgb, var(--color-accent) 10%, var(--color-bg-secondary));
}

.panel-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.55rem;
}

.title-with-tip {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
}

.concentration-body {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
}

.concentration-text {
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
  min-width: 0;
}

.concentration-extra {
  display: flex;
  flex-direction: column;
  gap: 0.55rem;
  margin-top: 0.65rem;
  padding-top: 0.65rem;
  border-top: 1px solid var(--color-border);
}

.rounds-row,
.conc-check {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
}

.rounds-left {
  font-size: 0.85rem;
  font-weight: 700;
}

.conc-damage {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  font-size: 0.78rem;
  font-weight: 700;
  color: var(--color-text-secondary);
}

.conc-damage input {
  width: 4.5rem;
  padding: 0.4rem 0.5rem;
  border-radius: var(--radius-sm);
  border: 1px solid var(--color-border);
  background: var(--color-bg-card);
  color: var(--color-text-primary);
  font: inherit;
}

.conc-dc {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 0.1rem;
}

.conc-dc-value {
  font-size: 1rem;
  font-weight: 800;
}

.conc-dc .meta,
.concentration-text .meta {
  font-size: 0.72rem;
  color: var(--color-text-muted);
}

.slots-row {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.slot-chip {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  min-width: 4.6rem;
  padding: 0.45rem 0.5rem;
  border-radius: var(--radius-sm);
  border: 1px solid var(--color-border);
  background: var(--color-bg-card);
}

.slot-chip-top {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 0.35rem;
}

.slot-chip-lvl {
  font-weight: 800;
  font-size: 1rem;
}

.slot-chip-count {
  font-size: 0.72rem;
  color: var(--color-text-muted);
}

.slot-pips {
  display: flex;
  flex-wrap: wrap;
  gap: 0.2rem;
}

.pip {
  width: 0.55rem;
  height: 0.55rem;
  border-radius: 50%;
  background: var(--color-accent);
}

.pip.used {
  background: var(--color-border);
  opacity: 0.7;
}

.slot-chip-actions,
.resource-counter {
  display: flex;
  align-items: center;
  gap: 0.25rem;
}

.slot-btn {
  width: 2rem;
  height: 2rem;
  border-radius: var(--radius-sm);
  border: 1px solid var(--color-border);
  background: var(--color-bg-secondary);
  color: var(--color-text-primary);
  font-weight: 800;
  line-height: 1;
}

.slot-btn:disabled {
  opacity: 0.35;
}

.slot-editor {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.slot-edit-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
}

.slot-lvl {
  font-size: 0.82rem;
  font-weight: 700;
}

.slot-max-label,
.resource-max {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  font-size: 0.72rem;
  color: var(--color-text-muted);
}

.slot-max-label input,
.resource-max input {
  width: 3.2rem;
  padding: 0.25rem 0.35rem;
  border-radius: var(--radius-sm);
  border: 1px solid var(--color-border);
  background: var(--color-bg-card);
  color: var(--color-text-primary);
}

.resources-list {
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
}

.resource-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.4rem;
  padding: 0.4rem 0.45rem;
  border-radius: var(--radius-sm);
  border: 1px solid var(--color-border);
  background: var(--color-bg-card);
}

.resource-label {
  flex: 1 1 7rem;
  min-width: 0;
  padding: 0.3rem 0.4rem;
  border-radius: var(--radius-sm);
  border: 1px solid var(--color-border);
  background: var(--color-bg-secondary);
  color: var(--color-text-primary);
  font-weight: 700;
  font-size: 0.85rem;
}

.resource-value {
  font-size: 0.85rem;
  font-weight: 800;
  min-width: 2.4rem;
  text-align: center;
}
</style>
