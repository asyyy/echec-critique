<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import StatsView from '@/components/StatsView.vue'
import SpellStatusView from '@/components/SpellStatusView.vue'
import CombatView from '@/components/CombatView.vue'
import SpellsView from '@/components/SpellsView.vue'
import InventoryView from '@/components/InventoryView.vue'
import EquipmentView from '@/components/EquipmentView.vue'
import CalculatorView from '@/components/CalculatorView.vue'
import IconsDebugView from '@/components/IconsDebugView.vue'
import DebugView from '@/components/DebugView.vue'
import GlobalSearch from '@/components/GlobalSearch.vue'
import AppToast from '@/components/AppToast.vue'
import OptionsMenu from '@/components/OptionsMenu.vue'
import PixelArtIcon from '@/components/icons/PixelArtIcon.vue'
import { useSettingsStore } from '@/stores/settings'
import { useCharacterStore } from '@/stores/character'
import { useDeathSounds } from '@/composables/useDeathSounds'
import { navigateSearchResult } from '@/composables/useSearchNavigation'
import { useTabLabelsFit } from '@/composables/useTabLabelsFit'
import type { SearchEntry } from '@/utils/searchIndex'
import type { PixelIconName } from '@/components/icons/pixelIcons'

type Context =
  'stats' | 'combat' | 'inventaire' | 'equipements' | 'calculatrice' | 'icons-debug' | 'debug'
type EquipmentSection = 'equipable' | 'capacite' | 'traits'
type CombatSection = 'attacks' | 'spells' | 'catalog'
type StatsSection = 'sheet' | 'magic'
type TabDef = { id: Context; label: string; icon?: PixelIconName }

const { t } = useI18n()
const settings = useSettingsStore()

// Passage à « RIP » (3ᵉ échec aux jets contre la mort) : son de mort aléatoire, si l'utilisateur en a ajouté
const character = useCharacterStore()
const deathSounds = useDeathSounds()
watch(
  () => character.isDead,
  (dead, wasDead) => {
    if (dead && !wasDead) void deathSounds.playRandom()
  },
)
const activeContext = ref<Context>('stats')
const optionsOpen = ref(false)
const equipmentSection = ref<EquipmentSection>('equipable')
const combatSection = ref<CombatSection>('attacks')
const statsSection = ref<StatsSection>('sheet')

const allTabs = computed(() => {
  const tabs: TabDef[] = [
    { id: 'stats', label: t('tabs.stats'), icon: 'stats' },
    { id: 'combat', label: t('tabs.combat'), icon: 'combat' },
    { id: 'equipements', label: t('tabs.character'), icon: 'personnage' },
    { id: 'inventaire', label: t('tabs.inventory'), icon: 'inventaire' },
    { id: 'calculatrice', label: t('tabs.calculator'), icon: 'calculatrice' },
    { id: 'icons-debug', label: t('tabs.iconsDebug') },
    { id: 'debug', label: t('tabs.debug') },
  ]
  return tabs.filter((tab) => {
    if (tab.id === 'calculatrice' && !settings.showCalculator) return false
    if (tab.id === 'icons-debug' && !settings.showIconsDebug) return false
    if (tab.id === 'debug' && !settings.showDebug) return false
    return true
  })
})

const tabs = allTabs

const contextNav = ref<HTMLElement | null>(null)
const { hidden: hideTabLabels } = useTabLabelsFit(contextNav, {
  button: '.context-btn',
  label: '.context-label',
  // onglet actif inclus : le thème Terminal ajoute un curseur après son libellé
  deps: [tabs, activeContext, () => settings.locale, () => settings.theme, () => settings.font],
})

const subTabs = computed(() => {
  if (activeContext.value === 'stats') {
    return [
      { id: 'sheet' as const, label: t('subTabs.sheet') },
      { id: 'magic' as const, label: t('subTabs.magic') },
    ]
  }
  if (activeContext.value === 'equipements') {
    return [
      { id: 'equipable' as const, label: t('subTabs.equipable') },
      { id: 'capacite' as const, label: t('subTabs.capacite') },
      { id: 'traits' as const, label: t('subTabs.traits') },
    ]
  }
  if (activeContext.value === 'combat') {
    return [
      { id: 'attacks' as const, label: t('subTabs.attacks') },
      { id: 'spells' as const, label: t('subTabs.spells') },
      { id: 'catalog' as const, label: t('subTabs.catalog') },
    ]
  }
  return []
})

function isSubTabActive(id: string) {
  if (activeContext.value === 'stats') return statsSection.value === id
  if (activeContext.value === 'equipements') return equipmentSection.value === id
  if (activeContext.value === 'combat') return combatSection.value === id
  return false
}

function selectSubTab(id: string) {
  if (activeContext.value === 'stats') {
    statsSection.value = id as StatsSection
  } else if (activeContext.value === 'equipements') {
    equipmentSection.value = id as EquipmentSection
  } else if (activeContext.value === 'combat') {
    combatSection.value = id as CombatSection
  }
}

watch(
  () => settings.showCalculator,
  (enabled) => {
    if (!enabled && activeContext.value === 'calculatrice') {
      activeContext.value = 'stats'
    }
  },
)

watch(
  () => settings.showIconsDebug,
  (enabled) => {
    if (!enabled && activeContext.value === 'icons-debug') {
      activeContext.value = 'stats'
    }
  },
)

watch(
  () => settings.showDebug,
  (enabled) => {
    if (!enabled && activeContext.value === 'debug') {
      activeContext.value = 'stats'
    }
  },
)

/** Perso de démo créé depuis l'onglet Débug : on l'affiche tout de suite */
function onDemoCreated() {
  activeContext.value = 'stats'
  statsSection.value = 'sheet'
}

function onSearchSelect(entry: SearchEntry) {
  navigateSearchResult(entry, (tab) => {
    activeContext.value = tab as Context
    if (tab === 'equipements') {
      equipmentSection.value = 'equipable'
    }
  })
}
</script>

<template>
  <div class="app-shell">
    <header class="app-header">
      <div class="header-toolbar">
        <GlobalSearch class="header-search" @select="onSearchSelect" />
        <button
          class="options-btn"
          type="button"
          :aria-label="t('common.options')"
          @click="optionsOpen = true"
        >
          ⚙
        </button>
      </div>
      <nav ref="contextNav" class="context-nav" :class="{ 'labels-hidden': hideTabLabels }">
        <button
          v-for="tab in tabs"
          :key="tab.id"
          class="context-btn"
          :class="{ active: activeContext === tab.id }"
          :title="tab.label"
          :aria-label="tab.label"
          @click="activeContext = tab.id"
        >
          <span class="context-icon">
            <PixelArtIcon v-if="tab.icon" :name="tab.icon" :size="40" />
            <span v-else class="context-icon-fallback">PX</span>
          </span>
          <span class="context-label">{{ tab.label }}</span>
        </button>
      </nav>
      <nav v-if="subTabs.length" class="sub-context-nav" :aria-label="t('tabs.subTabsLabel')">
        <button
          v-for="tab in subTabs"
          :key="tab.id"
          class="sub-context-btn"
          :class="{ active: isSubTabActive(tab.id) }"
          @click="selectSubTab(tab.id)"
        >
          <span class="sub-context-btn-inner">
            <span class="sub-context-btn-label">{{ tab.label }}</span>
          </span>
        </button>
      </nav>
    </header>

    <main class="context-content">
      <KeepAlive>
        <StatsView v-if="activeContext === 'stats' && statsSection === 'sheet'" />
        <SpellStatusView v-else-if="activeContext === 'stats' && statsSection === 'magic'" />
        <CombatView v-else-if="activeContext === 'combat' && combatSection === 'attacks'" />
        <SpellsView
          v-else-if="
            activeContext === 'combat' &&
            (combatSection === 'spells' || combatSection === 'catalog')
          "
          :panel="combatSection === 'catalog' ? 'catalog' : 'mine'"
        />
        <InventoryView v-else-if="activeContext === 'inventaire'" />
        <EquipmentView v-else-if="activeContext === 'equipements'" :section="equipmentSection" />
        <CalculatorView v-else-if="activeContext === 'calculatrice'" />
        <IconsDebugView v-else-if="activeContext === 'icons-debug'" />
        <DebugView v-else-if="activeContext === 'debug'" @created="onDemoCreated" />
      </KeepAlive>
    </main>

    <OptionsMenu v-model:open="optionsOpen" />
    <AppToast />
  </div>
</template>

<style scoped>
.app-shell {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  min-height: 100dvh;
}

.app-header {
  position: sticky;
  top: 0;
  z-index: 100;
  background: var(--color-bg-primary);
}

.header-toolbar {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.5rem 0.6rem 0;
}

.header-search {
  flex: 1;
  min-width: 0;
  align-self: stretch;
  display: flex;
}

.options-btn {
  flex-shrink: 0;
  width: 2.75rem;
  height: 2.75rem;
  border-radius: var(--radius-md);
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border);
  color: var(--color-text-secondary);
  font-size: 1.25rem;
  display: flex;
  align-items: center;
  justify-content: center;
  transition:
    border-color 0.2s,
    color 0.2s;
}

.options-btn:active {
  border-color: var(--color-accent);
  color: var(--color-accent);
}

.context-nav {
  display: flex;
  gap: 0;
  padding: 0.4rem 0.6rem 0;
}

.context-btn {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.35rem;
  padding: 0.85rem 0.45rem 0.75rem;
  background: var(--color-tab-inactive);
  color: var(--color-text-muted);
  border-radius: var(--radius-md) var(--radius-md) 0 0;
  font-weight: 600;
  transition:
    color 0.2s ease,
    background 0.2s ease,
    border-color 0.2s ease,
    border-bottom-width 0.15s ease;
  border: 1px solid var(--color-border);
  border-bottom: 2px solid var(--color-border);
  position: relative;
  min-width: 0;
  box-sizing: border-box;
}

.context-btn.active {
  background: var(--color-bg-secondary);
  color: var(--color-text-primary);
  border-color: var(--color-accent);
  border-bottom: 4px solid var(--color-accent);
  z-index: 2;
}

.context-btn:not(.active):active {
  background: var(--color-bg-card);
}

.context-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  line-height: 1;
  overflow: visible;
}

.context-icon-fallback {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  font-size: 0.6rem;
  font-weight: 800;
  letter-spacing: 0.04em;
  color: var(--color-text-muted);
  border: 1px dashed var(--color-border);
  border-radius: 4px;
}

.context-label {
  max-width: 100%;
  /* Plancher ~10 px : lisible même sur un petit écran (un libellé trop long finit en « … ») */
  font-size: clamp(0.6rem, 2.4vw, 0.78rem);
  text-transform: uppercase;
  letter-spacing: 0.02em;
  line-height: 1.15;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  padding: 0 0.15rem;
  box-sizing: border-box;
}

/* Un libellé ne tient pas : tous masqués, onglets en icônes seules (nom au survol / lecteur d'écran) */
.context-nav.labels-hidden .context-label {
  display: none !important;
}

.sub-context-nav {
  --chevron: 0.75rem;
  --chevron-stroke: 2px;
  display: flex;
  align-items: stretch;
  gap: 0.28rem;
  width: 100%;
  margin: 0;
  padding: 0.35rem 0.45rem;
  background: var(--color-bg-primary);
  border: none;
  border-radius: 0;
  box-sizing: border-box;
  overflow: visible;
}

.sub-context-btn {
  flex: 1;
  min-width: 0;
  position: relative;
  z-index: 1;
  margin: 0;
  padding: 0;
  /* Couleur de bordure du cadre → trait des chevrons */
  background: var(--color-border);
  border: none;
  font-size: clamp(0.6rem, 2.2vw, 0.68rem);
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.02em;
  line-height: 1.15;
  color: var(--color-text-muted);
  clip-path: polygon(
    0 50%,
    var(--chevron) 0,
    calc(100% - var(--chevron)) 0,
    100% 50%,
    calc(100% - var(--chevron)) 100%,
    var(--chevron) 100%
  );
  transition:
    color 0.15s ease,
    background 0.15s ease;
}

.sub-context-btn-inner {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  min-height: 2.6rem;
  min-width: 0;
  box-sizing: border-box;
  /* Marge latérale réduite au strict nécessaire : plus de place pour le libellé */
  padding: 0.55rem calc(0.15rem + var(--chevron));
  text-align: center;
  background: var(--color-tab-inactive);
  /* Même forme, légèrement rentrée = épaisseur du trait chevron */
  clip-path: polygon(
    var(--chevron-stroke) 50%,
    calc(var(--chevron) + var(--chevron-stroke) * 0.35) var(--chevron-stroke),
    calc(100% - var(--chevron) - var(--chevron-stroke) * 0.35) var(--chevron-stroke),
    calc(100% - var(--chevron-stroke)) 50%,
    calc(100% - var(--chevron) - var(--chevron-stroke) * 0.35) calc(100% - var(--chevron-stroke)),
    calc(var(--chevron) + var(--chevron-stroke) * 0.35) calc(100% - var(--chevron-stroke))
  );
}

.sub-context-btn-label {
  min-width: 0;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sub-context-btn.active {
  z-index: 3;
  background: var(--color-accent);
  color: var(--color-text-primary);
}

.sub-context-btn.active .sub-context-btn-inner {
  background: var(--color-bg-secondary);
}

.sub-context-btn:not(.active):active .sub-context-btn-inner {
  background: var(--color-bg-card);
}

.context-content {
  flex: 1;
  /* Haut réduit : le contenu reste proche des (sous-)onglets, pareil sur toutes les pages */
  padding: 0.5rem 1rem 1rem;
  background: var(--color-bg-primary);
}
</style>
