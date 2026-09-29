import * as XLSX from 'xlsx';

/**
 * Normalizes a string for comparison (lowercased, trimmed, accents removed).
 */
export function normalizeKey(str) {
  if (str === undefined || str === null) return '';
  return String(str)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[\r\n\t_]+/g, ' ')
    .trim()
    .toLowerCase();
}

/**
 * Checks if a value is considered empty or blank.
 */
export function isBlank(val) {
  if (val === undefined || val === null) return true;
  if (typeof val === 'string') return val.trim() === '';
  if (Array.isArray(val)) return val.length === 0 || val.every(isBlank);
  if (typeof val === 'object') return Object.keys(val).length === 0 || Object.values(val).every(isBlank);
  return false;
}

/**
 * Converts a Google Sheets sharing or view URL into an XLSX direct export link.
 */
export function convertGoogleSheetUrlToXlsx(url) {
  if (!url || typeof url !== 'string') return url;
  const trimmed = url.trim();

  // Pattern: published to web /pubhtml or /pub
  if (trimmed.includes('/pubhtml') || trimmed.includes('/pub?') || trimmed.endsWith('/pub')) {
    return trimmed.replace(/\/pubhtml(\?.*)?$/, '/pub?output=xlsx').replace(/\/pub(\?.*)?$/, '/pub?output=xlsx');
  }

  // Pattern: docs.google.com/spreadsheets/d/{SPREADSHEET_ID}/... (excluding /d/e/ published links)
  const idMatch = trimmed.match(/\/spreadsheets\/d\/(?!e\/)([a-zA-Z0-9_-]+)/);
  if (idMatch && idMatch[1]) {
    const sheetId = idMatch[1];
    return `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=xlsx`;
  }

  return trimmed;
}

/**
 * Helper to retrieve sheet rows by looking for various possible sheet names.
 */
function findSheetRows(workbook, possibleNames) {
  if (!workbook || !workbook.SheetNames) return [];
  const normalizedTargets = possibleNames.map(normalizeKey);

  for (const sheetName of workbook.SheetNames) {
    const norm = normalizeKey(sheetName);
    if (normalizedTargets.includes(norm)) {
      const ws = workbook.Sheets[sheetName];
      if (ws) {
        return XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
      }
    }
  }
  return [];
}

/**
 * Parses the "Infos" sheet.
 */
function parseInfoSheet(workbook) {
  const rows = findSheetRows(workbook, ['Infos', 'Info', 'Informations', 'Information', 'General']);
  const info = {};
  let charName = '';

  const labelMapping = {
    'player name': 'playerName',
    'nom du joueur': 'playerName',
    'joueur': 'playerName',
    'name': 'name',
    'nom': 'name',
    'nom du personnage': 'name',
    'character name': 'name',
    'gender': 'gender',
    'genre': 'gender',
    'sexe': 'gender',
    'origins': 'origins',
    'origin': 'origins',
    'origines': 'origins',
    'origine': 'origins',
    'age': 'age',
    'heigth': 'height',
    'height': 'height',
    'taille': 'height',
    'weigth': 'weight',
    'weight': 'weight',
    'poids': 'weight',
    'eyes color': 'eyesColor',
    'eye color': 'eyesColor',
    'yeux': 'eyesColor',
    'couleur des yeux': 'eyesColor',
    'hairs color': 'hairColor',
    'hair color': 'hairColor',
    'cheveux': 'hairColor',
    'couleur des cheveux': 'hairColor',
    'skin color': 'skinColor',
    'peau': 'skinColor',
    'couleur de peau': 'skinColor',
    'languages': 'languages',
    'langues': 'languages',
    'alphabet': 'alphabet',
    'alphabets': 'alphabet',
    'gods': 'gods',
    'dieux': 'gods',
    'divinites': 'gods',
    'xp to spend/total': 'xp',
    'xp to spend / total': 'xp',
    'xp': 'xp',
    'experience': 'xp',
    'background': 'background',
    'histoire': 'background',
    'historique': 'background'
  };

  rows.forEach((row) => {
    if (!Array.isArray(row)) return;
    row.forEach((cell, colIdx) => {
      const norm = normalizeKey(cell);
      if (labelMapping[norm]) {
        const key = labelMapping[norm];
        let val = '';
        for (let c = colIdx + 1; c < row.length; c++) {
          if (row[c] !== undefined && row[c] !== null && String(row[c]).trim() !== '') {
            val = String(row[c]).trim();
            break;
          }
        }
        if (val) {
          if (key === 'name') {
            charName = val;
            info.name = val;
          } else if (key === 'xp') {
            const parts = val.split('/');
            if (parts.length === 2) {
              info.xpToSpend = parts[0].trim();
              info.xpTotal = parts[1].trim();
            } else {
              info.xp = val;
            }
          } else {
            info[key] = val;
          }
        }
      }
    });
  });

  return { info, charName };
}

/**
 * Parses the "Stats" sheet.
 */
function parseStatsSheet(workbook) {
  const rows = findSheetRows(workbook, ['Stats', 'Statistiques', 'Stat', 'Attributes']);
  const stats = {};

  const statSearch = [
    { keys: ['fighting'], target: 'Fighting' },
    { keys: ['strength', 'force'], target: 'Strength' },
    { keys: ['agility', 'agilite'], target: 'Agility' },
    { keys: ['endurance'], target: 'Endurance' },
    { keys: ['speed', 'vitesse'], target: 'Speed' },
    { keys: ['intelligence'], target: 'Intelligence' },
    { keys: ['wisdom', 'sagesse'], target: 'Wisdom' },
    { keys: ['intuition'], target: 'Intuition' },
    { keys: ['psyche'], target: 'Psyche' },
    { keys: ['luck', 'chance'], target: 'Luck' },
    { keys: ['karma'], target: 'Karma' },
    { keys: ['combat capacity bonus', 'combat capacity'], target: 'CombatCapacityBonus' },
    { keys: ['mana pool bonus', 'mana pool'], target: 'ManaPoolBonus' },
    { keys: ['focus'], target: 'Focus' },
    { keys: ['full restante', 'action full', 'full'], target: 'FullRestante' },
    { keys: ['free restante', 'action libre', 'free'], target: 'FreeRestante' }
  ];

  rows.forEach((row) => {
    if (!Array.isArray(row)) return;
    row.forEach((cell, colIdx) => {
      const cellText = normalizeKey(cell);
      if (!cellText) return;

      for (const item of statSearch) {
        // Match exact or prefix
        const matches = item.keys.some((k) => cellText === k || cellText.startsWith(k + ' ') || cellText.startsWith(k + ':'));
        if (matches) {
          // Find adjacent numeric or non-empty value
          for (let c = colIdx + 1; c < Math.min(row.length, colIdx + 4); c++) {
            const candidate = row[c];
            if (candidate !== '' && candidate !== undefined && candidate !== null) {
              const strVal = String(candidate).trim();
              if (stats[item.target] === undefined) {
                stats[item.target] = strVal;
              }
              break;
            }
          }
        }
      }
    });
  });

  return stats;
}

/**
 * Parses the "Skills" sheet.
 */
function parseSkillsSheet(workbook) {
  const rows = findSheetRows(workbook, ['Skills', 'Competences', 'Compétences', 'Skill']);
  if (rows.length < 2) return [];

  // Identify column indices from header
  const headerRow = rows[0].map(normalizeKey);
  const findCol = (keys, defaultIdx) => {
    const idx = headerRow.findIndex((h) => keys.some((k) => h === k || h.includes(k)));
    return idx !== -1 ? idx : defaultIdx;
  };

  const colName = findCol(['name', 'nom'], 0);
  const colType = findCol(['skill type', 'type'], 1);
  const colStat = findCol(['stat', 'caracteristique'], 2);
  const colLevel = findCol(['cs level', 'level', 'lvl', 'niveau'], 3);
  const colAction = findCol(['action type', 'action'], 4);
  const colFocus = findCol(['focus cost', 'focus', 'cout focus'], 5);
  const colDesc = findCol(['description', 'effet', 'desc'], 6);
  const colWhite = findCol(['white', 'blanc', 'echec'], 7);
  const colGreen = findCol(['green', 'vert'], 8);
  const colYellow = findCol(['yellow', 'jaune'], 9);
  const colRed = findCol(['red', 'rouge'], 10);
  const colNatRed = findCol(['natural red', 'rouge naturel'], 11);
  const colCritRed = findCol(['critical red', 'critique'], 12);

  const skills = [];
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    if (!Array.isArray(row)) continue;
    const name = String(row[colName] ?? '').trim();
    if (!name || normalizeKey(name) === 'name' || normalizeKey(name) === 'nom') continue;

    const skillRow = [
      name,
      String(row[colType] ?? '').trim(),
      String(row[colStat] ?? '').trim(),
      String(row[colLevel] ?? '').trim(),
      String(row[colAction] ?? '').trim(),
      String(row[colFocus] ?? '').trim(),
      String(row[colDesc] ?? '').trim(),
      String(row[colWhite] ?? '').trim(),
      String(row[colGreen] ?? '').trim(),
      String(row[colYellow] ?? '').trim(),
      String(row[colRed] ?? '').trim(),
      String(row[colNatRed] ?? '').trim(),
      String(row[colCritRed] ?? '').trim()
    ];
    skills.push(skillRow);
  }

  return skills;
}

/**
 * Parses the "Spell" sheet.
 */
function parseSpellsSheet(workbook) {
  const rows = findSheetRows(workbook, ['Spell', 'Spells', 'Sorts', 'Sort', 'Magie']);
  if (rows.length < 2) return [];

  const headerRow = rows[0].map(normalizeKey);
  const findCol = (keys, defaultIdx) => {
    const idx = headerRow.findIndex((h) => keys.some((k) => h === k || h.includes(k)));
    return idx !== -1 ? idx : defaultIdx;
  };

  const colName = findCol(['name', 'nom'], 0);
  const colScellVal = findCol(['scell value', 'valeur sceau', 'scell'], 1);
  const colAction = findCol(['action type', 'action'], 2);
  const colMana = findCol(['mana cost', 'cout mana', 'mana'], 3);
  const colScells = findCol(['scells', 'sceaux'], 4);
  const colDesc = findCol(['description', 'effet'], 5);
  const colIntention = findCol(['intention'], 6);
  const colWhite = findCol(['white', 'blanc', 'fail'], 7);
  const colGreen = findCol(['green', 'vert'], 8);
  const colYellow = findCol(['yellow', 'jaune'], 9);
  const colRed = findCol(['red', 'rouge'], 10);
  const colNatRed = findCol(['natural red', 'rouge naturel'], 11);
  const colCritRed = findCol(['critical red', 'critique'], 12);

  const spells = [];
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    if (!Array.isArray(row)) continue;
    const name = String(row[colName] ?? '').trim();
    if (!name || normalizeKey(name) === 'name' || normalizeKey(name) === 'nom') continue;

    const spellRow = [
      name,
      String(row[colScellVal] ?? '').trim(),
      String(row[colAction] ?? '').trim(),
      String(row[colMana] ?? '').trim(),
      String(row[colScells] ?? '').trim(),
      String(row[colDesc] ?? '').trim(),
      String(row[colIntention] ?? '').trim(),
      String(row[colWhite] ?? '').trim(),
      String(row[colGreen] ?? '').trim(),
      String(row[colYellow] ?? '').trim(),
      String(row[colRed] ?? '').trim(),
      String(row[colNatRed] ?? '').trim(),
      String(row[colCritRed] ?? '').trim()
    ];
    spells.push(spellRow);
  }

  return spells;
}

/**
 * Parses the "Specialisations" sheet.
 */
function parseSpecialisationsSheet(workbook) {
  const rows = findSheetRows(workbook, ['Specialisations', 'Specialisation', 'Spécialisations', 'Spécialisation']);
  if (rows.length < 2) return [];

  const specs = [];
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    if (!Array.isArray(row)) continue;
    const name = String(row[0] ?? '').trim();
    if (!name || normalizeKey(name) === 'name' || normalizeKey(name) === 'nom') continue;

    specs.push([
      name,
      String(row[1] ?? 'Unspecialised').trim() || 'Unspecialised',
      String(row[2] ?? '0').trim() || '0',
      String(row[3] ?? '0').trim() || '0',
      Array.isArray(row[4]) ? row[4] : (row[4] ? [String(row[4]).trim()] : []),
      String(row[5] ?? '0').trim() || '0'
    ]);
  }
  return specs;
}

/**
 * Parses the "Weapons" sheet.
 */
function parseWeaponsSheet(workbook) {
  const rows = findSheetRows(workbook, ['Weapons', 'Armes', 'Arme', 'Weapon']);
  if (rows.length < 2) return [];

  const weapons = [];
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    if (!Array.isArray(row)) continue;
    const name = String(row[0] ?? '').trim();
    if (!name || normalizeKey(name) === 'name' || normalizeKey(name) === 'nom') continue;

    // Standard weapon layout array:
    // [0: Name, 1: Touch Stat, 2: Dmg Stat, 3: Eff Range, 4: Yellow Range, 5: Red Range, 6: Dice, 7: Ammo, 8: Quality, 9: Spec, 10: TwoHanded, 11: TouchBonus, 12: Desc]
    const touchStat = String(row[1] ?? 'Fighting').trim();
    const dmgStat = String(row[2] ?? 'Strength').trim();
    const effRange = String(row[3] ?? '').trim();
    const yelRange = String(row[4] ?? '').trim();
    const redRange = String(row[5] ?? '').trim();
    const dice = String(row[6] ?? '1D10').trim();
    const ammo = String(row[7] ?? '').trim();
    const quality = String(row[8] ?? '').trim();
    const desc = String(row[9] ?? '').trim();

    const weaponRow = [];
    weaponRow[0] = name;
    weaponRow[1] = touchStat;
    weaponRow[2] = dmgStat;
    weaponRow[3] = effRange;
    weaponRow[4] = yelRange;
    weaponRow[5] = redRange;
    weaponRow[6] = dice;
    weaponRow[7] = ammo;
    weaponRow[8] = quality;
    weaponRow[9] = '';
    weaponRow[10] = false;
    weaponRow[11] = '0';
    weaponRow[12] = desc;

    weapons.push(weaponRow);
  }
  return weapons;
}

/**
 * Parses the "Armor" sheet.
 */
function parseArmorSheet(workbook) {
  const rows = findSheetRows(workbook, ['Armor', 'Armure', 'Armures']);
  if (rows.length < 2) return [];

  const armorList = [];
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    if (!Array.isArray(row)) continue;
    const name = String(row[0] ?? '').trim();
    if (!name || normalizeKey(name) === 'name' || normalizeKey(name) === 'nom') continue;

    const baseArmor = String(row[1] ?? '').trim();
    const energyProt = String(row[2] ?? '').trim();
    const quality = String(row[3] ?? row[2] ?? '').trim();
    const runeSlots = String(row[4] ?? row[3] ?? '0').trim();
    const runes = Array.isArray(row[5]) ? row[5] : (row[4] && typeof row[4] === 'string' && row[4].includes('-') ? [] : []);
    const desc = String(row[6] ?? row[5] ?? '').trim();

    armorList.push([
      name,
      baseArmor,
      energyProt,
      quality,
      runeSlots,
      runes,
      desc
    ]);
  }
  return armorList;
}

/**
 * Parses the "Inventory" sheet.
 */
function parseInventorySheet(workbook) {
  const rows = findSheetRows(workbook, ['Inventory', 'Inventaire', 'Objets']);
  if (rows.length < 2) return [];

  const invList = [];
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    if (!Array.isArray(row)) continue;
    const name = String(row[0] ?? '').trim();
    if (!name || normalizeKey(name) === 'name' || normalizeKey(name) === 'nom') continue;

    const desc = String(row[1] ?? '').trim();
    const qte = String(row[2] ?? '1').trim();
    const loc = String(row[3] ?? '').trim();

    invList.push([
      qte,
      name,
      desc,
      loc
    ]);
  }
  return invList;
}

/**
 * Parses the "Relations" sheet.
 */
function parseRelationsSheet(workbook) {
  const rows = findSheetRows(workbook, ['Relations', 'Relation']);
  if (rows.length < 2) return [];

  const relList = [];
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    if (!Array.isArray(row)) continue;
    const name = String(row[0] ?? '').trim();
    if (!name || normalizeKey(name) === 'name' || normalizeKey(name) === 'nom') continue;

    relList.push([
      name,
      String(row[1] ?? '').trim(), // Race
      String(row[2] ?? '').trim(), // Gender
      String(row[3] ?? '').trim(), // Age
      String(row[4] ?? row[1] ?? '').trim(), // Link
      String(row[5] ?? row[2] ?? '').trim(), // Relation type
      String(row[6] ?? row[3] ?? '').trim()  // Description
    ]);
  }
  return relList;
}

/**
 * Parses the "Monture" sheet.
 */
function parseMontureSheet(workbook) {
  const rows = findSheetRows(workbook, ['Monture', 'Montures', 'Mount']);
  if (rows.length < 2) return [];

  const mountList = [];
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    if (!Array.isArray(row)) continue;
    const name = String(row[0] ?? '').trim();
    if (!name || normalizeKey(name) === 'name' || normalizeKey(name) === 'nom') continue;

    mountList.push([
      name,
      String(row[1] ?? '').trim(), // Type
      String(row[2] ?? '').trim(), // Speed
      String(row[3] ?? '').trim(), // Armor
      String(row[4] ?? '').trim()  // Notes
    ]);
  }
  return mountList;
}

/**
 * Parses the "Note du joueur" sheet.
 */
function parseNotesSheet(workbook) {
  const rows = findSheetRows(workbook, ['Note du joueur', 'Notes', 'Note', 'Player Notes']);
  if (rows.length === 0) return [];

  const notes = [];
  rows.forEach((row) => {
    if (Array.isArray(row)) {
      const text = row.map((c) => String(c ?? '').trim()).filter(Boolean).join('\n');
      if (text) notes.push(text);
    }
  });

  if (notes.length > 0) {
    return [{ 0: notes.join('\n\n') }];
  }
  return [];
}

/**
 * Parses the "Unique Power" sheet.
 */
function parseUniquePowerSheet(workbook) {
  const rows = findSheetRows(workbook, ['Unique Power', 'Pouvoirs Uniques', 'Pouvoirs', 'Powers']);
  if (rows.length < 2) return [];

  const powers = [];
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    if (!Array.isArray(row)) continue;
    const name = String(row[0] || row[1] || '').trim();
    if (!name || normalizeKey(name) === 'name' || normalizeKey(name) === 'nom') continue;
    const desc = String(row[1] || row[2] || '').trim();
    const cost = String(row[2] || row[3] || '').trim();
    powers.push({ name, description: desc, roll: 'No Roll', cost, charges: '' });
  }

  return powers;
}

/**
 * Parses an entire SheetJS Workbook into structured character sheet data.
 * Skips image insertion.
 */
export function parseWorkbookToCharacterData(workbook) {
  const { info, charName } = parseInfoSheet(workbook);
  const stats = parseStatsSheet(workbook);
  const skills = parseSkillsSheet(workbook);
  const spells = parseSpellsSheet(workbook);
  const specialisations = parseSpecialisationsSheet(workbook);
  const weapons = parseWeaponsSheet(workbook);
  const armor = parseArmorSheet(workbook);
  const inventory = parseInventorySheet(workbook);
  const relations = parseRelationsSheet(workbook);
  const monture = parseMontureSheet(workbook);
  const notes = parseNotesSheet(workbook);
  const powers = parseUniquePowerSheet(workbook);

  return {
    name: charName || info.name || '',
    info,
    stats,
    tables: {
      Skills: skills,
      Spell: spells,
      Specialisations: specialisations,
      Weapons: weapons,
      Armor: armor,
      Inventory: inventory,
      Relations: relations,
      Monture: monture,
      'Note du joueur': notes,
      'Unique Power': powers
    },
    powerThemes: powers.length > 0 ? [
      {
        title: 'Power Theme 1',
        description: '',
        image: '',
        imageSettings: { width: 320, height: 420 },
        powers
      }
    ] : []
  };
}

/**
 * Helper to normalize row objects/arrays into an array.
 */
function normalizeTableRows(stored) {
  if (Array.isArray(stored)) return stored;
  if (stored && typeof stored === 'object') {
    return Object.keys(stored).sort((a, b) => Number(a) - Number(b)).map((k) => stored[k]);
  }
  return [];
}

/**
 * Merges imported sheet data into a target character sheet.
 * If skills or spells already exist, fills in blanks without overwriting existing data.
 * Skips image insertion.
 */
export function mergeCharacterData(targetCharacter, importedData, options = {}) {
  const { fillBlanksOnly = true } = options;

  if (!targetCharacter || !importedData) return targetCharacter;

  targetCharacter.data ??= {};
  targetCharacter.data.info ??= {};
  targetCharacter.data.stats ??= {};
  targetCharacter.data.tables ??= {};

  // 1. Character Name
  if (importedData.name && (isBlank(targetCharacter.name) || targetCharacter.name.startsWith('Character ') || targetCharacter.name === 'New Character' || !fillBlanksOnly)) {
    targetCharacter.name = importedData.name;
    targetCharacter.data.info.name = importedData.name;
  }

  // 2. Info Fields (Skip Images)
  if (importedData.info) {
    Object.entries(importedData.info).forEach(([key, val]) => {
      // Explicitly skip any image attributes
      if (key === 'image' || key === 'imageSettings') return;

      if (!isBlank(val)) {
        if (!fillBlanksOnly || isBlank(targetCharacter.data.info[key])) {
          targetCharacter.data.info[key] = val;
        }
      }
    });
  }

  // 3. Stats
  if (importedData.stats) {
    Object.entries(importedData.stats).forEach(([statKey, val]) => {
      if (!isBlank(val)) {
        if (!fillBlanksOnly || isBlank(targetCharacter.data.stats[statKey])) {
          targetCharacter.data.stats[statKey] = val;
        }
      }
    });
  }

  // 4. Skills Table (Fill Blanks if already exists)
  if (importedData.tables?.Skills && Array.isArray(importedData.tables.Skills) && importedData.tables.Skills.length > 0) {
    let existingSkills = normalizeTableRows(targetCharacter.data.tables.Skills);

    importedData.tables.Skills.forEach((impSkill) => {
      if (!impSkill || isBlank(impSkill[0])) return;
      const impNameNorm = normalizeKey(impSkill[0]);

      const matchIdx = existingSkills.findIndex((ex) => {
        if (!ex) return false;
        const exName = Array.isArray(ex) ? ex[0] : ex['0'] || ex.name;
        return normalizeKey(exName) === impNameNorm;
      });

      if (matchIdx !== -1) {
        // Skill already exists: complete blanks only!
        const existing = existingSkills[matchIdx];
        if (Array.isArray(existing)) {
          for (let i = 0; i < Math.max(existing.length, impSkill.length, 13); i++) {
            if (isBlank(existing[i]) && !isBlank(impSkill[i])) {
              existing[i] = impSkill[i];
            }
          }
        } else if (typeof existing === 'object') {
          for (let i = 0; i < 13; i++) {
            if (isBlank(existing[i]) && !isBlank(impSkill[i])) {
              existing[i] = impSkill[i];
            }
          }
        }
      } else {
        // New skill: add to table
        existingSkills.push(impSkill);
      }
    });

    targetCharacter.data.tables.Skills = existingSkills;
  }

  // 5. Spell Table (Fill Blanks if already exists)
  if (importedData.tables?.Spell && Array.isArray(importedData.tables.Spell) && importedData.tables.Spell.length > 0) {
    let existingSpells = normalizeTableRows(targetCharacter.data.tables.Spell);

    // Filter out initial empty placeholder rows if importing real spells
    existingSpells = existingSpells.filter((s) => s && !isBlank(s[0]));

    importedData.tables.Spell.forEach((impSpell) => {
      if (!impSpell || isBlank(impSpell[0])) return;
      const impNameNorm = normalizeKey(impSpell[0]);

      const matchIdx = existingSpells.findIndex((ex) => {
        if (!ex) return false;
        const exName = Array.isArray(ex) ? ex[0] : ex['0'] || ex.name;
        return normalizeKey(exName) === impNameNorm;
      });

      if (matchIdx !== -1) {
        // Spell already exists: complete blanks only!
        const existing = existingSpells[matchIdx];
        if (Array.isArray(existing)) {
          for (let i = 0; i < Math.max(existing.length, impSpell.length, 13); i++) {
            if (isBlank(existing[i]) && !isBlank(impSpell[i])) {
              existing[i] = impSpell[i];
            }
          }
        } else if (typeof existing === 'object') {
          for (let i = 0; i < 13; i++) {
            if (isBlank(existing[i]) && !isBlank(impSpell[i])) {
              existing[i] = impSpell[i];
            }
          }
        }
      } else {
        // New spell: add to table
        existingSpells.push(impSpell);
      }
    });

    if (existingSpells.length === 0) {
      existingSpells = [{}];
    }
    targetCharacter.data.tables.Spell = existingSpells;
  }

  // 6. Specialisations Table
  if (importedData.tables?.Specialisations && Array.isArray(importedData.tables.Specialisations) && importedData.tables.Specialisations.length > 0) {
    let existingSpecs = normalizeTableRows(targetCharacter.data.tables.Specialisations);
    existingSpecs = existingSpecs.filter((s) => s && !isBlank(s[0]));

    importedData.tables.Specialisations.forEach((impSpec) => {
      if (!impSpec || isBlank(impSpec[0])) return;
      const normName = normalizeKey(impSpec[0]);

      const matchIdx = existingSpecs.findIndex((ex) => {
        const exName = Array.isArray(ex) ? ex[0] : ex['0'] || ex.name;
        return normalizeKey(exName) === normName;
      });

      if (matchIdx !== -1) {
        const existing = existingSpecs[matchIdx];
        if (Array.isArray(existing)) {
          for (let i = 0; i < 6; i++) {
            if (isBlank(existing[i]) && !isBlank(impSpec[i])) {
              existing[i] = impSpec[i];
            }
          }
        }
      } else {
        existingSpecs.push(impSpec);
      }
    });

    if (existingSpecs.length === 0) {
      existingSpecs = [{ 1: 'Unspecialised', 2: '0', 3: '0', 4: [], 5: '0' }];
    }
    targetCharacter.data.tables.Specialisations = existingSpecs;
  }

  // 7. Weapons Table
  if (importedData.tables?.Weapons && Array.isArray(importedData.tables.Weapons) && importedData.tables.Weapons.length > 0) {
    let existingWeapons = normalizeTableRows(targetCharacter.data.tables.Weapons);
    existingWeapons = existingWeapons.filter((w) => w && !isBlank(w[0]));

    importedData.tables.Weapons.forEach((impWeapon) => {
      if (!impWeapon || isBlank(impWeapon[0])) return;
      const normName = normalizeKey(impWeapon[0]);

      const matchIdx = existingWeapons.findIndex((ex) => {
        const exName = Array.isArray(ex) ? ex[0] : ex['0'] || ex.name;
        return normalizeKey(exName) === normName;
      });

      if (matchIdx !== -1) {
        const existing = existingWeapons[matchIdx];
        if (Array.isArray(existing)) {
          for (let i = 0; i < Math.max(existing.length, impWeapon.length); i++) {
            if (isBlank(existing[i]) && !isBlank(impWeapon[i])) {
              existing[i] = impWeapon[i];
            }
          }
        }
      } else {
        existingWeapons.push(impWeapon);
      }
    });

    if (existingWeapons.length === 0) {
      existingWeapons = [{}];
    }
    targetCharacter.data.tables.Weapons = existingWeapons;
  }

  // 8. Armor Table
  if (importedData.tables?.Armor && Array.isArray(importedData.tables.Armor) && importedData.tables.Armor.length > 0) {
    let existingArmor = normalizeTableRows(targetCharacter.data.tables.Armor);
    existingArmor = existingArmor.filter((a) => a && !isBlank(a[0]));

    importedData.tables.Armor.forEach((impArm) => {
      if (!impArm || isBlank(impArm[0])) return;
      const normName = normalizeKey(impArm[0]);

      const matchIdx = existingArmor.findIndex((ex) => {
        const exName = Array.isArray(ex) ? ex[0] : ex['0'] || ex.name;
        return normalizeKey(exName) === normName;
      });

      if (matchIdx !== -1) {
        const existing = existingArmor[matchIdx];
        if (Array.isArray(existing)) {
          for (let i = 0; i < Math.max(existing.length, impArm.length); i++) {
            if (isBlank(existing[i]) && !isBlank(impArm[i])) {
              existing[i] = impArm[i];
            }
          }
        }
      } else {
        existingArmor.push(impArm);
      }
    });

    if (existingArmor.length === 0) {
      existingArmor = [{}];
    }
    targetCharacter.data.tables.Armor = existingArmor;
  }

  // 9. Inventory Table
  if (importedData.tables?.Inventory && Array.isArray(importedData.tables.Inventory) && importedData.tables.Inventory.length > 0) {
    let existingInv = normalizeTableRows(targetCharacter.data.tables.Inventory);
    existingInv = existingInv.filter((inv) => inv && (!isBlank(inv[1]) || !isBlank(inv[0])));

    importedData.tables.Inventory.forEach((impInv) => {
      if (!impInv || (isBlank(impInv[1]) && isBlank(impInv[0]))) return;
      const normName = normalizeKey(impInv[1] || impInv[0]);

      const matchIdx = existingInv.findIndex((ex) => {
        const exName = Array.isArray(ex) ? ex[1] || ex[0] : ex['1'] || ex['0'] || ex.name;
        return normalizeKey(exName) === normName;
      });

      if (matchIdx !== -1) {
        const existing = existingInv[matchIdx];
        if (Array.isArray(existing)) {
          for (let i = 0; i < Math.max(existing.length, impInv.length); i++) {
            if (isBlank(existing[i]) && !isBlank(impInv[i])) {
              existing[i] = impInv[i];
            }
          }
        }
      } else {
        existingInv.push(impInv);
      }
    });

    if (existingInv.length === 0) {
      existingInv = [{}];
    }
    targetCharacter.data.tables.Inventory = existingInv;
  }

  // 10. Relations Table
  if (importedData.tables?.Relations && Array.isArray(importedData.tables.Relations) && importedData.tables.Relations.length > 0) {
    let existingRel = normalizeTableRows(targetCharacter.data.tables.Relations);
    existingRel = existingRel.filter((rel) => rel && !isBlank(rel[0]));

    importedData.tables.Relations.forEach((impRel) => {
      if (!impRel || isBlank(impRel[0])) return;
      const normName = normalizeKey(impRel[0]);

      const matchIdx = existingRel.findIndex((ex) => {
        const exName = Array.isArray(ex) ? ex[0] : ex['0'] || ex.name;
        return normalizeKey(exName) === normName;
      });

      if (matchIdx !== -1) {
        const existing = existingRel[matchIdx];
        if (Array.isArray(existing)) {
          for (let i = 0; i < Math.max(existing.length, impRel.length); i++) {
            if (isBlank(existing[i]) && !isBlank(impRel[i])) {
              existing[i] = impRel[i];
            }
          }
        }
      } else {
        existingRel.push(impRel);
      }
    });

    if (existingRel.length === 0) {
      existingRel = [{}];
    }
    targetCharacter.data.tables.Relations = existingRel;
  }

  // 11. Monture Table (Skip image)
  if (importedData.tables?.Monture && Array.isArray(importedData.tables.Monture) && importedData.tables.Monture.length > 0) {
    let existingMount = normalizeTableRows(targetCharacter.data.tables.Monture);
    existingMount = existingMount.filter((m) => m && !isBlank(m[0]));

    importedData.tables.Monture.forEach((impMount) => {
      if (!impMount || isBlank(impMount[0])) return;
      const normName = normalizeKey(impMount[0]);

      const matchIdx = existingMount.findIndex((ex) => {
        const exName = Array.isArray(ex) ? ex[0] : ex['0'] || ex.name;
        return normalizeKey(exName) === normName;
      });

      if (matchIdx !== -1) {
        const existing = existingMount[matchIdx];
        if (Array.isArray(existing)) {
          for (let i = 0; i < Math.max(existing.length, impMount.length); i++) {
            if (isBlank(existing[i]) && !isBlank(impMount[i])) {
              existing[i] = impMount[i];
            }
          }
        }
      } else {
        existingMount.push(impMount);
      }
    });

    targetCharacter.data.tables.Monture = existingMount;
  }

  // 12. Note du joueur
  if (importedData.tables?.['Note du joueur'] && Array.isArray(importedData.tables['Note du joueur']) && importedData.tables['Note du joueur'].length > 0) {
    const impNote = importedData.tables['Note du joueur'][0]?.[0] || importedData.tables['Note du joueur'][0]?.['0'] || '';
    if (impNote) {
      const existingNotes = normalizeTableRows(targetCharacter.data.tables['Note du joueur']);
      const currentNote = existingNotes[0]?.[0] || existingNotes[0]?.['0'] || '';
      if (!currentNote) {
        targetCharacter.data.tables['Note du joueur'] = [{ 0: impNote }];
      } else if (!currentNote.includes(impNote)) {
        targetCharacter.data.tables['Note du joueur'] = [{ 0: `${currentNote}\n\n${impNote}` }];
      }
    }
  }

  // 13. Unique Power / powerThemes (Skip image)
  if (importedData.powerThemes && Array.isArray(importedData.powerThemes) && importedData.powerThemes.length > 0) {
    targetCharacter.data.powerThemes ??= [];
    importedData.powerThemes.forEach((impTheme) => {
      if (!impTheme || !Array.isArray(impTheme.powers) || impTheme.powers.length === 0) return;
      if (targetCharacter.data.powerThemes.length === 0) {
        targetCharacter.data.powerThemes.push({
          title: impTheme.title || 'Power Theme 1',
          description: impTheme.description || '',
          image: '', // skipped
          imageSettings: { width: 320, height: 420 },
          powers: impTheme.powers
        });
      } else {
        const currentTheme = targetCharacter.data.powerThemes[0];
        currentTheme.powers ??= [];
        impTheme.powers.forEach((impPower) => {
          if (!impPower || isBlank(impPower.name)) return;
          const exIdx = currentTheme.powers.findIndex((p) => normalizeKey(p.name) === normalizeKey(impPower.name));
          if (exIdx !== -1) {
            const exPower = currentTheme.powers[exIdx];
            if (isBlank(exPower.description) && !isBlank(impPower.description)) exPower.description = impPower.description;
            if (isBlank(exPower.cost) && !isBlank(impPower.cost)) exPower.cost = impPower.cost;
            if (isBlank(exPower.roll) && !isBlank(impPower.roll)) exPower.roll = impPower.roll;
            if (isBlank(exPower.charges) && !isBlank(impPower.charges)) exPower.charges = impPower.charges;
          } else {
            currentTheme.powers.push(impPower);
          }
        });
      }
    });
  }

  targetCharacter.updatedAt = Date.now();
  return targetCharacter;
}

/**
 * Parses raw ArrayBuffer or binary data of an Excel workbook.
 */
export function readWorkbookFromData(data) {
  if (typeof data === 'string') {
    return XLSX.read(data, { type: 'binary' });
  }
  return XLSX.read(data, { type: 'array' });
}
