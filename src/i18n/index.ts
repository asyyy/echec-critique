import { createI18n } from 'vue-i18n'
import { fr } from './locales/fr'
import { en } from './locales/en'

export type AppLocale = 'fr' | 'en'

const STORAGE_KEY = 'echec-critique-locale'

export function loadStoredLocale(): AppLocale {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved === 'fr' || saved === 'en') return saved
  } catch {
    /* ignore */
  }
  return detectDeviceLocale()
}

/** Langue du téléphone / navigateur : français si c'est la langue préférée, sinon anglais */
function detectDeviceLocale(): AppLocale {
  if (typeof navigator === 'undefined') return 'fr'
  const preferred = (navigator.languages?.[0] ?? navigator.language ?? 'fr').toLowerCase()
  return preferred.startsWith('fr') ? 'fr' : 'en'
}

export function persistLocale(locale: AppLocale) {
  try {
    localStorage.setItem(STORAGE_KEY, locale)
  } catch {
    /* ignore */
  }
}

export const i18n = createI18n({
  legacy: false,
  locale: loadStoredLocale(),
  fallbackLocale: 'fr',
  messages: { fr, en },
})

/** Applique la langue sans l'enregistrer : tant que l'utilisateur n'a rien choisi, on suit le téléphone */
export function applyAppLocale(locale: AppLocale) {
  i18n.global.locale.value = locale
  document.documentElement.lang = locale
}

/** Choix explicite (Options) : enregistré, prioritaire sur la langue du téléphone */
export function setAppLocale(locale: AppLocale) {
  applyAppLocale(locale)
  persistLocale(locale)
}
