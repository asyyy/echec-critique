<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useSettingsStore } from '@/stores/settings'
import { useCharacterStore } from '@/stores/character'
import { useCharacterBundle } from '@/composables/useCharacterBundle'
import { useCharacterRosterStore } from '@/stores/characterRoster'
import { THEME_LIST, type ThemeId } from '@/themes/themes'
import { FONT_LIST, FONTS, type FontId } from '@/themes/fonts'
import { useDismissedNotes } from '@/composables/useDismissedNotes'
import {
  useDeathSounds,
  DEATH_SOUND_MAX_COUNT,
  DEATH_SOUND_MAX_SECONDS,
} from '@/composables/useDeathSounds'
import InfoTip from '@/components/InfoTip.vue'
import type { AppLocale } from '@/i18n'
import {
  encodeBundles,
  decodeBundles,
  bundleFilename,
  type CharacterBundle,
} from '@/utils/characterBundle'
import { shareTextFile } from '@/utils/shareFile'
import ActionIconButton from '@/components/ActionIconButton.vue'

const open = defineModel<boolean>('open', { default: false })

const { t, locale } = useI18n()
const settings = useSettingsStore()
const character = useCharacterStore()
const { emptyBundle, collectBundle, applyBundle } = useCharacterBundle()
const roster = useCharacterRosterStore()
type OptionsSection = 'theme' | 'font' | 'language' | 'character' | 'sounds' | 'credits'
const expandedSection = ref<OptionsSection | null>(null)
const importInput = ref<HTMLInputElement | null>(null)
const shareBusy = ref(false)
const showExportPicker = ref(false)
const shareFeedback = ref('')
const eggTaps = ref(0)
let eggTimer: ReturnType<typeof setTimeout> | null = null

const currentThemeLabel = computed(() => t(`themes.${settings.theme}.label`))
const currentFontLabel = computed(() => FONTS[settings.font].label)
const currentLanguageLabel = computed(() =>
  settings.locale === 'fr' ? t('options.french') : t('options.english'),
)
const characterSectionValue = computed(() => {
  const name = character.name.trim() || t('options.unnamedSlot')
  return name
})

const sortedThemes = computed(() =>
  [...THEME_LIST].sort((a, b) =>
    t(`themes.${a.id}.label`).localeCompare(t(`themes.${b.id}.label`), locale.value, {
      sensitivity: 'base',
    }),
  ),
)

const deathSounds = useDeathSounds()
const soundInput = ref<HTMLInputElement | null>(null)
const soundFeedback = ref('')
const soundBusy = ref(false)

const soundsSummary = computed(() => {
  const n = deathSounds.sounds.value.length
  if (!n) return t('options.soundsNone')
  return deathSounds.enabled.value
    ? t('options.soundsCount', { n })
    : t('options.soundsCountMuted', { n })
})

const soundRuleLines = computed(() => [
  t('options.soundsRule1', { seconds: DEATH_SOUND_MAX_SECONDS, count: DEATH_SOUND_MAX_COUNT }),
  t('options.soundsRule2'),
])

function triggerSoundImport() {
  soundFeedback.value = ''
  soundInput.value?.click()
}

async function onSoundFile(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  soundBusy.value = true
  try {
    await deathSounds.add(file)
    soundFeedback.value = t('options.soundAdded')
  } catch (err) {
    const code = (err as Error).message
    const known = ['format', 'tooLong', 'tooBig', 'tooMany', 'storage']
    soundFeedback.value = t(`options.soundError.${known.includes(code) ? code : 'format'}`, {
      seconds: DEATH_SOUND_MAX_SECONDS,
      count: DEATH_SOUND_MAX_COUNT,
    })
  } finally {
    soundBusy.value = false
  }
}

function formatSeconds(duration: number) {
  return `${duration.toFixed(1).replace('.', locale.value === 'fr' ? ',' : '.')} s`
}

const dismissedNotes = useDismissedNotes()
const tipsJustReset = ref(false)

function resetTips() {
  dismissedNotes.resetAll()
  tipsJustReset.value = true
}

// Un conseil masqué à nouveau après le reset : on repasse sur le compteur
watch(dismissedNotes.dismissedCount, (n) => {
  if (n > 0) tipsJustReset.value = false
})

const tipsStatus = computed(() => {
  if (tipsJustReset.value) return t('options.tipsReset')
  const n = dismissedNotes.dismissedCount.value
  return n ? t('options.tipsHidden', { n }) : t('options.tipsAllVisible')
})

const showCalculator = computed({
  get: () => settings.showCalculator,
  set: (value: boolean) => settings.setShowCalculator(value),
})

const showDebug = computed({
  get: () => settings.showDebug,
  set: (value: boolean) => settings.setShowDebug(value),
})

const showIconsDebug = computed({
  get: () => settings.showIconsDebug,
  set: (value: boolean) => settings.setShowIconsDebug(value),
})

watch(open, async (isOpen) => {
  if (!isOpen) {
    expandedSection.value = null
    shareFeedback.value = ''
    roster.lockArchives()
    eggTaps.value = 0
    return
  }
  await roster.ensureSeeded(collectBundle())
  await roster.saveActive(collectBundle())
})

onMounted(async () => {
  await roster.ensureSeeded(collectBundle())
})

function close() {
  open.value = false
}

function toggleSection(section: OptionsSection) {
  expandedSection.value = expandedSection.value === section ? null : section
}

function onCharacterLabelClick(e: MouseEvent) {
  if (expandedSection.value !== 'character') return
  e.stopPropagation()
  onCharacterEggTap()
}

function onCharacterEggTap() {
  eggTaps.value += 1
  if (eggTimer) clearTimeout(eggTimer)
  eggTimer = setTimeout(() => {
    eggTaps.value = 0
  }, 2500)
  if (eggTaps.value >= 7) {
    eggTaps.value = 0
    roster.unlockArchives()
  }
}

function slotLabel(name: string) {
  return name.trim() || t('options.unnamedSlot')
}

const creditEntries = computed(() =>
  (
    [
      { nameKey: 'credits.parentsName' as const, detailKey: 'credits.parents' as const },
      { name: 'AideDD', detailKey: 'credits.aidedd' as const },
      { name: 'D&D 5e', detailKey: 'credits.dndInspired' as const },
    ] as const
  ).map((entry) => ({
    name: 'nameKey' in entry ? t(entry.nameKey) : entry.name,
    detail: t(entry.detailKey),
  })),
)

function selectTheme(id: ThemeId) {
  settings.setTheme(id)
}

function selectFont(id: FontId) {
  settings.setFont(id)
}

function selectLanguage(id: AppLocale) {
  settings.setLocale(id)
  locale.value = id
}

function onBackdropClick(e: MouseEvent) {
  if (e.target === e.currentTarget) close()
}

async function newCharacter() {
  if (!confirm(t('options.confirmNewCharacter'))) return
  const blank = emptyBundle()
  await roster.createNew(blank, collectBundle())
  applyBundle(blank)
  shareFeedback.value = t('options.characterResetDone')
}

function triggerImport() {
  importInput.value?.click()
}

async function onImportFile(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  try {
    const text = await file.text()
    const bundles = await decodeBundles(text)
    const confirmText =
      bundles.length > 1
        ? t('options.confirmImportCharacters', { n: bundles.length })
        : t('options.confirmImportCharacter')
    if (!confirm(confirmText)) return
    // Chaque import devient actif : on l'applique avant le suivant pour que saveActive ne l'écrase pas
    for (const bundle of bundles) {
      await roster.importAsActive(bundle, collectBundle(), false)
      applyBundle(bundle)
    }
    shareFeedback.value =
      bundles.length > 1
        ? t('options.importManyDone', { n: bundles.length })
        : t('options.importDone')
  } catch {
    shareFeedback.value = t('options.importError')
  }
}

async function switchCharacter(id: string) {
  if (id === roster.activeId) return
  try {
    const bundle = await roster.switchTo(id, collectBundle())
    if (!bundle) {
      shareFeedback.value = t('options.switchError')
      return
    }
    applyBundle(bundle)
    shareFeedback.value = t('options.switchDone')
  } catch {
    shareFeedback.value = t('options.switchError')
  }
}

function removeCharacter(id: string, name: string) {
  if (id === roster.activeId) {
    shareFeedback.value = t('options.deleteActiveBlocked')
    return
  }
  if (!confirm(t('options.confirmDeleteCharacter', { name: slotLabel(name) }))) return
  if (roster.softDelete(id)) {
    shareFeedback.value = t('options.deleteDone')
  }
}

function restoreCharacter(id: string) {
  if (roster.restore(id)) {
    shareFeedback.value = t('options.restoreDone')
  }
}

async function toggleExportPicker() {
  if (!showExportPicker.value) {
    // Enregistre le perso actif pour que la liste (nom, fichier) soit à jour, même au premier lancement
    await roster.saveActive(collectBundle())
  }
  showExportPicker.value = !showExportPicker.value
}

/** Exporte un personnage (id) ou tous (null) dans un fichier .ec1 */
async function exportCharacters(id: string | null) {
  if (shareBusy.value) return
  shareBusy.value = true
  shareFeedback.value = ''
  try {
    await roster.saveActive(collectBundle())
    const ids = id ? [id] : roster.visibleSlots.map((slot) => slot.id)
    const bundles: CharacterBundle[] = []
    for (const slotId of ids) {
      const bundle = slotId === roster.activeId ? collectBundle() : await roster.loadSlot(slotId)
      if (bundle) bundles.push(bundle)
    }
    if (!bundles.length) throw new Error('empty')

    const single = bundles.length === 1 ? bundles[0]! : null
    const payload = await encodeBundles(bundles)
    const filename = single
      ? bundleFilename(single.character.name || t('common.unnamed'))
      : 'echec-critique-personnages.ec1'
    const outcome = await shareTextFile(filename, payload, {
      title: single?.character.name || t('options.shareTitle'),
      text: single ? t('options.shareText') : t('options.shareTextMany'),
    })
    if (outcome === 'cancelled') return
    shareFeedback.value =
      outcome === 'shared' ? t('options.shareDone') : t('options.exportDownloaded')
    showExportPicker.value = false
  } catch {
    shareFeedback.value = t('options.shareError')
  } finally {
    shareBusy.value = false
  }
}
</script>

<template>
  <Teleport to="body">
    <Transition name="options">
      <div v-if="open" class="options-overlay" @click="onBackdropClick">
        <div class="options-panel" role="dialog" aria-modal="true" aria-labelledby="options-title">
          <header class="options-header">
            <h2 id="options-title">{{ t('options.title') }}</h2>
            <button
              class="options-close"
              type="button"
              :aria-label="t('common.close')"
              @click="close"
            >
              ✕
            </button>
          </header>

          <nav class="options-menu">
            <div class="menu-group">
              <button
                class="menu-trigger"
                type="button"
                :aria-expanded="expandedSection === 'language'"
                @click="toggleSection('language')"
              >
                <span class="menu-trigger-text">
                  <span class="menu-trigger-label">{{ t('options.language') }}</span>
                  <span class="menu-trigger-value">{{ currentLanguageLabel }}</span>
                </span>
                <span class="menu-chevron" :class="{ open: expandedSection === 'language' }"
                  >›</span
                >
              </button>

              <Transition name="expand">
                <ul v-if="expandedSection === 'language'" class="choice-list">
                  <li>
                    <button
                      class="choice-option"
                      :class="{ active: settings.locale === 'fr' }"
                      type="button"
                      @click="selectLanguage('fr')"
                    >
                      <span class="choice-info">
                        <span class="choice-name">{{ t('options.french') }}</span>
                      </span>
                      <span v-if="settings.locale === 'fr'" class="choice-check">✓</span>
                    </button>
                  </li>
                  <li>
                    <button
                      class="choice-option"
                      :class="{ active: settings.locale === 'en' }"
                      type="button"
                      @click="selectLanguage('en')"
                    >
                      <span class="choice-info">
                        <span class="choice-name">{{ t('options.english') }}</span>
                      </span>
                      <span v-if="settings.locale === 'en'" class="choice-check">✓</span>
                    </button>
                  </li>
                </ul>
              </Transition>
            </div>

            <div class="menu-group">
              <button
                class="menu-trigger"
                type="button"
                :aria-expanded="expandedSection === 'theme'"
                @click="toggleSection('theme')"
              >
                <span class="menu-trigger-text">
                  <span class="menu-trigger-label">{{ t('options.theme') }}</span>
                  <span class="menu-trigger-value">{{ currentThemeLabel }}</span>
                </span>
                <span class="menu-chevron" :class="{ open: expandedSection === 'theme' }">›</span>
              </button>

              <Transition name="expand">
                <ul v-if="expandedSection === 'theme'" class="choice-list">
                  <li v-for="themeItem in sortedThemes" :key="themeItem.id">
                    <button
                      class="choice-option"
                      :class="{ active: settings.theme === themeItem.id }"
                      type="button"
                      @click="selectTheme(themeItem.id)"
                    >
                      <span
                        class="theme-preview"
                        :class="`shape-${themeItem.previewShape}`"
                        aria-hidden="true"
                      >
                        <span class="swatch-bg" :style="{ background: themeItem.preview[0] }" />
                        <span class="swatch-accent" :style="{ background: themeItem.preview[1] }" />
                        <span class="swatch-text" :style="{ background: themeItem.preview[2] }" />
                        <span class="preview-mark">EC</span>
                      </span>
                      <span class="choice-info">
                        <span class="choice-name">{{ t(`themes.${themeItem.id}.label`) }}</span>
                        <span class="choice-desc">{{
                          t(`themes.${themeItem.id}.description`)
                        }}</span>
                      </span>
                      <span v-if="settings.theme === themeItem.id" class="choice-check">✓</span>
                    </button>
                  </li>
                </ul>
              </Transition>
            </div>

            <div class="menu-group">
              <button
                class="menu-trigger"
                type="button"
                :aria-expanded="expandedSection === 'font'"
                @click="toggleSection('font')"
              >
                <span class="menu-trigger-text">
                  <span class="menu-trigger-label">{{ t('options.font') }}</span>
                  <span class="menu-trigger-value">{{ currentFontLabel }}</span>
                </span>
                <span class="menu-chevron" :class="{ open: expandedSection === 'font' }">›</span>
              </button>

              <Transition name="expand">
                <ul v-if="expandedSection === 'font'" class="choice-list">
                  <li v-for="f in FONT_LIST" :key="f.id">
                    <button
                      class="choice-option"
                      :class="{ active: settings.font === f.id }"
                      type="button"
                      @click="selectFont(f.id)"
                    >
                      <span class="font-preview" :style="{ fontFamily: f.family }">{{
                        f.sample
                      }}</span>
                      <span class="choice-info">
                        <span class="choice-name" :style="{ fontFamily: f.family }">{{
                          f.label
                        }}</span>
                        <span class="choice-desc">{{ t(`fonts.${f.id}.description`) }}</span>
                      </span>
                      <span v-if="settings.font === f.id" class="choice-check">✓</span>
                    </button>
                  </li>
                </ul>
              </Transition>
            </div>

            <div class="menu-group">
              <button
                class="menu-trigger"
                type="button"
                :aria-expanded="expandedSection === 'character'"
                @click="toggleSection('character')"
              >
                <span class="menu-trigger-text">
                  <span class="menu-trigger-label" @click="onCharacterLabelClick">{{
                    t('options.characterSection')
                  }}</span>
                  <span class="menu-trigger-value">{{ characterSectionValue }}</span>
                </span>
                <span class="menu-chevron" :class="{ open: expandedSection === 'character' }"
                  >›</span
                >
              </button>

              <Transition name="expand">
                <ul v-if="expandedSection === 'character'" class="choice-list">
                  <li v-for="slot in roster.visibleSlots" :key="slot.id" class="slot-row">
                    <button
                      class="choice-option slot-main"
                      :class="{ active: slot.id === roster.activeId }"
                      type="button"
                      @click="switchCharacter(slot.id)"
                    >
                      <span class="choice-info">
                        <span class="choice-name">{{ slotLabel(slot.displayName) }}</span>
                        <span class="choice-desc">
                          {{ t('options.levelShort', { level: slot.level })
                          }}<template v-if="slot.characterClass">
                            · {{ slot.characterClass }}</template
                          >
                        </span>
                      </span>
                      <span v-if="slot.id === roster.activeId" class="choice-check">✓</span>
                    </button>
                    <ActionIconButton
                      v-if="slot.id !== roster.activeId"
                      kind="remove"
                      compact
                      :label="t('options.removeCharacter')"
                      @click="removeCharacter(slot.id, slot.displayName)"
                    />
                    <!-- Perso actif : pas de corbeille, mais sa place est gardée (les lignes ne bougent pas) -->
                    <span v-else class="slot-remove-placeholder" aria-hidden="true" />
                  </li>

                  <li>
                    <button class="choice-option" type="button" @click="newCharacter">
                      <span class="choice-info">
                        <span class="choice-name">{{ t('options.newCharacter') }}</span>
                        <span class="choice-desc">{{ t('options.newCharacterHint') }}</span>
                      </span>
                    </button>
                  </li>
                  <li>
                    <button class="choice-option" type="button" @click="triggerImport">
                      <span class="choice-info">
                        <span class="choice-name">{{ t('options.importCharacter') }}</span>
                        <span class="choice-desc">{{ t('options.importCharacterHint') }}</span>
                      </span>
                    </button>
                  </li>
                  <li>
                    <button
                      class="choice-option"
                      type="button"
                      :aria-expanded="showExportPicker"
                      :disabled="shareBusy"
                      @click="toggleExportPicker"
                    >
                      <span class="choice-info">
                        <span class="choice-name">{{ t('options.shareCharacter') }}</span>
                        <span class="choice-desc">{{ t('options.shareCharacterHint') }}</span>
                      </span>
                      <span class="menu-chevron" :class="{ open: showExportPicker }">›</span>
                    </button>
                  </li>
                  <template v-if="showExportPicker">
                    <li v-for="slot in roster.visibleSlots" :key="`export-${slot.id}`">
                      <button
                        class="choice-option export-choice"
                        type="button"
                        :disabled="shareBusy"
                        @click="exportCharacters(slot.id)"
                      >
                        <span class="choice-info">
                          <span class="choice-name">{{ slotLabel(slot.displayName) }}</span>
                          <span class="choice-desc">{{ slot.fileName }}</span>
                        </span>
                      </button>
                    </li>
                    <li v-if="roster.visibleSlots.length > 1">
                      <button
                        class="choice-option export-choice"
                        type="button"
                        :disabled="shareBusy"
                        @click="exportCharacters(null)"
                      >
                        <span class="choice-info">
                          <span class="choice-name">{{
                            t('options.exportAll', { n: roster.visibleSlots.length })
                          }}</span>
                          <span class="choice-desc">echec-critique-personnages.ec1</span>
                        </span>
                      </button>
                    </li>
                  </template>

                  <template v-if="roster.archivesUnlocked">
                    <li class="archives-header">
                      <span class="archives-title">{{ t('options.archivesTitle') }}</span>
                      <span class="archives-hint">{{ t('options.archivesHint') }}</span>
                    </li>
                    <li v-if="!roster.archivedSlots.length" class="share-feedback">
                      {{ t('options.archivesHint') }}
                    </li>
                    <li
                      v-for="slot in roster.archivedSlots"
                      :key="`trash-${slot.id}`"
                      class="slot-row"
                    >
                      <div class="choice-option slot-main archived">
                        <span class="choice-info">
                          <span class="choice-name">{{ slotLabel(slot.displayName) }}</span>
                          <span class="choice-desc">{{ slot.fileName }}</span>
                        </span>
                      </div>
                      <button class="slot-restore" type="button" @click="restoreCharacter(slot.id)">
                        {{ t('options.restoreCharacter') }}
                      </button>
                    </li>
                  </template>

                  <li v-if="shareFeedback" class="share-feedback">{{ shareFeedback }}</li>
                </ul>
              </Transition>
              <!-- Pas d'attribut accept : Android ne connaît pas le type .ec1 et grise le fichier
                   dans le sélecteur. Le contenu est validé à la lecture (decodeBundles). -->
              <input ref="importInput" class="import-input" type="file" @change="onImportFile" />
            </div>

            <div class="menu-group">
              <label class="toggle-row">
                <span class="menu-trigger-text">
                  <span class="menu-trigger-label">{{ t('options.calculator') }}</span>
                  <span class="menu-trigger-value">{{ t('options.calculatorHint') }}</span>
                </span>
                <input v-model="showCalculator" class="toggle-input" type="checkbox" />
              </label>
            </div>

            <div class="menu-group">
              <label class="toggle-row">
                <span class="menu-trigger-text">
                  <span class="menu-trigger-label">{{ t('options.iconsDebug') }}</span>
                  <span class="menu-trigger-value">{{ t('options.iconsDebugHint') }}</span>
                </span>
                <input v-model="showIconsDebug" class="toggle-input" type="checkbox" />
              </label>
            </div>

            <div class="menu-group">
              <label class="toggle-row">
                <span class="menu-trigger-text">
                  <span class="menu-trigger-label">{{ t('options.debug') }}</span>
                  <span class="menu-trigger-value">{{ t('options.debugHint') }}</span>
                </span>
                <input v-model="showDebug" class="toggle-input" type="checkbox" />
              </label>
            </div>

            <div class="menu-group">
              <!-- En-tête : déplier la liste + interrupteur (deux contrôles distincts, pas imbriqués) -->
              <div class="menu-trigger sounds-header">
                <button
                  class="sounds-expand"
                  type="button"
                  :aria-expanded="expandedSection === 'sounds'"
                  @click="toggleSection('sounds')"
                >
                  <span class="menu-trigger-text">
                    <span class="menu-trigger-label">{{ t('options.sounds') }}</span>
                    <span class="menu-trigger-value">{{
                      t('options.soundsFormats', { seconds: DEATH_SOUND_MAX_SECONDS })
                    }}</span>
                  </span>
                  <span class="menu-chevron" :class="{ open: expandedSection === 'sounds' }"
                    >›</span
                  >
                </button>
                <input
                  class="toggle-input"
                  type="checkbox"
                  :aria-label="t('options.soundsEnabled')"
                  :title="t('options.soundsEnabled')"
                  :checked="deathSounds.enabled.value"
                  @change="deathSounds.setEnabled(($event.target as HTMLInputElement).checked)"
                />
              </div>

              <Transition name="expand">
                <div v-if="expandedSection === 'sounds'" class="credits-panel sounds-panel">
                  <ul v-if="deathSounds.sounds.value.length" class="sound-list">
                    <li v-for="sound in deathSounds.sounds.value" :key="sound.id" class="sound-row">
                      <button
                        class="sound-play"
                        type="button"
                        :aria-label="t('options.soundPlay', { name: sound.name })"
                        @click="deathSounds.play(sound.id)"
                      >
                        ▶
                      </button>
                      <span class="sound-info">
                        <span class="sound-name">{{ sound.name }}</span>
                        <span class="sound-meta">{{ formatSeconds(sound.duration) }}</span>
                      </span>
                      <ActionIconButton
                        kind="remove"
                        compact
                        :label="t('options.soundRemove', { name: sound.name })"
                        @click="deathSounds.remove(sound.id)"
                      />
                    </li>
                  </ul>

                  <div class="sound-actions">
                    <button
                      class="btn-add"
                      type="button"
                      :disabled="
                        soundBusy || deathSounds.sounds.value.length >= DEATH_SOUND_MAX_COUNT
                      "
                      @click="triggerSoundImport"
                    >
                      {{ t('options.soundAdd') }}
                    </button>
                    <span class="sound-count">{{ soundsSummary }}</span>
                    <InfoTip :title="t('options.sounds')" :lines="soundRuleLines" />
                  </div>
                  <p v-if="soundFeedback" class="sound-feedback">{{ soundFeedback }}</p>
                  <input
                    ref="soundInput"
                    class="import-input"
                    type="file"
                    accept="audio/*"
                    @change="onSoundFile"
                  />
                </div>
              </Transition>
            </div>

            <div class="menu-group">
              <button
                class="menu-trigger"
                type="button"
                :disabled="!dismissedNotes.dismissedCount.value"
                @click="resetTips"
              >
                <span class="menu-trigger-text">
                  <span class="menu-trigger-label">{{ t('options.tips') }}</span>
                  <span class="menu-trigger-value">{{ tipsStatus }}</span>
                </span>
              </button>
            </div>

            <div class="menu-group">
              <button
                class="menu-trigger"
                type="button"
                :aria-expanded="expandedSection === 'credits'"
                @click="toggleSection('credits')"
              >
                <span class="menu-trigger-text">
                  <span class="menu-trigger-label">{{ t('options.credits') }}</span>
                  <span class="menu-trigger-value">{{ t('options.creditsHint') }}</span>
                </span>
                <span class="menu-chevron" :class="{ open: expandedSection === 'credits' }">›</span>
              </button>

              <Transition name="expand">
                <div v-if="expandedSection === 'credits'" class="credits-panel">
                  <p class="credits-intro">{{ t('credits.intro') }}</p>
                  <ul class="credits-list">
                    <li v-for="entry in creditEntries" :key="entry.name" class="credits-item">
                      <span class="credits-name">{{ entry.name }}</span>
                      <span class="credits-detail">{{ entry.detail }}</span>
                    </li>
                  </ul>
                </div>
              </Transition>
            </div>
          </nav>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.options-overlay {
  position: fixed;
  inset: 0;
  z-index: 1000;
  background: rgba(0, 0, 0, 0.55);
  display: flex;
  align-items: flex-end;
  justify-content: center;
  padding: 0;
}

.options-panel {
  width: 100%;
  max-width: 600px;
  max-height: 85dvh;
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg) var(--radius-lg) 0 0;
  padding: 1rem 1rem calc(1rem + env(safe-area-inset-bottom));
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
}

.options-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1rem;
}

.options-header h2 {
  font-size: 1.2rem;
  font-weight: 700;
  color: var(--color-text-primary);
}

.options-close {
  width: 2.25rem;
  height: 2.25rem;
  border-radius: 50%;
  background: var(--color-bg-card);
  color: var(--color-text-secondary);
  font-size: 0.9rem;
  border: 1px solid var(--color-border);
  display: flex;
  align-items: center;
  justify-content: center;
}

.options-menu {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.menu-group {
  background: var(--color-bg-primary);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  overflow: hidden;
}

.menu-trigger {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding: 0.85rem 1rem;
  background: transparent;
  color: var(--color-text-primary);
  text-align: left;
}

.menu-trigger:disabled {
  cursor: default;
}

.menu-trigger-text {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
}

.menu-trigger-label {
  font-weight: 700;
  font-size: 0.95rem;
}

.menu-trigger-value {
  font-size: 0.8rem;
  color: var(--color-text-muted);
}

.menu-chevron {
  font-size: 1.25rem;
  color: var(--color-text-muted);
  transition: transform 0.2s ease;
  transform: rotate(90deg);
  line-height: 1;
}

.menu-chevron.open {
  transform: rotate(-90deg);
}

.credits-panel {
  padding: 0 1rem 0.9rem;
  border-top: 1px solid var(--color-border);
}

.sounds-panel {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
  padding-top: 0.75rem;
}

.sounds-header {
  gap: 0.75rem;
}

.sounds-expand {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  padding: 0;
  background: transparent;
  color: inherit;
  text-align: left;
}

.sound-actions {
  display: flex;
  align-items: center;
  gap: 0.6rem;
}

.sound-count {
  flex: 1;
  min-width: 0;
  font-size: 0.75rem;
  color: var(--color-text-muted);
}

.sound-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.sound-row {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  padding: 0.4rem 0.55rem;
  background: var(--color-bg-card);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
}

.sound-play {
  flex-shrink: 0;
  width: 2rem;
  height: 2rem;
  border-radius: 50%;
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border);
  color: var(--color-accent);
  font-size: 0.8rem;
  padding: 0;
}

.sound-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.sound-name {
  font-size: 0.85rem;
  font-weight: 700;
  color: var(--color-text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sound-meta {
  font-size: 0.72rem;
  color: var(--color-text-muted);
}

.sound-feedback {
  margin: 0;
  font-size: 0.78rem;
  color: var(--color-text-secondary);
}

.credits-intro {
  margin: 0.75rem 0 0.65rem;
  font-size: 0.8rem;
  color: var(--color-text-secondary);
  line-height: 1.4;
}

.credits-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.55rem;
}

.credits-item {
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
  padding: 0.45rem 0.55rem;
  background: var(--color-bg-card);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
}

.credits-name {
  font-size: 0.85rem;
  font-weight: 800;
  color: var(--color-text-primary);
}

.credits-detail {
  font-size: 0.72rem;
  color: var(--color-text-muted);
  line-height: 1.35;
}

.toggle-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  width: 100%;
  padding: 0.85rem 1rem;
  cursor: pointer;
}

.toggle-input {
  flex-shrink: 0;
  width: 1.25rem;
  height: 1.25rem;
  accent-color: var(--color-accent);
}

.import-input {
  display: none;
}

.share-feedback {
  padding: 0.45rem 0.75rem;
  font-size: 0.78rem;
  color: var(--color-text-secondary);
  line-height: 1.35;
}

.slot-row {
  display: flex;
  align-items: stretch;
  gap: 0.35rem;
}

.slot-remove-placeholder {
  flex-shrink: 0;
  width: 1.55rem;
  height: 1.55rem;
}

.slot-main {
  flex: 1;
  min-width: 0;
}

.slot-main.archived {
  opacity: 0.72;
  border-style: dashed;
}

.slot-restore {
  flex-shrink: 0;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-bg-secondary);
  color: var(--color-text-secondary);
  padding: 0 0.65rem;
  font-size: 0.75rem;
  font-weight: 700;
}

.archives-header {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
  padding: 0.35rem 0.5rem 0.1rem;
  margin-top: 0.25rem;
}

.archives-title {
  font-size: 0.78rem;
  font-weight: 800;
  color: var(--color-text-primary);
}

.archives-hint {
  font-size: 0.7rem;
  color: var(--color-text-muted);
}

.choice-list {
  list-style: none;
  border-top: 1px solid var(--color-border);
  padding: 0.5rem;
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.choice-option.export-choice {
  padding-left: 1.5rem;
}

.choice-option {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  width: 100%;
  padding: 0.65rem 0.75rem;
  background: var(--color-bg-secondary);
  border: 2px solid var(--color-border);
  border-radius: var(--radius-sm);
  text-align: left;
  color: var(--color-text-primary);
  transition: border-color 0.2s;
}

.choice-option.active {
  border-color: var(--color-accent);
  background: color-mix(in srgb, var(--color-accent) 8%, var(--color-bg-secondary));
}

.choice-option:active {
  transform: scale(0.99);
}

.theme-preview {
  position: relative;
  display: flex;
  flex-shrink: 0;
  width: 2.25rem;
  height: 2.25rem;
  border-radius: var(--radius-sm);
  overflow: hidden;
  border: 1px solid var(--color-border);
}

.theme-preview .preview-mark {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.55rem;
  font-weight: 800;
  letter-spacing: -0.04em;
  color: rgba(255, 255, 255, 0.9);
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.55);
  pointer-events: none;
  z-index: 1;
}

.theme-preview.shape-round,
.theme-preview.shape-orb {
  border-radius: 50%;
}

.theme-preview.shape-arch {
  border-radius: 50% 50% 4px 4px / 40% 40% 4px 4px;
}

.theme-preview.shape-leaf {
  border-radius: 60% 40% 55% 45% / 45% 55% 40% 60%;
  transform: rotate(-6deg);
}

.theme-preview.shape-hex {
  clip-path: polygon(50% 0%, 93% 25%, 93% 75%, 50% 100%, 7% 75%, 7% 25%);
  border: none;
  border-radius: 0;
}

.theme-preview.shape-shield {
  clip-path: polygon(50% 0%, 100% 12%, 100% 55%, 50% 100%, 0% 55%, 0% 12%);
  border: none;
  border-radius: 0;
}

.theme-preview.shape-drop {
  border-radius: 50% 0 50% 50%;
  transform: rotate(-45deg);
}

.theme-preview.shape-drop .preview-mark {
  transform: rotate(45deg);
}

.theme-preview.shape-terminal {
  border-radius: 0;
}

.theme-preview.shape-terminal .preview-mark {
  color: #33ff66;
  font-family: ui-monospace, monospace;
  text-shadow: none;
}

.theme-preview.shape-pixel {
  border-radius: 0;
  border-width: 2px;
  box-shadow: 2px 2px 0 #0d0f18;
}

.theme-preview.shape-pixel .preview-mark {
  font-family: 'Press Start 2P', ui-monospace, monospace;
  font-size: 0.4rem;
}

.theme-preview.shape-orb {
  box-shadow: 0 0 8px color-mix(in srgb, var(--color-accent) 35%, transparent);
}

.swatch-bg {
  flex: 2;
}

.swatch-accent {
  flex: 1;
}

.swatch-text {
  flex: 1;
}

.font-preview {
  flex-shrink: 0;
  width: 2.25rem;
  height: 2.25rem;
  border-radius: var(--radius-sm);
  border: 1px solid var(--color-border);
  background: var(--color-bg-card);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.85rem;
  font-weight: 700;
  color: var(--color-text-primary);
}

.choice-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
}

.choice-name {
  font-weight: 700;
  font-size: 0.9rem;
}

.choice-desc {
  font-size: 0.72rem;
  color: var(--color-text-muted);
  line-height: 1.3;
}

.choice-check {
  flex-shrink: 0;
  width: 1.4rem;
  height: 1.4rem;
  border-radius: var(--check-mark-radius, 50%);
  background: var(--color-accent);
  color: var(--color-bg-primary);
  font-size: 0.7rem;
  font-weight: 800;
  display: flex;
  align-items: center;
  justify-content: center;
}

.expand-enter-active,
.expand-leave-active {
  transition:
    opacity 0.2s ease,
    max-height 0.25s ease;
  overflow: hidden;
}

.expand-enter-from,
.expand-leave-to {
  opacity: 0;
  max-height: 0;
}

.expand-enter-to,
.expand-leave-from {
  max-height: 1200px;
}

.options-enter-active,
.options-leave-active {
  transition: opacity 0.25s ease;
}

.options-enter-active .options-panel,
.options-leave-active .options-panel {
  transition: transform 0.25s ease;
}

.options-enter-from,
.options-leave-to {
  opacity: 0;
}

.options-enter-from .options-panel,
.options-leave-to .options-panel {
  transform: translateY(100%);
}

@media (min-width: 480px) {
  .options-overlay {
    align-items: center;
    padding: 1rem;
  }

  .options-panel {
    border-radius: var(--radius-lg);
    max-height: 80dvh;
  }

  .options-enter-from .options-panel,
  .options-leave-to .options-panel {
    transform: translateY(20px) scale(0.97);
  }
}
</style>
