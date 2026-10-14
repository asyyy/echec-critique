import type { CharacterBundle, CharacterSnapshot } from '@/utils/characterBundle'
import type { EquipmentItem, Modifier } from '@/stores/inventory'
import type { ActiveCondition } from '@/stores/conditions'
import { createEmptySpell, type SpellsSnapshot } from '@/stores/spells'
import {
  createEmptyAttackConfig,
  createEmptyDamagePart,
  createEmptyWeaponDamage,
  type DamageType,
} from '@/utils/combatTypes'
import { ABILITIES, SKILLS, type Ability, type Skill } from '@/utils/dnd'
import type { SkillRank } from '@/stores/character'
import type { AppLocale } from '@/i18n'

/**
 * Personnages de démonstration (onglet Débug) : chacun met en avant un groupe de fonctionnalités.
 * Les noms d'objets / sorts suivent la langue active au moment de la création.
 */

export type DemoId = 'fighter' | 'wizard' | 'dying'
export const DEMO_IDS: DemoId[] = ['fighter', 'wizard', 'dying']

type Pick2 = (fr: string, en: string) => string

function baseCharacter(partial: Partial<CharacterSnapshot>): CharacterSnapshot {
  return {
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
    initiativeBonus: 0,
    deathSaveSuccesses: 0,
    deathSaveFailures: 0,
    ...partial,
  }
}

function saves(...abilities: Ability[]): Record<Ability, boolean> {
  return Object.fromEntries(ABILITIES.map((a) => [a, abilities.includes(a)])) as Record<
    Ability,
    boolean
  >
}

function skills(ranks: Partial<Record<Skill, SkillRank>>): Record<Skill, SkillRank> {
  return Object.fromEntries(SKILLS.map((s) => [s, ranks[s] ?? 'none'])) as Record<Skill, SkillRank>
}

function item(
  id: number,
  name: string,
  category: string,
  options: {
    description?: string
    modifiers?: Modifier[]
    damage?: [number, number, DamageType][]
    equipped?: boolean
  } = {},
): EquipmentItem {
  return {
    id: `eq-${id}`,
    name,
    category,
    description: options.description ?? '',
    modifiers: options.modifiers ?? [],
    weaponDamage: (options.damage ?? []).map(([diceCount, diceFaces, damageType]) =>
      createEmptyWeaponDamage({ label: '', diceCount, diceFaces, damageType }),
    ),
    equipped: options.equipped ?? false,
  }
}

function condition(
  partial: Omit<ActiveCondition, 'id' | 'level' | 'modifiers' | 'name'> & Partial<ActiveCondition>,
): ActiveCondition {
  return {
    id: `st-demo-${Math.random().toString(36).slice(2, 8)}`,
    name: '',
    level: 1,
    modifiers: [],
    ...partial,
  }
}

function emptySpells(): SpellsSnapshot {
  return {
    spells: [],
    slots: Object.fromEntries(
      [1, 2, 3, 4, 5, 6, 7, 8, 9].map((l) => [String(l), { max: 0, used: 0 }]),
    ),
    concentrationSpellId: null,
    resources: [],
  }
}

/** Guerrière : équipement, bonus d'objets, catégorie perso, attaques multiples, buffs et debuffs */
function fighter(L: Pick2): CharacterBundle {
  const sword = item(1, L('Épée longue +1', 'Longsword +1'), 'arme', {
    modifiers: [
      { type: 'attaque', value: 1 },
      { type: 'degats', value: 1 },
    ],
    damage: [[1, 8, 'tranchant']],
    equipped: true,
  })
  const bow = item(2, L('Arc long', 'Longbow'), 'arme', { damage: [[1, 8, 'perforant']] })
  return {
    character: baseCharacter({
      name: L('Brunhilde (démo)', 'Brunhilde (demo)'),
      level: 5,
      characterClass: L('Guerrière', 'Fighter'),
      species: L('Naine', 'Dwarf'),
      abilityScores: { str: 16, dex: 12, con: 15, int: 8, wis: 13, cha: 10 },
      savingThrowProficiency: saves('str', 'con'),
      skillRank: skills({
        athletics: 'expertise',
        perception: 'proficient',
        intimidation: 'proficient',
      }),
      hpCurrent: 38,
      hpMax: 44,
      hpTemp: 5,
      inspiration: 1,
      speedBase: 7.5,
    }),
    inventory: [
      sword,
      bow,
      item(3, L('Cotte de mailles', 'Chain mail'), 'armure', {
        modifiers: [{ type: 'ca', value: 6 }],
        equipped: true,
      }),
      item(4, L('Bouclier', 'Shield'), 'bouclier', {
        modifiers: [{ type: 'ca', value: 2 }],
        equipped: true,
      }),
      item(5, L('Anneau de protection', 'Ring of protection'), 'accessoire', {
        modifiers: [
          { type: 'ca', value: 1 },
          { type: 'sauvegardes', value: 1 },
        ],
        equipped: true,
      }),
      item(6, L('Ceinturon de force', 'Belt of strength'), 'accessoire', {
        modifiers: [{ type: 'force', value: 2 }],
      }),
      item(7, L('Potion de soins', 'Potion of healing'), 'cat-demo-potions', {
        description: '2d4 + 2',
      }),
      item(8, L('Potion de résistance au feu', 'Potion of fire resistance'), 'cat-demo-potions'),
      item(9, L('Corde de chanvre (15 m)', 'Hempen rope (50 ft)'), 'autre'),
    ],
    categories: [{ id: 'cat-demo-potions', name: L('Potions', 'Potions') }],
    attacks: [
      createEmptyAttackConfig({
        name: sword.name,
        ability: 'str',
        attackCount: 2,
        weaponItemId: sword.id,
        damageParts: [createEmptyDamagePart({ label: '', diceCount: 1, diceFaces: 8 })],
      }),
      createEmptyAttackConfig({
        name: bow.name,
        ability: 'dex',
        weaponItemId: bow.id,
        damageParts: [
          createEmptyDamagePart({ label: '', diceCount: 1, diceFaces: 8, damageType: 'perforant' }),
        ],
      }),
    ],
    conditions: [
      condition({ preset: 'benediction', kind: 'buff', source: 'sort' }),
      condition({ preset: 'bouclierFoi', kind: 'buff', source: 'allie' }),
      condition({
        preset: null,
        name: L('Cri de guerre', 'Battle cry'),
        kind: 'buff',
        source: 'allie',
        modifiers: [
          { type: 'attaque', value: 1 },
          { type: 'degats', value: 2 },
        ],
      }),
      condition({ preset: 'empoisonne', kind: 'debuff', source: 'ennemi' }),
    ],
    savedConditions: [
      {
        id: 'sv-demo-cri',
        name: L('Cri de guerre', 'Battle cry'),
        kind: 'buff',
        source: 'allie',
        modifiers: [
          { type: 'attaque', value: 1 },
          { type: 'degats', value: 2 },
        ],
      },
      {
        id: 'sv-demo-inspiration',
        name: L('Inspiration bardique', 'Bardic inspiration'),
        kind: 'buff',
        source: 'allie',
        modifiers: [],
      },
    ],
    spells: emptySpells(),
  }
}

/** Magicienne : sorts, emplacements, concentration en cours, ressources, Épuisement */
function wizard(L: Pick2): CharacterBundle {
  const web = createEmptySpell({
    name: L('Toile d’araignée', 'Web'),
    level: 2,
    concentration: true,
    durationRounds: 600,
  })
  const staff = item(1, L('Bâton', 'Quarterstaff'), 'arme', {
    damage: [[1, 6, 'contondant']],
    equipped: true,
  })
  return {
    character: baseCharacter({
      name: L('Ysolde (démo)', 'Ysolde (demo)'),
      level: 5,
      characterClass: L('Magicienne', 'Wizard'),
      species: L('Elfe', 'Elf'),
      abilityScores: { str: 8, dex: 14, con: 13, int: 17, wis: 12, cha: 10 },
      savingThrowProficiency: saves('int', 'wis'),
      skillRank: skills({
        arcana: 'expertise',
        history: 'proficient',
        investigation: 'proficient',
      }),
      hpCurrent: 19,
      hpMax: 32,
    }),
    inventory: [
      staff,
      item(2, L('Grimoire', 'Spellbook'), 'autre', { equipped: true }),
      item(3, L('Bandeau d’intellect', 'Headband of intellect'), 'accessoire', {
        modifiers: [{ type: 'intelligence', value: 2 }],
        equipped: true,
      }),
    ],
    attacks: [
      createEmptyAttackConfig({
        name: staff.name,
        ability: 'str',
        weaponItemId: staff.id,
        damageParts: [
          createEmptyDamagePart({
            label: '',
            diceCount: 1,
            diceFaces: 6,
            damageType: 'contondant',
          }),
        ],
      }),
    ],
    conditions: [
      condition({
        preset: null,
        name: L('Armure du mage', 'Mage armor'),
        kind: 'buff',
        source: 'sort',
        modifiers: [{ type: 'ca', value: 3 }],
      }),
      condition({ preset: 'epuisement', kind: 'debuff', source: 'autre', level: 1 }),
    ],
    spells: {
      spells: [
        createEmptySpell({
          name: L('Trait de feu', 'Fire bolt'),
          level: 0,
          consumesSlot: false,
          diceCount: 2,
          diceFaces: 10,
        }),
        createEmptySpell({
          name: L('Projectile magique', 'Magic missile'),
          level: 1,
          diceCount: 3,
          diceFaces: 4,
          flatBonus: 3,
        }),
        createEmptySpell({ name: L('Bouclier', 'Shield'), level: 1 }),
        web,
        createEmptySpell({
          name: L('Boule de feu', 'Fireball'),
          level: 3,
          diceCount: 8,
          diceFaces: 6,
        }),
      ],
      slots: {
        ...emptySpells().slots,
        '1': { max: 4, used: 1 },
        '2': { max: 3, used: 1 },
        '3': { max: 2, used: 0 },
      },
      concentrationSpellId: web.id,
      concentrationRoundsLeft: 594,
      resources: [
        {
          id: 'res-demo-arcane',
          label: L('Restauration arcanique', 'Arcane recovery'),
          current: 1,
          max: 1,
        },
      ],
    },
  }
}

/** Roublard à terre : jets contre la mort (2 échecs → commentaire), conditions qui bloquent la vitesse */
function dying(L: Pick2): CharacterBundle {
  return {
    character: baseCharacter({
      name: L('Pip (démo)', 'Pip (demo)'),
      level: 3,
      characterClass: L('Roublard', 'Rogue'),
      species: L('Halfelin', 'Halfling'),
      abilityScores: { str: 8, dex: 17, con: 12, int: 13, wis: 10, cha: 14 },
      savingThrowProficiency: saves('dex', 'int'),
      skillRank: skills({
        stealth: 'expertise',
        sleightOfHand: 'expertise',
        acrobatics: 'proficient',
      }),
      hpCurrent: 0,
      hpMax: 21,
      armorClassBase: 14,
      deathSaveSuccesses: 1,
      deathSaveFailures: 2,
    }),
    inventory: [
      item(1, L('Dague', 'Dagger'), 'arme', { damage: [[1, 4, 'perforant']], equipped: true }),
      item(2, L('Outils de voleur', 'Thieves’ tools'), 'autre'),
    ],
    attacks: [],
    conditions: [
      condition({ preset: 'inconscient', kind: 'debuff', source: 'ennemi' }),
      condition({ preset: 'empoisonne', kind: 'debuff', source: 'ennemi' }),
    ],
    spells: emptySpells(),
  }
}

export function buildDemoCharacter(id: DemoId, locale: AppLocale): CharacterBundle {
  const L: Pick2 = (fr, en) => (locale === 'fr' ? fr : en)
  if (id === 'fighter') return fighter(L)
  if (id === 'wizard') return wizard(L)
  return dying(L)
}
