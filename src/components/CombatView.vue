<script setup lang="ts">
import { computed, nextTick, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useCombatStore } from '@/stores/combat'
import { useInventoryStore } from '@/stores/inventory'
import { ABILITIES } from '@/utils/dnd'
import {
  DAMAGE_TYPES,
  DICE_FACES,
  createEmptyAttackConfig,
  createEmptyDamagePart,
  weaponDamageToParts,
  type AttackConfig,
  type DamagePart,
} from '@/utils/combatTypes'
import ActionIconButton from '@/components/ActionIconButton.vue'
import LeadNote from '@/components/LeadNote.vue'
import { useToast } from '@/composables/useToast'

const { t, locale } = useI18n()
const combat = useCombatStore()
const { show: showToast } = useToast()

/** Suppression immédiate, annulable quelques secondes */
function removeConfig(id: string) {
  const index = combat.configs.findIndex((c) => c.id === id)
  const config = combat.configs[index]
  if (!config) return
  combat.removeConfig(id)
  showToast(
    config.name ? t('common.removedNamed', { name: config.name }) : t('common.removed'),
    () => combat.restoreConfig(config, index),
  )
}
const inventory = useInventoryStore()

const showForm = ref(false)
const editingId = ref<string | null>(null)
const animating = ref(false)

const form = reactive(createEmptyAttackConfig())

const previewBonus = computed(() => combat.resolveAttackBonus(form as AttackConfig))
const previewFormula = computed(() => {
  void locale.value
  return combat.damageFormulaPreview({ ...form, id: editingId.value ?? 'draft' } as AttackConfig)
})

const linkedWeapon = computed(() =>
  form.weaponItemId ? inventory.getItem(form.weaponItemId) : undefined,
)

function applyWeaponToForm(weaponId: string | null) {
  const previousName = linkedWeapon.value?.name
  form.weaponItemId = weaponId
  if (!weaponId) return
  const weapon = inventory.getItem(weaponId)
  if (!weapon) return
  form.damageParts = weaponDamageToParts(weapon.weaponDamage ?? [], weapon.name)
  if (
    !form.name.trim() ||
    form.name === t('combat.defaultConfigName') ||
    (previousName && form.name === previousName)
  ) {
    form.name = weapon.name
  }
}

function weaponOptionLabel(weapon: {
  name: string
  weaponDamage?: { diceCount: number; diceFaces: number; damageType: string }[]
}) {
  if (!weapon.weaponDamage?.length) return weapon.name
  const parts = weapon.weaponDamage
    .map((p) => `${p.diceCount}d${p.diceFaces} ${t(`damageTypes.${p.damageType}`)}`)
    .join(' + ')
  return `${weapon.name} — ${parts}`
}

function onWeaponChange(event: Event) {
  const value = (event.target as HTMLSelectElement).value
  applyWeaponToForm(value || null)
}

function resetForm() {
  Object.assign(form, createEmptyAttackConfig())
  form.name = t('combat.defaultConfigName')
  form.weaponItemId = null
  form.damageParts = [
    createEmptyDamagePart({ label: t('combat.defaultWeaponLabel'), includeAbilityMod: true }),
  ]
  editingId.value = null
}

function openCreate() {
  resetForm()
  showForm.value = true
}

function openEdit(cfg: AttackConfig) {
  editingId.value = cfg.id
  Object.assign(form, {
    ...cfg,
    weaponItemId: cfg.weaponItemId ?? null,
    damageParts: cfg.damageParts.map((p) => ({ ...p })),
  })
  showForm.value = true
}

function addDamagePart() {
  form.damageParts.push(
    createEmptyDamagePart({
      label: t('combat.defaultExtraLabel'),
      diceCount: 1,
      diceFaces: 6,
      damageType: 'froid',
      includeAbilityMod: false,
    }),
  )
}

function removeDamagePart(index: number) {
  if (form.damageParts.length <= 1) return
  form.damageParts.splice(index, 1)
}

function saveConfig() {
  if (!form.name.trim()) return
  if (form.damageParts.length === 0) return

  const payload: AttackConfig = {
    id: editingId.value ?? createEmptyAttackConfig().id,
    name: form.name.trim(),
    ability: form.ability,
    proficient: form.proficient,
    attackCount: Math.max(1, Math.min(10, Number(form.attackCount) || 1)),
    attackBonusExtra: Number(form.attackBonusExtra) || 0,
    useEquipmentAttackBonus: form.useEquipmentAttackBonus,
    useEquipmentDamageBonus: form.useEquipmentDamageBonus,
    weaponItemId: form.weaponItemId || null,
    damageParts: form.damageParts.map((p: DamagePart) => ({
      ...p,
      label: p.label.trim() || t(`damageTypes.${p.damageType}`),
      diceCount: Math.max(0, Number(p.diceCount) || 0),
      diceFaces: Number(p.diceFaces) || 6,
      flatBonus: Number(p.flatBonus) || 0,
    })),
  }

  if (editingId.value) {
    combat.updateConfig(editingId.value, payload)
  } else {
    combat.addConfig(payload)
  }

  showForm.value = false
  resetForm()
}

function cancelForm() {
  showForm.value = false
  resetForm()
}

function roll(configId: string) {
  combat.rollConfig(configId)
  animating.value = true
  setTimeout(() => {
    animating.value = false
  }, 500)
}

async function chooseOutcome(attackIndex: number, outcome: 'hit' | 'crit' | 'miss') {
  const result = combat.lastResult
  if (!result) return
  combat.setAttackOutcome(result.id, attackIndex, outcome)
  await nextTick()
  // Enchaîne sur l'attaque suivante pour éviter de scroller à la main
  const next = document.querySelector<HTMLElement>(
    `.attack-block[data-attack-index="${attackIndex + 1}"]`,
  )
  next?.scrollIntoView({ behavior: 'smooth', block: 'center' })
}

function formatPartDice(part: { dice: { count: number; faces: number; result: number[] } | null }) {
  if (!part.dice) return '—'
  return `${part.dice.count}d${part.dice.faces} [${part.dice.result.join(', ')}]`
}

function attackCountLabel(count: number) {
  return count === 1 ? t('combat.attack_one', { n: count }) : t('combat.attack_other', { n: count })
}
</script>

<template>
  <div class="combat">
    <div class="view-lead">
      <LeadNote id="combat" :text="t('combat.intro')" />
      <button class="btn-add" type="button" @click="openCreate">
        {{ showForm ? '✕' : t('combat.addConfig') }}
      </button>
    </div>

    <!-- Formulaire création / édition -->
    <Transition name="slide">
      <div v-if="showForm" id="search-combat-config" class="config-form search-target">
        <h3 class="form-title">{{ editingId ? t('combat.editConfig') : t('combat.newConfig') }}</h3>

        <div class="form-group">
          <label>{{ t('combat.name') }}</label>
          <input v-model="form.name" type="text" :placeholder="t('combat.namePlaceholder')" />
        </div>

        <div class="form-group">
          <label>{{ t('combat.weapon') }}</label>
          <select :value="form.weaponItemId ?? ''" @change="onWeaponChange">
            <option value="">{{ t('combat.weaponNone') }}</option>
            <option v-for="w in inventory.weapons" :key="w.id" :value="w.id">
              {{ weaponOptionLabel(w) }}
            </option>
          </select>
          <p v-if="form.weaponItemId" class="hint weapon-link-hint">
            {{ t('combat.weaponHint') }}
          </p>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label>{{ t('combat.ability') }}</label>
            <select v-model="form.ability">
              <option v-for="ab in ABILITIES" :key="ab" :value="ab">
                {{ t(`abilityShort.${ab}`) }} — {{ t(`abilities.${ab}`) }}
              </option>
            </select>
          </div>
          <div class="form-group">
            <label>{{ t('combat.attackCount') }}</label>
            <input v-model.number="form.attackCount" type="number" min="1" max="10" />
          </div>
        </div>

        <div class="checks">
          <label class="check">
            <input v-model="form.proficient" type="checkbox" />
            {{ t('combat.weaponProficiency') }}
          </label>
          <label class="check">
            <input v-model="form.useEquipmentAttackBonus" type="checkbox" />
            {{ t('combat.useEquipAttack') }}
          </label>
          <label class="check">
            <input v-model="form.useEquipmentDamageBonus" type="checkbox" />
            {{ t('combat.useEquipDamage') }}
          </label>
        </div>

        <div class="form-group">
          <label>{{ t('combat.extraAttackBonus') }}</label>
          <input v-model.number="form.attackBonusExtra" type="number" />
        </div>

        <div class="preview-box">
          <div class="preview-line">
            {{ t('combat.toHit') }}
            <strong>{{ combat.formatModifier(previewBonus.total) }}</strong>
            <span class="muted">
              ({{ t(`abilityShort.${form.ability}`) }}
              {{ combat.formatModifier(previewBonus.abilityMod) }}
              <template v-if="previewBonus.proficiency"
                >+ {{ t('combat.proficiency') }}
                {{ combat.formatModifier(previewBonus.proficiency) }}</template
              >
              <template v-if="previewBonus.equipment"
                >+ {{ t('combat.equipment') }}
                {{ combat.formatModifier(previewBonus.equipment) }}</template
              >
              <template v-if="previewBonus.conditions"
                >+ {{ t('combat.conditions') }}
                {{ combat.formatModifier(previewBonus.conditions) }}</template
              >
              <template v-if="previewBonus.extra"
                >+ {{ t('combat.extra') }} {{ combat.formatModifier(previewBonus.extra) }}</template
              >)
            </span>
          </div>
          <div class="preview-line muted">{{ previewFormula }}</div>
        </div>

        <div class="parts-header">
          <span class="section-label">{{ t('combat.damageParts') }}</span>
          <button class="btn-add compact" type="button" @click="addDamagePart">
            {{ t('combat.addType') }}
          </button>
        </div>
        <p class="hint">
          {{ t('combat.damageHint') }}
        </p>

        <div v-for="(part, index) in form.damageParts" :key="part.id" class="damage-part">
          <div class="form-row">
            <div class="form-group grow">
              <label>{{ t('combat.label') }}</label>
              <input v-model="part.label" type="text" :placeholder="t('combat.labelPlaceholder')" />
            </div>
            <ActionIconButton
              v-if="form.damageParts.length > 1"
              kind="remove"
              compact
              :label="t('common.delete')"
              class="damage-part-remove"
              @click="removeDamagePart(index)"
            />
          </div>

          <div class="form-row">
            <div class="form-group">
              <label>{{ t('combat.diceCount') }}</label>
              <input v-model.number="part.diceCount" type="number" min="0" max="20" />
            </div>
            <div class="form-group">
              <label>{{ t('combat.die') }}</label>
              <div class="dice-selector">
                <button
                  v-for="d in DICE_FACES"
                  :key="d"
                  type="button"
                  class="dice-btn"
                  :class="{ active: part.diceFaces === d }"
                  @click="part.diceFaces = d"
                >
                  d{{ d }}
                </button>
              </div>
            </div>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label>{{ t('combat.flatBonus') }}</label>
              <input v-model.number="part.flatBonus" type="number" />
            </div>
            <div class="form-group grow">
              <label>{{ t('combat.type') }}</label>
              <select v-model="part.damageType">
                <option v-for="dtype in DAMAGE_TYPES" :key="dtype" :value="dtype">
                  {{ t(`damageTypes.${dtype}`) }}
                </option>
              </select>
            </div>
          </div>

          <label class="check">
            <input v-model="part.includeAbilityMod" type="checkbox" />
            {{ t('combat.includeAbilityMod') }}
          </label>
        </div>

        <div class="form-actions">
          <button class="btn-secondary" type="button" @click="cancelForm">
            {{ t('common.cancel') }}
          </button>
          <button
            class="btn-primary"
            type="button"
            :disabled="!form.name.trim()"
            @click="saveConfig"
          >
            {{ t('common.save') }}
          </button>
        </div>
      </div>
    </Transition>

    <!-- Liste des configs -->
    <div v-if="!showForm && combat.configs.length === 0" class="empty-state">
      <p>{{ t('combat.emptyTitle') }}</p>
      <p class="hint">{{ t('combat.emptyHint') }}</p>
    </div>

    <div v-if="!showForm" id="search-combat-attack" class="config-list search-target">
      <button
        v-for="cfg in combat.configs"
        :key="cfg.id"
        type="button"
        class="config-card"
        :class="{ animating }"
        @click="roll(cfg.id)"
      >
        <div class="config-card-main">
          <div class="config-name">{{ cfg.name }}</div>
          <div class="config-tohit">
            <span class="tohit-label">{{ t('combat.playerToHit') }}</span>
            <span class="tohit-bonus">{{
              combat.formatModifier(combat.resolveAttackBonus(cfg).total)
            }}</span>
            <span v-if="cfg.attackCount > 1" class="tohit-count">×{{ cfg.attackCount }}</span>
          </div>
          <div class="config-meta">
            {{ attackCountLabel(cfg.attackCount) }} · {{ t(`abilityShort.${cfg.ability}`) }}
            <template v-if="cfg.weaponItemId && inventory.getItem(cfg.weaponItemId)">
              · {{ inventory.getItem(cfg.weaponItemId)!.name }}
            </template>
          </div>
          <div class="config-formula">{{ combat.damageFormulaPreview(cfg) }}</div>
        </div>
        <div class="config-card-actions" @click.stop>
          <ActionIconButton kind="edit" :label="t('common.edit')" @click="openEdit(cfg)" />
          <ActionIconButton
            kind="remove"
            :label="t('common.delete')"
            @click="removeConfig(cfg.id)"
          />
        </div>
      </button>
    </div>

    <!-- Résultat -->
    <Transition name="result">
      <div
        v-if="combat.lastResult && !showForm"
        class="result-panel"
        :class="{ crit: combat.lastResult.crits > 0, miss: combat.lastResult.misses > 0 }"
      >
        <div class="result-tohit">
          <span class="result-tohit-hint">{{ t('combat.playerToHitHint') }}</span>
          <strong class="result-tohit-bonus"
            >d20 {{ combat.formatModifier(combat.lastResult.attackBonus) }}</strong
          >
          <span v-if="combat.lastResult.attackCount > 1" class="result-tohit-count">
            ×{{ combat.lastResult.attackCount }}
          </span>
        </div>

        <div class="result-top">
          <div>
            <div class="result-title">{{ combat.lastResult.configName }}</div>
            <div class="result-sub">
              {{ t('combat.damageRolled') }}
              <template v-if="combat.lastResult.crits">
                · {{ t('combat.crits', { n: combat.lastResult.crits }) }}</template
              >
              <template v-if="combat.lastResult.misses">
                · {{ t('combat.misses', { n: combat.lastResult.misses }) }}</template
              >
            </div>
          </div>
          <div class="result-grand">
            <span class="grand-number">{{ combat.lastResult.grandTotal }}</span>
            <span class="grand-label">{{ t('combat.damage') }}</span>
          </div>
        </div>

        <div v-if="combat.lastResult.byType.length" class="by-type">
          <div v-for="entry in combat.lastResult.byType" :key="entry.type" class="type-chip">
            <span class="type-total">{{ entry.total }}</span>
            <span class="type-name">{{ t(`damageTypes.${entry.type}`) }}</span>
          </div>
        </div>

        <div class="attack-details">
          <div
            v-for="atk in combat.lastResult.attacks"
            :key="atk.index"
            class="attack-block"
            :class="{
              critical: atk.isCriticalHit,
              fumble: !atk.hit,
              hit: atk.outcomeChosen && atk.hit && !atk.isCriticalHit,
            }"
            :data-attack-index="atk.index"
          >
            <div class="attack-block-header">
              <span>{{ t('combat.attackN', { n: atk.index }) }}</span>
              <span v-if="atk.isCriticalHit" class="badge crit">{{ t('combat.critical') }}</span>
              <span v-else-if="!atk.hit" class="badge fumble">{{ t('combat.outcomeMiss') }}</span>
            </div>

            <div class="outcome-row">
              <button
                type="button"
                class="outcome-btn"
                :class="{ active: atk.hit && !atk.isCriticalHit }"
                @click="chooseOutcome(atk.index, 'hit')"
              >
                {{ t('combat.outcomeHit') }}
              </button>
              <button
                type="button"
                class="outcome-btn"
                :class="{ active: atk.isCriticalHit }"
                @click="chooseOutcome(atk.index, 'crit')"
              >
                {{ t('combat.outcomeCrit') }}
              </button>
              <button
                type="button"
                class="outcome-btn"
                :class="{ active: !atk.hit }"
                @click="chooseOutcome(atk.index, 'miss')"
              >
                {{ t('combat.outcomeMiss') }}
              </button>
            </div>

            <div v-if="!atk.hit" class="no-damage">{{ t('combat.noDamage') }}</div>
            <div v-else class="part-lines">
              <div v-for="part in atk.parts" :key="part.partId" class="part-line">
                <span class="part-subtotal">{{ part.subtotal }}</span>
                <span class="part-desc">
                  {{ part.label }} · {{ t(`damageTypes.${part.damageType}`) }}
                  <span class="muted">
                    {{ formatPartDice(part) }}
                    <template v-if="part.abilityMod">
                      {{ combat.formatModifier(part.abilityMod) }} {{ t('combat.abilityMod') }}
                    </template>
                    <template v-if="part.flatBonus">
                      {{ combat.formatModifier(part.flatBonus) }} {{ t('combat.flatBonus') }}
                    </template>
                    <template v-if="part.wasCritical"> · {{ t('combat.diceDoubled') }}</template>
                  </span>
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Transition>

    <!-- Historique -->
    <div
      v-if="combat.history.length > 1 && !showForm"
      id="search-combat-history"
      class="history search-target"
    >
      <div class="history-header">
        <span>{{ t('combat.history') }}</span>
        <ActionIconButton
          kind="remove"
          compact
          :label="t('common.clear')"
          @click="combat.clearHistory()"
        />
      </div>
      <button
        v-for="entry in combat.history.slice(1)"
        :key="entry.id"
        type="button"
        class="history-entry"
        @click="combat.showResult(entry)"
      >
        <span class="hist-name">{{ entry.configName }}</span>
        <span class="hist-damage">{{ entry.grandTotal }} dmg</span>
        <span v-if="entry.crits" class="hist-crit">CRIT×{{ entry.crits }}</span>
      </button>
    </div>
  </div>
</template>

<style scoped>
.combat {
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

.view-lead .btn-add {
  flex-shrink: 0;
}

.config-form {
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  padding: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  min-width: 0;
}

.form-group.grow {
  flex: 1;
  min-width: 0;
}

.form-group input,
.form-group select {
  background: var(--color-bg-input);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  padding: 0.55rem 0.7rem;
  color: var(--color-text-primary);
  font-size: 0.95rem;
}

.form-row {
  display: flex;
  gap: 0.6rem;
  align-items: flex-start;
}

.checks {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.check {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.85rem;
  color: var(--color-text-secondary);
}

.check input {
  width: 1.1rem;
  height: 1.1rem;
  accent-color: var(--color-accent);
}

.preview-box {
  background: var(--color-bg-primary);
  border: 1px dashed var(--color-border);
  border-radius: var(--radius-sm);
  padding: 0.65rem 0.75rem;
  font-size: 0.85rem;
}

.preview-line {
  line-height: 1.4;
}

.muted {
  color: var(--color-text-muted);
  font-size: 0.8rem;
}

.parts-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.parts-header .btn-add {
  flex-shrink: 0;
}

/* Indication collée sous l'en-tête « Types de dégâts » */
.parts-header + .hint {
  margin-top: -0.3rem;
}

.damage-part {
  background: var(--color-bg-primary);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  padding: 0.7rem;
  display: flex;
  flex-direction: column;
  gap: 0.55rem;
}

.damage-part-remove {
  margin-top: 1.2rem;
}

.dice-selector {
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem;
}

.dice-btn {
  min-width: 2.4rem;
  min-height: 2.4rem;
  padding: 0.35rem 0.45rem;
  font-size: 0.8rem;
  font-weight: 700;
  border-radius: var(--radius-sm);
  background: var(--color-bg-input);
  color: var(--color-text-secondary);
  border: 1px solid var(--color-border);
}

.dice-btn.active {
  background: var(--color-accent);
  color: var(--color-on-accent);
  border-color: var(--color-accent);
}

.config-list {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}

.config-card {
  display: flex;
  flex-direction: column;
  text-align: left;
  background: var(--color-bg-secondary);
  border: 2px solid var(--color-border);
  border-radius: var(--radius-md);
  padding: 0.85rem 1rem;
  color: var(--color-text-primary);
  gap: 0.5rem;
}

.config-card:active {
  border-color: var(--color-accent);
  transform: scale(0.99);
}

.config-card.animating {
  animation: shake 0.45s ease-in-out;
}

@keyframes shake {
  0%,
  100% {
    transform: translateX(0);
  }
  25% {
    transform: translateX(-3px);
  }
  75% {
    transform: translateX(3px);
  }
}

.config-name {
  font-weight: 800;
  font-size: 1.05rem;
}

.config-tohit {
  display: flex;
  align-items: baseline;
  gap: 0.4rem;
  margin: 0.15rem 0 0.1rem;
}

.tohit-label {
  font-size: 0.72rem;
  font-weight: 700;
  color: var(--color-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.03em;
}

.tohit-bonus {
  font-size: 1.35rem;
  font-weight: 800;
  color: var(--color-accent);
  line-height: 1;
}

.tohit-count {
  font-size: 0.85rem;
  font-weight: 700;
  color: var(--color-text-secondary);
}

.config-meta {
  font-size: 0.8rem;
  color: var(--color-text-secondary);
}

.config-formula {
  font-size: 0.72rem;
  color: var(--color-text-muted);
  line-height: 1.35;
}

.config-card-actions {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  border-top: 1px solid var(--color-border);
  padding-top: 0.45rem;
}

.result-panel {
  background: var(--color-bg-secondary);
  border: 2px solid var(--color-border);
  border-radius: var(--radius-lg);
  padding: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
}

.result-panel.crit {
  border-color: var(--color-warning);
}

.result-tohit {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 0.4rem 0.55rem;
  padding: 0.55rem 0.65rem;
  border-radius: var(--radius-sm);
  background: color-mix(in srgb, var(--color-accent) 10%, var(--color-bg-card));
  border: 1px solid color-mix(in srgb, var(--color-accent) 30%, var(--color-border));
}

.result-tohit-hint {
  flex: 1 1 100%;
  font-size: 0.72rem;
  color: var(--color-text-muted);
}

.result-tohit-bonus {
  font-size: 1.25rem;
  font-weight: 800;
  color: var(--color-accent);
}

.result-tohit-count {
  font-size: 0.9rem;
  font-weight: 700;
  color: var(--color-text-secondary);
}

.result-top {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 0.75rem;
}

.result-title {
  font-weight: 800;
  font-size: 1.05rem;
}

.result-sub {
  font-size: 0.8rem;
  color: var(--color-text-muted);
}

.result-grand {
  text-align: right;
}

.grand-number {
  display: block;
  font-size: 2.2rem;
  font-weight: 800;
  line-height: 1;
  color: var(--color-accent);
}

.grand-label {
  font-size: 0.7rem;
  text-transform: uppercase;
  color: var(--color-text-muted);
  font-weight: 700;
}

.by-type {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
}

.type-chip {
  background: var(--color-bg-card);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  padding: 0.35rem 0.55rem;
  display: flex;
  flex-direction: column;
  min-width: 4rem;
}

.type-total {
  font-weight: 800;
  font-size: 1rem;
}

.type-name {
  font-size: 0.65rem;
  color: var(--color-text-muted);
  text-transform: uppercase;
}

.attack-details {
  display: flex;
  flex-direction: column;
  gap: 0.55rem;
}

.attack-block {
  background: var(--color-bg-primary);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  padding: 0.65rem 0.75rem;
}

.attack-block.critical {
  border-color: var(--color-warning);
}

.attack-block.hit {
  border-color: var(--color-success);
  background: color-mix(in srgb, var(--color-success) 8%, var(--color-bg-primary));
}

.attack-block.fumble {
  border-color: var(--color-danger);
}

.attack-block-header {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.85rem;
  font-weight: 700;
  margin-bottom: 0.4rem;
  flex-wrap: wrap;
}

.outcome-row {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
  margin-bottom: 0.45rem;
}

.outcome-btn {
  min-height: 2.4rem;
  padding: 0.3rem 0.85rem;
  border-radius: var(--radius-sm);
  border: 1px solid var(--color-border);
  background: var(--color-bg-card);
  color: var(--color-text-secondary);
  font-size: 0.75rem;
  font-weight: 700;
}

.outcome-btn.active {
  border-color: var(--color-accent);
  background: color-mix(in srgb, var(--color-accent) 14%, var(--color-bg-card));
  color: var(--color-text-primary);
}

.badge {
  font-size: 0.6rem;
  font-weight: 800;
  padding: 0.1rem 0.35rem;
  border-radius: 3px;
}

.badge.crit {
  background: color-mix(in srgb, var(--color-warning) 20%, transparent);
  color: var(--color-warning);
}

.badge.fumble {
  background: color-mix(in srgb, var(--color-danger) 20%, transparent);
  color: var(--color-danger);
}

.atk-roll {
  margin-left: auto;
  font-variant-numeric: tabular-nums;
}

.atk-roll small {
  font-weight: 500;
  color: var(--color-text-muted);
}

.no-damage {
  font-size: 0.8rem;
  color: var(--color-danger);
}

.part-lines {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.part-line {
  display: flex;
  gap: 0.55rem;
  align-items: flex-start;
  font-size: 0.85rem;
}

.part-subtotal {
  font-weight: 800;
  min-width: 1.6rem;
  color: var(--color-accent);
}

.part-desc {
  flex: 1;
  line-height: 1.35;
}

.history-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.4rem;
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--color-text-secondary);
}

.history-entry {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  width: 100%;
  padding: 0.45rem 0.7rem;
  background: var(--color-bg-secondary);
  border-radius: var(--radius-sm);
  color: var(--color-text-primary);
  font-size: 0.85rem;
  margin-bottom: 0.3rem;
  text-align: left;
}

.hist-name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.hist-damage {
  font-weight: 700;
  color: var(--color-accent);
}

.hist-crit {
  font-size: 0.65rem;
  font-weight: 800;
  color: var(--color-warning);
}

.slide-enter-active,
.slide-leave-active {
  transition: all 0.25s ease;
}

.slide-enter-from,
.slide-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}

.result-enter-active {
  transition: all 0.3s ease;
}

.result-enter-from {
  opacity: 0;
  transform: scale(0.95);
}
</style>
