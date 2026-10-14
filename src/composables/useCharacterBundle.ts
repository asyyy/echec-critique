import { useCharacterStore, type SkillRank } from '@/stores/character'
import { useInventoryStore } from '@/stores/inventory'
import { useConditionsStore } from '@/stores/conditions'
import { useCombatStore } from '@/stores/combat'
import { useSpellsStore } from '@/stores/spells'
import type { CharacterBundle } from '@/utils/characterBundle'
import { ABILITIES, SKILLS, type Ability, type Skill } from '@/utils/dnd'

/** Lire / appliquer le personnage actif en entier (fiche, inventaire, états, attaques, sorts) */
export function useCharacterBundle() {
  const character = useCharacterStore()
  const inventory = useInventoryStore()
  const conditionsStore = useConditionsStore()
  const combat = useCombatStore()
  const spellsStore = useSpellsStore()

  function emptyBundle(): CharacterBundle {
    return {
      character: {
        name: '',
        level: 1,
        characterClass: '',
        species: '',
        abilityScores: Object.fromEntries(ABILITIES.map((a) => [a, 10])) as Record<Ability, number>,
        savingThrowProficiency: Object.fromEntries(ABILITIES.map((a) => [a, false])) as Record<
          Ability,
          boolean
        >,
        skillRank: Object.fromEntries(SKILLS.map((s) => [s, 'none'])) as Record<Skill, SkillRank>,
        hpCurrent: 10,
        hpMax: 10,
        hpTemp: 0,
        inspiration: 0,
        armorClassBase: 10,
        speedBase: 9,
      },
      inventory: [],
      attacks: [],
      spells: {
        spells: [],
        slots: Object.fromEntries(
          [1, 2, 3, 4, 5, 6, 7, 8, 9].map((l) => [String(l), { max: 0, used: 0 }]),
        ),
        concentrationSpellId: null,
        resources: [],
      },
    }
  }

  function collectBundle(): CharacterBundle {
    const snap = character.exportSnapshot()
    return {
      character: {
        name: snap.name,
        level: snap.level,
        characterClass: snap.characterClass,
        species: snap.species,
        abilityScores: snap.abilityScores,
        savingThrowProficiency: snap.savingThrowProficiency,
        skillRank: snap.skillRank,
        hpCurrent: snap.hpCurrent,
        hpMax: snap.hpMax,
        hpTemp: snap.hpTemp,
        inspiration: snap.inspiration,
        armorClassBase: snap.armorClassBase,
        speedBase: snap.speedBase,
        initiativeBonus: snap.initiativeBonus,
        deathSaveSuccesses: snap.deathSaveSuccesses,
        deathSaveFailures: snap.deathSaveFailures,
      },
      inventory: inventory.items.map((item) => ({
        ...item,
        modifiers: item.modifiers.map((m) => ({ ...m })),
        weaponDamage: item.weaponDamage.map((p) => ({ ...p })),
      })),
      categories: inventory.customCategories.map((c) => ({ ...c })),
      conditions: conditionsStore.conditions.map((c) => ({
        ...c,
        modifiers: c.modifiers.map((m) => ({ ...m })),
      })),
      savedConditions: conditionsStore.saved.map((c) => ({
        ...c,
        modifiers: c.modifiers.map((m) => ({ ...m })),
      })),
      attacks: combat.configs.map((cfg) => ({
        ...cfg,
        damageParts: cfg.damageParts.map((p) => ({ ...p })),
      })),
      spells: spellsStore.exportSnapshot(),
    }
  }

  function applyBundle(bundle: CharacterBundle) {
    character.applySnapshot({
      ...bundle.character,
      hpTempExpiresAt: null,
    })
    inventory.replaceAll(bundle.inventory, bundle.categories)
    conditionsStore.replaceAll(bundle.conditions, bundle.savedConditions)
    combat.replaceConfigs(bundle.attacks)
    combat.clearHistory()
    spellsStore.applySnapshot(bundle.spells)
  }

  return { emptyBundle, collectBundle, applyBundle }
}
