import assert from 'node:assert';
import fs from 'node:fs';

console.log('🧪 Starting Weapon Quick Access & Specialisation Initiative Test Suite...');

const specialisationLevels = {
  Unspecialised: { touch: '0', potential: '0', ini: '0', colors: [], defaults: [] },
  Novice: { touch: '+5', potential: '+5', ini: '+1', colors: [null], defaults: ['Quick Draw'] },
  Apprentice: { touch: '+10', potential: '+10', ini: '+2', colors: [null, 'red'] },
  Adept: { touch: '+15', potential: '+15', ini: '+3', colors: [null, 'yellow'] },
  Expert: { touch: '+20', potential: '+20', ini: '+4', colors: [null, 'yellow', 'red'], defaults: [null, null, 'Combo on naturel red'] },
  Master: { touch: '+25', potential: '+25', ini: '+5', colors: [null, 'yellow', 'red', 'dark-red'] }
};

function getSelectedWeaponDamageInfo(character, weaponSelector = null) {
  const st = character?.data?.stats || {};
  const numFighting = parseFloat(st.Fighting ?? st['Combat Capacity'] ?? '6') || 0;
  const numStrength = parseFloat(st.Strength ?? '6') || 0;
  const numIntuition = parseFloat(st.Intuition ?? '6') || 0;
  const numSpeed = parseFloat(st.Speed ?? st.Movement ?? '6') || 0;
  const numAgility = parseFloat(st.Agility ?? '6') || 0;

  const normalizeTableRows = (stored) => {
    if (Array.isArray(stored)) return stored;
    if (stored && typeof stored === 'object') {
      return Object.keys(stored).sort((a, b) => Number(a) - Number(b)).map((k) => stored[k]);
    }
    return [];
  };

  const rawWeapons = normalizeTableRows(character?.data?.tables?.Weapons);
  const rawSpecs = normalizeTableRows(character?.data?.tables?.Specialisations);

  let targetIdx = 0;
  if (weaponSelector !== null && weaponSelector !== undefined && weaponSelector !== '') {
    if (typeof weaponSelector === 'number') {
      targetIdx = weaponSelector;
    } else if (typeof weaponSelector === 'string') {
      const parsedNum = parseInt(weaponSelector, 10);
      if (!isNaN(parsedNum) && String(parsedNum) === weaponSelector.trim()) {
        targetIdx = parsedNum;
      } else {
        const cleanSelector = weaponSelector.replace(/^['"]|['"]$/g, '').trim().toLowerCase();
        const foundIdx = rawWeapons.findIndex((w) => {
          const wName = (Array.isArray(w) ? w[0] : (w?.[0] || w?.Name || w?.name || '')) || '';
          return String(wName).trim().toLowerCase() === cleanSelector;
        });
        if (foundIdx !== -1) {
          targetIdx = foundIdx;
        } else {
          targetIdx = 0;
        }
      }
    }
  } else {
    targetIdx = character?.data?.quickAccessWeaponSlot ?? (Array.isArray(character?.data?.quickAccessWeaponSlots) ? character.data.quickAccessWeaponSlots[0] : 0);
  }

  if (targetIdx === undefined || targetIdx < 0 || (rawWeapons.length > 0 && targetIdx >= rawWeapons.length)) {
    targetIdx = 0;
  }

  const weapon = (rawWeapons.length > 0 && rawWeapons[targetIdx]) ? rawWeapons[targetIdx] : [];
  const rawWeaponName = Array.isArray(weapon) ? weapon[0] : (weapon[0] ?? weapon.Name ?? weapon.name);
  const weaponName = rawWeaponName || (rawWeapons.length > 0 ? `Weapon ${targetIdx + 1}` : 'Weapon');

  const validStats = ['Fighting', 'Strength', 'Agility', 'Endurance', 'Speed', 'Intelligence', 'Wisdom', 'Intuition', 'Psyche'];

  // 1. Identify specialisation name (stored at index 9 in standard table layout)
  let specName = '';
  if (weapon.Specialisation !== undefined && String(weapon.Specialisation).trim()) {
    specName = String(weapon.Specialisation).trim();
  } else if (weapon.specialisation !== undefined && String(weapon.specialisation).trim()) {
    specName = String(weapon.specialisation).trim();
  } else {
    const w9 = weapon[9] ?? weapon['9'];
    const w2 = weapon[2] ?? weapon['2'];
    const isDice9 = typeof w9 === 'string' && /^\d*\s*[dD]\s*\d+/i.test(w9.trim());
    const isStat2 = typeof w2 === 'string' && validStats.includes(w2.trim());
    const isDice2 = typeof w2 === 'string' && /^\d*\s*[dD]\s*\d+/i.test(w2.trim());

    if (w9 !== undefined && String(w9).trim() && !isDice9) {
      specName = String(w9).trim();
    } else if (w2 !== undefined && String(w2).trim() && !isStat2 && !isDice2) {
      specName = String(w2).trim();
    } else if (w9 !== undefined && String(w9).trim()) {
      specName = String(w9).trim();
    } else if (w2 !== undefined && String(w2).trim() && !isStat2) {
      specName = String(w2).trim();
    }
  }

  // 2. Find matching specialization row in Specialisations table
  const specRow = specName ? rawSpecs.find((s) => {
    if (!s) return false;
    const sName = String(Array.isArray(s) ? s[0] : (s[0] ?? s.Name ?? s.name ?? '')).trim();
    return sName !== '' && sName.toLowerCase() === specName.toLowerCase();
  }) : null;

  let specIniBonus = 0;
  let specTouchBonus = 0;
  let specPotentialBonus = 0;

  if (specRow) {
    const lvl = String(Array.isArray(specRow) ? specRow[1] : (specRow[1] ?? specRow['Actual LVL'] ?? specRow.level ?? '')).trim();
    const cfg = specialisationLevels[lvl] || specialisationLevels.Unspecialised || { touch: '0', potential: '0', ini: '0' };

    const rawIni = Array.isArray(specRow) ? specRow[5] : (specRow[5] ?? specRow['Ini Bonus'] ?? specRow.iniBonus ?? specRow.ini);
    const rawTouch = Array.isArray(specRow) ? specRow[2] : (specRow[2] ?? specRow['Touch Bonus'] ?? specRow.touchBonus ?? specRow.touch);
    const rawPot = Array.isArray(specRow) ? specRow[3] : (specRow[3] ?? specRow['Potential Bonus'] ?? specRow.potentialBonus ?? specRow.potential);

    specIniBonus = (rawIni !== undefined && rawIni !== '' && !isNaN(parseInt(rawIni, 10))) ? parseInt(rawIni, 10) : (parseInt(cfg.ini, 10) || 0);
    specTouchBonus = (rawTouch !== undefined && rawTouch !== '' && !isNaN(parseInt(rawTouch, 10))) ? parseInt(rawTouch, 10) : (parseInt(cfg.touch, 10) || 0);
    specPotentialBonus = (rawPot !== undefined && rawPot !== '' && !isNaN(parseInt(rawPot, 10))) ? parseInt(rawPot, 10) : (parseInt(cfg.potential, 10) || 0);
  }

  // 3. Touch Stat Name & Weapon Touch Bonus
  const touchStatName = (
    weapon['Touch Stat'] ||
    weapon.touchStat ||
    (weapon[1] && validStats.includes(String(weapon[1]).trim()) ? String(weapon[1]).trim() : null) ||
    (weapon[3] && validStats.includes(String(weapon[3]).trim()) ? String(weapon[3]).trim() : null) ||
    'Fighting'
  );

  const rawTouchBonus = weapon['Touch Bonus'] ?? weapon.touchBonus ?? weapon[11] ?? weapon['11'] ?? (weapon[4] !== undefined && !validStats.includes(String(weapon[4]).trim()) ? weapon[4] : '0');
  const weaponTouchBonus = parseInt(rawTouchBonus, 10) || 0;

  // 4. Damage Bonus Stat Name
  const damageBonusStatName = (
    weapon['Damage Bonus Stat'] ||
    weapon.damageBonusStat ||
    (weapon[2] && validStats.includes(String(weapon[2]).trim()) ? String(weapon[2]).trim() : null) ||
    (weapon[5] && validStats.includes(String(weapon[5]).trim()) ? String(weapon[5]).trim() : null) ||
    'Strength'
  );

  // 5. Dice string
  let diceStr = '1D10';
  if (weapon.Dice && String(weapon.Dice).trim()) {
    diceStr = String(weapon.Dice).trim();
  } else if (weapon.dice && String(weapon.dice).trim()) {
    diceStr = String(weapon.dice).trim();
  } else {
    const w6 = weapon[6] ?? weapon['6'];
    const w9 = weapon[9] ?? weapon['9'];
    if (w6 && /^\d*\s*[dD]\s*\d+/i.test(String(w6).trim())) {
      diceStr = String(w6).trim();
    } else if (w9 && /^\d*\s*[dD]\s*\d+/i.test(String(w9).trim())) {
      diceStr = String(w9).trim();
    } else if (w6 && String(w6).trim()) {
      diceStr = String(w6).trim();
    }
  }

  const twoHanded = (
    weapon['Two handed?'] === true || weapon['Two handed?'] === 'true' || weapon['Two handed?'] === 'on' ||
    weapon.twoHanded === true || weapon.twoHanded === 'true' || weapon.twoHanded === 'on' ||
    weapon[10] === true || weapon[10] === 'true' || weapon[10] === 'on' ||
    weapon['10'] === true || weapon['10'] === 'true' || weapon['10'] === 'on'
  );

  // 6. Base and total Initiative bonuses (Intuition/10 + specIniBonus for 1st round, Speed/10 + specIniBonus for Next rounds)
  const base1stBonus = Math.floor(numIntuition / 10);
  const baseNextBonus = Math.floor(numSpeed / 10);
  const total1stBonus = base1stBonus + specIniBonus;
  const totalNextBonus = baseNextBonus + specIniBonus;

  const touchStatVal = parseFloat(st[touchStatName] ?? (touchStatName === 'Fighting' ? numFighting : (touchStatName === 'Agility' ? numAgility : '6'))) || 0;
  const totalTouchVal = touchStatVal + weaponTouchBonus + specTouchBonus;

  const fightMult = Math.max(1, Math.floor(numFighting / 10));
  const dMatch = diceStr.match(/^(\d*)\s*[dD]\s*(\d+)/);
  const baseCount = dMatch ? (parseInt(dMatch[1], 10) || 1) : 1;
  const dieSides = dMatch ? parseInt(dMatch[2], 10) : 10;
  const totalDiceCount = fightMult * baseCount;
  const finalDiceStr = `${totalDiceCount}D${dieSides}`;

  const dmgStatVal = parseFloat(st[damageBonusStatName] ?? (damageBonusStatName === 'Strength' ? numStrength : (damageBonusStatName === 'Fighting' ? numFighting : '6'))) || 0;
  const statDmgBonus = twoHanded ? Math.floor(dmgStatVal * 1.5) : dmgStatVal;
  const totalFlatBonus = statDmgBonus + specPotentialBonus;

  let damageExpr = finalDiceStr;
  if (totalFlatBonus > 0) {
    damageExpr = `${finalDiceStr} + ${totalFlatBonus}`;
  } else if (totalFlatBonus < 0) {
    damageExpr = `${finalDiceStr} - ${Math.abs(totalFlatBonus)}`;
  }

  return {
    weaponIndex: targetIdx,
    weapon,
    weaponName,
    specName,
    specRow,
    specIniBonus,
    base1stBonus,
    baseNextBonus,
    touchStatName,
    touchStatVal,
    weaponTouchBonus,
    specTouchBonus,
    totalTouchVal,
    total1stBonus,
    totalNextBonus,
    damageBonusStatName,
    twoHanded,
    diceStr,
    baseDiceCount: baseCount,
    dieSides,
    fightMult,
    totalDiceCount,
    finalDiceStr,
    statDmgBonus,
    specPotentialBonus,
    totalFlatBonus,
    damageExpr
  };
}

// Test 1: Character with Intuition 24, Speed 16 and weapon linked to Novice specialization (+1 Ini)
console.log('1. Testing weapon with Novice specialization (+1 Ini)...');
const char1 = {
  data: {
    stats: {
      Fighting: '20',
      Strength: '15',
      Agility: '12',
      Speed: '16', // base next rounds = 1
      Intuition: '24' // base 1st round = 2
    },
    tables: {
      Specialisations: [
        ['Épée bâtarde', 'Novice', '+5', '+5', ['Quick Draw'], '+1']
      ],
      Weapons: [
        // Standard layout: [0: Name, 1: Touch Stat, 2: Dmg Stat, 3: Eff Range, 4: Yel Range, 5: Red Range, 6: Dice, 7: Ammo, 8: Quality, 9: Spec, 10: TwoHanded, 11: TouchBonus, 12: Desc]
        ['Épée de héros', 'Fighting', 'Strength', '1', '2', '3', '1D10', '', '10', 'Épée bâtarde', false, '0', 'Une belle épée']
      ]
    },
    quickAccessWeaponSlot: 0
  }
};

const res1 = getSelectedWeaponDamageInfo(char1, 0);
assert.strictEqual(res1.specName, 'Épée bâtarde', 'Specialisation name should be extracted');
assert.strictEqual(res1.specIniBonus, 1, 'Novice specIniBonus should be 1');
assert.strictEqual(res1.base1stBonus, 2, 'Base 1st round ini should be 2 (Intuition 24 / 10)');
assert.strictEqual(res1.baseNextBonus, 1, 'Base next rounds ini should be 1 (Speed 16 / 10)');
assert.strictEqual(res1.total1stBonus, 3, 'Total 1st round ini should be base (2) + specIni (1) = 3');
assert.strictEqual(res1.totalNextBonus, 2, 'Total next rounds ini should be base (1) + specIni (1) = 2');
assert.strictEqual(res1.finalDiceStr, '2D10', 'Dice count should be fightMult (2) * 1D10 = 2D10');
console.log('✅ Test 1 passed.');

// Test 2: Character with Master specialization (+5 Ini)
console.log('2. Testing weapon with Master specialization (+5 Ini)...');
const char2 = {
  data: {
    stats: {
      Fighting: '10',
      Speed: '35', // base next rounds = 3
      Intuition: '42' // base 1st round = 4
    },
    tables: {
      Specialisations: [
        ['Arc long', 'Master', '+25', '+25', [], '+5']
      ],
      Weapons: [
        ['Arc elfique', 'Agility', 'Strength', '10', '20', '30', '1D8', '', '0', 'Arc long', true, '0', '']
      ]
    },
    quickAccessWeaponSlot: 0
  }
};

const res2 = getSelectedWeaponDamageInfo(char2, 0);
assert.strictEqual(res2.specName, 'Arc long', 'Specialisation name should be Arc long');
assert.strictEqual(res2.specIniBonus, 5, 'Master specIniBonus should be 5');
assert.strictEqual(res2.total1stBonus, 9, 'Total 1st round ini should be 4 + 5 = 9');
assert.strictEqual(res2.totalNextBonus, 8, 'Total next rounds ini should be 3 + 5 = 8');
console.log('✅ Test 2 passed.');

// Test 3: Unspecialised weapon (specIni = 0)
console.log('3. Testing weapon without specialization...');
const char3 = {
  data: {
    stats: {
      Fighting: '10',
      Speed: '18', // base next rounds = 1
      Intuition: '22' // base 1st round = 2
    },
    tables: {
      Specialisations: [],
      Weapons: [
        ['Dague', 'Agility', 'Strength', '1', '2', '3', '1D6', '', '0', '', false, '0', '']
      ]
    },
    quickAccessWeaponSlot: 0
  }
};

const res3 = getSelectedWeaponDamageInfo(char3, 0);
assert.strictEqual(res3.specIniBonus, 0, 'No spec should have 0 specIniBonus');
assert.strictEqual(res3.total1stBonus, 2, 'Total 1st round ini should be 2');
assert.strictEqual(res3.totalNextBonus, 1, 'Total next rounds ini should be 1');
console.log('✅ Test 3 passed.');

console.log('🎉 ALL WEAPON QUICK ACCESS INITIATIVE TESTS PASSED SUCCESSFULLY!');
