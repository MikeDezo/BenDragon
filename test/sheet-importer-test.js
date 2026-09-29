import assert from 'node:assert';
import fs from 'node:fs';
import * as XLSX from 'xlsx';
import {
  convertGoogleSheetUrlToXlsx,
  parseWorkbookToCharacterData,
  mergeCharacterData,
  readWorkbookFromData,
  normalizeKey,
  isBlank
} from '../src/sheet-importer.js';

console.log('🧪 Starting Sheet Importer Test Suite...');

// --- Test 1: URL Conversion ---
console.log('1. Testing Google Sheet URL conversion...');
const gsheetUrls = [
  {
    input: 'https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/edit#gid=0',
    expected: 'https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/export?format=xlsx'
  },
  {
    input: 'https://docs.google.com/spreadsheets/d/2AbCdEfGhIjKlMnOpQrStUvWxYz/edit?usp=sharing',
    expected: 'https://docs.google.com/spreadsheets/d/2AbCdEfGhIjKlMnOpQrStUvWxYz/export?format=xlsx'
  },
  {
    input: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSamplePubSheetId/pubhtml',
    expected: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSamplePubSheetId/pub?output=xlsx'
  }
];

gsheetUrls.forEach(({ input, expected }) => {
  const result = convertGoogleSheetUrlToXlsx(input);
  assert.strictEqual(result, expected, `Failed converting ${input}`);
});
console.log('✅ URL conversion tests passed.');

// --- Test 2: Parsing Fiche de personnage.xlsx ---
console.log('2. Testing workbook parsing from Fiche de personnage.xlsx...');
const fileBuf = fs.readFileSync('Fiche de personnage.xlsx');
const wb = readWorkbookFromData(fileBuf);
assert(wb && wb.SheetNames.length > 0, 'Workbook failed to load');

const parsed = parseWorkbookToCharacterData(wb);
assert(parsed, 'parseWorkbookToCharacterData returned empty');
assert(parsed.stats, 'Parsed stats missing');
assert.strictEqual(parsed.stats.Fighting, '6', 'Fighting stat should be 6');
assert.strictEqual(parsed.stats.Strength, '6', 'Strength stat should be 6');
assert.strictEqual(parsed.stats.Agility, '6', 'Agility stat should be 6');
assert.strictEqual(parsed.stats.Speed, '6', 'Speed stat should be 6');
assert.strictEqual(parsed.tables && typeof parsed.tables === 'object', true, 'Tables missing');
assert(Array.isArray(parsed.tables.Spell), 'Spell table should be an array');
assert(parsed.tables.Spell.length > 0, 'Should have parsed spells');

const counterSpell = parsed.tables.Spell.find((s) => s[0] === 'Counter Spell');
assert(counterSpell, 'Counter Spell should be present in parsed spells');
assert.strictEqual(counterSpell[1], '2', 'Counter Spell scell value');
assert.strictEqual(counterSpell[3], '10', 'Counter Spell mana cost');
console.log('✅ Workbook parsing tests passed.');

// --- Test 3: Blank filling on Skills & Spells ---
console.log('3. Testing skill & spell blank-filling logic...');

const baseCharacter = {
  name: 'Valerius',
  data: {
    image: 'https://example.com/valerius.png',
    imageSettings: { width: 320, height: 480 },
    info: {
      playerName: 'Alice',
      name: 'Valerius',
      gender: '', // blank: should be filled
      age: '28' // filled: should not be overwritten
    },
    stats: {
      Fighting: '12',
      Strength: '10',
      Agility: '8',
      Luck: '' // blank: should be filled
    },
    tables: {
      Skills: [
        // Acrobaties with existing CS Level 3, but blank description and rolls
        ['Acrobaties', 'Hors-Combat', 'Agility', '3', '', '', '', '', '', '', '', '', ''],
        // Custom unique skill
        ['Alchimie Royale', 'Hors-Combat', 'Intelligence', '2', 'Normal', '', 'Créer des potions rares', '', '', '', '', '', '']
      ],
      Spell: [
        // Counter Spell with custom user note description and existing mana cost 15
        ['Counter Spell', '', 'Normal', '15', '', 'Ma description personnalisée', '', '', '', '', '', '', '']
      ],
      Weapons: [
        ['Épée bâtarde', 'Fighting', 'Strength', 'Melee', '', '', '1D10', '', '10', '', false, '2', '']
      ]
    }
  }
};

const incomingData = {
  name: 'Valerius Le Brave',
  info: {
    playerName: 'Alice Imported',
    gender: 'Masculin',
    age: '99', // Should not overwrite '28'
    origins: 'Borealis',
    image: 'https://should-not-be-inserted.com/evil.png' // Must be skipped!
  },
  stats: {
    Fighting: '6', // Should not overwrite '12'
    Luck: '5' // Should fill ''
  },
  tables: {
    Skills: [
      // Acrobaties in incoming has level '1' and full descriptions
      [
        'Acrobaties',
        'Hors-Combat',
        'Agility',
        '1',
        'Free',
        '2',
        'Garder l\'équilibre et faire des roulades',
        'Échec',
        'Réussite',
        'Réussite',
        'Critique',
        'Rouge Nat',
        'Critique Max'
      ],
      // New skill in incoming
      [
        'Crochetage',
        'Hors-Combat',
        'Agility',
        '1',
        'Normal',
        '',
        'Ouvrir des serrures',
        '',
        '',
        '',
        '',
        '',
        ''
      ]
    ],
    Spell: [
      [
        'Counter Spell',
        '2',
        'Normal',
        '10',
        '2 x Spirit',
        'Description par défaut de base',
        'Intention de défense',
        'Fail',
        '0D6 + 6',
        '0D6 + 7',
        '0D6 + 9',
        '0D6 + 12',
        '0D6 + 18'
      ],
      [
        'Boule de Feu',
        '3',
        'Normal',
        '25',
        'Feu x 3',
        'Lance une explosion de feu',
        'Dégâts de zone',
        'Fail',
        '3D6',
        '4D6',
        '5D6',
        '6D6',
        '8D6'
      ]
    ]
  }
};

const merged = mergeCharacterData(baseCharacter, incomingData, { fillBlanksOnly: true });

// Check image was skipped
assert.strictEqual(merged.data.image, 'https://example.com/valerius.png', 'Image should NOT be overwritten');

// Check Info fields
assert.strictEqual(merged.data.info.gender, 'Masculin', 'Blank gender should be filled');
assert.strictEqual(merged.data.info.age, '28', 'Existing age 28 should be preserved');
assert.strictEqual(merged.data.info.origins, 'Borealis', 'Blank origins should be filled');

// Check Stats
assert.strictEqual(merged.data.stats.Fighting, '12', 'Existing Fighting 12 should be preserved');
assert.strictEqual(merged.data.stats.Luck, '5', 'Blank Luck should be filled');

// Check Skills
const acro = merged.data.tables.Skills.find((s) => s[0] === 'Acrobaties');
assert(acro, 'Acrobaties skill missing');
assert.strictEqual(acro[3], '3', 'Existing CS Level 3 must NOT be overwritten by incoming 1');
assert.strictEqual(acro[4], 'Free', 'Blank Action Type was filled');
assert.strictEqual(acro[5], '2', 'Blank Focus Cost was filled');
assert.strictEqual(acro[6], 'Garder l\'équilibre et faire des roulades', 'Blank description was filled');
assert.strictEqual(acro[7], 'Échec', 'Blank roll was filled');

const alchemy = merged.data.tables.Skills.find((s) => s[0] === 'Alchimie Royale');
assert(alchemy, 'Custom skill Alchimie Royale should be preserved');

const crochetage = merged.data.tables.Skills.find((s) => s[0] === 'Crochetage');
assert(crochetage, 'New skill Crochetage should be added');
assert.strictEqual(crochetage[6], 'Ouvrir des serrures', 'Crochetage description');

// Check Spells
const cs = merged.data.tables.Spell.find((s) => s[0] === 'Counter Spell');
assert(cs, 'Counter Spell missing');
assert.strictEqual(cs[1], '2', 'Blank Scell Value filled');
assert.strictEqual(cs[3], '15', 'Existing Mana Cost 15 must NOT be overwritten by incoming 10');
assert.strictEqual(cs[5], 'Ma description personnalisée', 'Existing description must NOT be overwritten');
assert.strictEqual(cs[6], 'Intention de défense', 'Blank Intention was filled');
assert.strictEqual(cs[7], 'Fail', 'Blank White roll was filled');
assert.strictEqual(cs[8], '0D6 + 6', 'Blank Green roll was filled');

const fireball = merged.data.tables.Spell.find((s) => s[0] === 'Boule de Feu');
assert(fireball, 'New spell Boule de Feu should be added');
assert.strictEqual(fireball[3], '25', 'Boule de Feu mana cost');

console.log('✅ Skill & spell blank-filling tests passed.');

console.log('\n🎉 ALL SHEET IMPORTER TESTS PASSED SUCCESSFULLY!');
