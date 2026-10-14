import { ref } from 'vue'
import { defineStore } from 'pinia'
import { type ThemeId, applyTheme, loadStoredTheme, persistTheme } from '@/themes/themes'
import { type FontId, applyFont, loadStoredFont, persistFont } from '@/themes/fonts'
import { type AppLocale, loadStoredLocale, applyAppLocale, setAppLocale } from '@/i18n'

const CALC_STORAGE_KEY = 'echec-critique-show-calculator'
const ICONS_DEBUG_STORAGE_KEY = 'echec-critique-show-icons-debug'
const DEBUG_STORAGE_KEY = 'echec-critique-show-debug'

function loadFlag(key: string): boolean {
  try {
    return localStorage.getItem(key) === 'true'
  } catch {
    return false
  }
}

function persistFlag(key: string, value: boolean) {
  try {
    localStorage.setItem(key, value ? 'true' : 'false')
  } catch {
    /* ignore */
  }
}

function loadShowCalculator(): boolean {
  try {
    return localStorage.getItem(CALC_STORAGE_KEY) === 'true'
  } catch {
    return false
  }
}

function persistShowCalculator(value: boolean) {
  try {
    localStorage.setItem(CALC_STORAGE_KEY, value ? 'true' : 'false')
  } catch {
    /* ignore */
  }
}

function loadShowIconsDebug(): boolean {
  try {
    return localStorage.getItem(ICONS_DEBUG_STORAGE_KEY) === 'true'
  } catch {
    return false
  }
}

function persistShowIconsDebug(value: boolean) {
  try {
    localStorage.setItem(ICONS_DEBUG_STORAGE_KEY, value ? 'true' : 'false')
  } catch {
    /* ignore */
  }
}

export const useSettingsStore = defineStore('settings', () => {
  const theme = ref<ThemeId>(loadStoredTheme())
  const font = ref<FontId>(loadStoredFont())
  const showCalculator = ref(loadShowCalculator())
  const showIconsDebug = ref(loadShowIconsDebug())
  const showDebug = ref(loadFlag(DEBUG_STORAGE_KEY))
  const locale = ref<AppLocale>(loadStoredLocale())

  function initAppearance() {
    applyTheme(theme.value)
    applyFont(font.value)
    applyAppLocale(locale.value)
  }

  function setTheme(id: ThemeId) {
    theme.value = id
    applyTheme(id)
    persistTheme(id)
  }

  function setFont(id: FontId) {
    font.value = id
    applyFont(id)
    persistFont(id)
  }

  function setShowCalculator(value: boolean) {
    showCalculator.value = value
    persistShowCalculator(value)
  }

  function setShowIconsDebug(value: boolean) {
    showIconsDebug.value = value
    persistShowIconsDebug(value)
  }

  function setShowDebug(value: boolean) {
    showDebug.value = value
    persistFlag(DEBUG_STORAGE_KEY, value)
  }

  function setLocale(value: AppLocale) {
    locale.value = value
    setAppLocale(value)
  }

  return {
    theme,
    font,
    showCalculator,
    showIconsDebug,
    showDebug,
    locale,
    initAppearance,
    setTheme,
    setFont,
    setShowCalculator,
    setShowIconsDebug,
    setShowDebug,
    setLocale,
  }
})
