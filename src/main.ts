import './assets/fonts.css'
import './assets/main.css'

import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { applyTheme, loadStoredTheme } from '@/themes/themes'
import { applyFont, loadStoredFont } from '@/themes/fonts'
import { i18n, loadStoredLocale } from '@/i18n'

import App from './App.vue'

applyTheme(loadStoredTheme())
applyFont(loadStoredFont())
document.documentElement.lang = loadStoredLocale()

const app = createApp(App)
const pinia = createPinia()

app.use(pinia)
app.use(i18n)
app.mount('#app')
