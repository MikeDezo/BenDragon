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
const getSelectedWeaponDamageInfo = () => ({
  damageExpr: '3D10 + 56',
  weaponQuality: 12,
  criticalMultiplier: 2
});
const translateFormula = loadFunction('translateFormula', 'formulaCellHtml', {
  evaluateSafeMath,
  getSelectedWeaponDamageInfo
});

const formula = 'WeaponDamage("Longsword") + (Fgt/10)D10 + (Psy)';
const translated = translateFormula(formula, {
  Fighting: 30,
  Fgt: 30,
  Psyche: 32,
  Psy: 32,
  WeaponDamage: '3D10 + 56',
  _character: {}
});

assert.strictEqual(translated, '(3D10 + 56) + (3D10) + 32');

const parsed = parseDiceAndModifiers(translated);
assert.strictEqual(parsed.hasDice, true);
assert.deepStrictEqual(parsed.diceGroups.map(({ count, sides, sign, coefficient }) => ({ count, sides, sign, coefficient })), [
  { count: 3, sides: 10, sign: 1, coefficient: 1 },
  { count: 3, sides: 10, sign: 1, coefficient: 1 }
]);
assert.strictEqual(parsed.flatBonus, 88);

const independentlyScaled = parseDiceAndModifiers('(3D10 + 56) * 2 + (3D10) * 0.5 + 32');
assert.deepStrictEqual(independentlyScaled.diceGroups.map(({ count, coefficient }) => ({ count, coefficient })), [
  { count: 3, coefficient: 2 },
  { count: 3, coefficient: 0.5 }
]);
assert.strictEqual(independentlyScaled.flatBonus, 144);

const precedence = parseDiceAndModifiers('3D10 + 4 * 5 - 6 / 2');
assert.strictEqual(precedence.flatBonus, 17);

console.log('✅ Formula expression preservation and arithmetic tests passed.');
