import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync(new URL('../src/character-sheet.js', import.meta.url), 'utf8');

function loadFunction(name, nextFunction, dependencies = {}) {
  const start = source.indexOf(`function ${name}(`);
  const nextMarkers = [`\nfunction ${nextFunction}(`, `\nasync function ${nextFunction}(`];
  const end = Math.min(...nextMarkers.map((marker) => {
    const index = source.indexOf(marker, start);
    return index === -1 ? Number.POSITIVE_INFINITY : index;
  }));
  assert.notEqual(start, -1, `Expected to find ${name} in character-sheet.js`);
  assert.notEqual(end, Number.POSITIVE_INFINITY, `Expected to find the end of ${name} in character-sheet.js`);
  const names = Object.keys(dependencies);
  const values = Object.values(dependencies);
  const extracted = source.slice(start, end);
  return new Function(...names, `${extracted}; return ${name};`)(...values);
}

const evaluateSafeMath = loadFunction('evaluateSafeMath', 'getSelectedWeaponDamageInfo');
const parseDiceAndModifiers = loadFunction('parseDiceAndModifiers', 'rollFormulaEffect');
const formatDiceNotation = loadFunction('formatDiceNotation', 'rollFormulaEffect');
const formatFormulaRollGroups = loadFunction('formatFormulaRollGroups', 'rollFormulaEffect');
const getSelectedWeaponDamageInfo = () => ({
  damageExpr: '3D10 + 56',
  weaponQuality: 12,
  criticalMultiplier: 2,
  totalFlatBonus: 56,
  finalDiceStr: '3D10',
  weaponName: 'Selected Blade'
});
const translateFormula = loadFunction('translateFormula', 'formulaCellHtml', {
  evaluateSafeMath,
  getSelectedWeaponDamageInfo
});
const getCharacterStatsMap = loadFunction('getCharacterStatsMap', 'getCustomRollVariableMap', {
  specialisationLevels: {
    Unspecialised: { touch: '0', potential: '0', ini: '0' },
    Novice: { touch: '+5', potential: '+5', ini: '+1' }
  },
  getSelectedWeaponDamageInfo
});
const formulaTables = {
  'Action Types': ['Name', 'Action Type', 'Description', 'Critical 1', 'White', 'Green', 'Yellow', 'Red', 'Natural Red', 'Critical 100'],
  Skills: ['Name', 'Skill Type', 'Stat', 'CS Level', 'Action Type', 'Focus Cost', 'Description', 'White', 'Green', 'Yellow', 'Red', 'Natural Red', 'Critical Red', 'Specialisation'],
  Spell: ['Name', 'Scell Value', 'Action Type', 'Mana Cost', 'Scells', 'Description', 'Intention', 'White', 'Green', 'Yellow', 'Red', 'Natural Red', 'Critical Red', 'Roll Stat', 'Specialisation'],
  Specialisations: ['Name', 'Actual LVL', 'Touch Bonus', 'Potential Bonus', 'Special Effect', 'Ini Bonus'],
  Weapons: ['Name', 'Description', 'Specialisation', 'Touch Stat', 'Touch Bonus', 'Damage Bonus Stat', 'Effective Range', 'Yellow Range', 'Red Range', 'Dice', 'Two handed?', 'Quality', 'Critical Multiplier'],
  Armor: ['Name', 'Physical Protection', 'Energy Protection', 'Quality', 'Rune Slots', 'Runes', 'Description'],
  Inventory: ['Qte', 'Name', 'Description', 'Localisation'],
  Relations: ['Name', 'Race', 'Genre', 'Age', 'Link', 'Relation Type', 'Description'],
  Monture: ['Name', 'Type', 'Speed', 'Armor', 'Notes'],
  'Note du joueur': ['Note'],
  'Unique Power': ['Name', 'Description', 'Cost']
};
const getSkillFocusCostValue = loadFunction('getSkillFocusCostValue', 'getCustomRollVariableMap', {
  quickAccessDependentFocusCost: null
});
const getCustomRollVariableMap = loadFunction('getCustomRollVariableMap', 'getFormulaReferenceGroups', {
  getCharacterStatsMap,
  getSkillFocusCostValue,
  quickAccessDependentFocusCost: null,
  tables: formulaTables,
  ACTION_TYPES_ROWS: [['Normal', 'Full']],
  parseDiceAndModifiers,
  translateFormula,
  getSelectedWeaponDamageInfo
});
const getSkillFocusCostOptions = loadFunction('getSkillFocusCostOptions', 'readOnlyCell');
const getFormulaReferenceGroups = loadFunction('getFormulaReferenceGroups', 'formulaReferencePopoverHtml', {
  getCustomRollVariableMap,
  tables: formulaTables
});
const getFormulaVariableMapForPath = loadFunction('getFormulaVariableMapForPath', 'formulaCellHtml', {
  getCustomRollVariableMap,
  quickAccessDependentFocusCost: 7
});
const formulaReferencePopoverHtml = loadFunction('formulaReferencePopoverHtml', 'translateFormula', {
  getFormulaReferenceGroups,
  esc: (value) => String(value ?? '')
});
const dependentSkillRollModalHtml = loadFunction('dependentSkillRollModalHtml', 'openAddManaPoolModal', {
  pendingDependentSkillRoll: {
    name: 'Dependent Skill',
    statIsDependent: true,
    focusCostIsDependent: true
  },
  stats: ['Fighting', 'Strength'],
  quickAccessDependentFocusCost: null,
  esc: (value) => String(value ?? '')
});

const formulaReferenceCharacter = {
  data: {
    stats: { Fighting: 30 },
    info: { Biography: 7 },
    tables: {
      ...Object.fromEntries(Object.entries(formulaTables)
        .filter(([tableName]) => tableName !== 'Action Types')
        .map(([tableName, headers]) => [tableName, [headers.map((header, index) => index === 0 ? `${tableName} Item` : `${tableName} ${header} value`)]])),
      Skills: [
        ['Acrobaties', 'Hors-Combat', 'Agility', '', '', '', 'Balance', '', '(Fgt/10)D6'],
        ['Selected Skill', 'Combat', 'Fighting', '2', 'Normal', '3', 'A selected skill', '', '1D6 + Fighting']
      ],
      Specialisations: [['Fire Magic', 'Novice', '+5', '+10', '', '+1']],
      Weapons: [
        { Name: 'Longsword', Quality: '12', Dice: '1D8' },
        { Name: 'Selected Blade', Quality: '18', Dice: '2D10', 'Critical Multiplier': '2', 'Damage Bonus Stat': 'Strength' }
      ],
      Spell: [
        ['Counter Spell', '2', 'Normal', '10', '2 x Spirit'],
        ['Selected Spell', '7', 'Free', '3', '1 x Fire', 'Burning', 'Damage', 'Fail', '1D8 + MP']
      ]
    },
    quickAccessWeaponSlot: 1,
    quickAccessSkillSlot: 1,
    quickAccessSpellSlot: 1,
    currency: { boreal: '4' },
    customManaPools: [{ name: 'Focus Pool', value: '5' }],
    customRolls: [{ name: 'Fireball', formula: '1D6 + Fighting' }],
    powerThemes: [{ title: 'Flame', description: 'Fire powers', powers: [{ name: 'Flame Burst', description: 'Burn', damage: '1D6 + Fighting', cost: '2', charges: '3' }] }]
  }
};
const formulaReferenceGroups = getFormulaReferenceGroups(formulaReferenceCharacter);
const formulaReferenceEntries = formulaReferenceGroups.flatMap(({ entries }) => entries);
const formulaReferenceNames = new Set(formulaReferenceEntries.map(({ name }) => name));
assert.ok(formulaReferenceGroups.some(({ title }) => title === 'Skills'));
assert.ok(formulaReferenceGroups.some(({ title }) => title === 'Spell'));
assert.ok(formulaReferenceGroups.some(({ title }) => title === 'Action Types'));
assert.ok(formulaReferenceGroups.some(({ title }) => title === 'Armor'));
assert.ok(formulaReferenceGroups.some(({ title }) => title === 'Inventory'));
assert.ok(formulaReferenceGroups.some(({ title }) => title === 'Relations'));
assert.ok(formulaReferenceGroups.some(({ title }) => title === 'Monture'));
assert.ok(formulaReferenceGroups.some(({ title }) => title === 'Note du joueur'));
assert.ok(formulaReferenceNames.has('Skills_Acrobaties_Green'));
assert.ok(formulaReferenceNames.has('Skills_Acrobaties_Focus_Cost'));
assert.ok(formulaReferenceNames.has('Specialisations_Fire_Magic_Potential_Bonus'));
assert.ok(formulaReferenceNames.has('Currency_boreal'));
assert.ok(formulaReferenceNames.has('Mana_Pools_Focus_Pool_value'));
assert.ok(formulaReferenceNames.has('Custom_Roll_Fireball_formula'));
assert.ok(formulaReferenceNames.has('Unique_Power_Flame_Flame_Burst_damage'));
assert.ok(formulaReferenceNames.has('Selected_Weapon_Name'));
assert.ok(formulaReferenceNames.has('Selected_Weapon_Quality'));
assert.ok(formulaReferenceNames.has('Selected_Weapon_total_Flat_Bonus'));
assert.ok(formulaReferenceNames.has('Selected_Skill_Name'));
assert.ok(formulaReferenceNames.has('Selected_Skill_Green'));
assert.ok(formulaReferenceNames.has('Selected_Skill_Focus_Cost'));
assert.ok(formulaReferenceNames.has('Selected_Spell_Name'));
assert.ok(formulaReferenceNames.has('Selected_Spell_Green'));
const selectedValues = Object.fromEntries(formulaReferenceEntries.map(({ name, value }) => [name, value]));
assert.strictEqual(selectedValues.Selected_Weapon_Name, 'Selected Blade');
assert.strictEqual(selectedValues.Selected_Weapon_Quality, '18');
assert.strictEqual(selectedValues.Selected_Skill_Name, 'Selected Skill');
assert.strictEqual(selectedValues.Selected_Spell_Name, 'Selected Spell');
assert.strictEqual(selectedValues.Selected_Skill_Focus_Cost, '3');
assert.strictEqual(getCustomRollVariableMap(formulaReferenceCharacter).focus_cost, '3');
assert.strictEqual(getCustomRollVariableMap(formulaReferenceCharacter, null, 0).focus_cost, '--');
assert.strictEqual(selectedValues.Skills_Acrobaties_Focus_Cost, '--');
assert.strictEqual(selectedValues.Selected_Skill_Green, '1D6 + 30');
assert.strictEqual(selectedValues.Selected_Spell_Green, '1D8 + 24');
assert.strictEqual(translateFormula('Selected_Weapon_Dice', getCustomRollVariableMap(formulaReferenceCharacter)), '2D10');
assert.strictEqual(
  translateFormula('Skills_Acrobaties_Green', getCustomRollVariableMap(formulaReferenceCharacter)),
  '(3D6)'
);
assert.deepStrictEqual(getSkillFocusCostOptions(), ['--', 'Depend', ...Array.from({ length: 50 }, (_, index) => String(index + 1))]);

const dependentFocusCostCharacter = {
  data: {
    stats: { Fighting: 30 },
    quickAccessSkillSlot: 0,
    tables: {
      Skills: [
        ['Dependent Skill', 'Combat', 'Fighting', '', 'Normal', 'Depend', '', '', '1D6 + Skills_Dependent_Skill_Focus_Cost'],
        ['Fixed Skill', 'Combat', 'Fighting', '', 'Normal', '4', '', '', '1D6 + focus_cost']
      ]
    }
  }
};
const dependentFocusVariables = getCustomRollVariableMap(dependentFocusCostCharacter, 7);
assert.strictEqual(dependentFocusVariables.Selected_Skill_Focus_Cost, '7');
assert.strictEqual(dependentFocusVariables.Skills_Dependent_Skill_Focus_Cost, '7');
assert.strictEqual(dependentFocusVariables.focus_cost, 7);
assert.strictEqual(
  getFormulaVariableMapForPath(dependentFocusCostCharacter, 'tables.Skills.0.8').focus_cost,
  7
);
assert.strictEqual(
  getFormulaVariableMapForPath(dependentFocusCostCharacter, 'tables.Skills.1.8').focus_cost,
  '4'
);
assert.strictEqual(getSkillFocusCostValue(dependentFocusCostCharacter, 0, 7), 7);
assert.strictEqual(getSkillFocusCostValue(dependentFocusCostCharacter, 1, 7), '4');
assert.strictEqual(
  translateFormula('1D6 + focus_cost', getFormulaVariableMapForPath(dependentFocusCostCharacter, 'tables.Skills.1.8')),
  '1D6 + 4'
);
assert.strictEqual(
  translateFormula('1D6 + focus_cost', dependentFocusVariables),
  '1D6 + 7'
);
assert.match(formulaReferencePopoverHtml(formulaReferenceCharacter), /aria-controls="formula-reference-popover"/);
assert.match(formulaReferencePopoverHtml(formulaReferenceCharacter), /Toutes les valeurs appelables/);
assert.match(formulaReferencePopoverHtml(formulaReferenceCharacter), /formula-reference-search/);
assert.match(dependentSkillRollModalHtml(), /id="dependent-skill-roll-stat"/);
assert.match(dependentSkillRollModalHtml(), /id="dependent-skill-roll-focus-cost"/);
const quickAccessRollHandler = source.slice(
  source.indexOf("app.querySelectorAll('[data-qa-universal-roll]')"),
  source.indexOf("app.querySelector('.qa-vs-intensity')?.addEventListener('input'")
);
assert.match(quickAccessRollHandler, /const focusCostIsDependent = btn\.dataset\.focusCostDependent === 'true'/);
const quickAccessSkillMarkup = source.slice(
  source.indexOf('const skillsTableHtml = `'),
  source.indexOf('let selectedSpellIdx', source.indexOf('const skillsTableHtml = `'))
);
assert.equal(
  (quickAccessSkillMarkup.match(/data-focus-cost-dependent="\$\{isDependentFocusCost\}"[^>]+data-target-tier="(?:standard|green|yellow|red)"/g) || []).length,
  4,
  'All four skill check buttons should request dependent focus cost'
);
assert.doesNotMatch(quickAccessSkillMarkup, /rollable-qa-effect[^>]*data-focus-cost-dependent/);
const quickAccessSkillEffectHandler = source.slice(
  source.indexOf("app.querySelectorAll('.rollable-qa-effect')"),
  source.indexOf("app.querySelector('#font-decrease-btn')")
);
assert.doesNotMatch(quickAccessSkillEffectHandler, /pendingDependentSkillRoll\s*=/);
assert.match(quickAccessSkillEffectHandler, /await rollFormulaEffect/);
assert.match(quickAccessSkillEffectHandler, /quickAccessDependentFocusCost = null/);

const specialisationStats = getCharacterStatsMap({
  data: {
    tables: {
      Specialisations: [
        ['Fire Magic', 'Novice', '+5', '+10', '', '+1'],
        { Name: 'Named Spec', 'Actual LVL': 'Novice', 'Touch Bonus': '+7', 'Potential Bonus': '+12', 'Ini Bonus': '+2' }
      ]
    }
  }
});
assert.strictEqual(translateFormula('1D10 + Fire Magic Potential Bonus', specialisationStats), '1D10 + 10');
assert.strictEqual(translateFormula('Fire Magic Touch Bonus + Named Spec Potential Bonus', specialisationStats), '17');
assert.strictEqual(specialisationStats['FireMagicPB'], 10);
const formulaCellHtml = loadFunction('formulaCellHtml', 'editable', {
  translateFormula,
  getCustomRollVariableMap: () => specialisationStats,
  getFormulaVariableMapForPath: () => specialisationStats,
  quickAccessDependentFocusCost: null,
  esc: (value) => String(value ?? '')
});
assert.match(
  formulaCellHtml('tables.Spell.0.7', '1D10 + Fire Magic Potential Bonus', {}),
  /<span class="formula-result-text[^>]*>1D10 \+ 10<\/span>/
);
const powerDamageCell = formulaCellHtml('powerThemes.0.powers.0.damage', '1D6 + Fire Magic Potential Bonus', {});
assert.match(powerDamageCell, /formula-autocomplete-input/);
assert.match(powerDamageCell, /<span class="formula-result-text[^>]*>1D6 \+ 10<\/span>/);
const powerDamageFormula = parseDiceAndModifiers(translateFormula('1D6 + Fire Magic Potential Bonus', specialisationStats));
assert.strictEqual(powerDamageFormula.hasDice, true);
assert.strictEqual(powerDamageFormula.flatBonus, 10);

const formula = 'WeaponDamage("Longsword") + (Fgt/10)D10 + (Psy)';
const translated = translateFormula(formula, {
  Fighting: 30,
  Fgt: 30,
  Psyche: 32,
  Psy: 32,
  WeaponDamage: '3D10 + 56',
  _character: {}
});

assert.strictEqual(translated, '3D10 + 56 + (3D10) + 32');

assert.strictEqual(translateFormula('WeaponDamage()', {
  WeaponDamage: '3D10 + 58',
  _character: {}
}), '3D10 + 58');

assert.strictEqual(translateFormula('(WeaponDamage()) * 2', {
  WeaponDamage: '3D10 + 58',
  _character: {}
}), '(3D10 + 58) * 2');

const parsed = parseDiceAndModifiers(translated);
assert.strictEqual(parsed.hasDice, true);
assert.deepStrictEqual(parsed.diceGroups.map(({ count, sides, sign, coefficient }) => ({ count, sides, sign, coefficient })), [
  { count: 3, sides: 10, sign: 1, coefficient: 1 },
  { count: 3, sides: 10, sign: 1, coefficient: 1 }
]);
assert.strictEqual(parsed.flatBonus, 88);

assert.strictEqual(evaluateSafeMath('5 / 2'), 2);
assert.strictEqual(evaluateSafeMath('5 / 2 * 2'), 4);
assert.strictEqual(evaluateSafeMath('5 * 2 / 3'), 3);
assert.strictEqual(evaluateSafeMath('-5 / 2'), -3);
assert.strictEqual(parseDiceAndModifiers('3D10 + 5 / 2 * 2').flatBonus, 4);

const independentlyScaled = parseDiceAndModifiers('(3D10 + 56) * 2 + (3D10) * 0.5 + 32');
assert.deepStrictEqual(independentlyScaled.diceGroups.map(({ count, coefficient }) => ({ count, coefficient })), [
  { count: 3, coefficient: 2 },
  { count: 3, coefficient: 0.5 }
]);
assert.strictEqual(independentlyScaled.flatBonus, 144);

const precedence = parseDiceAndModifiers('3D10 + 4 * 5 - 6 / 2');
assert.strictEqual(precedence.flatBonus, 17);

const repeatedMultiplier = parseDiceAndModifiers('1D2 * 1.5 * 2').diceGroups[0];
assert.deepStrictEqual(repeatedMultiplier.multiplierSteps, [
  { operator: '*', value: 1.5 },
  { operator: '*', value: 2 }
]);
assert.strictEqual(repeatedMultiplier.multiplierSteps.reduce(
  (total, step) => step.operator === '*' ? Math.floor(total * step.value) : Math.floor(total / step.value),
  1
), 2);

const scaledRoll = parseDiceAndModifiers('(3D10 + 56) * 1.5 + 2D6 / 2');
assert.strictEqual(formatDiceNotation(scaledRoll.diceGroups, scaledRoll.flatBonus, false), '3d10 + 2d6 + 84');
assert.strictEqual(formatDiceNotation(scaledRoll.diceGroups, scaledRoll.flatBonus, true), '3d10 * 1.5 + 2d6 / 2 + 84');

const groupedRollDisplay = formatFormulaRollGroups([
  { count: 3, sides: 10, rolls: [4, 7, 3], sign: 1, multiplierSteps: [{ operator: '*', value: 1.6 }] },
  { count: 5, sides: 10, rolls: [10, 6, 8, 4, 4], sign: 1, multiplierSteps: [{ operator: '*', value: 1.6 }] }
]);
assert.strictEqual(groupedRollDisplay, '3D10 (4, 7, 3) * 1.6 + 5D10 (10, 6, 8, 4, 4) * 1.6');

console.log('✅ Formula expression preservation and arithmetic tests passed.');
