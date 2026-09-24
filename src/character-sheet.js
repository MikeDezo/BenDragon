import './character-sheet.css';
import OBR from '@owlbear-rodeo/sdk';
import { chartRankCodes, chartRankNames, chartRankValues, chartStatRanges, chartRows, resolveUniversalRoll } from './universal-chart-data.js';
import sadhornUrl from '../sounds/sadhorn.mp3';
import wowUrl from '../sounds/wow.mp3';

const tabs = [
  'Infos', 'Stats', 'Action Types', 'Skills', 'Spell', 'Specialisations',
  'Weapons', 'Armor', 'Inventory', 'Relations', 'Monture', 'Note du joueur',
  'Unique Power'
];

// Proactively purge any legacy character sheet data from browser storage / cache
function purgeBrowserCharacterCache() {
  try {
    localStorage.removeItem('terranova.characterSheets');
    localStorage.removeItem('characterSheets');
    sessionStorage.removeItem('terranova.characterSheets');
    sessionStorage.removeItem('characterSheets');
    if (typeof window !== 'undefined' && 'caches' in window) {
      caches.keys().then((names) => {
        for (const name of names) {
          if (name.includes('character') || name.includes('terranova')) {
            caches.delete(name);
          }
        }
      }).catch(() => {});
    }
  } catch (e) {}
}

purgeBrowserCharacterCache();

const infoFields = [['Player Name', 'playerName'], ['Name', 'name'], ['Gender', 'gender'], ['Origins', 'origins'], ['Age', 'age'], ['Heigth', 'height'], ['Weigth', 'weight'], ['Eyes Color', 'eyesColor'], ['Hairs Color', 'hairColor'], ['Skin Color', 'skinColor'], ['Languages', 'languages'], ['Alphabet', 'alphabet'], ['Gods', 'gods'], ['Xp to spend/Total', 'xp'], ['BackGround', 'background']];
const DEFAULT_TABLE_ROWS = 2;
const stats = ['Fighting', 'Strength', 'Agility', 'Endurance', 'Speed', 'Intelligence', 'Wisdom', 'Intuition', 'Psyche', 'Luck', 'Karma'];
const tables = {
  'Action Types': ['Name', 'Action Type', 'Description', 'Critical 1', 'White', 'Green', 'Yellow', 'Red', 'Natural Red', 'Critical 100'],
  Skills: ['Name', 'Skill Type', 'Stat', 'CS Level', 'Action Type', 'Focus Cost', 'Description', 'White', 'Green', 'Yellow', 'Red', 'Natural Red', 'Critical Red'],
  Spell: ['Name', 'Scell Value', 'Action Type', 'Mana Cost', 'Scells', 'Description', 'Intention', 'White', 'Green', 'Yellow', 'Red', 'Natural Red', 'Critical Red'],
  Specialisations: ['Name', 'Actual LVL', 'Touch Bonus', 'Potential Bonus', 'Special Effect', 'Ini Bonus'],
  Weapons: ['Name', 'Description', 'Specialisation', 'Touch Stat', 'Touch Bonus', 'Damage Bonus Stat', 'Effective Range', 'Yellow Range', 'Red Range', 'Dice', 'Two handed?', 'Quality'],
  Armor: ['Name', 'Base Armor', 'Quality', 'Runes Slots', 'Runes', 'Description'],
  Inventory: ['Qte', 'Name', 'Description', 'Localisation'],
  Relations: ['Name', 'Race', 'Genre', 'Age', 'Link', 'Relation Type', 'Description'],
  Monture: ['Name', 'Type', 'Speed', 'Armor', 'Notes'],
  'Note du joueur': ['Note'],
  'Unique Power': ['Name', 'Description', 'Cost']
};

const ACTION_TYPES_ROWS = [
  ['Attaque Normal', 'Full', 'Une attaque normale représente une attaque effectuée sans compétence particulière, sans spécialisation ou sans technique spéciale.', "Déclenche une attaque d'opportunité de la part de l'adversaire à l'aide d'une Action de Réaction.", 'Échec', 'Réussite', 'Réussite', 'Réussite', 'Coup Critique\n+50% de dégats', 'Coup Critique\n+5 Karma\n+50% de dégats\n+1 Action instantannément'],
  ['Désengagement', 'Full', 'Se désengager d\'un combat en cour.\nRisque d\'attaque d\'opportunité.', '', '-', '-', '-', '-', '-', '-'],
  ["Attaque d'oportunité", 'Free', "Une attaque d'opportunité consomme une Action libre.", "Déclenche une attaque d'opportunité de la part de l'adversaire à l'aide d'une Action de Réaction.", 'Échec', 'Réussite', 'Réussite', 'Réussite', 'Coup Critique\n+50% de dégats', 'Coup Critique\n+5 Karma\n+50% de dégats\n+1 Action instantannément'],
  ['Action libre', 'Free', 'Un personnage peut utiliser un nombre maximal d\'Actions libres par round égal à son nombre d\'Actions normales.\nLes Actions libres ne sont jamais automatiques.\nElles doivent toujours être accordées par une règle, une compétence, une capacité ou une circonstance particulière.\nUne attaque normale ne donne jamais d\'Action libre.\nCertaines règles, comme un Rouge naturel ou un 100 naturel, peuvent accorder des Actions libres supplémentaires qui ne comptent pas dans cette limite.', '', '', '', '', '', '', ''],
  ['Blocage', 'Full, Fighting', "Le Blocage permet d'encaisser une attaque grâce à un bouclier ou à une arme.", '', 'Échec', 'Augmente +10 la valeur de blocage', 'Augmente +20 la valeur de blocage', '- Augmente +30 la valeur de blocage\n\n- Accorde une contre-attaque avec une arme secondaire maîtrisée en Action libre', '- Augmente +40 la valeur de blocage\n\n- L\'Action défensive n\'est pas consommée.\n\n- Accorde une contre-attaque avec une arme secondaire maîtrisée en Action libre.', '+5 Karma\n\n- Évite complètement les dégâts.\n\n- L\'Action défensive n\'est pas consommée.\n\n- Accorde une contre-attaque gratuite avec une arme secondaire maîtrisée, sans utiliser d\'Action libre.'],
  ['Parade', 'Full, Fighting', 'La Parade permet de dévier une attaque de mêlée ou une attaque à distance.', '', 'Échec', 'Réduit 50 % des dégâts.\n\n+ 1 Focus', 'Réduit 75 % des dégâts.\n\n+ 1 Focus', '- Évite complètement les dégâts.\n\n- Accorde une contre-attaque avec une arme secondaire maîtrisée en Action libre.\n\n+ 1 Focus', '- Évite complètement les dégâts.\n\n- L\'Action défensive n\'est pas consommée.\n\n- Accorde une contre-attaque avec une arme secondaire maîtrisée en Action libre.\n\n+ 1 Focus', '+5 Karma\n\n- Évite complètement les dégâts.\n\n- L\'Action défensive n\'est pas consommée.\n\n- Accorde une contre-attaque gratuite avec une arme secondaire maîtrisée, sans utiliser d\'Action libre.\n\n+ 1 Focus'],
  ['Esquive', 'Full, Agilité', "L'Esquive permet d'éviter une attaque de mêlée ou une attaque à distance.", '', 'Échec', 'Évite 50 % des dégâts.', 'Évite complètement les dégâts', '- Évite complètement les dégâts.\n\n- Accorde une contre-attaque avec une arme secondaire maîtrisée en Action libre', '- Évite complètement les dégâts.\n\n- L\'Action défensive n\'est pas consommée.\n\n- Accorde une contre-attaque avec une arme secondaire maîtrisée en Action libre.', '+5 Karma\n\n- Évite complètement les dégâts.\n\n- L\'Action défensive n\'est pas consommée.\n\n- Accorde une contre-attaque gratuite avec une arme secondaire maîtrisée, sans utiliser d\'Action libre.']
];

const DEFAULT_SKILLS_ROWS = [
  ['Acrobaties', 'Hors-Combat', 'Agility', '', '', '', "Garder l'équilibre, faire une roulade, franchir un obstacle difficile, marcher sur une surface étroite", '', '', '', '', '', ''],
  ['Arcanes', 'Hors-Combat', 'Intelligence', '', '', '', "Comprendre la magie, identifier un phénomène magique, reconnaître un sort ou une théorie magique", '', '', '', '', '', ''],
  ['Athlétisme', 'Hors-Combat', 'Depend', '', '', '', "Grimper, sauter, nager, pousser, tirer, accomplir un effort physique", '', '', '', '', '', ''],
  ['Crochetage', 'Hors-Combat', 'Agility', '', '', '', "Ouvrir une serrure, désamorcer un mécanisme simple, manipuler un verrou", '', '', '', '', '', ''],
  ['Discrétion', 'Hors-Combat', 'Agility', '', '', '', "Se cacher, avancer silencieusement, éviter d'être repéré", '', '', '', '', '', ''],
  ['Étiquette', 'Hors-Combat', 'Wisdom', '', '', '', "Connaître les règles de politesse, les usages sociaux, les bonnes manières et le comportement attendu selon le milieu, le rang ou la culture.", '', '', '', '', '', ''],
  ['Intimidation', 'Hors-Combat', 'Depend', '', '', '', "Menacer, imposer sa présence ou forcer quelqu'un à céder", '', '', '', '', '', ''],
  ['Investigation', 'Hors-Combat', 'Intelligence', '', '', '', "Fouiller une pièce, rechercher un indice, comprendre une scène, déduire ce qui s'est passé", '', '', '', '', '', ''],
  ['Lecture des Runes Auroriennes', 'Hors-Combat', 'Intelligence', '', '', '', "Lire, reconnaître et interpréter les runes auroriennes utilisées dans les enchantements, artefacts, mécanismes magitek, sceaux et inscriptions anciennes ou techniques.", '', '', '', '', '', ''],
  ['Orientation', 'Hors-Combat', 'Wisdom', '', '', '', "Lire une carte, utiliser des repères, retrouver son chemin, déterminer une direction", '', '', '', '', '', ''],
  ['Perception', 'Hors-Combat', 'Intuition', '', '', '', "Remarquer un bruit, une silhouette, une odeur, un mouvement ou un détail inhabituel", '', '', '', '', '', ''],
  ['Performance', 'Hors-Combat', 'Psyche', '', '', '', "Jouer de la musique, chanter, danser, raconter une histoire ou captiver un public", '', '', '', '', '', ''],
  ['Perspicacité', 'Hors-Combat', 'Intuition', '', '', '', "Comprendre l'attitude, les intentions ou l'état émotionnel d'une personne", '', '', '', '', '', ''],
  ['Persuasion', 'Hors-Combat', 'Depend', '', '', '', "Convaincre quelqu'un par des arguments sincères ou une négociation", '', '', '', '', '', ''],
  ['Pistage', 'Hors-Combat', 'Intuition', '', '', '', "Suivre des traces, reconnaître le passage d'une créature, déterminer une direction ou l'âge approximatif d'une piste", '', '', '', '', '', ''],
  ['Premier Soins', 'Hors-Combat', 'Depend', '', '', '', "Examiner une blessure, identifier une maladie, stabiliser quelqu'un, déterminer une cause de mort", '', '', '', '', '', ''],
  ['Survie', 'Hors-Combat', 'Endurance', '', '', '', "Trouver de la nourriture, installer un camp, éviter les dangers naturels, survivre dans un environnement hostile", '', '', '', '', '', ''],
  ['Tromperie', 'Hors-Combat', 'Depend', '', '', '', "Mentir, cacher ses intentions, inventer une histoire crédible, maintenir une fausse identité", '', '', '', '', '', ''],
  ['Protocole', 'Hors-Combat', 'Depend', '', '', '', "Connaître et appliquer les procédures officielles, militaires, diplomatiques, administratives ou cérémonielles propres à une institution ou à une autorité.", '', '', '', '', '', '']
];

function isSkillsEmpty(skillsRows) {
  if (!skillsRows) return true;
  let arr = skillsRows;
  if (!Array.isArray(arr)) {
    if (typeof arr === 'object') {
      arr = Object.values(arr);
    } else {
      return true;
    }
  }
  if (arr.length === 0) return true;
  return arr.every((r) => {
    if (!r) return true;
    if (Array.isArray(r)) {
      return r.every((v) => v === undefined || v === null || String(v).trim() === '');
    }
    if (typeof r === 'object') {
      return Object.values(r).every((v) => v === undefined || v === null || String(v).trim() === '');
    }
    return true;
  });
}

const app = document.querySelector('#root');
let activeTab = 'Infos';
let state = { characters: {}, assignments: {}, rollHistory: [], initiativeTracker: {}, knownPlayers: {} };
let user = { id: 'local-player', name: 'Local Player', role: 'GM' };
let players = [];
let activeCharacterId = null;

function getAvailableTabs() {
  if (user.role === 'GM') {
    return ['Rolls & Ini', ...tabs];
  }
  return tabs;
}

function updateUserRole(newRole, newName) {
  let changed = false;
  if (newRole && user.role !== newRole) {
    user.role = newRole;
    changed = true;
  }
  if (newName && user.name !== newName) {
    user.name = newName;
    changed = true;
  }

  if (user.role !== 'GM') {
    const myChars = getAssignedCharacters(user.id);
    if (!myChars.some(([id]) => id === activeCharacterId)) {
      activeCharacterId = myChars[0]?.[0] || null;
    }
    if (activeTab === 'Rolls & Ini' || !getAvailableTabs().includes(activeTab)) {
      activeTab = 'Infos';
    }
  } else {
    if (!activeCharacterId || !state.characters[activeCharacterId]) {
      const sorted = getSortedDmCharacterEntries();
      activeCharacterId = sorted[0]?.[0] || Object.keys(state.characters)[0] || null;
    }
  }

  try {
    localStorage.setItem('terranova.currentUser', JSON.stringify(user));
    if (activeCharacterId) {
      localStorage.setItem('terranova.activeCharId', activeCharacterId);
    } else {
      localStorage.removeItem('terranova.activeCharId');
    }
    localStorage.setItem('terranova.activeTab', activeTab);
  } catch (e) {}

  return changed;
}

const esc = (value = '') => String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const blankCharacter = (name = 'New Character') => ({
  name,
  ownerId: null,
  ownerName: '',
  updatedAt: Date.now(),
  data: {
    info: {},
    stats: {
      Fighting: '6',
      Strength: '6',
      Agility: '6',
      Endurance: '6',
      Speed: '6',
      Intelligence: '6',
      Wisdom: '6',
      Intuition: '6',
      Psyche: '6',
      Luck: '0',
      Karma: '0',
      CombatCapacityBonus: '0',
      ManaPoolBonus: '0',
      Focus: '0',
      FullRestante: '0',
      FreeRestante: '0'
    },
    tables: {
      Weapons: Array.from({ length: DEFAULT_TABLE_ROWS }, () => ({})),
      Armor: Array.from({ length: DEFAULT_TABLE_ROWS }, () => ({})),
      Inventory: Array.from({ length: DEFAULT_TABLE_ROWS }, () => ({})),
      Relations: Array.from({ length: DEFAULT_TABLE_ROWS }, () => ({})),
      Skills: DEFAULT_SKILLS_ROWS.map((row) => [...row]),
      Specialisations: Array.from({ length: DEFAULT_TABLE_ROWS }, () => ({
        1: 'Unspecialised', 2: '0', 3: '0', 4: [], 5: '0'
      })),
      Spell: [
        [
          'Counter Spell',
          '2',
          'Normal',
          '10',
          '2 x Spirit',
          'Counter Spell est un sort de défense universel contre les éléments matériels de Boréalis.',
          'Sceaux 1 - Rassemble la mana vers la main\nSceaux 2 - En position compresser la mana pour amortir le sort',
          'Fail',
          '(Fgt/10)D6 + (MP/4) Vs Energy',
          '(Fgt/10)D6 + ((MP/4)*1.25) Vs Energy',
          '(Fgt/10)D6 + ((MP/4)*1.5) Vs Energy',
          '(Fgt/10)D6 + ((MP/4)*2) Vs Energy',
          '(Fgt/10)D6 + ((MP/4)*3) Vs Energy'
        ],
        {}
      ],
      'Note du joueur': [{}]
    },
    powerThemes: [
      {
        title: 'Power Theme 1',
        description: '',
        image: '',
        imageSettings: { width: 320, height: 420 },
        powers: [
          { name: '', description: '', roll: 'No Roll', cost: '', charges: '' },
          { name: '', description: '', roll: 'No Roll', cost: '', charges: '' }
        ]
      }
    ],
    imageSettings: { width: 320, height: 480 }
  }
});

function isCharacterAssigned(id, char) {
  if (char?.ownerId) return true;
  if (!state.assignments) return false;
  return Object.values(state.assignments).some((val) => {
    if (Array.isArray(val)) return val.includes(id);
    return val === id;
  });
}

function registerKnownPlayer(id, name, role) {
  if (!id) return;
  state.knownPlayers ??= {};
  const current = state.knownPlayers[id] || {};
  state.knownPlayers[id] = {
    id,
    name: name || current.name || 'Player',
    role: role || current.role || 'PLAYER',
    lastSeen: Date.now()
  };
}

function updateKnownPlayers(playerList = []) {
  state.knownPlayers ??= {};
  if (user?.id) {
    registerKnownPlayer(user.id, user.name, user.role);
  }
  (playerList || []).forEach((p) => {
    if (p?.id) {
      registerKnownPlayer(p.id, p.name, p.role);
    }
  });
}

function getAssignablePlayers(currentChar = null) {
  state.knownPlayers ??= {};
  const map = new Map();

  // 1. Current user (including DM)
  if (user && user.id) {
    map.set(user.id, {
      id: user.id,
      name: user.name || (user.role === 'GM' ? 'DM' : 'Player'),
      role: user.role || 'GM',
      isOnline: true,
      isSelf: true
    });
  }

  // 2. Currently connected party members
  (players || []).forEach((p) => {
    if (p && p.id) {
      const existing = map.get(p.id);
      map.set(p.id, {
        id: p.id,
        name: p.name || existing?.name || 'Player',
        role: p.role || existing?.role || 'PLAYER',
        isOnline: true,
        isSelf: p.id === user.id
      });
    }
  });

  // 3. Known players from state
  if (state.knownPlayers) {
    Object.values(state.knownPlayers).forEach((kp) => {
      if (kp && kp.id && !map.has(kp.id)) {
        map.set(kp.id, {
          id: kp.id,
          name: kp.name || 'Player',
          role: kp.role || 'PLAYER',
          isOnline: false,
          isSelf: kp.id === user.id
        });
      }
    });
  }

  // 4. Any assigned owner from any character in state
  Object.values(state.characters || {}).forEach((c) => {
    if (c?.ownerId && !map.has(c.ownerId)) {
      map.set(c.ownerId, {
        id: c.ownerId,
        name: c.ownerName || 'Player',
        role: 'PLAYER',
        isOnline: false,
        isSelf: c.ownerId === user.id
      });
    }
  });

  // 5. Current character's assigned owner if not yet in map
  if (currentChar?.ownerId && !map.has(currentChar.ownerId)) {
    map.set(currentChar.ownerId, {
      id: currentChar.ownerId,
      name: currentChar.ownerName || 'Player',
      role: 'PLAYER',
      isOnline: false,
      isSelf: currentChar.ownerId === user.id
    });
  }

  return Array.from(map.values()).sort((a, b) => {
    if (a.id === user.id && b.id !== user.id) return -1;
    if (b.id === user.id && a.id !== user.id) return 1;
    if (a.isOnline !== b.isOnline) return a.isOnline ? -1 : 1;
    return a.name.localeCompare(b.name, undefined, { sensitivity: 'base', numeric: true });
  });
}

function getSortedDmCharacterEntries() {
  return Object.entries(state.characters || {}).sort(([idA, itemA], [idB, itemB]) => {
    const isAssignedA = isCharacterAssigned(idA, itemA);
    const isAssignedB = isCharacterAssigned(idB, itemB);
    if (isAssignedA !== isAssignedB) {
      return isAssignedA ? 1 : -1;
    }
    const nameA = String(itemA?.name || idA || '').trim();
    const nameB = String(itemB?.name || idB || '').trim();
    return nameA.localeCompare(nameB, undefined, { sensitivity: 'base', numeric: true });
  });
}

let tableSortState = {};
let powerThemeSortState = {};
let iniSortState = { colKey: 'order', direction: 'asc' };
let rollHistorySortState = { colKey: 'time', direction: 'desc' };

function compareValues(valA, valB, direction = 'asc') {
  if (Array.isArray(valA)) valA = valA.filter(Boolean).join(', ');
  if (Array.isArray(valB)) valB = valB.filter(Boolean).join(', ');

  if (typeof valA === 'boolean' || typeof valB === 'boolean') {
    valA = valA ? 1 : 0;
    valB = valB ? 1 : 0;
  }

  const strA = valA != null ? String(valA).trim() : '';
  const strB = valB != null ? String(valB).trim() : '';

  const emptyA = strA === '' || strA === '-' || strA === '—';
  const emptyB = strB === '' || strB === '-' || strB === '—';
  if (emptyA && emptyB) return 0;
  if (emptyA) return 1;
  if (emptyB) return -1;

  const numA = Number(strA);
  const numB = Number(strB);
  const isNumA = !isNaN(numA) && !isNaN(parseFloat(strA));
  const isNumB = !isNaN(numB) && !isNaN(parseFloat(strB));

  let cmp = 0;
  if (isNumA && isNumB) {
    cmp = numA - numB;
  } else {
    cmp = strA.localeCompare(strB, undefined, { numeric: true, sensitivity: 'base' });
  }

  return direction === 'desc' ? -cmp : cmp;
}

async function sortTable(tableName, columnIndex) {
  const headers = tables[tableName];
  if (!headers) return;
  const colName = headers[columnIndex];

  const currentSort = tableSortState[tableName];
  let direction = 'asc';
  if (currentSort && currentSort.colIndex === columnIndex) {
    direction = currentSort.direction === 'asc' ? 'desc' : 'asc';
  }
  tableSortState[tableName] = { colIndex: columnIndex, colName, direction };

  if (tableName === 'Action Types') {
    ACTION_TYPES_ROWS.sort((rowA, rowB) => {
      const valA = rowA[columnIndex];
      const valB = rowB[columnIndex];
      return compareValues(valA, valB, direction);
    });
    render();
    return;
  }

  const character = currentCharacter();
  if (!character || !canEditCurrent()) {
    render();
    return;
  }

  character.data.tables ??= {};
  let rows = character.data.tables[tableName];
  if (!Array.isArray(rows)) {
    if (rows && typeof rows === 'object') {
      rows = Object.keys(rows).sort((a, b) => Number(a) - Number(b)).map((key) => rows[key]);
    } else {
      rows = [];
    }
  }

  const weaponStorageColumns = [0, 12, 9, 1, 11, 2, 3, 4, 5, 6, 10, 8];
  const sourceColumnIndex = tableName === 'Weapons' ? weaponStorageColumns[columnIndex] : columnIndex;

  rows.sort((rowA, rowB) => {
    let valA = rowA ? rowA[sourceColumnIndex] : '';
    let valB = rowB ? rowB[sourceColumnIndex] : '';

    if (tableName === 'Specialisations') {
      if (sourceColumnIndex === 1) {
        valA = valA || 'Unspecialised';
        valB = valB || 'Unspecialised';
      } else if ([2, 3, 5].includes(sourceColumnIndex)) {
        valA = valA || '0';
        valB = valB || '0';
      }
    } else if (tableName === 'Weapons') {
      if (headers[columnIndex] === 'Two handed?') {
        valA = Boolean(rowA?.[10]);
        valB = Boolean(rowB?.[10]);
      }
    }

    return compareValues(valA, valB, direction);
  });

  character.data.tables[tableName] = rows;
  character.updatedAt = Date.now();
  state.updatedAt = Date.now();
  await save();
  render();
}

async function sortPowerThemeTable(themeIdx, colKey) {
  const character = currentCharacter();
  if (!character || !canEditCurrent()) return;
  const themes = getPowerThemes(character);
  const theme = themes[themeIdx];
  if (!theme || !Array.isArray(theme.powers)) return;

  const currentSort = powerThemeSortState[themeIdx];
  let direction = 'asc';
  if (currentSort && currentSort.colKey === colKey) {
    direction = currentSort.direction === 'asc' ? 'desc' : 'asc';
  }
  powerThemeSortState[themeIdx] = { colKey, direction };

  theme.powers.sort((pA, pB) => {
    if (colKey === 'roll') {
      const rankA = getUniversalRankVal(pA?.roll);
      const rankB = getUniversalRankVal(pB?.roll);
      if (rankA != null && rankB != null) {
        return direction === 'desc' ? rankB - rankA : rankA - rankB;
      }
    }
    const valA = pA ? pA[colKey] : '';
    const valB = pB ? pB[colKey] : '';
    return compareValues(valA, valB, direction);
  });

  character.updatedAt = Date.now();
  state.updatedAt = Date.now();
  await save();
  render();
}

function getAssignedCharacters(userId) {
  if (!userId) return [];
  return Object.entries(state.characters).filter(([id, char]) => {
    if (char.ownerId === userId) return true;
    const direct = state.assignments?.[userId];
    if (Array.isArray(direct)) return direct.includes(id);
    return direct === id;
  }).sort(([idA, itemA], [idB, itemB]) => {
    const nameA = String(itemA?.name || idA || '').trim();
    const nameB = String(itemB?.name || idB || '').trim();
    return nameA.localeCompare(nameB, undefined, { sensitivity: 'base', numeric: true });
  });
}

function currentCharacter() {
  if (user.role === 'GM') {
    if (activeCharacterId && state.characters[activeCharacterId]) {
      return state.characters[activeCharacterId];
    }
    const sorted = getSortedDmCharacterEntries();
    if (sorted.length > 0) {
      activeCharacterId = sorted[0][0];
      return sorted[0][1];
    }
    return null;
  }
  const myChars = getAssignedCharacters(user.id);
  if (!myChars.length) {
    activeCharacterId = null;
    return null;
  }
  const found = myChars.find(([id]) => id === activeCharacterId);
  if (found) return found[1];
  activeCharacterId = myChars[0][0];
  return myChars[0][1];
}

function canEditCurrent() {
  if (!currentCharacter()) return false;
  if (user.role === 'GM') return true;
  const myChars = getAssignedCharacters(user.id);
  return myChars.some(([id]) => id === activeCharacterId);
}

function autoResizeTextarea(el) {
  if (!el || el.tagName !== 'TEXTAREA') return;
  el.style.height = 'auto';
  const scrollH = el.scrollHeight;
  if (scrollH > 0) {
    el.style.height = `${scrollH}px`;
  }
}

function autoResizeAllTextareas(container = app) {
  if (!container) return;
  requestAnimationFrame(() => {
    container.querySelectorAll('textarea').forEach((ta) => {
      autoResizeTextarea(ta);
    });
  });
}

function getPlayerColumnWidthsKey() {
  const playerId = user?.id || 'local-player';
  return `terranova.tableColWidths.${playerId}`;
}

function getPlayerColumnWidths(tableName) {
  try {
    const key = getPlayerColumnWidthsKey();
    const data = JSON.parse(localStorage.getItem(key) || '{}');
    return data[tableName] || {};
  } catch (e) {
    return {};
  }
}

function savePlayerColumnWidth(tableName, colName, width) {
  try {
    const key = getPlayerColumnWidthsKey();
    const data = JSON.parse(localStorage.getItem(key) || '{}');
    if (!data[tableName]) data[tableName] = {};
    if (width === null || width === undefined) {
      delete data[tableName][colName];
    } else {
      data[tableName][colName] = Math.round(width);
    }
    localStorage.setItem(key, JSON.stringify(data));
  } catch (e) {}
}

const specialisationLevels = {
  Unspecialised: { touch: '0', potential: '0', ini: '0', colors: [], defaults: [] },
  Novice: { touch: '+5', potential: '+5', ini: '+1', colors: [null], defaults: ['Quick Draw'] },
  Apprentice: { touch: '+10', potential: '+10', ini: '+2', colors: [null, 'red'] },
  Adept: { touch: '+15', potential: '+15', ini: '+3', colors: [null, 'yellow'] },
  Expert: { touch: '+20', potential: '+20', ini: '+4', colors: [null, 'yellow', 'red'], defaults: [null, null, 'Combo on naturel red'] },
  Master: { touch: '+25', potential: '+25', ini: '+5', colors: [null, 'yellow', 'red', 'dark-red'] }
};

function evaluateSafeMath(expr) {
  if (!expr || typeof expr !== 'string') return null;
  if (!/^[0-9\.\+\-\*\/\%\(\)\s]+$/.test(expr)) return null;
  try {
    const val = Function('"use strict"; return (' + expr + ')')();
    if (typeof val === 'number' && !isNaN(val) && isFinite(val)) {
      return val;
    }
  } catch (e) {}
  return null;
}

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
        const foundIdx = rawWeapons.findIndex((w) => (w?.[0] || '').trim().toLowerCase() === cleanSelector);
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
  const weaponName = weapon[0] || (rawWeapons.length > 0 ? `Weapon ${targetIdx + 1}` : 'Weapon');
  const specName = (typeof weapon[2] === 'string' && weapon[2] && !/^\d+d\d+/i.test(weapon[2]) ? weapon[2] : weapon[9]) || '';
  const touchStatName = (weapon[3] && ['Fighting', 'Strength', 'Agility', 'Endurance', 'Speed', 'Intelligence', 'Wisdom', 'Intuition', 'Psyche'].includes(weapon[3]) ? weapon[3] : (weapon[1] && ['Fighting', 'Strength', 'Agility', 'Endurance', 'Speed', 'Intelligence', 'Wisdom', 'Intuition', 'Psyche'].includes(weapon[1]) ? weapon[1] : 'Fighting'));
  const weaponTouchBonus = parseInt(weapon[4] !== undefined && weapon[4] !== '' ? weapon[4] : weapon[11]) || 0;
  const damageBonusStatName = (weapon[5] && ['Fighting', 'Strength', 'Agility', 'Endurance', 'Speed', 'Intelligence', 'Wisdom', 'Intuition', 'Psyche'].includes(weapon[5]) ? weapon[5] : (weapon[2] && ['Fighting', 'Strength', 'Agility', 'Endurance', 'Speed', 'Intelligence', 'Wisdom', 'Intuition', 'Psyche'].includes(weapon[2]) ? weapon[2] : 'Strength'));
  const diceStr = weapon[9] || weapon[6] || '1D10';
  const twoHanded = weapon[10] === true || weapon[10] === 'true' || weapon[10] === 'on' || weapon['10'] === true || weapon['10'] === 'true' || weapon['10'] === 'on' || weapon['Two handed?'] === true || weapon.twoHanded === true;

  const specRow = rawSpecs.find((s) => (s[0] || '').trim() === (specName || '').trim() && (specName || '').trim() !== '');
  const specIniBonus = specRow ? (parseInt(specRow[5]) || 0) : 0;
  const specTouchBonus = specRow ? (parseInt(specRow[2]) || 0) : 0;
  const specPotentialBonus = specRow ? (parseInt(specRow[3]) || 0) : 0;

  const total1stBonus = Math.floor(numIntuition / 10) + specIniBonus;
  const totalNextBonus = Math.floor(numSpeed / 10) + specIniBonus;

  const touchStatVal = parseFloat(st[touchStatName] ?? (touchStatName === 'Fighting' ? numFighting : (touchStatName === 'Agility' ? numAgility : '6'))) || 0;
  const totalTouchVal = touchStatVal + weaponTouchBonus + specTouchBonus;

  const fightMult = Math.max(1, Math.floor(numFighting / 10));
  const dMatch = diceStr.match(/^(\d*)\s*[dD]\s*(\d+)/);
  const baseCount = dMatch ? (parseInt(dMatch[1]) || 1) : 1;
  const dieSides = dMatch ? parseInt(dMatch[2]) : 10;
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

function getCharacterStatsMap(character) {
  const st = character?.data?.stats || {};
  const fgt = parseFloat(st.Fighting ?? st['Combat Capacity'] ?? '6') || 0;
  const str = parseFloat(st.Strength ?? '6') || 0;
  const agi = parseFloat(st.Agility ?? '6') || 0;
  const end = parseFloat(st.Endurance ?? '6') || 0;
  const spd = parseFloat(st.Speed ?? st.Movement ?? '6') || 0;
  const intVal = parseFloat(st.Intelligence ?? '6') || 0;
  const wis = parseFloat(st.Wisdom ?? '6') || 0;
  const intu = parseFloat(st.Intuition ?? '6') || 0;
  const psy = parseFloat(st.Psyche ?? '6') || 0;
  const cc = str + agi + end + spd;
  const mp = intVal + wis + intu + psy;

  const map = {
    Fighting: fgt,
    Fgt: fgt,
    Strength: str,
    Stength: str,
    Str: str,
    Agility: agi,
    Agi: agi,
    Endurance: end,
    End: end,
    Speed: spd,
    Spd: spd,
    Spe: spd,
    Intelligence: intVal,
    Intel: intVal,
    Int: intVal,
    Wisdom: wis,
    Wis: wis,
    Intuition: intu,
    Intui: intu,
    Intu: intu,
    Psyche: psy,
    Psy: psy,
    'Combat Capacity': cc,
    CC: cc,
    'Mana Pool': mp,
    MP: mp
  };

  const storedSpecs = character?.data?.tables?.Specialisations;
  const rawSpecs = Array.isArray(storedSpecs)
    ? storedSpecs
    : (storedSpecs && typeof storedSpecs === 'object' ? Object.values(storedSpecs) : []);

  rawSpecs.forEach((row) => {
    if (!row) return;
    const name = String(Array.isArray(row) ? row[0] : (row[0] || row.name || '')).trim();
    if (!name) return;
    const lvl = String(Array.isArray(row) ? row[1] : (row[1] || row.level || '')).trim();
    const cfg = specialisationLevels[lvl] || specialisationLevels.Unspecialised || { touch: '0', potential: '0', ini: '0' };

    const tb = (row[2] !== undefined && row[2] !== '' && !isNaN(parseInt(row[2]))) ? parseInt(row[2]) : (parseInt(cfg.touch) || 0);
    const pb = (row[3] !== undefined && row[3] !== '' && !isNaN(parseInt(row[3]))) ? parseInt(row[3]) : (parseInt(cfg.potential) || 0);
    const ib = (row[5] !== undefined && row[5] !== '' && !isNaN(parseInt(row[5]))) ? parseInt(row[5]) : (parseInt(cfg.ini) || 0);

    const variations = Array.from(new Set([name, name.replace(/\s+/g, ''), name.replace(/\s+/g, '_')])).filter(Boolean);
    variations.forEach((v) => {
      map[`${v}TB`] = tb;
      map[`${v} TB`] = tb;
      map[`${v}_TB`] = tb;

      map[`${v}PB`] = pb;
      map[`${v} PB`] = pb;
      map[`${v}_PB`] = pb;

      map[`${v}IB`] = ib;
      map[`${v} IB`] = ib;
      map[`${v}_IB`] = ib;
    });
  });

  const weaponInfo = getSelectedWeaponDamageInfo(character);
  const dmgExpr = weaponInfo.damageExpr;

  const weaponAliases = [
    'WeaponDamage',
    'Weapon Damage',
    'Weapon_Damage',
    'weapondamage',
    'weaponDamage',
    'WEAPONDAMAGE',
    'WeaponDmg',
    'Weapon Dmg',
    'Weapon_Dmg',
    'weapondmg'
  ];

  weaponAliases.forEach((alias) => {
    map[alias] = dmgExpr;
  });

  map['WeaponFlatDamage'] = weaponInfo.totalFlatBonus;
  map['WeaponFlatBonus'] = weaponInfo.totalFlatBonus;
  map['WeaponDice'] = weaponInfo.finalDiceStr;
  map['WeaponName'] = weaponInfo.weaponName;

  map._weaponInfo = weaponInfo;
  map._character = character;

  return map;
}

function simplifyDiceExpression(str) {
  if (!str || typeof str !== 'string') return str;
  const trimmed = str.trim();
  if (!trimmed) return '';

  const dicePattern = /([+\-]?)\s*(\d*)\s*[dD]\s*(\d+)/g;
  const diceMatches = Array.from(trimmed.matchAll(dicePattern));
  if (diceMatches.length === 0) return trimmed;

  let mathPortion = trimmed;
  let textSuffix = '';

  const matchSuffix = trimmed.match(/^([+\-\d\s\*\/\%\(\)dD\.]+?)(\s+(?![dD]\d+\b)[A-Za-z].*)$/);
  if (matchSuffix) {
    mathPortion = matchSuffix[1].trim();
    textSuffix = matchSuffix[2];
  }

  const withoutDiceExpr = mathPortion.replace(/([+\-]?)\s*(\d*)\s*[dD]\s*(\d+)/g, (match, sign) => {
    return (sign === '-' ? ' - 0 ' : ' + 0 ');
  });

  const flatVal = evaluateSafeMath(withoutDiceExpr);
  if (flatVal === null) {
    return trimmed;
  }

  const diceList = [];
  const sidesMap = new Map();

  for (const m of mathPortion.matchAll(/([+\-]?)\s*(\d*)\s*[dD]\s*(\d+)/g)) {
    const sign = m[1] === '-' ? -1 : 1;
    const count = (m[2] ? parseInt(m[2], 10) : 1) * sign;
    const sides = parseInt(m[3], 10);
    if (!sidesMap.has(sides)) {
      const entry = { sides, count: 0 };
      sidesMap.set(sides, entry);
      diceList.push(entry);
    }
    sidesMap.get(sides).count += count;
  }

  const diceParts = [];
  for (const entry of diceList) {
    if (entry.count !== 0) {
      if (entry.count > 0 && diceParts.length > 0) {
        diceParts.push('+ ' + entry.count + 'D' + entry.sides);
      } else if (entry.count < 0) {
        diceParts.push('- ' + Math.abs(entry.count) + 'D' + entry.sides);
      } else {
        diceParts.push(entry.count + 'D' + entry.sides);
      }
    }
  }

  if (diceParts.length === 0) {
    return String(Math.floor(flatVal)) + textSuffix;
  }

  const roundedFlat = Math.floor(flatVal);
  let res = diceParts.join(' ');
  if (roundedFlat > 0) {
    res += ' + ' + roundedFlat;
  } else if (roundedFlat < 0) {
    res += ' - ' + Math.abs(roundedFlat);
  }

  return res + textSuffix;
}

function translateFormula(formula, stats) {
  if (!formula || typeof formula !== 'string') return '';

  const statAliases = {
    fgt: 'Fighting',
    fighting: 'Fighting',
    str: 'Strength',
    strength: 'Strength',
    stength: 'Strength',
    agi: 'Agility',
    agility: 'Agility',
    end: 'Endurance',
    endurance: 'Endurance',
    spd: 'Speed',
    speed: 'Speed',
    spe: 'Speed',
    int: 'Intelligence',
    intel: 'Intelligence',
    intelligence: 'Intelligence',
    wis: 'Wisdom',
    wisdom: 'Wisdom',
    intu: 'Intuition',
    intui: 'Intuition',
    intuition: 'Intuition',
    psy: 'Psyche',
    psyche: 'Psyche',
    cc: 'Combat Capacity',
    'combat capacity': 'Combat Capacity',
    mp: 'Mana Pool',
    'mana pool': 'Mana Pool',
    weapondamage: 'WeaponDamage',
    'weapon damage': 'WeaponDamage',
    weapon_damage: 'WeaponDamage',
    weapondmg: 'WeaponDamage',
    'weapon dmg': 'WeaponDamage',
    weapon_dmg: 'WeaponDamage'
  };

  let result = formula.trim();
  if (result.startsWith('=')) {
    result = result.slice(1).trim();
  }

  // Compatibility with direct Excel ROUNDDOWN formulas
  if (/ROUNDDOWN/i.test(result)) {
    result = result.replace(/ROUNDDOWN\(([^,]+),\s*\d+\)/gi, '($1)');
    result = result.replace(/\s*&\s*/g, ' ');
    result = result.replace(/"([^"]*)"/g, '$1');
  }

  // Handle WeaponDamage() or WeaponDamage(param) function call syntax
  result = result.replace(/\b(WeaponDamage|Weapon\s*Damage|Weapon_Damage|weapondamage|weapondmg|WeaponDmg)\s*\(([^)]*)\)/gi, (match, fnName, rawArgs) => {
    const arg = (rawArgs || '').trim();
    if (!arg) {
      return stats?.WeaponDamage || stats?._weaponInfo?.damageExpr || '1D10';
    }
    if (stats?._character) {
      const specific = getSelectedWeaponDamageInfo(stats._character, arg);
      return specific.damageExpr;
    }
    return stats?.WeaponDamage || stats?._weaponInfo?.damageExpr || '1D10';
  });

  const allKeys = Object.keys(stats).sort((a, b) => b.length - a.length);
  const escapedKeys = allKeys.map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
  const baseStatPattern = 'Fighting|Fgt|Strength|Stength|Str|Agility|Agi|Endurance|End|Speed|Spd|Spe|Intelligence|Intel|Int|Wisdom|Wis|Intuition|Intui|Intu|Psyche|Psy|Combat Capacity|CC|Mana Pool|MP|WeaponDamage|Weapon Damage|Weapon_Damage|weapondamage|weapondmg';
  const fullPattern = escapedKeys ? `(?:${escapedKeys}|${baseStatPattern})` : baseStatPattern;
  const tokenRegex = new RegExp(`\\b(${fullPattern})\\b`, 'gi');

  function replaceStats(str) {
    let replaced = str.replace(tokenRegex, (match) => {
      const trimmed = match.trim();
      if (stats[trimmed] !== undefined) {
        const val = stats[trimmed];
        return typeof val === 'number' ? String(val) : (val != null ? String(val) : match);
      }
      const lower = trimmed.toLowerCase();
      for (const k of Object.keys(stats)) {
        if (k.toLowerCase() === lower) {
          const val = stats[k];
          return typeof val === 'number' ? String(val) : (val != null ? String(val) : match);
        }
      }
      const canonical = statAliases[lower] || match;
      const val = stats[canonical] ?? stats[match] ?? stats[lower.toUpperCase()];
      return typeof val === 'number' ? String(val) : (val != null ? String(val) : match);
    });

    // Fallback for any other [SpecName](IB|TB|PB) pattern (case-insensitive)
    replaced = replaced.replace(/\b([A-Za-z0-9_\s]+?)\s*(IB|TB|PB)\b/gi, (match, specPart, suffixPart) => {
      const cleanSpec = specPart.trim().toLowerCase().replace(/[\s_\W]+/g, '');
      const suf = suffixPart.toUpperCase();
      for (const k of Object.keys(stats)) {
        const kClean = k.toLowerCase().replace(/[\s_\W]+/g, '');
        if (kClean.endsWith(suf.toLowerCase())) {
          const kPrefix = kClean.slice(0, -suf.length);
          if (kPrefix && (kPrefix === cleanSpec || kPrefix.startsWith(cleanSpec))) {
            const val = stats[k];
            return typeof val === 'number' ? String(val) : (val != null ? String(val) : '0');
          }
        }
      }
      return match;
    });

    return replaced;
  }

  // Replace all stat abbreviations, specialisation identifiers and WeaponDamage with values
  result = replaceStats(result);

  // Clean spaced dice
  result = result.replace(/(\d+)\s*[dD]\s*(\d+)/g, '$1D$2');

  // Evaluate parentheses from innermost to outermost
  // Inner nested parentheses evaluate as exact floats, and outermost/standalone parentheses round down
  for (let iter = 0; iter < 10; iter++) {
    const next = result.replace(/\(([^()]+)\)/g, (match, inner, offset, fullStr) => {
      const val = evaluateSafeMath(inner);
      if (val === null) return match;

      let openBefore = 0;
      for (let i = 0; i < offset; i++) {
        if (fullStr[i] === '(') openBefore++;
        else if (fullStr[i] === ')') openBefore--;
      }

      if (openBefore > 0) {
        return String(val);
      } else {
        return String(Math.floor(val));
      }
    });
    if (next === result) break;
    result = next;
  }

  // If the entire remaining string is an arithmetic expression, evaluate and floor it
  const wholeVal = evaluateSafeMath(result);
  if (wholeVal !== null) {
    return String(Math.floor(wholeVal));
  }

  // Simplify dice arithmetic (e.g. 1D10 + 15 + 10 -> 1D10 + 25)
  result = simplifyDiceExpression(result);

  return result;
}

function formulaCellHtml(path, value, character) {
  const statsMap = getCharacterStatsMap(character);
  const translated = translateFormula(value, statsMap);
  const hasValue = Boolean(value && String(value).trim());
  return `<div class="formula-cell">
    <div class="formula-subline formula-input-line">
      <textarea class="cell-input formula-input" data-path="${path}" rows="1" placeholder="Formula or text">${esc(value || '')}</textarea>
    </div>
    <div class="formula-subline formula-result-line" data-formula-result="${path}" title="Translated value">
      <span class="formula-result-text ${!hasValue ? 'formula-result-empty' : ''}">${esc(hasValue ? (translated || value) : '—')}</span>
    </div>
  </div>`;
}

function editable(path, value, className = 'field-input', placeholder = '') {
  return `<textarea class="${className}" data-path="${path}" rows="1"${placeholder ? ` placeholder="${esc(placeholder)}"` : ''}>${esc(value)}</textarea>`;
}

function editableInteger(path, value, className = 'cell-input', attributes = '') {
  return `<input type="number" class="${className}" data-path="${path}" data-integer="true" step="1" inputmode="numeric" value="${esc(value)}"${attributes ? ` ${attributes}` : ''}>`;
}

function readOnlyCell(value) {
  return `<span class="cell-readonly">${esc(value)}</span>`;
}

function editableSelect(path, value, options, className = 'cell-select', attributes = '') {
  const strVal = value == null ? '' : String(value);
  const isCustom = strVal && !options.some((opt) => String(opt) === strVal);
  const optsHtml = [
    '<option value="">-- Select --</option>',
    ...options.map((opt) => `<option value="${esc(opt)}" ${String(opt) === strVal ? 'selected' : ''}>${esc(opt)}</option>`),
    ...(isCustom ? [`<option value="${esc(strVal)}" selected>${esc(strVal)}</option>`] : [])
  ].join('');
  return `<select class="${className}" data-path="${path}" ${attributes}>${optsHtml}</select>`;
}

function armorRunesInputs(path, value, slotsCount, rowIndex) {
  const count = Math.max(0, parseInt(slotsCount) || 0);
  const values = Array.isArray(value) ? value : (typeof value === 'string' && value ? [value] : []);
  if (count === 0) {
    return `<div class="armor-runes-container" data-armor-runes-container="${rowIndex}"><span class="cell-readonly runes-empty-note">0 slots</span></div>`;
  }
  const lines = [];
  for (let i = 0; i < count; i++) {
    const val = values[i] || '';
    lines.push(
      `<div class="armor-rune-line">` +
        `<span class="armor-rune-badge">R${i + 1}</span>` +
        `<input type="text" class="cell-input rune-input" data-armor-rune-path="${path}" data-armor-rune-index="${i}" value="${esc(val)}" placeholder="Rune ${i + 1}" />` +
      `</div>`
    );
  }
  return `<div class="armor-runes-container" data-armor-runes-container="${rowIndex}">${lines.join('')}</div>`;
}

function bindArmorRuneInputs(container = app) {
  container.querySelectorAll('[data-armor-rune-path]').forEach((input) => {
    const updateRune = () => {
      const runePath = input.dataset.armorRunePath;
      const rowPath = runePath.split('.').slice(0, -1).join('.');
      const row = getPath(rowPath);
      if (!row) return;
      if (!Array.isArray(row[4])) {
        row[4] = typeof row[4] === 'string' && row[4] ? [row[4]] : [];
      }
      const idx = Number(input.dataset.armorRuneIndex);
      row[4][idx] = input.value;
      queueSave();
    };
    input.addEventListener('input', updateRune);
    input.addEventListener('blur', updateRune);
    input.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        input.blur();
      }
    });
  });
}

function editableCheckbox(path, value) {
  const checked = value === true || value === 'true' || value === 'on';
  return `<label class="checkbox-cell"><input type="checkbox" data-path="${path}" data-checkbox="true" aria-label="Two handed" ${checked ? 'checked' : ''}></label>`;
}

function applySpecialisationLevel(row, level) {
  const config = specialisationLevels[level];
  if (!config) return;
  row[1] = level;
  row[2] = config.touch;
  row[3] = config.potential;
  row[5] = config.ini;
  const previousEffects = Array.isArray(row[4]) ? row[4] : [row[4] || ''];
  row[4] = config.colors.map((_, index) => config.defaults?.[index] ?? previousEffects[index] ?? '');
}

function specialisationEffectInputs(path, value, level) {
  const config = specialisationLevels[level];
  const values = Array.isArray(value) ? value : [value || ''];
  if (config?.colors.length === 0) return '';
  if (!config) {
    return `<textarea class="cell-input special-effect-input" data-special-effect-path="${path}" data-special-effect-index="0" rows="1">${esc(values[0])}</textarea>`;
  }
  return config.colors.map((color, index) => `<textarea class="cell-input special-effect-input${color ? ` special-effect-${color}` : ''}" data-special-effect-path="${path}" data-special-effect-index="${index}" rows="1">${esc(values[index] || '')}</textarea>`).join('');
}

async function chooseOwlbearAsset() {
  const character = currentCharacter();
  if (!character || !canEditCurrent()) return;
  if (!OBR.isAvailable || !OBR.assets?.downloadImages) {
    promptImageUrl();
    return;
  }
  try {
    const downloads = await OBR.assets.downloadImages(false);
    if (downloads && downloads.length > 0 && downloads[0].image?.url) {
      character.data.image = downloads[0].image.url;
      await save();
      render();
    }
  } catch (err) {
    console.error('Owlbear image selection error:', err);
  }
}

async function promptImageUrl() {
  const character = currentCharacter();
  if (!character || !canEditCurrent()) return;
  const current = character.data.image || '';
  const url = window.prompt('Enter character image URL (Owlbear Cloud URL, Discord, Imgur, etc.):', current);
  if (url !== null) {
    const trimmed = url.trim();
    if (trimmed) {
      character.data.image = trimmed;
    } else {
      delete character.data.image;
    }
    await save();
    render();
  }
}

let isAddXpModalOpen = false;

function openAddXpModal() {
  const character = currentCharacter();
  if (!character || !canEditCurrent()) return;
  isAddXpModalOpen = true;
  render();
}

function closeAddXpModal() {
  if (!isAddXpModalOpen) return;
  isAddXpModalOpen = false;
  render();
}

async function applyAddExperience(amount) {
  const character = currentCharacter();
  if (!character || !canEditCurrent()) return;

  amount = Math.round(amount);
  if (isNaN(amount) || !isFinite(amount) || amount === 0) {
    closeAddXpModal();
    return;
  }

  character.data.info ??= {};
  const info = character.data.info;

  let currentToSpend = 0;
  let currentTotal = 0;

  if (info.xpToSpend !== undefined && String(info.xpToSpend).trim() !== '') {
    currentToSpend = parseInt(String(info.xpToSpend).trim(), 10) || 0;
  } else if (info.xp !== undefined && String(info.xp).trim() !== '') {
    const parts = String(info.xp).split('/');
    currentToSpend = parseInt(parts[0].trim(), 10) || 0;
  }

  if (info.xpTotal !== undefined && String(info.xpTotal).trim() !== '') {
    currentTotal = parseInt(String(info.xpTotal).trim(), 10) || 0;
  } else if (info.xp !== undefined && String(info.xp).trim() !== '') {
    const parts = String(info.xp).split('/');
    if (parts.length === 2) {
      currentTotal = parseInt(parts[1].trim(), 10) || 0;
    }
  }

  const newToSpend = Math.max(0, currentToSpend + amount);
  const newTotal = Math.max(0, currentTotal + amount);

  info.xpToSpend = String(newToSpend);
  info.xpTotal = String(newTotal);

  isAddXpModalOpen = false;
  await save();
  render();
}

function addXpModalHtml(character) {
  if (!isAddXpModalOpen || !character) return '';
  const info = character.data?.info || {};

  let currentToSpend = 0;
  let currentTotal = 0;

  if (info.xpToSpend !== undefined && String(info.xpToSpend).trim() !== '') {
    currentToSpend = parseInt(String(info.xpToSpend).trim(), 10) || 0;
  } else if (info.xp !== undefined && String(info.xp).trim() !== '') {
    const parts = String(info.xp).split('/');
    currentToSpend = parseInt(parts[0].trim(), 10) || 0;
  }

  if (info.xpTotal !== undefined && String(info.xpTotal).trim() !== '') {
    currentTotal = parseInt(String(info.xpTotal).trim(), 10) || 0;
  } else if (info.xp !== undefined && String(info.xp).trim() !== '') {
    const parts = String(info.xp).split('/');
    if (parts.length === 2) {
      currentTotal = parseInt(parts[1].trim(), 10) || 0;
    }
  }

  return `<div class="modal-backdrop" id="xp-modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="xp-modal-title">
    <div class="xp-modal" id="xp-modal-dialog">
      <div class="xp-modal-header">
        <h2 class="xp-modal-title" id="xp-modal-title">Add Experience (XP)</h2>
        <button type="button" class="xp-modal-close" id="xp-modal-close-btn" title="Close dialog">&times;</button>
      </div>
      <div class="xp-modal-body">
        <div class="xp-modal-current">
          <div class="xp-modal-current-item">
            <span class="xp-modal-current-label">Current To Spend</span>
            <span class="xp-modal-current-val">${currentToSpend}</span>
          </div>
          <div class="xp-modal-current-item">
            <span class="xp-modal-current-label">Current Total</span>
            <span class="xp-modal-current-val">${currentTotal}</span>
          </div>
        </div>
        <div class="xp-modal-info">Amount will be added to both "To spend" and "Total".</div>
        <div class="xp-modal-presets">
          <button type="button" class="xp-preset-btn" data-xp-preset="10">+10</button>
          <button type="button" class="xp-preset-btn" data-xp-preset="25">+25</button>
          <button type="button" class="xp-preset-btn" data-xp-preset="50">+50</button>
          <button type="button" class="xp-preset-btn" data-xp-preset="100">+100</button>
          <button type="button" class="xp-preset-btn" data-xp-preset="250">+250</button>
          <button type="button" class="xp-preset-btn" data-xp-preset="500">+500</button>
        </div>
        <input type="number" id="xp-modal-amount-input" class="xp-modal-input" placeholder="Enter amount of XP (e.g. 50)" step="1" inputmode="numeric" />
      </div>
      <div class="xp-modal-footer">
        <button type="button" class="toolbar-button secondary" id="xp-modal-cancel-btn">Cancel</button>
        <button type="button" class="toolbar-button" id="xp-modal-submit-btn">Add XP</button>
      </div>
    </div>
  </div>`;
}

function ensureMountRow(character, mountIndex) {
  if (!character.data.tables) character.data.tables = {};
  if (!Array.isArray(character.data.tables.Monture)) {
    character.data.tables.Monture = [];
  }
  while (character.data.tables.Monture.length <= mountIndex) {
    character.data.tables.Monture.push({});
  }
}

function getMountImage(character, mountIndex) {
  const row = character.data?.tables?.Monture?.[mountIndex];
  if (!row) return '';
  return row.image || row[5] || '';
}

function setMountImage(character, mountIndex, url) {
  ensureMountRow(character, mountIndex);
  const row = character.data.tables.Monture[mountIndex];
  if (Array.isArray(row)) {
    row[5] = url;
  }
  row.image = url;
}

function removeMountImage(character, mountIndex) {
  const row = character.data?.tables?.Monture?.[mountIndex];
  if (!row) return;
  delete row.image;
  delete row[5];
}

async function chooseOwlbearAssetForMount(mountIndex) {
  const character = currentCharacter();
  if (!character || !canEditCurrent()) return;
  if (!OBR.isAvailable || !OBR.assets?.downloadImages) {
    promptMountImageUrl(mountIndex);
    return;
  }
  try {
    const downloads = await OBR.assets.downloadImages(false);
    if (downloads && downloads.length > 0 && downloads[0].image?.url) {
      setMountImage(character, mountIndex, downloads[0].image.url);
      await save();
      render();
    }
  } catch (err) {
    console.error('Owlbear mount image selection error:', err);
  }
}

async function promptMountImageUrl(mountIndex) {
  const character = currentCharacter();
  if (!character || !canEditCurrent()) return;
  const current = getMountImage(character, mountIndex);
  const url = window.prompt('Enter mount image URL (Owlbear Cloud URL, Discord, Imgur, etc.):', current);
  if (url !== null) {
    const trimmed = url.trim();
    if (trimmed) {
      setMountImage(character, mountIndex, trimmed);
    } else {
      removeMountImage(character, mountIndex);
    }
    await save();
    render();
  }
}

function monturePage(character) {
  const storedRows = character.data.tables?.Monture;
  let rows = Array.isArray(storedRows)
    ? storedRows
    : storedRows && typeof storedRows === 'object'
      ? Object.keys(storedRows).sort((a, b) => Number(a) - Number(b)).map((key) => storedRows[key])
      : [{}];

  if (rows.length === 0) {
    rows = [{}];
  }
  character.data.tables.Monture = rows;

  return `<section class="monture-page">
    <div class="monture-list">
      ${rows.map((row, mountIndex) => {
        const image = row.image || row[5] || '';
        const imgSettings = row.imageSettings || { width: 320, height: 380 };
        const widthVal = imgSettings.width || 320;
        const heightVal = imgSettings.height || 380;
        const mountName = row[0] || (rows.length > 1 ? `Monture ${mountIndex + 1}` : 'Monture & Compagnon');

        return `<div class="mount-card" data-mount-card="${mountIndex}">
          <div class="mount-header"><span class="mount-header-icon">✦</span><span>${esc(mountName)}</span></div>
          <div class="grid-sheet info-layout mount-layout" style="--portrait-width: ${widthVal}px; --portrait-height: ${heightVal}px;">
            <div class="portrait-column">
              <div class="character-image mount-image ${image ? 'has-image' : ''}" data-mount-image-container="${mountIndex}" tabindex="0" role="button" aria-label="Mount image">
                ${image ? `
                  <img src="${esc(image)}" alt="Mount image" class="character-image-preview" />
                  <div class="image-overlay">
                    <div class="image-overlay-actions">
                      ${OBR.isAvailable ? `<button type="button" class="img-btn" data-mount-owlbear-btn="${mountIndex}">Owlbear Cloud</button>` : ''}
                      <button type="button" class="img-btn" data-mount-url-btn="${mountIndex}">Lien URL</button>
                    </div>
                    <button type="button" class="image-remove-btn" data-mount-remove-btn="${mountIndex}" title="Supprimer l'image">&times;</button>
                  </div>
                ` : `
                  <div class="empty-image-placeholder">
                    <div class="placeholder-crest">
                      <img src="/boreali-fleur-de-lys.svg" alt="Emblème de Boréalis" class="placeholder-crest-img" />
                    </div>
                    <span class="image-label">Portrait de Monture / Compagnon</span>
                    <div class="image-choice-buttons">
                      ${OBR.isAvailable ? `<button type="button" class="img-choice-btn" data-mount-owlbear-btn="${mountIndex}">Owlbear Cloud</button>` : ''}
                      <button type="button" class="img-choice-btn" data-mount-url-btn="${mountIndex}">Lien URL</button>
                    </div>
                  </div>
                `}
                <div class="image-corner-handle" data-mount-corner-handle="${mountIndex}" title="Redimensionner le cadre"></div>
              </div>
              <div class="mount-actions">
                <button type="button" class="add-row mount-action-btn" data-add-mount title="Ajouter une nouvelle monture">+ Ajouter Monture</button>
                <button type="button" class="delete-row mount-action-btn" data-delete-mount="${mountIndex}" title="Supprimer cette monture">Supprimer Monture</button>
              </div>
            </div>
            <div class="info-fields">
              <label class="field-row"><span class="field-label">Nom</span>${editable(`tables.Monture.${mountIndex}.0`, row[0] || '', 'field-input', 'Nom de la monture')}</label>
              <label class="field-row"><span class="field-label">Type / Espèce</span>${editable(`tables.Monture.${mountIndex}.1`, row[1] || '', 'field-input', 'Type (ex: Cheval Boréalien, Loup Blanc...)')}</label>
              <label class="field-row"><span class="field-label">Vitesse</span>${editable(`tables.Monture.${mountIndex}.2`, row[2] || '', 'field-input', 'Vitesse de déplacement')}</label>
              <label class="field-row"><span class="field-label">Armure</span>${editable(`tables.Monture.${mountIndex}.3`, row[3] || '', 'field-input', 'Valeur d\'armure')}</label>
              <label class="field-row tall"><span class="field-label">Notes & Capacités</span>${editable(`tables.Monture.${mountIndex}.4`, row[4] || '', 'field-input', 'Notes, harnachement, capacités spéciales...')}</label>
            </div>
          </div>
        </div>`;
      }).join('')}
    </div>
  </section>`;
}

const universalChartRollOptions = [
  { value: 'No Roll', label: 'No Roll', rankVal: null, code: '' },
  { value: 'Shift 0', label: 'Shift 0 (0)', rankVal: 0, code: '0' },
  { value: 'Feeble', label: 'Feeble (Fe - 2)', rankVal: 2, code: 'Fe' },
  { value: 'Poor', label: 'Poor (Pr - 4)', rankVal: 4, code: 'Pr' },
  { value: 'Typical', label: 'Typical (Ty - 6)', rankVal: 6, code: 'Ty' },
  { value: 'Good', label: 'Good (Gd - 10)', rankVal: 10, code: 'Gd' },
  { value: 'Excelent', label: 'Excelent (Ex - 20)', rankVal: 20, code: 'Ex' },
  { value: 'Remarkable', label: 'Remarkable (Rm - 30)', rankVal: 30, code: 'Rm' },
  { value: 'Incredible', label: 'Incredible (In - 40)', rankVal: 40, code: 'In' },
  { value: 'Amazing', label: 'Amazing (Am - 50)', rankVal: 50, code: 'Am' },
  { value: 'Monstrous', label: 'Monstrous (Mn - 75)', rankVal: 75, code: 'Mn' },
  { value: 'Unearthly', label: 'Unearthly (Un - 100)', rankVal: 100, code: 'Un' },
  { value: 'Shift X', label: 'Shift X (X - 150)', rankVal: 150, code: 'X' },
  { value: 'Shift Y', label: 'Shift Y (Y - 250)', rankVal: 250, code: 'Y' },
  { value: 'Shift Z', label: 'Shift Z (Z - 500)', rankVal: 500, code: 'Z' },
  { value: 'Class 1000', label: 'Class 1000 (1000)', rankVal: 1000, code: '1000' },
  { value: 'Class 3000', label: 'Class 3000 (3000)', rankVal: 3000, code: '3000' },
  { value: 'Class 5000', label: 'Class 5000 (5000)', rankVal: 5000, code: '5000' },
  { value: 'Beyond', label: 'Beyond (∞)', rankVal: 10000, code: 'B' }
];

function getUniversalRankVal(rollStr) {
  if (!rollStr || rollStr === 'No Roll' || rollStr === '—' || rollStr === '-') return null;
  const match = universalChartRollOptions.find(
    (opt) => opt.value.toLowerCase() === rollStr.toLowerCase() ||
             opt.label.toLowerCase() === rollStr.toLowerCase() ||
             opt.label.toLowerCase().startsWith(rollStr.toLowerCase()) ||
             (opt.code && opt.code.toLowerCase() === rollStr.toLowerCase())
  );
  if (match && match.rankVal !== null) return match.rankVal;
  const statRank = statRankRanges.find(
    (r) => r.name.toLowerCase() === rollStr.toLowerCase() ||
           r.code.toLowerCase() === rollStr.toLowerCase()
  );
  if (statRank) {
    const valIdx = statRank.colIndex;
    const num = parseFloat(chartRankValues[valIdx]);
    return !isNaN(num) ? num : statRank.min;
  }
  return null;
}

function getPowerThemes(character) {
  if (!character || !character.data) return [];
  if (Array.isArray(character.data.powerThemes)) {
    return character.data.powerThemes;
  }

  // Check legacy tables['Unique Power']
  const legacyRows = character.data.tables?.['Unique Power'];
  if (Array.isArray(legacyRows) && legacyRows.length > 0) {
    const migratedTheme = {
      title: 'Unique Powers',
      description: '',
      image: '',
      imageSettings: { width: 320, height: 420 },
      powers: legacyRows.map((r) => ({
        name: r[0] || '',
        description: r[1] || '',
        roll: r[3] || 'No Roll',
        cost: r[2] || '',
        charges: r[4] || ''
      }))
    };
    character.data.powerThemes = [migratedTheme];
    return character.data.powerThemes;
  }

  const defaultTheme = {
    title: 'Power Theme 1',
    description: '',
    image: '',
    imageSettings: { width: 320, height: 420 },
    powers: [
      { name: '', description: '', roll: 'No Roll', cost: '', charges: '' },
      { name: '', description: '', roll: 'No Roll', cost: '', charges: '' }
    ]
  };
  character.data.powerThemes = [defaultTheme];
  return character.data.powerThemes;
}

function getThemeImage(character, themeIndex) {
  const themes = getPowerThemes(character);
  return themes[themeIndex]?.image || '';
}

function setThemeImage(character, themeIndex, url) {
  const themes = getPowerThemes(character);
  if (themes[themeIndex]) {
    themes[themeIndex].image = url;
  }
}

function removeThemeImage(character, themeIndex) {
  const themes = getPowerThemes(character);
  if (themes[themeIndex]) {
    delete themes[themeIndex].image;
  }
}

async function chooseOwlbearAssetForTheme(themeIndex) {
  const character = currentCharacter();
  if (!character || !canEditCurrent()) return;
  if (!OBR.isAvailable || !OBR.assets?.downloadImages) {
    promptThemeImageUrl(themeIndex);
    return;
  }
  try {
    const downloads = await OBR.assets.downloadImages(false);
    if (downloads && downloads.length > 0 && downloads[0].image?.url) {
      setThemeImage(character, themeIndex, downloads[0].image.url);
      await save();
      render();
    }
  } catch (err) {
    console.error('Owlbear power theme image selection error:', err);
  }
}

async function promptThemeImageUrl(themeIndex) {
  const character = currentCharacter();
  if (!character || !canEditCurrent()) return;
  const current = getThemeImage(character, themeIndex);
  const url = window.prompt('Enter power theme image URL (Owlbear Cloud URL, Discord, Imgur, etc.):', current);
  if (url !== null) {
    const trimmed = url.trim();
    if (trimmed) {
      setThemeImage(character, themeIndex, trimmed);
    } else {
      removeThemeImage(character, themeIndex);
    }
    await save();
    render();
  }
}

function uniquePowerPage(character) {
  const themes = getPowerThemes(character);

  return `<section class="unique-power-page">
    <div class="unique-power-top-bar">
      <h2 class="section-title" style="margin: 0;">Pouvoirs Uniques &amp; Flux Arcaniques</h2>
      <button type="button" class="toolbar-button add-theme-top-btn" data-add-power-theme title="Ajouter un nouveau Thème de Pouvoir">+ Nouveau Thème</button>
    </div>
    ${rollResultBannerHtml()}
    <div class="power-themes-list">
      ${themes.map((theme, themeIdx) => {
        const image = theme.image || '';
        const imgSettings = theme.imageSettings || { width: 320, height: 420 };
        const widthVal = imgSettings.width || 320;
        const heightVal = imgSettings.height || 420;
        const powers = Array.isArray(theme.powers) ? theme.powers : [];
        const themeTitle = theme.title || (themes.length > 1 ? `Thème de Pouvoir ${themeIdx + 1}` : 'Thème de Pouvoir');
        const currentPowerSort = powerThemeSortState[themeIdx];
        const renderPowerTh = (colKey, label, className) => {
          const isSorted = currentPowerSort && currentPowerSort.colKey === colKey;
          const sortDir = isSorted ? currentPowerSort.direction : null;
          const sortClass = isSorted ? ` sort-active sort-${sortDir}` : '';
          const sortIcon = isSorted
            ? (sortDir === 'asc' ? '<span class="sort-icon sort-asc" title="Tri croissant">▲</span>' : '<span class="sort-icon sort-desc" title="Tri décroissant">▼</span>')
            : '<span class="sort-icon sort-none" title="Cliquer pour trier">⇅</span>';
          return `<th class="${className} sortable-header${sortClass}" data-sort-power-theme="${themeIdx}" data-power-col="${colKey}" title="Cliquer pour trier par ${esc(label)}"><span class="th-content">${esc(label)}${sortIcon}</span></th>`;
        };

        return `<div class="power-theme-card" data-theme-card="${themeIdx}">
          <div class="grid-sheet info-layout power-theme-layout" style="--portrait-width: ${widthVal}px; --portrait-height: ${heightVal}px;">
            <div class="portrait-column">
              <div class="character-image power-theme-image ${image ? 'has-image' : ''}" data-theme-image-container="${themeIdx}" tabindex="0" role="button" aria-label="Power Theme image">
                ${image ? `
                  <img src="${esc(image)}" alt="Power theme image" class="character-image-preview" />
                  <div class="image-overlay">
                    <div class="image-overlay-actions">
                      ${OBR.isAvailable ? `<button type="button" class="img-btn" data-theme-owlbear-btn="${themeIdx}">Owlbear Cloud</button>` : ''}
                      <button type="button" class="img-btn" data-theme-url-btn="${themeIdx}">Lien URL</button>
                    </div>
                    <button type="button" class="image-remove-btn" data-theme-remove-btn="${themeIdx}" title="Supprimer l'illustration">&times;</button>
                  </div>
                ` : `
                  <div class="empty-image-placeholder">
                    <div class="placeholder-crest">
                      <img src="/boreali-fleur-de-lys.svg" alt="Emblème de Boréalis" class="placeholder-crest-img" />
                    </div>
                    <span class="image-label">Illustration du Flux Arcanique</span>
                    <div class="image-choice-buttons">
                      ${OBR.isAvailable ? `<button type="button" class="img-choice-btn" data-theme-owlbear-btn="${themeIdx}">Owlbear Cloud</button>` : ''}
                      <button type="button" class="img-choice-btn" data-theme-url-btn="${themeIdx}">Lien URL</button>
                    </div>
                  </div>
                `}
                <div class="image-corner-handle" data-theme-corner-handle="${themeIdx}" title="Redimensionner le cadre"></div>
              </div>
            </div>
            <div class="power-theme-details">
              <div class="power-theme-header">
                <div class="power-theme-title-container">
                  <span class="power-theme-title-tag">TITRE DU FLUX / THÈME</span>
                  <input type="text" class="power-theme-title-input" data-path="powerThemes.${themeIdx}.title" value="${esc(theme.title || '')}" placeholder="Titre du Pouvoir (ex: Électromancie, Cryomancie, Flux d'Air...)" />
                </div>
                <button type="button" class="delete-row power-theme-delete-btn" data-delete-power-theme="${themeIdx}" title="Supprimer ce Thème">Supprimer Thème</button>
              </div>

              <div class="power-theme-desc-wrap">
                <span class="power-theme-desc-tag">Description &amp; Principes du Flux Arcanique</span>
                <textarea class="field-input power-theme-desc-input" data-path="powerThemes.${themeIdx}.description" rows="2" placeholder="Saisir la description, l'histoire ou les lois arcaniques de ce pouvoir...">${esc(theme.description || '')}</textarea>
              </div>

              <div class="table-wrap power-table-wrap">
                <table class="sheet-table sheet-table-unique-powers">
                  <thead>
                    <tr>
                      ${renderPowerTh('name', 'Nom du Pouvoir', 'col-p-name')}
                      ${renderPowerTh('description', 'Description', 'col-p-desc')}
                      ${renderPowerTh('roll', 'Jet Universel', 'col-p-roll')}
                      ${renderPowerTh('cost', 'Coût Mana/Focus', 'col-p-cost')}
                      ${renderPowerTh('charges', 'Charges / Utilisation', 'col-p-charges')}
                      <th class="col-p-rollbtn" style="text-align: center;">Lancer</th>
                      <th class="row-actions col-p-delete" style="text-align: center;">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${powers.map((power, pIdx) => {
                      const rollVal = power.roll || 'No Roll';
                      const isRollActive = rollVal && rollVal !== 'No Roll' && rollVal !== '—' && rollVal !== '-';
                      const rollOptionsHtml = universalChartRollOptions.map((opt) => {
                        const isSelected = (opt.value === rollVal) || (opt.label === rollVal) || (opt.value.toLowerCase() === rollVal.toLowerCase());
                        return `<option value="${esc(opt.value)}" ${isSelected ? 'selected' : ''}>${esc(opt.label)}</option>`;
                      }).join('');

                      return `<tr>
                        <td class="col-p-name">
                          <textarea class="cell-input" data-path="powerThemes.${themeIdx}.powers.${pIdx}.name" rows="1" placeholder="Nom du Pouvoir">${esc(power.name || '')}</textarea>
                        </td>
                        <td class="col-p-desc">
                          <textarea class="cell-input" data-path="powerThemes.${themeIdx}.powers.${pIdx}.description" rows="1" placeholder="Effet & description du sort/capacité">${esc(power.description || '')}</textarea>
                        </td>
                        <td class="col-p-roll">
                          <select class="cell-input cell-select power-roll-select" data-path="powerThemes.${themeIdx}.powers.${pIdx}.roll" data-theme-idx="${themeIdx}" data-power-idx="${pIdx}">
                            ${rollOptionsHtml}
                          </select>
                        </td>
                        <td class="col-p-cost">
                          <textarea class="cell-input" data-path="powerThemes.${themeIdx}.powers.${pIdx}.cost" rows="1" placeholder="Coût (Mana / Focus)">${esc(power.cost || '')}</textarea>
                        </td>
                        <td class="col-p-charges">
                          <textarea class="cell-input" data-path="powerThemes.${themeIdx}.powers.${pIdx}.charges" rows="1" placeholder="Charges / Jour">${esc(power.charges || '')}</textarea>
                        </td>
                        <td class="col-p-rollbtn" style="text-align: center;">
                          ${isRollActive ? `
                            <button type="button" class="power-roll-btn power-roll-btn-active" data-roll-power-theme="${themeIdx}" data-roll-power-idx="${pIdx}" title="Lancer ${esc(power.name || 'Pouvoir')} (${esc(rollVal)}) sur la Table Universelle">🎲 Lancer</button>
                          ` : `
                            <button type="button" class="power-roll-btn power-roll-btn-disabled" disabled title="Sélectionnez un rang dans la colonne Jet Universel pour activer le lancer">🎲 Lancer</button>
                          `}
                        </td>
                        <td class="row-actions col-p-delete" style="text-align: center;">
                          <button type="button" class="delete-row" data-delete-power-row="${themeIdx}.${pIdx}" title="Supprimer cette ligne">Supprimer</button>
                        </td>
                      </tr>`;
                    }).join('')}
                  </tbody>
                </table>
              </div>

              <div class="power-theme-actions">
                <button type="button" class="add-row add-power-btn" data-add-power-row="${themeIdx}">+ Ajouter un Pouvoir</button>
              </div>
            </div>
          </div>
        </div>`;
      }).join('')}
    </div>
  </section>`;
}

function infoPage(character) {
  const info = character.data.info;
  const image = character.data.image || '';
  const imgSettings = character.data.imageSettings || { width: 320, height: 480 };
  const widthVal = imgSettings.width || 320;
  const heightVal = imgSettings.height || 480;

  let xpToSpend = info.xpToSpend;
  let xpTotal = info.xpTotal;
  if (xpToSpend === undefined && xpTotal === undefined && info.xp !== undefined) {
    const parts = String(info.xp).split('/');
    if (parts.length === 2) {
      xpToSpend = parts[0].trim();
      xpTotal = parts[1].trim();
    } else {
      xpToSpend = info.xp;
      xpTotal = '';
    }
  }

  return `<div class="grid-sheet info-layout" style="--portrait-width: ${widthVal}px; --portrait-height: ${heightVal}px;">
    <div class="portrait-column">
      <div class="character-image ${image ? 'has-image' : ''}" id="character-image-container" tabindex="0" role="button" aria-label="Character portrait">
        ${image ? `
          <img src="${esc(image)}" alt="Character Portrait" class="character-image-preview" />
          <div class="image-overlay">
            <div class="image-overlay-actions">
              ${OBR.isAvailable ? '<button type="button" class="img-btn" id="owlbear-asset-btn">Owlbear Cloud</button>' : ''}
              <button type="button" class="img-btn" id="image-url-btn">Lien URL</button>
            </div>
            <button type="button" class="image-remove-btn" id="remove-image-btn" title="Supprimer l'image">&times;</button>
          </div>
        ` : `
          <div class="empty-image-placeholder">
            <div class="placeholder-crest">
              <img src="/boreali-fleur-de-lys.svg" alt="Emblème de Boréalis" class="placeholder-crest-img" />
            </div>
            <span class="image-label">Portrait du Personnage</span>
            <div class="image-choice-buttons">
              ${OBR.isAvailable ? '<button type="button" class="img-choice-btn" id="owlbear-asset-btn">Owlbear Cloud</button>' : ''}
              <button type="button" class="img-choice-btn" id="image-url-btn">Lien URL</button>
            </div>
          </div>
        `}
        <div class="image-corner-handle" id="image-corner-handle" title="Redimensionner le cadre"></div>
      </div>
    </div>
    <div class="info-fields">
      ${infoFields.map(([label, key], index) => {
        if (key === 'xp') {
          return `<div class="field-row xp-split-row">
            <span class="field-label">${label}</span>
            <div class="xp-split-inputs">
              <button type="button" class="add-xp-btn" id="add-xp-btn" title="Attribuer de l'expérience" ${!canEditCurrent() ? 'disabled' : ''}>+ XP</button>
              <div class="xp-cell">
                <span class="xp-cell-tag">À dépenser</span>
                ${editable('info.xpToSpend', xpToSpend || '', 'field-input xp-input', '0')}
              </div>
              <div class="xp-cell">
                <span class="xp-cell-tag">Total</span>
                ${editable('info.xpTotal', xpTotal || '', 'field-input xp-input', '0')}
              </div>
            </div>
          </div>`;
        }
        return `<label class="field-row${index === infoFields.length - 1 ? ' tall' : ''}"><span class="field-label">${label}</span>${editable(`info.${key}`, info[key] || '', 'field-input')}</label>`;
      }).join('')}
    </div>
  </div>`;
}

const pendingStatRolls = new Map();
let activeRollResult = null;
let lastPlayedSoundRollId = null;

function playCritSound(outcomeType, rollId = null) {
  if (rollId && lastPlayedSoundRollId === rollId) {
    return;
  }
  if (rollId) {
    lastPlayedSoundRollId = rollId;
  }

  let soundUrl = null;
  if (outcomeType === 'crit-fail' || outcomeType === 'crit_fail') {
    soundUrl = sadhornUrl;
  } else if (outcomeType === 'crit-success' || outcomeType === 'crit_success') {
    soundUrl = wowUrl;
  }

  if (!soundUrl) return;

  try {
    const audio = new Audio(soundUrl);
    audio.volume = 0.85;
    const playPromise = audio.play();
    if (playPromise !== undefined) {
      playPromise.catch((err) => {
        console.warn('Audio playback was prevented by browser policy or error:', err);
      });
    }
  } catch (err) {
    console.warn('Audio playback initialization failed:', err);
  }
}

function rollResultBannerHtml() {
  if (!activeRollResult) return '';

  if (activeRollResult.type === 'damage') {
    const bonusStr = activeRollResult.flatBonus >= 0 ? `+ ${activeRollResult.flatBonus}` : `- ${Math.abs(activeRollResult.flatBonus)}`;
    const diceDetail = activeRollResult.individualRolls?.length
      ? `${activeRollResult.diceStr} (${activeRollResult.individualRolls.join(' + ')}) ${bonusStr}`
      : `${activeRollResult.diceStr} ${bonusStr}`;
    return `<div class="roll-result-banner banner-red">
      <div class="roll-result-info">
        <div class="roll-result-title">
          <span class="roll-char-name">${esc(activeRollResult.charName)}</span>
          <span class="roll-stat-tag">Damage &bull; <strong>${esc(activeRollResult.label)}</strong></span>
        </div>
        <div class="roll-result-detail">
          ${diceDetail} = <strong class="roll-score-num">${activeRollResult.total}</strong>
        </div>
      </div>
      <div class="roll-result-outcome outcome-red">
        Damage: ${activeRollResult.total}
      </div>
      <button type="button" class="roll-result-close" id="dismiss-roll-result" title="Dismiss result">&times;</button>
    </div>`;
  }

  if (activeRollResult.type === 'initiative') {
    const bonusStr = activeRollResult.bonus > 0 ? `+ ${activeRollResult.bonus}` : (activeRollResult.bonus < 0 ? `- ${Math.abs(activeRollResult.bonus)}` : '');
    return `<div class="roll-result-banner banner-green">
      <div class="roll-result-info">
        <div class="roll-result-title">
          <span class="roll-char-name">${esc(activeRollResult.charName)}</span>
          <span class="roll-stat-tag">Initiative &bull; <strong>${esc(activeRollResult.label)}</strong> (Bonus: <strong>${activeRollResult.bonus >= 0 ? `+${activeRollResult.bonus}` : activeRollResult.bonus}</strong>)</span>
        </div>
        <div class="roll-result-detail">
          1D12 (${activeRollResult.d12 ?? activeRollResult.total - activeRollResult.bonus}) ${bonusStr} = <strong class="roll-score-num">${activeRollResult.total}</strong>
        </div>
      </div>
      <div class="roll-result-outcome outcome-green">
        Initiative: ${activeRollResult.total}
      </div>
      <button type="button" class="roll-result-close" id="dismiss-roll-result" title="Dismiss result">&times;</button>
    </div>`;
  }

  if (activeRollResult.type === 'effect') {
    return `<div class="roll-result-banner banner-${activeRollResult.colorTone || 'green'}">
      <div class="roll-result-info">
        <div class="roll-result-title">
          <span class="roll-char-name">${esc(activeRollResult.charName)}</span>
          <span class="roll-stat-tag">Effect &bull; <strong>${esc(activeRollResult.label)}</strong></span>
        </div>
        <div class="roll-result-detail">
          ${esc(activeRollResult.outcomeLabel)}
        </div>
      </div>
      <div class="roll-result-outcome outcome-${activeRollResult.colorTone || 'green'}">
        ${esc(activeRollResult.outcomeLabel)}
      </div>
      <button type="button" class="roll-result-close" id="dismiss-roll-result" title="Dismiss result">&times;</button>
    </div>`;
  }

  const targetTag = activeRollResult.targetTier && activeRollResult.targetTier !== 'standard'
    ? `<span class="roll-target-tag">Target: <strong>${activeRollResult.targetTier.toUpperCase()}</strong> ${typeof activeRollResult.karmaCost === 'number' ? `&bull; Karma Cost: <strong>${activeRollResult.karmaCost}</strong>` : ''}</span>`
    : '';

  const csTag = typeof activeRollResult.columnShift === 'number' && activeRollResult.columnShift !== 0
    ? ` <span class="roll-cs-tag">[CS: <strong>${activeRollResult.columnShift > 0 ? '+' + activeRollResult.columnShift : activeRollResult.columnShift}</strong>]</span>`
    : '';

  return `<div class="roll-result-banner banner-${activeRollResult.colorTone}">
    <div class="roll-result-info">
      <div class="roll-result-title">
        <span class="roll-char-name">${esc(activeRollResult.charName)}</span>
        <span class="roll-stat-tag">${esc(activeRollResult.statName)} (Value: <strong>${activeRollResult.statValue}</strong> &rarr; Rank: <strong>${esc(activeRollResult.rankName)}</strong>)${csTag}</span>
        ${targetTag}
      </div>
      <div class="roll-result-detail">
        D100 Roll: <strong class="roll-score-num">${activeRollResult.roll}</strong>
      </div>
    </div>
    <div class="roll-result-outcome outcome-${activeRollResult.colorTone}">
      ${esc(activeRollResult.outcomeLabel)}
    </div>
    <button type="button" class="roll-result-close" id="dismiss-roll-result" title="Dismiss result">&times;</button>
  </div>`;
}

let rollFilter = 'all';

function addRollToHistory(roll) {
  state.rollHistory ??= [];
  const existingIdx = state.rollHistory.findIndex((r) => r.id && r.id === roll.id);
  if (existingIdx !== -1) {
    state.rollHistory[existingIdx] = roll;
  } else {
    state.rollHistory.unshift(roll);
    if (state.rollHistory.length > 250) {
      state.rollHistory = state.rollHistory.slice(0, 250);
    }
  }
  queueSave(300);
}

function recordInitiative(characterId, charName, playerName, isAssigned, label, bonus, d12, total) {
  state.initiativeTracker ??= {};
  const charEntry = Object.entries(state.characters).find(([id, c]) => id === characterId || c.name === charName);
  const effectiveId = characterId || (charEntry ? charEntry[0] : (charName || 'unknown'));
  const effectiveAssigned = charEntry ? Boolean(charEntry[1].ownerId) : Boolean(isAssigned);
  const inCombat = charEntry ? (charEntry[1].data?.inCombat !== false) : true;

  state.initiativeTracker[effectiveId] = {
    characterId: effectiveId,
    charName: charName || 'Character',
    playerName: playerName || (effectiveAssigned ? 'Assigned' : 'Unassigned (NPC)'),
    isAssigned: effectiveAssigned,
    inCombat,
    label: label || 'Initiative',
    bonus: parseInt(bonus) || 0,
    d12: parseInt(d12) || 0,
    total: parseInt(total) || 0,
    timestamp: Date.now()
  };
  queueSave(300);
}

function displayAndAnnounceInitiativeResult(label, bonus, d12Val, total, charName, playerName, broadcast = true, characterId = null) {
  const currentRollId = `roll_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  const bonusNum = parseInt(bonus) || 0;
  const d12Num = parseInt(d12Val) || 0;
  const totalNum = parseInt(total) || (d12Num + bonusNum);
  const bonusStr = bonusNum > 0 ? `+ ${bonusNum}` : (bonusNum < 0 ? `- ${Math.abs(bonusNum)}` : '');

  activeRollResult = {
    rollId: currentRollId,
    type: 'initiative',
    label,
    bonus: bonusNum,
    d12: d12Num,
    total: totalNum,
    colorTone: 'green',
    charName: charName || 'Character',
    characterId,
    playerName: playerName || 'Player',
    playerId: user.id,
    timestamp: Date.now()
  };

  addRollToHistory({
    id: currentRollId,
    timestamp: Date.now(),
    type: 'initiative',
    charName: charName || 'Character',
    playerName: playerName || 'Player',
    statName: `Initiative (${label})`,
    detail: `1D12 (${d12Num}) ${bonusNum >= 0 ? `+ ${bonusNum}` : `- ${Math.abs(bonusNum)}`} = ${totalNum}`,
    roll: totalNum,
    outcomeType: 'initiative',
    outcomeLabel: `Initiative: ${totalNum}`,
    colorTone: 'green'
  });

  recordInitiative(characterId, charName, playerName, null, label, bonusNum, d12Num, totalNum);

  if (broadcast && OBR.isAvailable && OBR.broadcast) {
    try {
      OBR.broadcast.sendMessage('terranova/stat-roll-result', activeRollResult, { destination: 'ALL' });
    } catch (e) {}
  }

  if (OBR.isAvailable && OBR.notification?.show) {
    OBR.notification.show(
      `⚔️ ${activeRollResult.charName} (${playerName || 'Player'}) rolled Initiative (${label}): 1D12 (${d12Num}) ${bonusStr} = ${totalNum}`,
      'DEFAULT'
    );
  }

  render();
}

function displayAndAnnounceRollResult(statName, statValue, rolledTotal, charName, playerName, broadcast = true, rollId = null, targetTier = 'standard', columnShift = 0) {
  const cShift = parseInt(columnShift) || 0;
  const resolution = resolveUniversalRoll(statValue, rolledTotal, cShift);
  const currentRollId = rollId || `roll_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

  let karmaCost = 0;
  if (targetTier === 'green') {
    if (resolution.outcomeType === 'fail' || resolution.outcomeType === 'crit-fail') karmaCost = 1;
  } else if (targetTier === 'yellow') {
    if (resolution.outcomeType === 'fail' || resolution.outcomeType === 'crit-fail') karmaCost = 2;
    else if (resolution.outcomeType === 'green') karmaCost = 1;
  } else if (targetTier === 'red') {
    if (resolution.outcomeType === 'fail' || resolution.outcomeType === 'crit-fail') karmaCost = 3;
    else if (resolution.outcomeType === 'green') karmaCost = 2;
    else if (resolution.outcomeType === 'yellow') karmaCost = 1;
  }

  let finalOutcomeLabel = resolution.outcomeLabel;
  if (targetTier && targetTier !== 'standard') {
    if (karmaCost > 0) {
      finalOutcomeLabel = `${resolution.outcomeLabel} (Karma: ${karmaCost})`;
    } else {
      finalOutcomeLabel = `${resolution.outcomeLabel} (${targetTier.toUpperCase()} Met)`;
    }
  }

  activeRollResult = {
    rollId: currentRollId,
    statName,
    statValue: resolution.statValue,
    roll: resolution.roll,
    rankCode: resolution.rankCode,
    rankName: resolution.rankName,
    colIndex: resolution.colIndex,
    rowIndex: resolution.rowIndex,
    colorTone: resolution.colorTone,
    outcomeType: resolution.outcomeType,
    outcomeLabel: finalOutcomeLabel,
    targetTier,
    karmaCost,
    columnShift: cShift,
    charName: charName || 'Character',
    playerName: playerName || 'Player',
    playerId: user.id,
    timestamp: Date.now()
  };

  playCritSound(resolution.outcomeType, currentRollId);

  const targetSuffix = targetTier && targetTier !== 'standard' ? ` [Target: ${targetTier.toUpperCase()}, Karma: ${karmaCost}]` : '';
  const shiftSuffix = cShift !== 0 ? ` [CS: ${cShift > 0 ? '+' + cShift : cShift}]` : '';
  addRollToHistory({
    id: currentRollId,
    timestamp: Date.now(),
    type: 'stat',
    charName: charName || 'Character',
    playerName: playerName || 'Player',
    statName: targetTier && targetTier !== 'standard' ? `${statName} (${targetTier.toUpperCase()})` : statName,
    statValue: resolution.statValue,
    rankName: resolution.rankName,
    detail: `D100 = ${resolution.roll} (${resolution.statValue} ➔ ${resolution.rankName})${shiftSuffix}${targetSuffix}`,
    roll: resolution.roll,
    outcomeType: resolution.outcomeType,
    outcomeLabel: finalOutcomeLabel,
    colorTone: resolution.colorTone
  });

  if (broadcast && OBR.isAvailable && OBR.broadcast) {
    try {
      OBR.broadcast.sendMessage('terranova/stat-roll-result', activeRollResult, { destination: 'ALL' });
    } catch (e) {}
  }

  if (OBR.isAvailable && OBR.notification?.show) {
    const isSuccess = resolution.outcomeType === 'green' || resolution.outcomeType === 'yellow' || resolution.outcomeType === 'red' || resolution.outcomeType === 'crit-success';
    const karmaNote = targetTier && targetTier !== 'standard' ? ` [Target: ${targetTier.toUpperCase()}${karmaCost > 0 ? `, Karma: ${karmaCost}` : ''}]` : '';
    const csNote = cShift !== 0 ? ` [CS: ${cShift > 0 ? '+' + cShift : cShift}]` : '';
    OBR.notification.show(
      `🎲 ${activeRollResult.charName} (${playerName || 'Player'}) rolled ${statName}${csNote} [${activeRollResult.statValue} ➔ ${resolution.rankName}]: D100 = ${resolution.roll} ➔ ${resolution.outcomeLabel.toUpperCase()}${karmaNote}`,
      isSuccess ? 'DEFAULT' : 'WARNING'
    );
  }

  render();
}

function displayAndAnnounceDamageResult(weaponName, modLabel, diceStrOrCount, sides, individualRolls, flatBonus, totalDamage, charName, playerName, broadcast = true, rollId = null) {
  const currentRollId = rollId || `roll_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  const label = `${weaponName}${modLabel ? ' (' + modLabel + ')' : ''}`;
  
  let diceStr = '1D10';
  if (typeof diceStrOrCount === 'string' && diceStrOrCount) {
    diceStr = diceStrOrCount;
  } else if (typeof diceStrOrCount === 'number' && sides) {
    diceStr = `${diceStrOrCount}D${sides}`;
  } else if (diceStrOrCount) {
    diceStr = String(diceStrOrCount);
  }

  const bonus = parseInt(flatBonus) || 0;
  const bonusStr = bonus > 0 ? `+ ${bonus}` : (bonus < 0 ? `- ${Math.abs(bonus)}` : '');

  activeRollResult = {
    rollId: currentRollId,
    type: 'damage',
    label,
    weaponName,
    modLabel,
    diceStr,
    flatBonus: bonus,
    individualRolls: individualRolls || [],
    total: totalDamage,
    colorTone: 'red',
    outcomeType: 'red',
    outcomeLabel: `Damage: ${totalDamage}`,
    charName: charName || 'Character',
    playerName: playerName || 'Player',
    playerId: user.id,
    timestamp: Date.now()
  };

  const rollsText = (individualRolls && individualRolls.length > 0) ? individualRolls.join(', ') : (totalDamage - bonus);
  const detail = bonusStr
    ? `${diceStr} (${rollsText}) ${bonusStr} = ${totalDamage}`
    : `${diceStr} (${rollsText}) = ${totalDamage}`;

  addRollToHistory({
    id: currentRollId,
    timestamp: Date.now(),
    type: 'damage',
    charName: charName || 'Character',
    playerName: playerName || 'Player',
    statName: `Damage - ${label}`,
    detail,
    roll: totalDamage,
    outcomeType: 'red',
    outcomeLabel: `Damage: ${totalDamage}`,
    colorTone: 'red'
  });

  if (broadcast && OBR.isAvailable && OBR.broadcast) {
    try {
      OBR.broadcast.sendMessage('terranova/stat-roll-result', activeRollResult, { destination: 'ALL' });
    } catch (e) {}
  }

  if (OBR.isAvailable && OBR.notification?.show) {
    OBR.notification.show(
      `💥 ${charName || 'Character'} (${playerName || 'Player'}) rolled Damage (${label}): ${diceStr}${bonusStr ? ' ' + bonusStr : ''} = ${totalDamage}`,
      'DEFAULT'
    );
  }

  render();
}

async function rollUniversalCheck(name, statValue, targetTier = 'standard', columnShift = 0) {
  const character = currentCharacter();
  const charId = activeCharacterId || Object.entries(state.characters).find(([_, c]) => c === character)?.[0] || null;
  const numVal = parseFloat(statValue) || 0;
  const cShift = parseInt(columnShift) || 0;
  const charName = character?.name || 'Character';

  const rollId = `roll_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  const timestamp = Date.now();
  let playerId = user?.id || 'local-player';
  let playerName = user?.name || 'Player';

  if (OBR.isAvailable) {
    try {
      playerId = await OBR.player.getId();
      playerName = await OBR.player.getName();
    } catch (e) {}
  }

  const rollInfo = {
    rollId,
    type: 'stat',
    statName: name,
    statValue: numVal,
    targetTier,
    columnShift: cShift,
    charName,
    characterId: charId,
    playerName,
    playerId,
    timestamp
  };

  pendingStatRolls.set(rollId, rollInfo);

  const payload = {
    rollId,
    playerId,
    playerName,
    rollTarget: 'everyone',
    diceNotation: '1d100',
    diceCounts: { d1: 0, d2: 0, d3: 0, d4: 0, d6: 0, d8: 0, d10: 0, d12: 0, d20: 0, d100: 1, dF: 0 },
    diceIndices: { d1: 0, d2: 0, d3: 0, d4: 0, d6: 0, d8: 0, d10: 0, d12: 0, d20: 0, d100: 0, dF: 0 },
    showResults: true,
    timestamp,
    source: 'dice-plus'
  };

  if (OBR.isAvailable && OBR.broadcast) {
    try {
      await OBR.broadcast.sendMessage('terranova/stat-roll-start', rollInfo, { destination: 'ALL' });
    } catch (e) {}

    try {
      await OBR.broadcast.sendMessage('dice-plus/roll-request', payload, { destination: 'LOCAL' });
      if (OBR.notification?.show) {
        const preview = resolveUniversalRoll(numVal, 50, cShift);
        const shiftNote = cShift !== 0 ? ` (CS ${cShift > 0 ? '+' + cShift : cShift})` : '';
        OBR.notification.show(`Rolling 1D100 for ${name}${shiftNote} (${numVal} ➔ ${preview.rankName})...`);
      }
    } catch (err) {
      try {
        await OBR.broadcast.sendMessage('dice-plus/roll-request', payload, { destination: 'ALL' });
      } catch (e) {}
    }
  } else {
    const roll = Math.floor(Math.random() * 100) + 1;
    displayAndAnnounceRollResult(name, numVal, roll, charName, playerName, false, rollId, targetTier, cShift);
  }
}

async function rollWeaponDamage(weaponName, diceString, baseBonus, modLabel = '', modBonus = 0) {
  const character = currentCharacter();
  const charId = activeCharacterId || Object.entries(state.characters).find(([_, c]) => c === character)?.[0] || null;
  const charName = character?.name || 'Character';

  const parsed = parseDiceAndModifiers(diceString || '1D10');
  let diceGroups = [];
  let diceStringRepr = '1D10';
  let embeddedFlat = 0;
  let totalDiceCount = 1;
  let primarySides = 10;
  let diceCounts = { d1: 0, d2: 0, d3: 0, d4: 0, d6: 0, d8: 0, d10: 0, d12: 0, d20: 0, d100: 0, dF: 0 };

  if (parsed && parsed.hasDice) {
    diceGroups = parsed.diceGroups;
    diceStringRepr = parsed.diceString;
    embeddedFlat = parsed.flatBonus || 0;
    totalDiceCount = parsed.totalDiceCount || 1;
    primarySides = parsed.sides || 10;
    diceCounts = parsed.diceCounts;
  } else {
    const match = (diceString || '1D10').match(/^(\d*)\s*[dD]\s*(\d+)/);
    const count = match ? (parseInt(match[1]) || 1) : 1;
    const sides = match ? parseInt(match[2]) : 10;
    diceGroups = [{ count, sides, sign: 1 }];
    diceStringRepr = `${count}D${sides}`;
    totalDiceCount = count;
    primarySides = sides;
    const countsKey = `d${sides}`;
    if (diceCounts[countsKey] !== undefined) {
      diceCounts[countsKey] = count;
    }
  }

  const bBonus = parseInt(baseBonus) || 0;
  const mBonus = parseInt(modBonus) || 0;
  const totalFlat = embeddedFlat + bBonus + mBonus;

  const rollId = `roll_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  const timestamp = Date.now();
  let playerId = user?.id || 'local-player';
  let playerName = user?.name || 'Player';

  if (OBR.isAvailable) {
    try {
      playerId = await OBR.player.getId();
      playerName = await OBR.player.getName();
    } catch (e) {}
  }

  let notation = diceGroups.map((g, idx) => {
    const prefix = idx > 0 ? (g.sign < 0 ? '- ' : '+ ') : (g.sign < 0 ? '-' : '');
    return `${prefix}${g.count}d${g.sides}`;
  }).join(' ');

  if (totalFlat > 0) {
    notation += ` + ${totalFlat}`;
  } else if (totalFlat < 0) {
    notation += ` - ${Math.abs(totalFlat)}`;
  }

  const rollInfo = {
    rollId,
    type: 'damage',
    label: `${weaponName}${modLabel ? ' (' + modLabel + ')' : ''}`,
    weaponName,
    modLabel,
    diceStr: diceStringRepr,
    diceGroups,
    count: totalDiceCount,
    sides: primarySides,
    flatBonus: totalFlat,
    notation,
    charName,
    characterId: charId,
    playerName,
    playerId,
    timestamp
  };

  pendingStatRolls.set(rollId, rollInfo);

  const diceIndices = { d1: 0, d2: 0, d3: 0, d4: 0, d6: 0, d8: 0, d10: 0, d12: 0, d20: 0, d100: 0, dF: 0 };

  const payload = {
    rollId,
    playerId,
    playerName,
    rollTarget: 'everyone',
    diceNotation: notation,
    diceCounts,
    diceIndices,
    showResults: true,
    timestamp,
    source: 'dice-plus'
  };

  if (OBR.isAvailable && OBR.broadcast) {
    try {
      await OBR.broadcast.sendMessage('terranova/stat-roll-start', rollInfo, { destination: 'ALL' });
    } catch (e) {}

    try {
      await OBR.broadcast.sendMessage('dice-plus/roll-request', payload, { destination: 'LOCAL' });
      if (OBR.notification?.show) {
        OBR.notification.show(`Rolling Damage for ${weaponName}${modLabel ? ' (' + modLabel + ')' : ''}: ${notation}...`);
      }
    } catch (err) {
      try {
        await OBR.broadcast.sendMessage('dice-plus/roll-request', payload, { destination: 'ALL' });
      } catch (e) {}
    }
  } else {
    let diceTotal = 0;
    const individualRolls = [];
    for (const g of diceGroups) {
      for (let i = 0; i < g.count; i++) {
        const die = Math.floor(Math.random() * g.sides) + 1;
        individualRolls.push(die);
        diceTotal += (g.sign < 0 ? -die : die);
      }
    }
    const totalDamage = diceTotal + totalFlat;
    displayAndAnnounceDamageResult(weaponName, modLabel, diceStringRepr, null, individualRolls, totalFlat, totalDamage, charName, playerName, false, rollId);
  }
}

function parseDiceAndModifiers(str) {
  if (!str || typeof str !== 'string') return null;
  const trimmed = str.trim();
  if (!trimmed || trimmed === '—') return null;

  const diceRegex = /([+\-]?)\s*(\d*)\s*[dD]\s*(\d+)/g;
  const diceMatches = Array.from(trimmed.matchAll(diceRegex));

  if (diceMatches.length > 0) {
    let mathPortion = trimmed;
    let textSuffix = '';

    const matchSuffix = trimmed.match(/^([+\-\d\s\*\/\%\(\)dD\.]+?)(\s+(?![dD]\d+\b)[A-Za-z].*)$/);
    if (matchSuffix) {
      mathPortion = matchSuffix[1].trim();
      textSuffix = matchSuffix[2].trim();
    }

    const withoutDice = mathPortion.replace(diceRegex, (match, sign) => {
      return (sign === '-' ? ' - 0 ' : ' + 0 ');
    });

    let flatBonus = 0;
    const flatVal = evaluateSafeMath(withoutDice);
    if (flatVal !== null) {
      flatBonus = Math.floor(flatVal);
    } else {
      let bonus = 0;
      let hasExplicitSign = false;
      for (const m of withoutDice.matchAll(/([+\-])\s*(\d+(?:\.\d+)?)/g)) {
        hasExplicitSign = true;
        const sign = m[1] === '-' ? -1 : 1;
        bonus += sign * parseInt(m[2], 10);
      }
      if (!hasExplicitSign) {
        const standalone = withoutDice.match(/\b\d+\b/);
        if (standalone) bonus = parseInt(standalone[0], 10);
      }
      flatBonus = bonus;
    }

    const diceList = [];
    const sidesMap = new Map();

    for (const m of mathPortion.matchAll(diceRegex)) {
      const sign = m[1] === '-' ? -1 : 1;
      const count = (m[2] ? parseInt(m[2], 10) : 1) * sign;
      const sides = parseInt(m[3], 10);
      if (!sidesMap.has(sides)) {
        const entry = { sides, count: 0 };
        sidesMap.set(sides, entry);
        diceList.push(entry);
      }
      sidesMap.get(sides).count += count;
    }

    const diceGroups = [];
    const diceParts = [];
    let totalDiceCount = 0;

    for (const entry of diceList) {
      if (entry.count !== 0) {
        diceGroups.push({
          count: Math.abs(entry.count),
          sides: entry.sides,
          sign: entry.count < 0 ? -1 : 1
        });
        totalDiceCount += Math.abs(entry.count);
        if (entry.count > 0 && diceParts.length > 0) {
          diceParts.push('+ ' + entry.count + 'D' + entry.sides);
        } else if (entry.count < 0) {
          diceParts.push('- ' + Math.abs(entry.count) + 'D' + entry.sides);
        } else {
          diceParts.push(entry.count + 'D' + entry.sides);
        }
      }
    }

    const diceString = diceParts.join(' ') || '1D10';

    const diceCounts = { d1: 0, d2: 0, d3: 0, d4: 0, d6: 0, d8: 0, d10: 0, d12: 0, d20: 0, d100: 0, dF: 0 };
    for (const g of diceGroups) {
      const k = `d${g.sides}`;
      if (diceCounts[k] !== undefined) {
        diceCounts[k] = (diceCounts[k] || 0) + g.count;
      }
    }

    let diceNotation = diceParts.map((p) => p.toLowerCase()).join(' ');
    if (flatBonus > 0) {
      diceNotation += ` + ${flatBonus}`;
    } else if (flatBonus < 0) {
      diceNotation += ` - ${Math.abs(flatBonus)}`;
    }

    return {
      hasDice: true,
      isNumeric: false,
      diceGroups,
      totalDiceCount,
      diceString,
      diceNotation,
      diceCounts,
      count: diceGroups[0]?.count || 1,
      sides: diceGroups[0]?.sides || 10,
      flatBonus,
      suffix: textSuffix
    };
  }

  const mathOnly = trimmed.match(/^[+\-\d\s\*\/\(\)\.]+$/);
  if (mathOnly) {
    try {
      const val = Math.floor(Function('"use strict"; return (' + trimmed + ')')());
      if (!isNaN(val) && isFinite(val)) {
        return {
          hasDice: false,
          isNumeric: true,
          total: val,
          suffix: ''
        };
      }
    } catch (e) {}
  }

  return {
    hasDice: false,
    isNumeric: false,
    text: trimmed
  };
}

async function rollFormulaEffect(actionName, tierLabel, expression) {
  const character = currentCharacter();
  const charId = activeCharacterId || Object.entries(state.characters).find(([_, c]) => c === character)?.[0] || null;
  const charName = character?.name || 'Character';

  const parsed = parseDiceAndModifiers(expression);
  const label = `${actionName} (${tierLabel})`;

  if (parsed && parsed.hasDice && parsed.totalDiceCount > 0) {
    const diceString = parsed.diceString;
    const modLabel = `${tierLabel}${parsed.suffix ? ' - ' + parsed.suffix : ''}`;
    await rollWeaponDamage(actionName, diceString, parsed.flatBonus, modLabel, 0);
    return;
  }

  const rollId = `roll_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  const timestamp = Date.now();
  let playerId = user?.id || 'local-player';
  let playerName = user?.name || 'Player';

  if (OBR.isAvailable) {
    try {
      playerId = await OBR.player.getId();
      playerName = await OBR.player.getName();
    } catch (e) {}
  }

  let detailStr = expression;
  let outcomeText = expression;
  let isNumeric = false;
  let totalVal = null;

  if (parsed && parsed.hasDice && parsed.count === 0) {
    totalVal = parsed.flatBonus;
    detailStr = `${parsed.flatBonus}${parsed.suffix ? ' ' + parsed.suffix : ''}`;
    outcomeText = `Result: ${parsed.flatBonus}${parsed.suffix ? ' ' + parsed.suffix : ''}`;
    isNumeric = true;
  } else if (parsed && parsed.isNumeric) {
    totalVal = parsed.total;
    detailStr = `Result: ${parsed.total}`;
    outcomeText = `Result: ${parsed.total}`;
    isNumeric = true;
  }

  const colorTone = tierLabel.toLowerCase().includes('crit') ? 'crit' : (tierLabel.toLowerCase().includes('red') ? 'red' : (tierLabel.toLowerCase().includes('yellow') ? 'yellow' : 'green'));

  activeRollResult = {
    rollId,
    type: isNumeric ? 'damage' : 'effect',
    label,
    weaponName: actionName,
    modLabel: tierLabel,
    diceStr: isNumeric ? detailStr : 'Effect',
    flatBonus: totalVal ?? 0,
    individualRolls: [],
    total: totalVal ?? detailStr,
    colorTone,
    outcomeType: colorTone,
    outcomeLabel: outcomeText,
    charName: charName || 'Character',
    playerName: playerName || 'Player',
    playerId,
    timestamp
  };

  addRollToHistory({
    id: rollId,
    timestamp,
    type: isNumeric ? 'damage' : 'effect',
    charName: charName || 'Character',
    playerName: playerName || 'Player',
    statName: `${actionName} - ${tierLabel}`,
    detail: detailStr,
    roll: totalVal ?? detailStr,
    outcomeType: activeRollResult.outcomeType,
    outcomeLabel: outcomeText,
    colorTone: activeRollResult.colorTone
  });

  if (OBR.isAvailable && OBR.broadcast) {
    try {
      OBR.broadcast.sendMessage('terranova/stat-roll-result', activeRollResult, { destination: 'ALL' });
    } catch (e) {}
  }

  if (OBR.isAvailable && OBR.notification?.show) {
    OBR.notification.show(`✨ ${charName} (${playerName}) - ${actionName} [${tierLabel}]: ${outcomeText}`, 'DEFAULT');
  }

  render();
}

function universalChartTableHtml() {
  const h0 = chartRankCodes;
  const h1 = chartRankNames;
  const h2 = chartRankValues;
  const h3 = chartStatRanges;

  const colgroupHtml = `
    <colgroup>
      <col class="col-roll" />
      ${h0.map((code, idx) => code === '|' ? '<col class="col-divider" />' : `<col class="col-rank ${activeRollResult?.colIndex === idx ? 'col-highlighted' : ''}" />`).join('')}
    </colgroup>
  `;

  const headerHtml = `
    <thead>
      <tr class="chart-hdr-row rank-codes">
        <th class="chart-col-roll" rowspan="4">Roll</th>
        ${h0.map((code, idx) => code === '|' ? '<th class="chart-col-divider" rowspan="4"></th>' : `<th class="chart-col-rank ${activeRollResult?.colIndex === idx ? 'hdr-highlighted' : ''}">${esc(code)}</th>`).join('')}
      </tr>
      <tr class="chart-hdr-row rank-names">
        ${h1.map((name, idx) => h0[idx] === '|' ? '' : `<th class="chart-col-name ${activeRollResult?.colIndex === idx ? 'hdr-highlighted' : ''}">${esc(name)}</th>`).join('')}
      </tr>
      <tr class="chart-hdr-row rank-values">
        ${h2.map((val, idx) => h0[idx] === '|' ? '' : `<th class="chart-col-val ${activeRollResult?.colIndex === idx ? 'hdr-highlighted' : ''}">${esc(val)}</th>`).join('')}
      </tr>
      <tr class="chart-hdr-row stat-ranges">
        ${h3.map((range, idx) => h0[idx] === '|' ? '' : `<th class="chart-col-range ${activeRollResult?.colIndex === idx ? 'hdr-highlighted' : ''}">${esc(range)}</th>`).join('')}
      </tr>
    </thead>
  `;

  const bodyHtml = `
    <tbody>
      ${chartRows.map((row, rIdx) => `
        <tr class="chart-data-row ${rIdx % 2 === 1 ? 'row-alt' : ''} ${activeRollResult?.rowIndex === rIdx ? 'row-highlighted' : ''}">
          <td class="chart-roll-label ${activeRollResult?.rowIndex === rIdx ? 'roll-lbl-highlighted' : ''}">${esc(row.roll)}</td>
          ${row.cells.map((cellStr, colIdx) => {
            if (cellStr === '|') return '<td class="chart-cell-divider"></td>';
            const [val, color] = cellStr.split(':');
            const isTarget = activeRollResult && activeRollResult.rowIndex === rIdx && activeRollResult.colIndex === colIdx;
            return `<td class="chart-cell cell-${color} ${isTarget ? 'cell-targeted' : ''}">${esc(val || '')}</td>`;
          }).join('')}
        </tr>
      `).join('')}
    </tbody>
  `;

  return `<div class="universal-chart-wrap"><table class="universal-chart-table">${colgroupHtml}${headerHtml}${bodyHtml}</table></div>`;
}

async function rollInitiative(label, bonusVal) {
  const character = currentCharacter();
  const charId = activeCharacterId || Object.entries(state.characters).find(([_, c]) => c === character)?.[0] || null;
  const bonus = parseInt(bonusVal) || 0;
  const charName = character?.name || 'Character';

  const rollId = `roll_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  const timestamp = Date.now();
  let playerId = 'local-player';
  let playerName = user?.name || 'Player';

  if (OBR.isAvailable) {
    try {
      playerId = await OBR.player.getId();
      playerName = await OBR.player.getName();
    } catch (e) {
      console.warn('Failed to get player identity:', e);
    }
  }

  const notation = bonus > 0 ? `1d12 + ${bonus}` : (bonus < 0 ? `1d12 - ${Math.abs(bonus)}` : '1d12');

  const rollInfo = {
    rollId,
    type: 'initiative',
    label,
    bonus,
    charName,
    characterId: charId,
    playerName,
    playerId,
    timestamp
  };

  pendingStatRolls.set(rollId, rollInfo);

  const payload = {
    rollId,
    playerId,
    playerName,
    rollTarget: 'everyone',
    diceNotation: notation,
    diceCounts: { d1: 0, d2: 0, d3: 0, d4: 0, d6: 0, d8: 0, d10: 0, d12: 1, d20: 0, d100: 0, dF: 0 },
    diceIndices: { d1: 0, d2: 0, d3: 0, d4: 0, d6: 0, d8: 0, d10: 0, d12: 0, d20: 0, d100: 0, dF: 0 },
    showResults: true,
    timestamp,
    source: 'dice-plus'
  };

  if (OBR.isAvailable && OBR.broadcast) {
    try {
      await OBR.broadcast.sendMessage('terranova/stat-roll-start', rollInfo, { destination: 'ALL' });
    } catch (e) {}

    try {
      await OBR.broadcast.sendMessage('dice-plus/roll-request', payload, { destination: 'LOCAL' });
      if (OBR.notification?.show) {
        OBR.notification.show(`Rolling Initiative (${label}): ${notation}...`);
      }
    } catch (err) {
      console.error('Failed to send LOCAL dice-plus roll request:', err);
      try {
        await OBR.broadcast.sendMessage('dice-plus/roll-request', payload, { destination: 'ALL' });
      } catch (e) {
        console.error('Failed to broadcast roll request:', e);
      }
    }
  } else {
    const d12 = Math.floor(Math.random() * 12) + 1;
    const total = d12 + bonus;
    displayAndAnnounceInitiativeResult(label, bonus, d12, total, charName, playerName, false, charId);
  }
}

async function rollInitiativeForCharacter(charId, label, bonusVal) {
  if (user.role !== 'GM') return;
  const character = state.characters[charId];
  const charName = character?.name || 'Character';
  const bonus = parseInt(bonusVal) || 0;

  const rollId = `roll_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  const timestamp = Date.now();
  let playerId = user?.id || 'local-player';
  let playerName = user?.name || 'DM';

  if (OBR.isAvailable) {
    try {
      playerId = await OBR.player.getId();
      playerName = await OBR.player.getName();
    } catch (e) {}
  }

  const notation = bonus > 0 ? `1d12 + ${bonus}` : (bonus < 0 ? `1d12 - ${Math.abs(bonus)}` : '1d12');

  const rollInfo = {
    rollId,
    type: 'initiative',
    label,
    bonus,
    charName,
    characterId: charId,
    playerName,
    playerId,
    timestamp
  };

  pendingStatRolls.set(rollId, rollInfo);

  const payload = {
    rollId,
    playerId,
    playerName,
    rollTarget: 'everyone',
    diceNotation: notation,
    diceCounts: { d1: 0, d2: 0, d3: 0, d4: 0, d6: 0, d8: 0, d10: 0, d12: 1, d20: 0, d100: 0, dF: 0 },
    diceIndices: { d1: 0, d2: 0, d3: 0, d4: 0, d6: 0, d8: 0, d10: 0, d12: 0, d20: 0, d100: 0, dF: 0 },
    showResults: true,
    timestamp,
    source: 'dice-plus'
  };

  if (OBR.isAvailable && OBR.broadcast) {
    try {
      await OBR.broadcast.sendMessage('terranova/stat-roll-start', rollInfo, { destination: 'ALL' });
    } catch (e) {}

    try {
      await OBR.broadcast.sendMessage('dice-plus/roll-request', payload, { destination: 'LOCAL' });
      if (OBR.notification?.show) {
        OBR.notification.show(`Rolling Initiative for ${charName} (${label}): ${notation}...`);
      }
    } catch (err) {
      console.error('Failed to send LOCAL dice-plus roll request:', err);
      try {
        await OBR.broadcast.sendMessage('dice-plus/roll-request', payload, { destination: 'ALL' });
      } catch (e) {}
    }
  } else {
    const d12 = Math.floor(Math.random() * 12) + 1;
    const total = d12 + bonus;
    displayAndAnnounceInitiativeResult(label, bonus, d12, total, charName, playerName, false, charId);
  }
}

async function rollAllUnassignedInitiative(roundType = 'First round') {
  if (user.role !== 'GM') return;
  const unassigned = Object.entries(state.characters).filter(([id, c]) => {
    const isUnassigned = !c.ownerId && (!state.assignments || !state.assignments[c.ownerId]);
    const inCombat = c.data?.inCombat !== false;
    return isUnassigned && inCombat;
  });

  if (unassigned.length === 0) {
    if (OBR.isAvailable && OBR.notification?.show) {
      OBR.notification.show('No in-combat unassigned (NPC) characters found.');
    }
    return;
  }
  for (let i = 0; i < unassigned.length; i++) {
    const [id, c] = unassigned[i];
    if (i > 0) {
      await new Promise((resolve) => setTimeout(resolve, 6000));
    }
    if (roundType === 'Next Rounds') {
      const speedVal = parseFloat(c.data?.stats?.Speed ?? c.data?.stats?.Movement ?? '6') || 0;
      const nextRoundsBonus = Math.floor(speedVal / 10);
      await rollInitiativeForCharacter(id, 'Next Rounds', nextRoundsBonus);
    } else {
      const numIntuition = parseFloat(c.data?.stats?.Intuition ?? '6') || 0;
      const firstRoundBonus = Math.floor(numIntuition / 10);
      await rollInitiativeForCharacter(id, 'First round', firstRoundBonus);
    }
  }
}

async function rollDicePlus(statName) {
  const character = currentCharacter();
  const charId = activeCharacterId || Object.entries(state.characters).find(([_, c]) => c === character)?.[0] || null;
  const st = character?.data?.stats || {};
  const rawVal = st[statName] ?? (statName === 'Luck' ? '0' : '6');
  const statValue = parseFloat(rawVal) || 0;
  const charName = character?.name || 'Character';

  const rollId = `roll_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  const timestamp = Date.now();
  let playerId = 'local-player';
  let playerName = user?.name || 'Player';

  if (OBR.isAvailable) {
    try {
      playerId = await OBR.player.getId();
      playerName = await OBR.player.getName();
    } catch (e) {
      console.warn('Failed to get player identity:', e);
    }
  }

  const rollInfo = {
    rollId,
    type: 'stat',
    statName,
    statValue,
    charName,
    characterId: charId,
    playerName,
    playerId,
    timestamp
  };

  pendingStatRolls.set(rollId, rollInfo);

  const payload = {
    rollId,
    playerId,
    playerName,
    rollTarget: 'everyone',
    diceNotation: '1d100',
    diceCounts: { d1: 0, d2: 0, d3: 0, d4: 0, d6: 0, d8: 0, d10: 0, d12: 0, d20: 0, d100: 1, dF: 0 },
    diceIndices: { d1: 0, d2: 0, d3: 0, d4: 0, d6: 0, d8: 0, d10: 0, d12: 0, d20: 0, d100: 0, dF: 0 },
    showResults: true,
    timestamp,
    source: 'dice-plus'
  };

  if (OBR.isAvailable && OBR.broadcast) {
    try {
      await OBR.broadcast.sendMessage('terranova/stat-roll-start', rollInfo, { destination: 'ALL' });
    } catch (e) {}

    try {
      await OBR.broadcast.sendMessage('dice-plus/roll-request', payload, { destination: 'LOCAL' });
      if (OBR.notification?.show) {
        const preview = resolveUniversalRoll(statValue, 50);
        OBR.notification.show(`Rolling 1D100 for ${statName} (${statValue} ➔ ${preview.rankName})...`);
      }
    } catch (err) {
      console.error('Failed to send LOCAL dice-plus roll request:', err);
      try {
        await OBR.broadcast.sendMessage('dice-plus/roll-request', payload, { destination: 'ALL' });
      } catch (e) {
        console.error('Failed to broadcast roll request:', e);
      }
    }
  } else {
    const roll = Math.floor(Math.random() * 100) + 1;
    displayAndAnnounceRollResult(statName, statValue, roll, charName, playerName, false);
  }
}

function quickAccessSectionHtml(character, numFighting, numStrength, numAgility, numIntuition, numSpeed) {
  const st = character.data.stats || {};
  const statsMap = getCharacterStatsMap(character);
  character.data.quickAccessWeaponSlot ??= 0;
  character.data.quickAccessSkillSlot ??= 0;
  character.data.quickAccessSpellSlot ??= 0;

  const normalizeTableRows = (stored) => {
    if (Array.isArray(stored)) return stored;
    if (stored && typeof stored === 'object') {
      return Object.keys(stored).sort((a, b) => Number(a) - Number(b)).map((k) => stored[k]);
    }
    return [];
  };

  const rawWeapons = normalizeTableRows(character.data.tables?.Weapons);
  const rawSpecs = normalizeTableRows(character.data.tables?.Specialisations);
  const rawSkills = normalizeTableRows(character.data.tables?.Skills);
  const rawSpells = normalizeTableRows(character.data.tables?.Spell);

  const defenseTableHtml = `
    <div class="qa-table-card">
      <div class="qa-table-header text-bold">Defense menu</div>
      <div class="qa-grid-4">
        <!-- Row 1: Dodge (Agility) -->
        <div class="qa-cell bg-gray rollable-qa-btn" data-qa-universal-roll="Dodge" data-stat-name="Agility" data-stat-val="${numAgility}" data-target-tier="standard" title="Roll Standard Dodge (Agility: ${numAgility})">Dodge</div>
        <div class="qa-cell bg-green rollable-qa-btn" data-qa-universal-roll="Dodge" data-stat-name="Agility" data-stat-val="${numAgility}" data-target-tier="green" title="Roll Dodge [Target: Green] (Agility: ${numAgility})">Green</div>
        <div class="qa-cell bg-yellow rollable-qa-btn" data-qa-universal-roll="Dodge" data-stat-name="Agility" data-stat-val="${numAgility}" data-target-tier="yellow" title="Roll Dodge [Target: Yellow] (Agility: ${numAgility})">Yellow</div>
        <div class="qa-cell bg-red rollable-qa-btn" data-qa-universal-roll="Dodge" data-stat-name="Agility" data-stat-val="${numAgility}" data-target-tier="red" title="Roll Dodge [Target: Red] (Agility: ${numAgility})">Red</div>

        <!-- Row 2: Pary (Fighting) -->
        <div class="qa-cell bg-gray rollable-qa-btn" data-qa-universal-roll="Pary" data-stat-name="Fighting" data-stat-val="${numFighting}" data-target-tier="standard" title="Roll Standard Pary (Fighting: ${numFighting})">Pary</div>
        <div class="qa-cell bg-green rollable-qa-btn" data-qa-universal-roll="Pary" data-stat-name="Fighting" data-stat-val="${numFighting}" data-target-tier="green" title="Roll Pary [Target: Green] (Fighting: ${numFighting})">Green</div>
        <div class="qa-cell bg-yellow rollable-qa-btn" data-qa-universal-roll="Pary" data-stat-name="Fighting" data-stat-val="${numFighting}" data-target-tier="yellow" title="Roll Pary [Target: Yellow] (Fighting: ${numFighting})">Yellow</div>
        <div class="qa-cell bg-red rollable-qa-btn" data-qa-universal-roll="Pary" data-stat-name="Fighting" data-stat-val="${numFighting}" data-target-tier="red" title="Roll Pary [Target: Red] (Fighting: ${numFighting})">Red</div>

        <!-- Row 3: Block (Fighting) -->
        <div class="qa-cell bg-gray rollable-qa-btn" data-qa-universal-roll="Block" data-stat-name="Fighting" data-stat-val="${numFighting}" data-target-tier="standard" title="Roll Standard Block (Fighting: ${numFighting})">Block</div>
        <div class="qa-cell bg-green rollable-qa-btn" data-qa-universal-roll="Block" data-stat-name="Fighting" data-stat-val="${numFighting}" data-target-tier="green" title="Roll Block [Target: Green] (Fighting: ${numFighting})">Green</div>
        <div class="qa-cell bg-yellow rollable-qa-btn" data-qa-universal-roll="Block" data-stat-name="Fighting" data-stat-val="${numFighting}" data-target-tier="yellow" title="Roll Block [Target: Yellow] (Fighting: ${numFighting})">Yellow</div>
        <div class="qa-cell bg-red rollable-qa-btn" data-qa-universal-roll="Block" data-stat-name="Fighting" data-stat-val="${numFighting}" data-target-tier="red" title="Roll Block [Target: Red] (Fighting: ${numFighting})">Red</div>
      </div>
    </div>
  `;

  let selectedWIdx = character.data.quickAccessWeaponSlot ?? (Array.isArray(character.data.quickAccessWeaponSlots) ? character.data.quickAccessWeaponSlots[0] : 0);
  if (selectedWIdx === undefined || selectedWIdx < 0 || (rawWeapons.length > 0 && selectedWIdx >= rawWeapons.length)) {
    selectedWIdx = 0;
  }

  const optionsHtml = rawWeapons.length === 0
    ? '<option value="0">-- No weapons in Weapons tab --</option>'
    : rawWeapons.map((w, wIdx) => `<option value="${wIdx}" ${wIdx === selectedWIdx ? 'selected' : ''}>${esc(w[0] || `Weapon ${wIdx + 1}`)}</option>`).join('');

  const weaponInfo = getSelectedWeaponDamageInfo(character, selectedWIdx);
  const weapon = weaponInfo.weapon;
  const weaponName = weaponInfo.weaponName;
  const touchStatName = weaponInfo.touchStatName;
  const totalTouchVal = weaponInfo.totalTouchVal;
  const total1stBonus = weaponInfo.total1stBonus;
  const totalNextBonus = weaponInfo.totalNextBonus;
  const finalDiceStr = weaponInfo.finalDiceStr;
  const statDmgBonus = weaponInfo.statDmgBonus;
  const specPotentialBonus = weaponInfo.specPotentialBonus;
  const totalFlatBonus = weaponInfo.totalFlatBonus;
  const twoHanded = weaponInfo.twoHanded;

  const weaponTableHtml = `
    <div class="qa-table-card">
      <div class="qa-table-header text-bold">Weapons</div>
      <div class="qa-sub-header">
        <label class="qa-weapon-label">Weapon:
          <select class="qa-weapon-select" data-qa-slot="0">
            ${optionsHtml}
          </select>
        </label>
      </div>
      <!-- Row 1: Initiative Rolls (2 columns) -->
      <div class="qa-grid-2">
        <div class="qa-cell bg-blue rollable-qa-ini" data-roll-initiative="${esc(weaponName)} (1st round)" data-bonus="${total1stBonus}" title="Roll Initiative (1st round): 1D12 + ${total1stBonus}">Ini Roll 1st</div>
        <div class="qa-cell bg-coral rollable-qa-ini" data-roll-initiative="${esc(weaponName)} (Next rounds)" data-bonus="${totalNextBonus}" title="Roll Initiative (Next rounds): 1D12 + ${totalNextBonus}">Ini Roll Next</div>
      </div>
      <!-- Row 2: Attack Rolls (4 columns) -->
      <div class="qa-grid-4">
        <div class="qa-cell bg-gray rollable-qa-btn" data-qa-universal-roll="${esc(weaponName)} Attack" data-stat-name="${esc(touchStatName)}" data-stat-val="${totalTouchVal}" data-target-tier="standard" title="Roll Standard Attack (${touchStatName}: ${totalTouchVal})">Attack</div>
        <div class="qa-cell bg-green rollable-qa-btn" data-qa-universal-roll="${esc(weaponName)} Attack" data-stat-name="${esc(touchStatName)}" data-stat-val="${totalTouchVal}" data-target-tier="green" title="Roll Attack [Target: Green] (Total: ${totalTouchVal})">Green</div>
        <div class="qa-cell bg-yellow rollable-qa-btn" data-qa-universal-roll="${esc(weaponName)} Attack" data-stat-name="${esc(touchStatName)}" data-stat-val="${totalTouchVal}" data-target-tier="yellow" title="Roll Attack [Target: Yellow] (Total: ${totalTouchVal})">Yellow</div>
        <div class="qa-cell bg-red rollable-qa-btn" data-qa-universal-roll="${esc(weaponName)} Attack" data-stat-name="${esc(touchStatName)}" data-stat-val="${totalTouchVal}" data-target-tier="red" title="Roll Attack [Target: Red] (Total: ${totalTouchVal})">Red</div>
      </div>
      <!-- Row 3: Merged Damage Cell -->
      <div class="qa-grid-1">
        <div class="qa-cell bg-light text-bold rollable-qa-dmg" data-weapon-name="${esc(weaponName)}" data-dice="${finalDiceStr}" data-base-bonus="${totalFlatBonus}" data-mod-label="" data-mod-bonus="0" title="Click to roll Damage: ${finalDiceStr} + ${totalFlatBonus}">
          Damage: ${finalDiceStr}+${statDmgBonus}+${specPotentialBonus}
        </div>
      </div>
      <!-- Row 4: Attack Success Damage Modifiers (4 columns) -->
      <div class="qa-grid-4">
        <div class="qa-cell bg-green rollable-qa-dmg" data-weapon-name="${esc(weaponName)}" data-dice="${finalDiceStr}" data-base-bonus="${totalFlatBonus}" data-mod-label="Block" data-mod-bonus="${twoHanded ? 0 : 10}" title="${twoHanded ? `Click to roll Damage: ${finalDiceStr} + ${totalFlatBonus}` : `Click to roll Damage (+10 Block): ${finalDiceStr} + ${totalFlatBonus + 10}`}">Block</div>
        <div class="qa-cell bg-yellow rollable-qa-dmg" data-weapon-name="${esc(weaponName)}" data-dice="${finalDiceStr}" data-base-bonus="${totalFlatBonus}" data-mod-label="Yellow" data-mod-bonus="20" title="Click to roll Damage (+20 Yellow): ${finalDiceStr} + ${totalFlatBonus + 20}">Yellow</div>
        <div class="qa-cell bg-red rollable-qa-dmg" data-weapon-name="${esc(weaponName)}" data-dice="${finalDiceStr}" data-base-bonus="${totalFlatBonus}" data-mod-label="Red" data-mod-bonus="30" title="Click to roll Damage (+30 Red): ${finalDiceStr} + ${totalFlatBonus + 30}">Red</div>
        <div class="qa-cell bg-dark-red rollable-qa-dmg" data-weapon-name="${esc(weaponName)}" data-dice="${finalDiceStr}" data-base-bonus="${totalFlatBonus}" data-mod-label="Natural Red" data-mod-bonus="40" title="Click to roll Damage (+40 Natural Red): ${finalDiceStr} + ${totalFlatBonus + 40}">NaturalRed</div>
      </div>
    </div>
  `;

  let selectedSkillIdx = character.data.quickAccessSkillSlot ?? 0;
  if (selectedSkillIdx < 0 || (rawSkills.length > 0 && selectedSkillIdx >= rawSkills.length)) {
    selectedSkillIdx = 0;
  }
  const skillOptionsHtml = rawSkills.length === 0
    ? '<option value="0">-- No skills in Skills tab --</option>'
    : rawSkills.map((s, sIdx) => `<option value="${sIdx}" ${sIdx === selectedSkillIdx ? 'selected' : ''}>${esc(s[0] || `Skill ${sIdx + 1}`)}</option>`).join('');

  const skill = (rawSkills.length > 0 && rawSkills[selectedSkillIdx]) ? rawSkills[selectedSkillIdx] : [];
  const skillName = skill[0] || (rawSkills.length > 0 ? `Skill ${selectedSkillIdx + 1}` : 'Skill');
  const skillStatName = skill[2] || 'Fighting';
  const skillStatVal = parseFloat(st[skillStatName] ?? statsMap[skillStatName] ?? numFighting) || 0;
  const csLevel = parseInt(skill[3]) || 0;
  const baseRank = resolveUniversalRoll(skillStatVal, 50, 0);
  const shiftedRank = resolveUniversalRoll(skillStatVal, 50, csLevel);
  const rankLabel = csLevel !== 0
    ? `${skillStatName}: ${skillStatVal} ➔ ${shiftedRank.rankName} (Base: ${baseRank.rankName}, CS: ${csLevel > 0 ? '+' + csLevel : csLevel})`
    : `${skillStatName}: ${skillStatVal} ➔ ${shiftedRank.rankName}`;

  const skillGreenVal = translateFormula(skill[8] || '', statsMap) || skill[8] || '—';
  const skillYellowVal = translateFormula(skill[9] || '', statsMap) || skill[9] || '—';
  const skillRedVal = translateFormula(skill[10] || '', statsMap) || skill[10] || '—';
  const skillNatRedVal = translateFormula(skill[11] || '', statsMap) || skill[11] || '—';
  const skillCritVal = translateFormula(skill[12] || '', statsMap) || skill[12] || '—';

  const skillsTableHtml = `
    <div class="qa-table-card">
      <div class="qa-table-header text-bold">Skills</div>
      <div class="qa-sub-header">
        <label class="qa-weapon-label">Skill:
          <select class="qa-weapon-select qa-skill-select" data-qa-slot="0">
            ${skillOptionsHtml}
          </select>
        </label>
      </div>
      <!-- Row 1: 4 columns for Karma target tiers -->
      <div class="qa-grid-4">
        <div class="qa-cell bg-gray rollable-qa-btn" data-qa-universal-roll="${esc(skillName)}" data-stat-name="${esc(skillStatName)}" data-stat-val="${skillStatVal}" data-cs-level="${csLevel}" data-target-tier="standard" title="Roll Standard ${esc(skillName)} (${rankLabel})">No Karma</div>
        <div class="qa-cell bg-green rollable-qa-btn" data-qa-universal-roll="${esc(skillName)}" data-stat-name="${esc(skillStatName)}" data-stat-val="${skillStatVal}" data-cs-level="${csLevel}" data-target-tier="green" title="Roll ${esc(skillName)} [Target: Green] (${rankLabel})">Green</div>
        <div class="qa-cell bg-yellow rollable-qa-btn" data-qa-universal-roll="${esc(skillName)}" data-stat-name="${esc(skillStatName)}" data-stat-val="${skillStatVal}" data-cs-level="${csLevel}" data-target-tier="yellow" title="Roll ${esc(skillName)} [Target: Yellow] (${rankLabel})">Yellow</div>
        <div class="qa-cell bg-red rollable-qa-btn" data-qa-universal-roll="${esc(skillName)}" data-stat-name="${esc(skillStatName)}" data-stat-val="${skillStatVal}" data-cs-level="${csLevel}" data-target-tier="red" title="Roll ${esc(skillName)} [Target: Red] (${rankLabel})">Red</div>
      </div>
      <!-- Row 2: 5 columns for translated outcome values -->
      <div class="qa-grid-5">
        <div class="qa-cell bg-green rollable-qa-effect" data-qa-effect-name="${esc(skillName)}" data-qa-tier-label="Green" data-qa-effect-expr="${esc(skillGreenVal)}" title="Click to roll Green: ${esc(skillGreenVal)}">${esc(skillGreenVal)}</div>
        <div class="qa-cell bg-yellow rollable-qa-effect" data-qa-effect-name="${esc(skillName)}" data-qa-tier-label="Yellow" data-qa-effect-expr="${esc(skillYellowVal)}" title="Click to roll Yellow: ${esc(skillYellowVal)}">${esc(skillYellowVal)}</div>
        <div class="qa-cell bg-red rollable-qa-effect" data-qa-effect-name="${esc(skillName)}" data-qa-tier-label="Red" data-qa-effect-expr="${esc(skillRedVal)}" title="Click to roll Red: ${esc(skillRedVal)}">${esc(skillRedVal)}</div>
        <div class="qa-cell bg-nat-red rollable-qa-effect" data-qa-effect-name="${esc(skillName)}" data-qa-tier-label="Natural Red" data-qa-effect-expr="${esc(skillNatRedVal)}" title="Click to roll Natural Red: ${esc(skillNatRedVal)}">${esc(skillNatRedVal)}</div>
        <div class="qa-cell bg-crit-red rollable-qa-effect" data-qa-effect-name="${esc(skillName)}" data-qa-tier-label="Critical 100" data-qa-effect-expr="${esc(skillCritVal)}" title="Click to roll Critical 100: ${esc(skillCritVal)}">${esc(skillCritVal)}</div>
      </div>
    </div>
  `;

  let selectedSpellIdx = character.data.quickAccessSpellSlot ?? 0;
  if (selectedSpellIdx < 0 || (rawSpells.length > 0 && selectedSpellIdx >= rawSpells.length)) {
    selectedSpellIdx = 0;
  }
  const spellOptionsHtml = rawSpells.length === 0
    ? '<option value="0">-- No spells in Spell tab --</option>'
    : rawSpells.map((sp, spIdx) => `<option value="${spIdx}" ${spIdx === selectedSpellIdx ? 'selected' : ''}>${esc(sp[0] || `Spell ${spIdx + 1}`)}</option>`).join('');

  const spell = (rawSpells.length > 0 && rawSpells[selectedSpellIdx]) ? rawSpells[selectedSpellIdx] : [];
  const spellName = spell[0] || (rawSpells.length > 0 ? `Spell ${selectedSpellIdx + 1}` : 'Spell');
  const spellStatVal = parseFloat(st.Intelligence ?? statsMap['Intelligence'] ?? numIntelligence) || 0;
  const spellRank = resolveUniversalRoll(spellStatVal, 50, 0);
  const spellRankLabel = `Intelligence: ${spellStatVal} ➔ ${spellRank.rankName}`;

  const spellGreenVal = translateFormula(spell[8] || '', statsMap) || spell[8] || '—';
  const spellYellowVal = translateFormula(spell[9] || '', statsMap) || spell[9] || '—';
  const spellRedVal = translateFormula(spell[10] || '', statsMap) || spell[10] || '—';
  const spellNatRedVal = translateFormula(spell[11] || '', statsMap) || spell[11] || '—';
  const spellCritVal = translateFormula(spell[12] || '', statsMap) || spell[12] || '—';

  const spellsTableHtml = `
    <div class="qa-table-card">
      <div class="qa-table-header text-bold">Spells</div>
      <div class="qa-sub-header">
        <label class="qa-weapon-label">Spell:
          <select class="qa-weapon-select qa-spell-select" data-qa-slot="0">
            ${spellOptionsHtml}
          </select>
        </label>
      </div>
      <!-- Row 1: 4 columns for Karma target tiers -->
      <div class="qa-grid-4">
        <div class="qa-cell bg-gray rollable-qa-btn" data-qa-universal-roll="${esc(spellName)}" data-stat-name="Intelligence" data-stat-val="${spellStatVal}" data-target-tier="standard" title="Roll Standard ${esc(spellName)} (${spellRankLabel})">No Karma</div>
        <div class="qa-cell bg-green rollable-qa-btn" data-qa-universal-roll="${esc(spellName)}" data-stat-name="Intelligence" data-stat-val="${spellStatVal}" data-target-tier="green" title="Roll ${esc(spellName)} [Target: Green] (${spellRankLabel})">Green</div>
        <div class="qa-cell bg-yellow rollable-qa-btn" data-qa-universal-roll="${esc(spellName)}" data-stat-name="Intelligence" data-stat-val="${spellStatVal}" data-target-tier="yellow" title="Roll ${esc(spellName)} [Target: Yellow] (${spellRankLabel})">Yellow</div>
        <div class="qa-cell bg-red rollable-qa-btn" data-qa-universal-roll="${esc(spellName)}" data-stat-name="Intelligence" data-stat-val="${spellStatVal}" data-target-tier="red" title="Roll ${esc(spellName)} [Target: Red] (${spellRankLabel})">Red</div>
      </div>
      <!-- Row 2: 5 columns for translated outcome values -->
      <div class="qa-grid-5">
        <div class="qa-cell bg-green rollable-qa-effect" data-qa-effect-name="${esc(spellName)}" data-qa-tier-label="Green" data-qa-effect-expr="${esc(spellGreenVal)}" title="Click to roll Green: ${esc(spellGreenVal)}">${esc(spellGreenVal)}</div>
        <div class="qa-cell bg-yellow rollable-qa-effect" data-qa-effect-name="${esc(spellName)}" data-qa-tier-label="Yellow" data-qa-effect-expr="${esc(spellYellowVal)}" title="Click to roll Yellow: ${esc(spellYellowVal)}">${esc(spellYellowVal)}</div>
        <div class="qa-cell bg-red rollable-qa-effect" data-qa-effect-name="${esc(spellName)}" data-qa-tier-label="Red" data-qa-effect-expr="${esc(spellRedVal)}" title="Click to roll Red: ${esc(spellRedVal)}">${esc(spellRedVal)}</div>
        <div class="qa-cell bg-nat-red rollable-qa-effect" data-qa-effect-name="${esc(spellName)}" data-qa-tier-label="Natural Red" data-qa-effect-expr="${esc(spellNatRedVal)}" title="Click to roll Natural Red: ${esc(spellNatRedVal)}">${esc(spellNatRedVal)}</div>
        <div class="qa-cell bg-crit-red rollable-qa-effect" data-qa-effect-name="${esc(spellName)}" data-qa-tier-label="Critical 100" data-qa-effect-expr="${esc(spellCritVal)}" title="Click to roll Critical 100: ${esc(spellCritVal)}">${esc(spellCritVal)}</div>
      </div>
    </div>
  `;

  return `
    <div class="quick-access-section">
      <h3 class="quick-access-main-title">⚡ Quick Access</h3>
      ${defenseTableHtml}
      <div class="qa-separator"></div>
      ${weaponTableHtml}
      <div class="qa-separator"></div>
      ${skillsTableHtml}
      <div class="qa-separator"></div>
      ${spellsTableHtml}
    </div>
  `;
}

function statsPage(character) {
  const st = character.data.stats || {};
  const fighting = st.Fighting ?? st['Combat Capacity'] ?? '6';
  const strength = st.Strength ?? '6';
  const agility = st.Agility ?? '6';
  const endurance = st.Endurance ?? '6';
  const speed = st.Speed ?? st.Movement ?? '6';
  const intelligence = st.Intelligence ?? '6';
  const wisdom = st.Wisdom ?? '6';
  const intuition = st.Intuition ?? '6';
  const psyche = st.Psyche ?? '6';
  const luck = st.Luck ?? '0';
  const karma = st.Karma ?? '0';

  const combatCapacityBonus = st.CombatCapacityBonus ?? '0';
  const manaPoolBonus = st.ManaPoolBonus ?? '0';
  const focus = st.Focus ?? '0';
  const fullRestante = st.FullRestante ?? '0';
  const freeRestante = st.FreeRestante ?? '0';

  const numFighting = parseFloat(fighting) || 0;
  const numStrength = parseFloat(strength) || 0;
  const numAgility = parseFloat(agility) || 0;
  const numEndurance = parseFloat(endurance) || 0;
  const numSpeed = parseFloat(speed) || 0;
  const numIntelligence = parseFloat(intelligence) || 0;
  const numWisdom = parseFloat(wisdom) || 0;
  const numIntuition = parseFloat(intuition) || 0;
  const numPsyche = parseFloat(psyche) || 0;

  const movement = 4 + Math.floor(numSpeed / 10);
  const combatCapacityTotal = numStrength + numAgility + numEndurance + numSpeed;
  const manaPoolTotal = numIntelligence + numWisdom + numIntuition + numPsyche;
  const statSum = numFighting + numStrength + numAgility + numEndurance + numSpeed + numIntelligence + numWisdom + numIntuition + numPsyche;
  const karmaLevel = Math.floor(statSum / 9);
  const actionTotal = (Math.floor((statSum / 90) * 10) / 10).toFixed(1);
  const firstRoundBonus = Math.floor(numIntuition / 10);
  const nextRoundsBonus = Math.floor(numSpeed / 10);

  return `<div class="stats-page-layout">
    <div class="stats-left-panel">
      ${rollResultBannerHtml()}
      <div class="excel-stats-grid">
        <!-- Row 1: Fighting, Luck, Movement -->
        <div class="excel-row">
          <div class="excel-cell bg-gray text-bold label-cell rollable-stat" data-roll-stat="Fighting" title="Click to roll 1D100 for Fighting">Fighting</div>
          <div class="excel-cell bg-light input-cell">${editable('stats.Fighting', fighting, 'stat-input-cell', '6')}</div>
          <div class="excel-cell bg-green text-bold label-cell rollable-stat" data-roll-stat="Luck" title="Click to roll 1D100 for Luck">Luck</div>
          <div class="excel-cell bg-light input-cell">${editable('stats.Luck', luck, 'stat-input-cell', '0')}</div>
          <div class="excel-cell bg-coral text-bold label-cell">Movement</div>
          <div class="excel-cell bg-light calc-cell"><span class="auto-value" id="calc-movement">${movement}</span></div>
        </div>

        <div class="excel-spacer-row"></div>

        <!-- Rows 3-10: Main Stats (Left), Combat Capacity & Mana Pool (Middle, aligned with Luck), Karma (Right, full height) -->
        <div class="excel-main-stats-block">
          <!-- Col 1-2: Physical & Mental Stats -->
          <div class="main-stats-col">
            <div class="excel-row mini-row">
              <div class="excel-cell bg-coral text-bold label-cell rollable-stat" data-roll-stat="Strength" title="Click to roll 1D100 for Strength">Strength</div>
              <div class="excel-cell bg-light input-cell">${editable('stats.Strength', strength, 'stat-input-cell', '6')}</div>
            </div>
            <div class="excel-row mini-row">
              <div class="excel-cell bg-coral text-bold label-cell rollable-stat" data-roll-stat="Agility" title="Click to roll 1D100 for Agility">Agility</div>
              <div class="excel-cell bg-light input-cell">${editable('stats.Agility', agility, 'stat-input-cell', '6')}</div>
            </div>
            <div class="excel-row mini-row">
              <div class="excel-cell bg-coral text-bold label-cell rollable-stat" data-roll-stat="Endurance" title="Click to roll 1D100 for Endurance">Endurance</div>
              <div class="excel-cell bg-light input-cell">${editable('stats.Endurance', endurance, 'stat-input-cell', '6')}</div>
            </div>
            <div class="excel-row mini-row">
              <div class="excel-cell bg-coral text-bold label-cell rollable-stat" data-roll-stat="Speed" title="Click to roll 1D100 for Speed">Speed</div>
              <div class="excel-cell bg-light input-cell">${editable('stats.Speed', speed, 'stat-input-cell', '6')}</div>
            </div>
            <div class="excel-row mini-row">
              <div class="excel-cell bg-blue text-bold label-cell rollable-stat" data-roll-stat="Intelligence" title="Click to roll 1D100 for Intelligence">Intelligence</div>
              <div class="excel-cell bg-light input-cell">${editable('stats.Intelligence', intelligence, 'stat-input-cell', '6')}</div>
            </div>
            <div class="excel-row mini-row">
              <div class="excel-cell bg-blue text-bold label-cell rollable-stat" data-roll-stat="Wisdom" title="Click to roll 1D100 for Wisdom">Wisdom</div>
              <div class="excel-cell bg-light input-cell">${editable('stats.Wisdom', wisdom, 'stat-input-cell', '6')}</div>
            </div>
            <div class="excel-row mini-row">
              <div class="excel-cell bg-blue text-bold label-cell rollable-stat" data-roll-stat="Intuition" title="Click to roll 1D100 for Intuition">Intuition</div>
              <div class="excel-cell bg-light input-cell">${editable('stats.Intuition', intuition, 'stat-input-cell', '6')}</div>
            </div>
            <div class="excel-row mini-row">
              <div class="excel-cell bg-blue text-bold label-cell rollable-stat" data-roll-stat="Psyche" title="Click to roll 1D100 for Psyche">Psyche</div>
              <div class="excel-cell bg-light input-cell">${editable('stats.Psyche', psyche, 'stat-input-cell', '6')}</div>
            </div>
          </div>

          <!-- Col 3-4: Combat Capacity (top) & Mana Pool (bottom) aligned with Luck -->
          <div class="pools-col">
            <!-- Top Half: Combat Capacity -->
            <div class="pool-box cc-box">
              <div class="excel-cell bg-coral text-bold banner-cell">
                <span class="banner-title text-bold">Combat Capacity</span>
                <span class="banner-icon">❤️❤️❤️</span>
              </div>
              <div class="pool-values-col">
                <div class="excel-cell bg-light input-cell pool-val-top">${editable('stats.CombatCapacityBonus', combatCapacityBonus, 'stat-input-cell', '0')}</div>
                <div class="excel-cell bg-coral calc-cell pool-val-bottom text-bold"><span class="auto-big-value" id="calc-combat-capacity">${combatCapacityTotal}</span></div>
              </div>
            </div>

            <!-- Bottom Half: Mana Pool -->
            <div class="pool-box mp-box">
              <div class="excel-cell bg-blue text-bold banner-cell">
                <span class="banner-title text-bold">Mana Pool</span>
                <span class="banner-icon">✨✨✨</span>
              </div>
              <div class="pool-values-col">
                <div class="excel-cell bg-light input-cell pool-val-top">${editable('stats.ManaPoolBonus', manaPoolBonus, 'stat-input-cell', '0')}</div>
                <div class="excel-cell bg-blue calc-cell pool-val-bottom text-bold"><span class="auto-big-value" id="calc-mana-pool">${manaPoolTotal}</span></div>
              </div>
            </div>
          </div>

          <!-- Col 5-6: Karma spanning the full height of Combat Capacity + Mana Pool -->
          <div class="karma-col">
            <div class="excel-cell bg-purple text-bold banner-cell karma-banner">
              <span class="banner-title text-bold">Karma</span>
            </div>
            <div class="pool-values-col karma-values">
              <div class="excel-cell bg-light input-cell pool-val-top">${editable('stats.Karma', karma, 'stat-input-cell', '0')}</div>
              <div class="excel-cell bg-purple calc-cell pool-val-bottom text-bold"><span class="auto-big-value" id="calc-karma-level">${karmaLevel}</span></div>
            </div>
          </div>
        </div>

        <div class="excel-spacer-row"></div>

        <!-- Rows 12-14: Initiative & Actions & Focus -->
        <div class="excel-initiative-block">
          <!-- Col 1-2: Initiative -->
          <div class="ini-col">
            <div class="excel-row mini-row">
              <div class="excel-cell bg-gray text-bold label-cell">Initiative</div>
              <div class="excel-cell bg-gray text-bold input-cell static-text">1D12 +</div>
            </div>
            <div class="excel-row mini-row">
              <div class="excel-cell bg-blue text-bold label-cell rollable-stat" data-roll-initiative="First round" data-bonus="${firstRoundBonus}" title="Click to roll Initiative (First round): 1D12 + ${firstRoundBonus}">First round</div>
              <div class="excel-cell bg-blue text-bold calc-cell rollable-stat" data-roll-initiative="First round" data-bonus="${firstRoundBonus}" title="Click to roll Initiative (First round): 1D12 + ${firstRoundBonus}"><span class="auto-value" id="calc-first-round">${firstRoundBonus}</span></div>
            </div>
            <div class="excel-row mini-row">
              <div class="excel-cell bg-coral text-bold label-cell rollable-stat" data-roll-initiative="Next Rounds" data-bonus="${nextRoundsBonus}" title="Click to roll Initiative (Next Rounds): 1D12 + ${nextRoundsBonus}">Next Rounds</div>
              <div class="excel-cell bg-coral text-bold calc-cell rollable-stat" data-roll-initiative="Next Rounds" data-bonus="${nextRoundsBonus}" title="Click to roll Initiative (Next Rounds): 1D12 + ${nextRoundsBonus}"><span class="auto-value" id="calc-next-rounds">${nextRoundsBonus}</span></div>
            </div>
          </div>

          <!-- Col 3-4: Action Total, Full Restante, Free Restante -->
          <div class="actions-col">
            <div class="excel-row mini-row">
              <div class="excel-cell bg-yellow text-bold label-cell">Action Total</div>
              <div class="excel-cell bg-yellow text-bold calc-cell"><span class="auto-value" id="calc-action-total">${actionTotal}</span></div>
            </div>
            <div class="excel-row mini-row">
              <div class="excel-cell bg-yellow text-bold label-cell">Full Restante</div>
              <div class="excel-cell bg-light input-cell">${editable('stats.FullRestante', fullRestante, 'stat-input-cell', '0')}</div>
            </div>
            <div class="excel-row mini-row">
              <div class="excel-cell bg-yellow text-bold label-cell">Free Restante</div>
              <div class="excel-cell bg-light input-cell">${editable('stats.FreeRestante', freeRestante, 'stat-input-cell', '0')}</div>
            </div>
          </div>

          <!-- Col 5-6: Focus (full contour and height) -->
          <div class="focus-col">
            <div class="excel-cell bg-yellow text-bold banner-cell focus-label">
              <span class="banner-title text-bold">Focus</span>
              <span class="banner-icon" style="font-size: calc(10px * var(--font-scale, 1)); font-weight: normal; color: #555850;">(10 Maximum)</span>
            </div>
            <div class="excel-cell bg-light input-cell focus-input">
              ${editable('stats.Focus', focus, 'stat-input-cell', '0')}
            </div>
          </div>
        </div>

      </div>

      ${quickAccessSectionHtml(character, numFighting, numStrength, numAgility, numIntuition, numSpeed)}
    </div>

    <div class="stats-right-panel">
      <div class="universal-chart-card">
        <h3 class="chart-heading">Universal Chart (Table Universelle)</h3>
        ${universalChartTableHtml()}
      </div>
    </div>
  </div>`;
}

function updateStatsCalculations() {
  const character = currentCharacter();
  if (!character || activeTab !== 'Stats') return;

  const st = character.data.stats || {};
  const fighting = parseFloat(st.Fighting ?? st['Combat Capacity'] ?? '6') || 0;
  const strength = parseFloat(st.Strength ?? '6') || 0;
  const agility = parseFloat(st.Agility ?? '6') || 0;
  const endurance = parseFloat(st.Endurance ?? '6') || 0;
  const speed = parseFloat(st.Speed ?? st.Movement ?? '6') || 0;
  const intelligence = parseFloat(st.Intelligence ?? '6') || 0;
  const wisdom = parseFloat(st.Wisdom ?? '6') || 0;
  const intuition = parseFloat(st.Intuition ?? '6') || 0;
  const psyche = parseFloat(st.Psyche ?? '6') || 0;

  const movement = 4 + Math.floor(speed / 10);
  const combatCapacityTotal = strength + agility + endurance + speed;
  const manaPoolTotal = intelligence + wisdom + intuition + psyche;
  const statSum = fighting + strength + agility + endurance + speed + intelligence + wisdom + intuition + psyche;
  const karmaLevel = Math.floor(statSum / 9);
  const actionTotal = (Math.floor((statSum / 90) * 10) / 10).toFixed(1);
  const firstRoundBonus = Math.floor(intuition / 10);
  const nextRoundsBonus = Math.floor(speed / 10);

  const moveEl = app.querySelector('#calc-movement');
  if (moveEl) moveEl.textContent = movement;

  const ccEl = app.querySelector('#calc-combat-capacity');
  if (ccEl) ccEl.textContent = combatCapacityTotal;

  const karmaEl = app.querySelector('#calc-karma-level');
  if (karmaEl) karmaEl.textContent = karmaLevel;

  const manaEl = app.querySelector('#calc-mana-pool');
  if (manaEl) manaEl.textContent = manaPoolTotal;

  const actEl = app.querySelector('#calc-action-total');
  if (actEl) actEl.textContent = actionTotal;

  const frEl = app.querySelector('#calc-first-round');
  if (frEl) {
    frEl.textContent = firstRoundBonus;
    frEl.closest('.excel-row')?.querySelectorAll('[data-roll-initiative="First round"]').forEach((el) => {
      el.dataset.bonus = firstRoundBonus;
      el.title = `Click to roll Initiative (First round): 1D12 + ${firstRoundBonus}`;
    });
  }

  const nrEl = app.querySelector('#calc-next-rounds');
  if (nrEl) {
    nrEl.textContent = nextRoundsBonus;
    nrEl.closest('.excel-row')?.querySelectorAll('[data-roll-initiative="Next Rounds"]').forEach((el) => {
      el.dataset.bonus = nextRoundsBonus;
      el.title = `Click to roll Initiative (Next Rounds): 1D12 + ${nextRoundsBonus}`;
    });
  }

  const statsMap = getCharacterStatsMap(character);
  app.querySelectorAll('.formula-cell').forEach((cell) => {
    const ta = cell.querySelector('.formula-input');
    const resultTextEl = cell.querySelector('.formula-result-text');
    if (ta && resultTextEl) {
      const val = ta.value;
      const hasVal = Boolean(val && val.trim());
      const translated = translateFormula(val, statsMap);
      resultTextEl.textContent = hasVal ? (translated || val) : '—';
      if (hasVal) {
        resultTextEl.classList.remove('formula-result-empty');
      } else {
        resultTextEl.classList.add('formula-result-empty');
      }
    }
  });
}

function universalChartPage() {
  return `<section><h2 class="section-title">Universale Chart</h2>${rollResultBannerHtml()}${universalChartTableHtml()}</section>`;
}

function rollsAndIniPage() {
  const characters = Object.entries(state.characters || {});
  const trackerMap = state.initiativeTracker || {};

  const allEntriesMap = new Map();

  characters.forEach(([id, c]) => {
    const isAssigned = Boolean(c.ownerId);
    let ownerName = 'Unassigned (NPC)';
    if (isAssigned) {
      const p = players.find((pl) => pl.id === c.ownerId) || state.knownPlayers?.[c.ownerId];
      ownerName = p ? p.name : (c.ownerName || (c.ownerId === user.id ? user.name : 'Player'));
    }
    const intuitionVal = parseFloat(c.data?.stats?.Intuition ?? '6') || 0;
    const speedVal = parseFloat(c.data?.stats?.Speed ?? c.data?.stats?.Movement ?? '6') || 0;
    const firstRoundBonus = Math.floor(intuitionVal / 10);
    const nextRoundsBonus = Math.floor(speedVal / 10);

    const tracked = trackerMap[id] || Object.values(trackerMap).find((t) => t.charName === c.name);
    const inCombat = isAssigned ? true : (c.data?.inCombat !== false && tracked?.inCombat !== false);

    allEntriesMap.set(id, {
      characterId: id,
      charName: c.name || 'Unnamed',
      isAssigned,
      ownerName,
      inCombat,
      firstRoundBonus,
      nextRoundsBonus,
      hasRolled: tracked && typeof tracked.total === 'number',
      total: tracked?.total,
      d12: tracked?.d12,
      bonus: tracked?.bonus,
      label: tracked?.label,
      timestamp: tracked?.timestamp || 0
    });
  });

  Object.entries(trackerMap).forEach(([tId, tVal]) => {
    const existingKey = Array.from(allEntriesMap.keys()).find((k) => k === tId || allEntriesMap.get(k).charName === tVal.charName);
    if (!existingKey && tVal) {
      const isAssigned = Boolean(tVal.isAssigned);
      const inCombat = isAssigned ? true : (tVal.inCombat !== false);
      allEntriesMap.set(tId, {
        characterId: tId,
        charName: tVal.charName || 'Character',
        isAssigned,
        ownerName: tVal.playerName || (isAssigned ? 'Assigned' : 'Unassigned (NPC)'),
        inCombat,
        firstRoundBonus: tVal.bonus ?? 0,
        nextRoundsBonus: 0,
        hasRolled: typeof tVal.total === 'number',
        total: tVal.total,
        d12: tVal.d12,
        bonus: tVal.bonus,
        label: tVal.label,
        timestamp: tVal.timestamp || 0
      });
    }
  });

  const allEntries = Array.from(allEntriesMap.values());

  const inCombatRolled = allEntries
    .filter((e) => e.inCombat && e.hasRolled)
    .sort((a, b) => (b.total - a.total) || (b.bonus - a.bonus) || a.charName.localeCompare(b.charName));

  const inCombatUnrolled = allEntries
    .filter((e) => e.inCombat && !e.hasRolled)
    .sort((a, b) => a.charName.localeCompare(b.charName));

  const outOfCombatList = allEntries
    .filter((e) => !e.inCombat)
    .sort((a, b) => a.charName.localeCompare(b.charName));

  let sortedIniList;
  if (!iniSortState || iniSortState.colKey === 'order') {
    if (iniSortState?.direction === 'desc') {
      sortedIniList = [...inCombatRolled.slice().reverse(), ...inCombatUnrolled.slice().reverse(), ...outOfCombatList.slice().reverse()];
    } else {
      sortedIniList = [...inCombatRolled, ...inCombatUnrolled, ...outOfCombatList];
    }
  } else if (iniSortState.colKey === 'charName') {
    sortedIniList = [...allEntries].sort((a, b) => compareValues(a.charName, b.charName, iniSortState.direction));
  } else if (iniSortState.colKey === 'status') {
    sortedIniList = [...allEntries].sort((a, b) => {
      const statusA = a.isAssigned ? (a.ownerName || 'Player') : (a.inCombat ? 'NPC (In Combat)' : 'NPC (Out of Combat)');
      const statusB = b.isAssigned ? (b.ownerName || 'Player') : (b.inCombat ? 'NPC (In Combat)' : 'NPC (Out of Combat)');
      return compareValues(statusA, statusB, iniSortState.direction);
    });
  } else if (iniSortState.colKey === 'mods') {
    sortedIniList = [...allEntries].sort((a, b) => compareValues(a.firstRoundBonus, b.firstRoundBonus, iniSortState.direction));
  } else if (iniSortState.colKey === 'result') {
    sortedIniList = [...allEntries].sort((a, b) => compareValues(a.hasRolled ? a.total : null, b.hasRolled ? b.total : null, iniSortState.direction));
  } else {
    sortedIniList = [...inCombatRolled, ...inCombatUnrolled, ...outOfCombatList];
  }

  const inCombatEntries = allEntries.filter((e) => e.inCombat);
  const inCombatNpcs = allEntries.filter((e) => !e.isAssigned && e.inCombat);

  const allRolls = state.rollHistory || [];
  const filteredRolls = allRolls.filter((r) => {
    if (rollFilter === 'stats') return r.type === 'stat';
    if (rollFilter === 'initiative') return r.type === 'initiative';
    if (rollFilter === 'crits') return r.outcomeType === 'crit-fail' || r.outcomeType === 'crit-success' || r.roll === 1 || r.roll === 100;
    return true;
  });

  if (rollHistorySortState?.colKey) {
    filteredRolls.sort((a, b) => {
      let valA, valB;
      if (rollHistorySortState.colKey === 'time') {
        valA = a.timestamp || 0;
        valB = b.timestamp || 0;
      } else if (rollHistorySortState.colKey === 'charName') {
        valA = `${a.charName || ''} ${a.playerName || ''}`;
        valB = `${b.charName || ''} ${b.playerName || ''}`;
      } else if (rollHistorySortState.colKey === 'stat') {
        valA = a.statName || a.label || '';
        valB = b.statName || b.label || '';
      } else if (rollHistorySortState.colKey === 'formula') {
        valA = a.detail || String(a.roll || '');
        valB = b.detail || String(b.roll || '');
      } else if (rollHistorySortState.colKey === 'outcome') {
        valA = a.outcomeLabel || a.total || a.roll || '';
        valB = b.outcomeLabel || b.total || b.roll || '';
      }
      return compareValues(valA, valB, rollHistorySortState.direction);
    });
  }

  const renderIniTh = (colKey, label, style = '', align = 'left') => {
    const isSorted = iniSortState && iniSortState.colKey === colKey;
    const sortDir = isSorted ? iniSortState.direction : null;
    const sortClass = isSorted ? ` sort-active sort-${sortDir}` : '';
    const sortIcon = isSorted
      ? (sortDir === 'asc' ? '<span class="sort-icon sort-asc" title="Sorted ascending">▲</span>' : '<span class="sort-icon sort-desc" title="Sorted descending">▼</span>')
      : '<span class="sort-icon sort-none" title="Click to sort">⇅</span>';
    return `<th class="sortable-header${sortClass}" data-sort-ini-col="${colKey}" style="${style} text-align: ${align}; cursor: pointer;" title="Click to sort by ${esc(label)}"><span class="th-content" style="display: flex; align-items: center; justify-content: ${align === 'center' ? 'center' : (align === 'right' ? 'flex-end' : 'space-between')}; gap: 4px;">${esc(label)}${sortIcon}</span></th>`;
  };

  const renderRollHistoryTh = (colKey, label, style = '', align = 'left') => {
    const isSorted = rollHistorySortState && rollHistorySortState.colKey === colKey;
    const sortDir = isSorted ? rollHistorySortState.direction : null;
    const sortClass = isSorted ? ` sort-active sort-${sortDir}` : '';
    const sortIcon = isSorted
      ? (sortDir === 'asc' ? '<span class="sort-icon sort-asc" title="Sorted ascending">▲</span>' : '<span class="sort-icon sort-desc" title="Sorted descending">▼</span>')
      : '<span class="sort-icon sort-none" title="Click to sort">⇅</span>';
    return `<th class="sortable-header${sortClass}" data-sort-roll-col="${colKey}" style="${style} text-align: ${align}; cursor: pointer;" title="Click to sort by ${esc(label)}"><span class="th-content" style="display: flex; align-items: center; justify-content: ${align === 'center' ? 'center' : (align === 'right' ? 'flex-end' : 'space-between')}; gap: 4px;">${esc(label)}${sortIcon}</span></th>`;
  };

  return `<div class="roll-tracker-layout">
    ${rollResultBannerHtml()}

    <!-- Section 1: Initiative Tracker -->
    <div class="tracker-card">
      <div class="tracker-card-header">
        <div class="tracker-title-wrap">
          <h2 class="tracker-card-title">⚔️ Ordre d'Initiative &amp; Tableau de Bataille</h2>
          <span class="tracker-count-badge">${inCombatRolled.length}/${inCombatEntries.length} Combattants Prêts &bull; ${inCombatNpcs.length} PNJs Actifs</span>
        </div>
        <div class="tracker-btn-group">
          <button type="button" class="tracker-btn tracker-btn-primary" id="roll-unassigned-ini-btn" title="Lancer l'Initiative du 1er Tour pour tous les PNJs en combat">🎲 Lancer PNJs (1er Tour)</button>
          <button type="button" class="tracker-btn tracker-btn-primary" id="roll-unassigned-next-ini-btn" title="Lancer l'Initiative des Tours Suivants pour tous les PNJs en combat">🎲 Lancer PNJs (Tours Suiv.)</button>
          <button type="button" class="tracker-btn" id="all-npcs-enter-combat-btn" title="Engager tous les PNJs dans le combat">⚔️ Tous en Combat</button>
          <button type="button" class="tracker-btn" id="all-npcs-leave-combat-btn" title="Désengager tous les PNJs du combat">🚪 Sortir tous les PNJs</button>
          <button type="button" class="tracker-btn tracker-btn-danger" id="clear-initiative-btn" title="Réinitialiser tous les scores d'initiative">🗑️ Réinitialiser</button>
        </div>
      </div>
      <div class="tracker-table-wrap">
        ${sortedIniList.length === 0 ? `
          <div class="tracker-empty-state">Aucun personnage dans le registre. Créez des dossiers de personnages pour suivre leur initiative.</div>
        ` : `
          <table class="tracker-table">
            <thead>
              <tr>
                ${renderIniTh('order', 'Rang', 'width: 60px;', 'center')}
                ${renderIniTh('charName', 'Personnage')}
                ${renderIniTh('status', 'Statut / Attribution')}
                ${renderIniTh('mods', 'Modificateurs d\'Ini')}
                ${renderIniTh('result', 'Score Obtenu')}
                <th style="text-align: right;">Actions</th>
              </tr>
            </thead>
            <tbody>
              ${sortedIniList.map((item, idx) => {
                const isLeader = item.inCombat && item.hasRolled && idx === 0;
                const rankText = (!item.inCombat) ? '—' : (item.hasRolled ? `${idx + 1}` : '-');
                return `<tr class="${isLeader ? 'row-leader' : ''} ${!item.inCombat ? 'row-out-of-combat' : ''}">
                  <td style="text-align: center;">
                    <span class="ini-rank-badge ${!item.inCombat ? 'unrolled' : (item.hasRolled ? (isLeader ? 'leader' : 'active') : 'unrolled')}">${rankText}</span>
                  </td>
                  <td>
                    <span class="tracker-char-name">${esc(item.charName)}</span>
                  </td>
                  <td>
                    <div style="display: flex; gap: 4px; align-items: center; flex-wrap: wrap;">
                      <span class="tracker-tag ${item.isAssigned ? 'tag-player' : 'tag-npc'}">
                        ${item.isAssigned ? `👤 ${esc(item.ownerName)}` : '🤖 PNJ'}
                      </span>
                      ${!item.isAssigned ? `
                        <button type="button" class="tracker-tag ${item.inCombat ? 'tag-in-combat' : 'tag-out-combat'}" data-ini-toggle-combat="${esc(item.characterId)}" style="cursor: pointer;" title="Basculer l'état de combat (${item.inCombat ? 'En Combat' : 'Hors Combat'})">
                          ${item.inCombat ? '⚔️ En Combat' : '💤 Hors Combat'}
                        </button>
                      ` : ''}
                    </div>
                  </td>
                  <td>
                    <span class="tracker-mod-tag" title="Bonus 1er Tour (Intuition / 10)">1er: <strong>+${item.firstRoundBonus}</strong></span>
                    <span class="tracker-mod-tag" title="Bonus Tours Suivants (Vitesse / 10)">Suiv: <strong>+${item.nextRoundsBonus}</strong></span>
                  </td>
                  <td>
                    ${!item.inCombat ? `
                      <span class="ini-unrolled-note out-of-combat-note">Hors combat (ignoré lors des lancers groupés)</span>
                    ` : item.hasRolled ? `
                      <div class="ini-score-box">
                        <span class="ini-score-number">${item.total}</span>
                        <span class="ini-score-detail">(1D12: ${item.d12} ${item.bonus >= 0 ? `+ ${item.bonus}` : `- ${Math.abs(item.bonus)}`}) &bull; <em>${esc(item.label || '1er tour')}</em></span>
                      </div>
                    ` : `
                      <span class="ini-unrolled-note">En attente de jet...</span>
                    `}
                  </td>
                  <td style="text-align: right;">
                    <div class="tracker-btn-group" style="justify-content: flex-end;">
                      ${!item.isAssigned ? `
                        <button type="button" class="tracker-btn-mini combat-toggle-btn ${item.inCombat ? 'combat-leave-btn' : 'combat-enter-btn'}" data-ini-toggle-combat="${esc(item.characterId)}" title="${item.inCombat ? 'Quitter le combat' : 'Entrer en combat'}">${item.inCombat ? 'Quitter' : '⚔️ Entrer'}</button>
                      ` : ''}
                      <button type="button" class="tracker-btn-mini" data-ini-roll-char="${esc(item.characterId)}" data-ini-label="1er tour" data-ini-bonus="${item.firstRoundBonus}" title="Lancer 1er Tour: 1D12 + ${item.firstRoundBonus}">Jet 1er</button>
                      <button type="button" class="tracker-btn-mini" data-ini-roll-char="${esc(item.characterId)}" data-ini-label="Tours suivants" data-ini-bonus="${item.nextRoundsBonus}" title="Lancer Tours Suivants: 1D12 + ${item.nextRoundsBonus}">Jet Suiv</button>
                      <button type="button" class="tracker-btn-mini" data-ini-set-score="${esc(item.characterId)}" data-char-name="${esc(item.charName)}" title="Définir manuellement le score d'initiative">Fixer</button>
                      ${item.hasRolled ? `<button type="button" class="tracker-btn-mini remove-btn" data-ini-clear-char="${esc(item.characterId)}" title="Effacer l'initiative de ce personnage">&times;</button>` : ''}
                    </div>
                  </td>
                </tr>`;
              }).join('')}
            </tbody>
          </table>
        `}
      </div>
    </div>

    <!-- Section 2: All Rolls History Tracker -->
    <div class="tracker-card">
      <div class="tracker-card-header">
        <div class="tracker-title-wrap">
          <h2 class="tracker-card-title">📜 Registre &amp; Historique des Jets</h2>
          <span class="tracker-count-badge">${allRolls.length} Enregistrés</span>
          <div class="tracker-filter-pills">
            <button type="button" class="tracker-filter-btn ${rollFilter === 'all' ? 'active' : ''}" data-roll-filter="all">Tous (${allRolls.length})</button>
            <button type="button" class="tracker-filter-btn ${rollFilter === 'stats' ? 'active' : ''}" data-roll-filter="stats">Stats D100</button>
            <button type="button" class="tracker-filter-btn ${rollFilter === 'initiative' ? 'active' : ''}" data-roll-filter="initiative">Initiative D12</button>
            <button type="button" class="tracker-filter-btn ${rollFilter === 'crits' ? 'active' : ''}" data-roll-filter="crits">Critiques (1/100)</button>
          </div>
        </div>
        <div class="tracker-btn-group">
          <button type="button" class="tracker-btn tracker-btn-danger" id="clear-rolls-btn" title="Effacer tout l'historique des jets">🗑️ Effacer l'Historique</button>
        </div>
      </div>
      <div class="tracker-table-wrap roll-history-scroll-wrap">
        ${filteredRolls.length === 0 ? `
          <div class="tracker-empty-state">${allRolls.length === 0 ? 'Aucun jet enregistré pour le moment. Les jets de statistiques, d\'initiative et de dés apparaîtront ici en direct.' : 'Aucun jet ne correspond au filtre sélectionné.'}</div>
        ` : `
          <table class="tracker-table">
            <thead>
              <tr>
                ${renderRollHistoryTh('time', 'Heure', 'width: 85px;')}
                ${renderRollHistoryTh('charName', 'Personnage / Joueur')}
                ${renderRollHistoryTh('stat', 'Jet / Statistique')}
                ${renderRollHistoryTh('formula', 'Formule &amp; Détails')}
                ${renderRollHistoryTh('outcome', 'Résultat', '', 'right')}
              </tr>
            </thead>
            <tbody>
              ${filteredRolls.map((roll) => {
                const timeStr = roll.timestamp ? new Date(roll.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '-';
                let outcomeClass = 'outcome-white';
                if (roll.outcomeType === 'crit-fail' || roll.outcomeType === 'crit-success') outcomeClass = 'outcome-crit';
                else if (roll.outcomeType === 'red') outcomeClass = 'outcome-red';
                else if (roll.outcomeType === 'yellow') outcomeClass = 'outcome-yellow';
                else if (roll.outcomeType === 'green' || roll.outcomeType === 'initiative') outcomeClass = 'outcome-green';

                let badgeText = roll.outcomeLabel || 'Jet';
                if (roll.outcomeType === 'crit-fail') badgeText = '💥 ÉCHEC CRITIQUE (1)';
                if (roll.outcomeType === 'crit-success') badgeText = '🌟 SUCCÈS CRITIQUE (100)';

                return `<tr>
                  <td class="log-cell-time">${timeStr}</td>
                  <td>
                    <div class="log-cell-char">
                      <strong class="tracker-char-name">${esc(roll.charName || 'Personnage')}</strong>
                      <span class="log-player-sub">${esc(roll.playerName || 'Joueur')}</span>
                    </div>
                  </td>
                  <td class="log-cell-stat">
                    ${esc(roll.statName || 'Jet')}
                  </td>
                  <td class="log-cell-detail">
                    <code>${esc(roll.detail || `Jet: ${roll.roll}`)}</code>
                  </td>
                  <td style="text-align: right;">
                    <span class="roll-log-badge ${outcomeClass}">${esc(badgeText)}</span>
                  </td>
                </tr>`;
              }).join('')}
            </tbody>
          </table>
        `}
      </div>
    </div>
        </div>
      </div>
      <div class="tracker-table-wrap roll-history-scroll-wrap">
        ${filteredRolls.length === 0 ? `
          <div class="tracker-empty-state">${allRolls.length === 0 ? 'No rolls have been recorded yet. Rolls from character stats, initiative, and dice tray will appear here in real-time.' : 'No rolls match the current filter.'}</div>
        ` : `
          <table class="tracker-table">
            <thead>
              <tr>
                ${renderRollHistoryTh('time', 'Time', 'width: 85px;')}
                ${renderRollHistoryTh('charName', 'Character / Player')}
                ${renderRollHistoryTh('stat', 'Roll / Stat')}
                ${renderRollHistoryTh('formula', 'Formula & Details')}
                ${renderRollHistoryTh('outcome', 'Outcome', '', 'right')}
              </tr>
            </thead>
            <tbody>
              ${filteredRolls.map((roll) => {
                const timeStr = roll.timestamp ? new Date(roll.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '-';
                let outcomeClass = 'outcome-white';
                if (roll.outcomeType === 'crit-fail' || roll.outcomeType === 'crit-success') outcomeClass = 'outcome-crit';
                else if (roll.outcomeType === 'red') outcomeClass = 'outcome-red';
                else if (roll.outcomeType === 'yellow') outcomeClass = 'outcome-yellow';
                else if (roll.outcomeType === 'green' || roll.outcomeType === 'initiative') outcomeClass = 'outcome-green';

                let badgeText = roll.outcomeLabel || 'Roll';
                if (roll.outcomeType === 'crit-fail') badgeText = '💥 CRITICAL FAIL (1)';
                if (roll.outcomeType === 'crit-success') badgeText = '🌟 CRITICAL SUCCESS (100)';

                return `<tr>
                  <td class="log-cell-time">${timeStr}</td>
                  <td>
                    <div class="log-cell-char">
                      <strong class="tracker-char-name">${esc(roll.charName || 'Character')}</strong>
                      <span class="log-player-sub">${esc(roll.playerName || 'Player')}</span>
                    </div>
                  </td>
                  <td class="log-cell-stat">
                    ${esc(roll.statName || 'Roll')}
                  </td>
                  <td class="log-cell-detail">
                    <code>${esc(roll.detail || `Roll: ${roll.roll}`)}</code>
                  </td>
                  <td style="text-align: right;">
                    <span class="roll-log-badge ${outcomeClass}">${esc(badgeText)}</span>
                  </td>
                </tr>`;
              }).join('')}
            </tbody>
          </table>
        `}
      </div>
    </div>
  </div>`;
}

function tablePage(name, character) {
  const headers = tables[name];
  character.data.tables ??= {};
  const storedRows = character.data.tables[name];
  let rows;
  if (name === 'Spell' && (!storedRows || (Array.isArray(storedRows) && storedRows.length === 0))) {
    rows = [[
      'Counter Spell',
      '2',
      'Normal',
      '10',
      '2 x Spirit',
      'Counter Spell est un sort de défense universel contre les éléments matériels de Boréalis.',
      'Sceaux 1 - Rassemble la mana vers la main\nSceaux 2 - En position compresser la mana pour amortir le sort',
      'Fail',
      '(Fgt/10)D6 + (MP/4) Vs Energy',
      '(Fgt/10)D6 + ((MP/4)*1.25) Vs Energy',
      '(Fgt/10)D6 + ((MP/4)*1.5) Vs Energy',
      '(Fgt/10)D6 + ((MP/4)*2) Vs Energy',
      '(Fgt/10)D6 + ((MP/4)*3) Vs Energy'
    ]];
    character.data.tables.Spell = rows;
  } else if (name === 'Skills' && isSkillsEmpty(storedRows)) {
    rows = DEFAULT_SKILLS_ROWS.map((row) => [...row]);
    character.data.tables.Skills = rows;
  } else {
    rows = Array.isArray(storedRows)
      ? storedRows
      : storedRows && typeof storedRows === 'object'
        ? Object.keys(storedRows).sort((a, b) => Number(a) - Number(b)).map((key) => storedRows[key])
        : Array.from({ length: name === 'Note du joueur' ? 1 : DEFAULT_TABLE_ROWS }, () => ({}));
  }
  const isActionTypes = name === 'Action Types';
  if (isActionTypes) rows = ACTION_TYPES_ROWS;
  if (!isActionTypes) {
    character.data.tables[name] = rows;
  }
  if (name === 'Specialisations') {
    rows.forEach((row) => {
      row[1] ||= 'Unspecialised';
      row[2] ||= '0';
      row[3] ||= '0';
      row[5] ||= '0';
      if (row[1] === 'Unspecialised') row[4] = [];
    });
    if (!character.data.tables[name]) character.data.tables[name] = rows;
  }
  if (name === 'Armor') {
    rows.forEach((row) => {
      if (row && !row._v2) {
        if (row[5] === undefined && (row[4] === '10' || row[4] === '20' || row[4] === '30' || row[4] === '40' || row[4] === '50' || row[4] === '75' || row[4] === '100' || (row[2] !== undefined && !['10', '20', '30', '40', '50', '75', '100'].includes(row[2]) && row[4] !== undefined))) {
          const oldName = row[0] || '';
          const oldBaseArmor = row[1] || '';
          const oldSlots = row[2] || '';
          const oldRunes = row[3] || '';
          const oldQuality = row[4] || '';
          row[0] = oldName;
          row[1] = oldBaseArmor;
          row[2] = oldQuality;
          row[3] = oldSlots;
          row[4] = Array.isArray(oldRunes) ? oldRunes : (oldRunes ? [oldRunes] : []);
          row[5] = '';
        }
        row._v2 = true;
      }
      if (row[3] === undefined) row[3] = '0';
      if (!Array.isArray(row[4])) {
        row[4] = typeof row[4] === 'string' && row[4] ? [row[4]] : [];
      }
    });
    if (!character.data.tables[name]) character.data.tables[name] = rows;
  }
  if (name === 'Inventory') {
    rows.forEach((row) => {
      if (row && !row._v2) {
        if (row[0] !== undefined || row[1] !== undefined) {
          const oldObject = row[0] || '';
          const oldQte = row[1] || '';
          row[0] = oldQte;
          row[1] = oldObject;
        }
        row._v2 = true;
      }
    });
    if (!character.data.tables[name]) character.data.tables[name] = rows;
  }
  if (name === 'Relations') {
    rows.forEach((row) => {
      if (row && !row._v2) {
        if (row[3] !== undefined || row[4] !== undefined) {
          const oldName = row[0] || '';
          const oldLink = row[1] || '';
          const oldRelType = row[2] || '';
          row[0] = oldName;
          row[1] = '';
          row[2] = '';
          row[3] = '';
          row[4] = oldLink;
          row[5] = oldRelType;
          row[6] = '';
        }
        row._v2 = true;
      }
    });
    if (!character.data.tables[name]) character.data.tables[name] = rows;
  }
  const weaponStatOptions = ['Fighting', 'Strength', 'Agility', 'Endurance', 'Speed', 'Intelligence', 'Wisdom', 'Intuition', 'Psyche'];
  const specialisationLevelOptions = ['Unspecialised', 'Novice', 'Apprentice', 'Adept', 'Expert', 'Master'];
  const armorQualityOptions = ['10', '20', '30', '40', '50', '75', '100'];
  const skillTypeOptions = ['Combat', 'Hors-Combat', 'Passive'];
  const skillStatOptions = ['Fighting', 'Strength', 'Agility', 'Endurance', 'Speed', 'Intelligence', 'Wisdom', 'Intuition', 'Psyche', 'Depend'];
  const actionTypeOptions = ['Normal', 'Free'];
  const storedSpecialisationRows = character.data.tables.Specialisations;
  const specialisationRows = Array.isArray(storedSpecialisationRows)
    ? storedSpecialisationRows
    : storedSpecialisationRows && typeof storedSpecialisationRows === 'object'
      ? Object.keys(storedSpecialisationRows).sort((a, b) => Number(a) - Number(b)).map((key) => storedSpecialisationRows[key])
      : [];
  const specialisationNames = specialisationRows
    .map((row) => Array.isArray(row) ? row[0] : row?.[0] || row?.name || '')
    .map((name) => String(name).trim())
    .filter(Boolean)
    .filter((name, index, names) => names.indexOf(name) === index);
  const displayColumns = name === 'Specialisations' ? [0, 1, 5, 2, 3, 4] : headers.map((_, index) => index);
  const weaponStorageColumns = [0, 12, 9, 1, 11, 2, 3, 4, 5, 6, 10, 8];
  const canDeleteRows = ['Skills', 'Spell', 'Specialisations', 'Weapons', 'Armor', 'Inventory', 'Relations', 'Monture', 'Note du joueur', 'Unique Power'].includes(name);

  const tableClass = name === 'Action Types'
    ? ' sheet-table-action-types'
    : name === 'Skills'
      ? ' sheet-table-skills'
      : name === 'Spell'
        ? ' sheet-table-spell'
        : name === 'Specialisations'
          ? ' sheet-table-specialisations'
          : name === 'Weapons'
            ? ' sheet-table-weapons'
            : name === 'Armor'
              ? ' sheet-table-armor'
              : name === 'Inventory'
                ? ' sheet-table-inventory'
                : name === 'Relations'
                  ? ' sheet-table-relations'
                  : '';
  const savedWidths = getPlayerColumnWidths(name);
  const currentSort = tableSortState[name];
  const headersHtml = displayColumns.map((columnIndex) => {
    const header = headers[columnIndex];
    const savedW = savedWidths[header];
    const widthStyle = savedW ? ` style="width: ${savedW}px; min-width: ${savedW}px;"` : '';
    const isSorted = currentSort && currentSort.colIndex === columnIndex;
    const sortDir = isSorted ? currentSort.direction : null;
    const sortClass = isSorted ? ` sort-active sort-${sortDir}` : '';
    const sortIcon = isSorted
      ? (sortDir === 'asc' ? '<span class="sort-icon sort-asc" title="Sorted ascending">▲</span>' : '<span class="sort-icon sort-desc" title="Sorted descending">▼</span>')
      : '<span class="sort-icon sort-none" title="Click to sort">⇅</span>';
    return `<th${widthStyle} class="sortable-header${sortClass}" data-sort-table="${esc(name)}" data-col-index="${columnIndex}" data-col-name="${esc(header)}" title="Click to sort by ${esc(header)}"><span class="th-content">${esc(header)}${sortIcon}</span><div class="col-resize-handle" data-col-resize="${esc(header)}" data-table-name="${esc(name)}" title="Drag to resize column (Double-click to reset)"></div></th>`;
  }).join('');
  const actionsTh = canDeleteRows ? (() => {
    const savedActionW = savedWidths['Actions'];
    const widthStyle = savedActionW ? ` style="width: ${savedActionW}px; min-width: ${savedActionW}px;"` : '';
    return `<th class="row-actions"${widthStyle} data-col-name="Actions"><span class="th-content">Actions</span><div class="col-resize-handle" data-col-resize="Actions" data-table-name="${esc(name)}" title="Drag to resize column (Double-click to reset)"></div></th>`;
  })() : '';

  return `<section><h2 class="section-title">${esc(name)}</h2><div class="table-wrap"><table class="sheet-table${tableClass}"><thead><tr>${headersHtml}${actionsTh}</tr></thead><tbody>${rows.map((row, rowIndex) => `<tr>${displayColumns.map((columnIndex) => {
    const header = headers[columnIndex];
    const sourceColumnIndex = name === 'Weapons' ? weaponStorageColumns[columnIndex] : columnIndex;
    const specialisationDefault = name === 'Specialisations' && sourceColumnIndex === 1 ? 'Unspecialised' : (name === 'Specialisations' && [2, 3, 5].includes(sourceColumnIndex) ? '0' : '');
    const val = row[sourceColumnIndex] || specialisationDefault;
    const path = `tables.${name}.${rowIndex}.${sourceColumnIndex}`;
    if (name === 'Skills' && header === 'Skill Type') {
      return `<td>${editableSelect(path, val, skillTypeOptions, 'cell-input cell-select')}</td>`;
    }
    if (name === 'Skills' && header === 'Stat') {
      return `<td>${editableSelect(path, val, skillStatOptions, 'cell-input cell-select')}</td>`;
    }
    if (name === 'Skills' && (header === 'CS Level' || header === 'Focus Cost')) {
      return `<td>${editableInteger(path, val)}</td>`;
    }
    if (name === 'Skills' && header === 'Action Type') {
      return `<td>${editableSelect(path, val, actionTypeOptions, 'cell-input cell-select')}</td>`;
    }
    if (name === 'Spell' && (header === 'Scell Value' || header === 'Mana Cost')) {
      return `<td>${editableInteger(path, val)}</td>`;
    }
    if (name === 'Spell' && header === 'Action Type') {
      return `<td>${editableSelect(path, val, actionTypeOptions, 'cell-input cell-select')}</td>`;
    }
    if (name === 'Weapons' && (header === 'Touch Stat' || header === 'Damage Bonus Stat')) {
      return `<td>${editableSelect(path, val, weaponStatOptions, 'cell-input cell-select')}</td>`;
    }
    if (name === 'Weapons' && header === 'Specialisation') {
      return `<td>${editableSelect(path, val, specialisationNames, 'cell-input cell-select')}</td>`;
    }
    if (name === 'Weapons' && header === 'Touch Bonus') {
      return `<td>${editableInteger(path, val)}</td>`;
    }
    if (name === 'Weapons' && header === 'Two handed?') {
      return `<td>${editableCheckbox(path, val)}</td>`;
    }
    if (name === 'Armor' && header === 'Base Armor') {
      return `<td>${editableInteger(path, val)}</td>`;
    }
    if (name === 'Armor' && header === 'Quality') {
      return `<td>${editableSelect(path, val, armorQualityOptions, 'cell-input cell-select')}</td>`;
    }
    if (name === 'Armor' && header === 'Runes Slots') {
      return `<td>${editableInteger(path, val, 'cell-input', 'data-armor-runes-slots="true" min="0"')}</td>`;
    }
    if (name === 'Armor' && header === 'Runes') {
      return `<td>${armorRunesInputs(path, val, row[3], rowIndex)}</td>`;
    }
    if (name === 'Inventory' && header === 'Qte') {
      return `<td>${editableInteger(path, val)}</td>`;
    }
    if (name === 'Relations' && header === 'Age') {
      return `<td>${editableInteger(path, val)}</td>`;
    }
    if (name === 'Specialisations' && header === 'Actual LVL') {
      return `<td>${editableSelect(path, val, specialisationLevelOptions, 'cell-input cell-select', `data-specialisation-level="${esc(path)}"`)}</td>`;
    }
    if (name === 'Specialisations' && header === 'Special Effect') {
      return `<td>${specialisationEffectInputs(path, val, row[1])}</td>`;
    }
    if (name === 'Specialisations' && ['Ini Bonus', 'Touch Bonus', 'Potential Bonus'].includes(header)) {
      return `<td>${readOnlyCell(val)}</td>`;
    }
    if ((name === 'Skills' || name === 'Spell') && ['White', 'Green', 'Yellow', 'Red', 'Natural Red', 'Critical Red'].includes(header)) {
      return `<td>${formulaCellHtml(path, val, character)}</td>`;
    }
    if (isActionTypes) return `<td><span class="cell-readonly action-type-cell">${esc(val)}</span></td>`;
    return `<td>${editable(path, val, 'cell-input')}</td>`;
  }).join('')}${canDeleteRows ? `<td class="row-actions"><button type="button" class="delete-row" data-delete-row="${esc(name)}" data-row-index="${rowIndex}" title="Delete this row">Delete</button></td>` : ''}</tr>`).join('')}</tbody></table></div>${isActionTypes ? '' : `<button class="add-row" data-add-row="${esc(name)}">+ Add row</button>`}</section>`;
}

function pageFor(character) {
  if (activeTab === 'Rolls & Ini') {
    if (user.role === 'GM') return rollsAndIniPage();
    return infoPage(character);
  }
  if (activeTab === 'Infos') return infoPage(character);
  if (activeTab === 'Stats') return statsPage(character);
  if (activeTab === 'Monture') return monturePage(character);
  if (activeTab === 'Unique Power') return uniquePowerPage(character);
  return tablePage(activeTab, character);
}

let currentFontScale = 1.0;

function fontSizeControlHtml() {
  const options = [80, 90, 100, 110, 120, 130, 140, 150, 175, 200];
  const optionList = options.map((opt) => {
    const val = opt / 100;
    const isSel = Math.abs(currentFontScale - val) < 0.03;
    return `<option value="${val.toFixed(2)}" ${isSel ? 'selected' : ''}>${opt}%</option>`;
  }).join('');

  return `<div class="font-scale-control" title="Adjust text / character size">
    <span class="font-scale-label">Text</span>
    <button type="button" class="font-scale-btn" id="font-decrease-btn" title="Decrease character size (A-)">A-</button>
    <select id="font-scale-select" class="font-scale-select" title="Select character size">
      ${optionList}
    </select>
    <button type="button" class="font-scale-btn" id="font-increase-btn" title="Increase character size (A+)">A+</button>
  </div>`;
}

function applyFontScale(scale, persist = true) {
  const clamped = Math.max(0.75, Math.min(2.0, Math.round(scale * 100) / 100));
  currentFontScale = clamped;
  document.documentElement.style.setProperty('--font-scale', clamped.toString());

  const select = app.querySelector('#font-scale-select');
  if (select) {
    const closestOption = Array.from(select.options).find((opt) => Math.abs(parseFloat(opt.value) - clamped) < 0.03);
    if (closestOption) {
      select.value = closestOption.value;
    }
  }

  if (persist) {
    try {
      localStorage.setItem('terranova.fontScale', clamped.toString());
    } catch (e) {}
  }

  autoResizeAllTextareas();
}

function restoreSavedFontScale() {
  try {
    const saved = localStorage.getItem('terranova.fontScale');
    if (saved) {
      const scale = parseFloat(saved);
      if (!isNaN(scale)) {
        applyFontScale(scale, false);
      }
    }
  } catch (e) {}
}

function controls(character) {
  const fontControl = fontSizeControlHtml();

  if (user.role !== 'GM') {
    const myChars = getAssignedCharacters(user.id);
    if (myChars.length > 1) {
      const options = myChars.map(([id, item]) => `<option value="${esc(id)}" ${id === activeCharacterId ? 'selected' : ''}>${esc(item.name || id)}</option>`).join('');
      return `<div class="sheet-controls">
        <label>Character <select id="player-character-select">${options}</select></label>
        <span class="control-note">(${myChars.length} sheets assigned)</span>
        ${fontControl}
      </div>`;
    } else if (myChars.length === 1 || character) {
      return `<div class="sheet-controls">
        <span class="control-note">Assigned sheet: <strong>${esc(character?.name || 'Character')}</strong></span>
        ${fontControl}
      </div>`;
    }
    return `<div class="sheet-controls">
      <span class="control-note">No character sheet assigned by DM</span>
      ${fontControl}
    </div>`;
  }

  const sortedEntries = getSortedDmCharacterEntries();
  const options = sortedEntries.map(([id, item]) => `<option value="${esc(id)}" ${id === activeCharacterId ? 'selected' : ''}>${esc(item.name || id)}</option>`).join('');
  const assignablePlayers = getAssignablePlayers(character);
  const playerOptions = assignablePlayers.map((player) => {
    let roleLabel = player.role || 'PLAYER';
    if (player.id === user.id && user.role === 'GM') {
      roleLabel = 'GM';
    }
    const statusLabel = player.isOnline ? roleLabel : `${roleLabel} - Offline`;
    const isSelected = character?.ownerId === player.id;
    return `<option value="${esc(player.id)}" ${isSelected ? 'selected' : ''}>${esc(player.name)} (${esc(statusLabel)})</option>`;
  }).join('');
  return `<div class="sheet-controls"><label>Character <select id="character-select">${options || '<option>No sheets</option>'}</select></label><button class="toolbar-button" id="new-character">New sheet</button>${character ? `<button class="toolbar-button danger" id="delete-character" title="Delete current character sheet">Delete sheet</button>` : ''}${character ? `<label>Sheet Name <input type="text" id="sheet-name-input" class="sheet-name-input" value="${esc(character.name || '')}" placeholder="Sheet name" /></label>` : ''}<label>Assign to <select id="owner-select"><option value="">Unassigned</option>${playerOptions}</select></label><button class="toolbar-button secondary" id="export-backup-btn" title="Export all character sheets to a JSON file">Export Backup</button><button class="toolbar-button secondary" id="import-backup-btn" title="Import character sheets from a JSON backup">Import Backup</button><input type="file" id="import-backup-input" accept=".json" style="display:none;" />${fontControl}</div>`;
}

function render(focusPath = null, selectAll = false) {
  const activeEl = document.activeElement;
  let targetPath = focusPath;
  let targetId = null;
  let selStart = null;
  let selEnd = null;

  if (!targetPath && activeEl && app.contains(activeEl)) {
    if (activeEl.dataset?.path) {
      targetPath = activeEl.dataset.path;
      selStart = activeEl.selectionStart;
      selEnd = activeEl.selectionEnd;
    } else if (activeEl.id) {
      targetId = activeEl.id;
    }
  }

  const character = currentCharacter();

  if (user.role !== 'GM' && !character) {
    app.innerHTML = `<div class="sheet-app">
    <main class="sheet-frame unassigned-frame">
      <div class="page-resize-handle page-resize-r" data-direction="r" title="Drag right edge to resize width (Double-click to reset to 50% width)"></div>
      <div class="page-resize-handle page-resize-b" data-direction="b" title="Drag bottom edge to resize height (Double-click to reset size)"></div>
      <div class="page-resize-handle page-resize-l" data-direction="l" title="Drag left edge to resize width (Double-click to reset to 50% width)"></div>
      <div class="page-resize-handle page-resize-br" data-direction="br" title="Drag corner to resize page (Double-click to reset to 50% width)"></div>
      <div class="page-resize-handle page-resize-bl" data-direction="bl" title="Drag corner to resize page (Double-click to reset to 50% width)"></div>
      <div class="unassigned-container">
        <div class="unassigned-card">
          <div class="unassigned-logo-wrap">
            <img src="/boreali-fleur-de-lys.svg" alt="Emblème de Boréalis" class="unassigned-logo-img" />
          </div>
          <h2 class="unassigned-realm">Royaume de Boréalis</h2>
          <p class="unassigned-motto">« Honneur · Force · Devoir et discernement »</p>
          <div class="unassigned-divider"></div>
          <div class="unassigned-message">En attente de l'attribution d'un dossier par le Maître de Jeu</div>
        </div>
      </div>
    </main>
  </div>`;
    bindEvents();
    autoResizeAllTextareas(app);
    return;
  }

  app.innerHTML = `<div class="sheet-app">
    <main class="sheet-frame">
      <div class="page-resize-handle page-resize-r" data-direction="r" title="Drag right edge to resize width (Double-click to reset to 50% width)"></div>
      <div class="page-resize-handle page-resize-b" data-direction="b" title="Drag bottom edge to resize height (Double-click to reset size)"></div>
      <div class="page-resize-handle page-resize-l" data-direction="l" title="Drag left edge to resize width (Double-click to reset to 50% width)"></div>
      <div class="page-resize-handle page-resize-br" data-direction="br" title="Drag corner to resize page (Double-click to reset to 50% width)"></div>
      <div class="page-resize-handle page-resize-bl" data-direction="bl" title="Drag corner to resize page (Double-click to reset to 50% width)"></div>
      <header class="sheet-header">
        <div class="sheet-brand">
          <div class="sheet-logo-container" title="Emblème officiel de Boréalis">
            <img src="/boreali-fleur-de-lys.svg" alt="Boréalis Fleur de Lys" class="sheet-logo-img" />
          </div>
          <div class="sheet-brand-titles">
            <div class="sheet-kicker-row">
              <span class="sheet-realm-badge">ROYAUME DE BORÉALIS</span>
              <span class="sheet-kicker-sep">✦</span>
              <span class="sheet-kicker-motto">Honneur · Force · Devoir et discernement</span>
            </div>
            <div class="sheet-character-header-title">
              <h1 class="sheet-title">${esc(activeTab)}</h1>
              ${character?.name ? `<span class="sheet-char-name-badge"><span class="sheet-char-badge-label">Dossier:</span> <strong class="sheet-char-badge-name">${esc(character.name)}</strong></span>` : ''}
            </div>
          </div>
        </div>
        <div class="sheet-meta">
          <div class="sheet-meta-workspace">
            <span class="sheet-workspace-role">${user.role === 'GM' ? 'Commandement MJ' : 'Registre Citoyen'}</span>
            <span class="sheet-workspace-user">${esc(user.name)}</span>
          </div>
          <span class="cloud-status" id="cloud-status"><span class="cloud-status-pulse"></span>Registre synchronisé</span>
        </div>
      </header>
      ${controls(character)}
      <nav class="sheet-tabs" aria-label="Character sheet tabs">
        ${getAvailableTabs().map((tab) => `<button class="sheet-tab${tab === activeTab ? ' active' : ''}" data-tab="${esc(tab)}">${esc(tab)}</button>`).join('')}
      </nav>
      <div class="sheet-body">
        <div class="sheet-status">
          <span>REGISTRE OFFICIEL <strong>${esc(activeTab)}</strong></span>
          <span>${character || activeTab === 'Rolls & Ini' ? '✦ SAUVEGARDE EN TEMPS RÉEL' : 'EN ATTENTE D\'ATTRIBUTION'}</span>
        </div>
        ${(character || activeTab === 'Rolls & Ini') ? pageFor(character) : '<div class="empty-note">The DM has not assigned a character sheet to this player yet.</div>'}
      </div>
    </main>
    ${addXpModalHtml(character)}
  </div>`;
  bindEvents();
  autoResizeAllTextareas(app);

  if (targetPath) {
    const el = app.querySelector(`[data-path="${targetPath.replace(/"/g, '\\"')}"]`);
    if (el) {
      el.focus();
      if (selectAll) {
        el.select?.();
      } else if (typeof selStart === 'number' && typeof selEnd === 'number' && typeof el.setSelectionRange === 'function') {
        try {
          el.setSelectionRange(selStart, selEnd);
        } catch (e) {}
      }
    }
  } else if (targetId) {
    const el = app.querySelector(`#${CSS.escape(targetId)}`);
    if (el) {
      el.focus();
    }
  }
}

function getPath(path) {
  return path.split('.').reduce((value, key) => value?.[key], currentCharacter()?.data);
}

function setPath(path, value) {
  const character = currentCharacter();
  if (!character || !canEditCurrent()) return;
  const parts = path.split('.');
  let target = character.data;
  parts.slice(0, -1).forEach((part, index) => {
    if (target[part] == null || typeof target[part] !== 'object') {
      target[part] = /^\d+$/.test(parts[index + 1]) ? [] : {};
    }
    target = target[part];
  });
  target[parts.at(-1)] = value;
  character.updatedAt = Date.now();
  state.updatedAt = Date.now();
}

const CLOUD_API_BASE = '';
let isCloudAvailable = true;
let lastCloudSyncSuccess = false;
let pendingDeletedCharacterIds = new Set();

function updateCloudStatus(customText = null) {
  const status = document.querySelector('#cloud-status');
  if (!status) return;
  if (customText) {
    status.textContent = customText;
    return;
  }
  if (isCloudAvailable && lastCloudSyncSuccess) {
    status.textContent = 'Cloud Database: Synced';
  } else if (isCloudAvailable) {
    status.textContent = 'Cloud Database ready';
  } else {
    status.textContent = 'Connecting to Cloud Database...';
  }
}

async function fetchCloudState() {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(`${CLOUD_API_BASE}/api/character-sheets?_t=${Date.now()}`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache'
      },
      cache: 'no-store',
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    isCloudAvailable = true;
    lastCloudSyncSuccess = true;
    return data;
  } catch (err) {
    console.warn('[CloudStorage] Could not fetch state from database:', err.message);
    isCloudAvailable = false;
    return null;
  }
}

async function saveCloudState(payload, deletedIds = []) {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    const res = await fetch(`${CLOUD_API_BASE}/api/sync`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache'
      },
      cache: 'no-store',
      body: JSON.stringify({ ...payload, deletedCharacterIds: deletedIds }),
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const result = await res.json();
    isCloudAvailable = true;
    lastCloudSyncSuccess = true;
    return result;
  } catch (err) {
    console.warn('[CloudStorage] Could not save state to database:', err.message);
    isCloudAvailable = false;
    lastCloudSyncSuccess = false;
    return null;
  }
}

async function deleteCloudCharacter(charId) {
  pendingDeletedCharacterIds.add(charId);
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(`${CLOUD_API_BASE}/api/characters/${encodeURIComponent(charId)}`, {
      method: 'DELETE',
      headers: {
        'Accept': 'application/json',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache'
      },
      cache: 'no-store',
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    if (res.ok) {
      pendingDeletedCharacterIds.delete(charId);
    }
  } catch (err) {
    console.warn('[CloudStorage] Could not immediately delete character in database:', err.message);
  }
}

let saveTimeout = null;
let isSaving = false;
let pendingSave = false;
let lastSavedHash = null;

function getSaveHash(data) {
  try {
    return JSON.stringify({
      characters: data?.characters || {},
      assignments: data?.assignments || {},
      rollHistoryCount: (data?.rollHistory || []).length,
      initiativeTracker: data?.initiativeTracker || {},
      knownPlayers: data?.knownPlayers || {}
    });
  } catch (e) {
    return '';
  }
}

function mergeStates(...states) {
  const validStates = states.filter((s) => s && typeof s === 'object');
  if (validStates.length === 0) {
    return {
      characters: {},
      assignments: {},
      rollHistory: [],
      initiativeTracker: {},
      knownPlayers: {},
      updatedAt: Date.now()
    };
  }

  const maxUpdatedAt = Math.max(0, ...validStates.map((s) => s.updatedAt || 0));

  const merged = {
    updatedAt: maxUpdatedAt || Date.now(),
    characters: {},
    assignments: {},
    initiativeTracker: {},
    knownPlayers: {},
    rollHistory: []
  };

  validStates.forEach((s) => {
    Object.assign(merged.assignments, s.assignments || {});
    Object.assign(merged.initiativeTracker, s.initiativeTracker || {});
    Object.assign(merged.knownPlayers, s.knownPlayers || {});
  });

  const allCharIds = new Set();
  validStates.forEach((s) => {
    Object.keys(s.characters || {}).forEach((id) => allCharIds.add(id));
  });

  allCharIds.forEach((id) => {
    if (pendingDeletedCharacterIds.has(id)) {
      return;
    }
    let latestChar = null;
    let latestTime = -1;

    validStates.forEach((s) => {
      const char = s.characters?.[id];
      if (char) {
        const time = char.updatedAt || s.updatedAt || 0;
        if (time >= latestTime) {
          latestTime = time;
          latestChar = char;
        }
      }
    });

    if (latestChar) {
      merged.characters[id] = latestChar;
    }
  });

  const newAssignments = {};
  Object.entries(merged.characters).forEach(([cId, c]) => {
    if (c.ownerId) {
      newAssignments[c.ownerId] ??= [];
      if (!newAssignments[c.ownerId].includes(cId)) {
        newAssignments[c.ownerId].push(cId);
      }
    }
  });
  merged.assignments = newAssignments;

  const historyMap = new Map();
  validStates.forEach((s) => {
    (s.rollHistory || []).forEach((r) => {
      if (r && r.id) historyMap.set(r.id, r);
    });
  });
  merged.rollHistory = Array.from(historyMap.values()).sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0)).slice(0, 200);

  return merged;
}

function queueSave(delay = 400) {
  updateCloudStatus('Saving to database...');

  if (saveTimeout) {
    clearTimeout(saveTimeout);
  }
  saveTimeout = setTimeout(() => {
    saveTimeout = null;
    save().catch((error) => console.error('Failed to save character sheet:', error));
  }, delay);
}

async function save() {
  if (saveTimeout) {
    clearTimeout(saveTimeout);
    saveTimeout = null;
  }

  const currentHash = getSaveHash(state);
  if (currentHash === lastSavedHash && lastSavedHash !== null && !pendingSave && pendingDeletedCharacterIds.size === 0) {
    updateCloudStatus();
    return;
  }

  if (isSaving) {
    pendingSave = true;
    return;
  }

  isSaving = true;
  updateCloudStatus('Saving to database...');
  state.updatedAt = Date.now();
  const payload = { ...state, updatedAt: state.updatedAt };

  // Ensure character sheets are NEVER stored in browser cache / localStorage
  purgeBrowserCharacterCache();

  try {
    // 1. Save to Cloud Database (PostgreSQL / Cloudflare)
    const deletedIds = Array.from(pendingDeletedCharacterIds);
    try {
      const cloudRes = await saveCloudState(payload, deletedIds);
      if (cloudRes && cloudRes.success) {
        deletedIds.forEach((id) => pendingDeletedCharacterIds.delete(id));
      }
    } catch (err) {
      console.warn('Failed to save to cloud database:', err);
    }

    // 2. Broadcast real-time update in memory to other room peers via OBR broadcast
    if (OBR.isAvailable) {
      try {
        if (OBR.broadcast?.sendMessage) {
          const char = currentCharacter();
          if (char && activeCharacterId) {
            OBR.broadcast.sendMessage('terranova/character-update', {
              characterId: activeCharacterId,
              character: char,
              updatedAt: char.updatedAt || state.updatedAt,
              senderId: user.id
            }, { destination: 'REMOTE' });
          }
        }
      } catch (e) {}
    }

    lastSavedHash = currentHash;
  } finally {
    isSaving = false;
    if (pendingSave) {
      pendingSave = false;
      setTimeout(() => save(), 250);
    }
  }

  updateCloudStatus();
}

async function load() {
  updateCloudStatus('Loading from database...');

  // Ensure character sheets are NEVER stored in browser cache / localStorage
  purgeBrowserCharacterCache();

  // Fetch state directly from Cloud Database
  let cloudState = null;
  try {
    cloudState = await fetchCloudState();
  } catch (e) {
    console.warn('Failed to load database state:', e);
  }

  state = cloudState || {
    characters: {},
    assignments: {},
    rollHistory: [],
    initiativeTracker: {},
    knownPlayers: {},
    updatedAt: Date.now()
  };
  state.characters ??= {};
  state.assignments ??= {};
  state.rollHistory ??= [];
  state.initiativeTracker ??= {};
  state.knownPlayers ??= {};

  updateKnownPlayers(players);

  Object.values(state.characters).forEach((char) => {
    if (char) {
      if (char.ownerId && !char.ownerName) {
        const foundPlayer = state.knownPlayers?.[char.ownerId] || (players || []).find((p) => p.id === char.ownerId) || (char.ownerId === user.id ? user : null);
        if (foundPlayer?.name) {
          char.ownerName = foundPlayer.name;
        }
      }
      if (char.ownerId && char.ownerName) {
        registerKnownPlayer(char.ownerId, char.ownerName, char.ownerId === user.id ? user.role : 'PLAYER');
      }
      if (char.data) {
        char.data.tables ??= {};
        if (isSkillsEmpty(char.data.tables.Skills)) {
          char.data.tables.Skills = DEFAULT_SKILLS_ROWS.map((row) => [...row]);
        }
        Object.keys(char.data.tables).forEach((tName) => {
          const tVal = char.data.tables[tName];
          if (tVal && typeof tVal === 'object' && !Array.isArray(tVal)) {
            char.data.tables[tName] = Object.keys(tVal).sort((a, b) => Number(a) - Number(b)).map((k) => tVal[k]);
          }
        });
      }
    }
  });

  try {
    if (!OBR.isAvailable) {
      const savedUser = JSON.parse(localStorage.getItem('terranova.currentUser') || 'null');
      if (savedUser && savedUser.id) {
        user.id = savedUser.id;
        user.name = savedUser.name || user.name;
        user.role = savedUser.role || user.role;
      }
      const savedPlayers = JSON.parse(localStorage.getItem('terranova.players') || 'null');
      if (Array.isArray(savedPlayers) && savedPlayers.length) {
        players = savedPlayers;
      }
    }

    const savedCharId = localStorage.getItem('terranova.activeCharId');
    if (savedCharId && state.characters[savedCharId]) {
      if (user.role === 'GM') {
        activeCharacterId = savedCharId;
      } else {
        const myChars = getAssignedCharacters(user.id);
        if (myChars.some(([id]) => id === savedCharId)) {
          activeCharacterId = savedCharId;
        }
      }
    }

    const savedTab = localStorage.getItem('terranova.activeTab');
    if (savedTab && getAvailableTabs().includes(savedTab)) {
      activeTab = savedTab;
    } else {
      activeTab = 'Infos';
    }
  } catch (e) {}

  lastSavedHash = getSaveHash(state);

  if (OBR.isAvailable && user.role === 'GM' && !Object.keys(state.characters).length) {
    activeCharacterId = crypto.randomUUID();
    state.characters[activeCharacterId] = blankCharacter('Character 1');
    await save();
  }

  if (user.role === 'GM') {
    if (!activeCharacterId || !state.characters[activeCharacterId]) {
      const sorted = getSortedDmCharacterEntries();
      activeCharacterId = sorted[0]?.[0] || Object.keys(state.characters)[0] || null;
    }
  } else {
    const myChars = getAssignedCharacters(user.id);
    if (!activeCharacterId || !myChars.some(([id]) => id === activeCharacterId)) {
      activeCharacterId = myChars[0]?.[0] || null;
    }
    if (activeTab === 'Rolls & Ini' || !getAvailableTabs().includes(activeTab)) {
      activeTab = 'Infos';
    }
  }

  updateCloudStatus();

  // Ensure character sheets are NEVER stored in browser cache / localStorage
  purgeBrowserCharacterCache();
}

let lastObrSyncTime = 0;
let obrSyncTimeout = null;
let isObrResizing = false;
let pendingObrSize = null;
let isObrReady = false;

function isPopoutMode() {
  try {
    return window.self === window.top || Boolean(window.opener);
  } catch (e) {
    return false;
  }
}

async function doSyncObrSize(w, h) {
  if (!OBR.isAvailable) return;
  if (isObrResizing) {
    pendingObrSize = { w, h };
    return;
  }
  isObrResizing = true;
  try {
    const promises = [];
    if (OBR.action?.setWidth) promises.push(OBR.action.setWidth(w));
    if (OBR.action?.setHeight) promises.push(OBR.action.setHeight(h));
    if (OBR.popover?.setWidth) {
      try {
        promises.push(OBR.popover.setWidth(w));
      } catch (e) {}
    }
    if (OBR.popover?.setHeight) {
      try {
        promises.push(OBR.popover.setHeight(h));
      } catch (e) {}
    }
    await Promise.all(promises);
  } catch (e) {
  } finally {
    isObrResizing = false;
    lastObrSyncTime = Date.now();
    if (pendingObrSize) {
      const next = pendingObrSize;
      pendingObrSize = null;
      setTimeout(() => {
        doSyncObrSize(next.w, next.h);
      }, 50);
    }
  }
}

function scheduleSyncObrSize(w, h, immediate = false) {
  if (!OBR.isAvailable) return;

  if (immediate) {
    if (obrSyncTimeout) {
      clearTimeout(obrSyncTimeout);
      obrSyncTimeout = null;
    }
    doSyncObrSize(w, h);
    return;
  }

  const now = Date.now();
  const timeSinceLast = now - lastObrSyncTime;
  const THROTTLE_MS = 150;

  if (timeSinceLast >= THROTTLE_MS && !isObrResizing) {
    if (obrSyncTimeout) {
      clearTimeout(obrSyncTimeout);
      obrSyncTimeout = null;
    }
    doSyncObrSize(w, h);
  } else {
    if (!obrSyncTimeout) {
      const delay = Math.max(30, THROTTLE_MS - timeSinceLast);
      obrSyncTimeout = setTimeout(() => {
        obrSyncTimeout = null;
        doSyncObrSize(w, h);
      }, delay);
    } else {
      pendingObrSize = { w, h };
    }
  }
}

function applyPageSize(w, h, persist = true, immediate = false) {
  if (isPopoutMode()) {
    document.documentElement.style.setProperty('--sheet-width', '100%');
    document.documentElement.style.setProperty('--sheet-height', '100%');
    return;
  }

  const clampedW = Math.max(480, Math.min(2560, Math.round(w)));
  const clampedH = Math.max(400, Math.min(2000, Math.round(h)));

  document.documentElement.style.setProperty('--sheet-width', `${clampedW}px`);
  document.documentElement.style.setProperty('--sheet-height', `${clampedH}px`);

  scheduleSyncObrSize(clampedW, clampedH, immediate || persist);

  if (persist) {
    try {
      localStorage.setItem('terranova.windowDimensions', JSON.stringify({ width: clampedW, height: clampedH }));
    } catch (e) {}
  }
}

async function getDefaultWindowDimensions() {
  let screenWidth = 1920;
  let screenHeight = 1080;

  if (typeof window !== 'undefined') {
    screenWidth = window.screen?.availWidth || window.screen?.width || window.outerWidth || 1920;
    screenHeight = window.screen?.availHeight || window.screen?.height || window.outerHeight || 1080;
  }

  let windowWidth = screenWidth;
  let windowHeight = screenHeight;

  if (isPopoutMode()) {
    windowWidth = window.innerWidth || screenWidth;
    windowHeight = window.innerHeight || screenHeight;
    return {
      width: Math.max(480, Math.min(2560, windowWidth)),
      height: Math.max(400, Math.min(2000, windowHeight)),
    };
  }

  if (OBR.isAvailable && isObrReady && OBR.viewport?.getWidth) {
    try {
      const vWidth = await OBR.viewport.getWidth();
      if (typeof vWidth === 'number' && vWidth > 0) {
        windowWidth = vWidth;
      }
    } catch (e) {
      console.warn('Failed to get OBR viewport width:', e);
    }
  }

  if (OBR.isAvailable && isObrReady && OBR.viewport?.getHeight) {
    try {
      const vHeight = await OBR.viewport.getHeight();
      if (typeof vHeight === 'number' && vHeight > 0) {
        windowHeight = vHeight;
      }
    } catch (e) {
      console.warn('Failed to get OBR viewport height:', e);
    }
  }

  // Default width is 50% of the window/viewport size
  const defaultWidth = Math.round(windowWidth * 0.5);
  const defaultHeight = Math.round(windowHeight * 0.88);

  return {
    width: Math.max(480, Math.min(2560, defaultWidth)),
    height: Math.max(400, Math.min(2000, defaultHeight)),
  };
}

async function restoreSavedWindowSize() {
  if (isPopoutMode()) {
    document.documentElement.style.setProperty('--sheet-width', '100%');
    document.documentElement.style.setProperty('--sheet-height', '100%');
    return;
  }

  try {
    const saved = JSON.parse(localStorage.getItem('terranova.windowDimensions') || 'null');
    if (saved?.width && saved?.height) {
      applyPageSize(saved.width, saved.height, false, true);
      return;
    }
  } catch (e) {}

  const defaults = await getDefaultWindowDimensions();
  applyPageSize(defaults.width, defaults.height, false, true);
}

// Initial quick sizing right away before full async OBR ready
if (typeof window !== 'undefined') {
  try {
    if (isPopoutMode()) {
      document.documentElement.style.setProperty('--sheet-width', '100%');
      document.documentElement.style.setProperty('--sheet-height', '100%');
    } else {
      const saved = JSON.parse(localStorage.getItem('terranova.windowDimensions') || 'null');
      if (saved?.width && saved?.height) {
        document.documentElement.style.setProperty('--sheet-width', `${saved.width}px`);
        document.documentElement.style.setProperty('--sheet-height', `${saved.height}px`);
      } else {
        const screenW = window.screen?.availWidth || window.screen?.width || 1920;
        const initialW = Math.max(480, Math.min(2560, Math.round(screenW * 0.5)));
        document.documentElement.style.setProperty('--sheet-width', `${initialW}px`);
      }
    }
  } catch (e) {}

  window.addEventListener('resize', () => {
    if (isPopoutMode()) {
      document.documentElement.style.setProperty('--sheet-width', '100%');
      document.documentElement.style.setProperty('--sheet-height', '100%');
    }
    autoResizeAllTextareas();
  });
}

async function initialise() {
  // Apply size as soon as script runs
  await restoreSavedWindowSize();

  if (OBR.isAvailable) {
    await new Promise((resolve) => OBR.onReady(resolve));
    isObrReady = true;
    user.id = await OBR.player.getId();
    const currentName = await OBR.player.getName();
    const currentRole = await OBR.player.getRole();
    user.name = currentName || user.name;
    user.role = currentRole || user.role;
    try {
      players = (await OBR.party.getPlayers()) || [];
    } catch (e) {
      console.warn('Failed to get players:', e);
    }

    // Sync size immediately upon OBR ready and again with small delays to ensure popout/popover window catches it
    await restoreSavedWindowSize();
    setTimeout(() => { restoreSavedWindowSize(); }, 50);
    setTimeout(() => { restoreSavedWindowSize(); }, 200);

    if (OBR.action?.onOpenChange) {
      OBR.action.onOpenChange(async (isOpen) => {
        if (isOpen) {
          await restoreSavedWindowSize();
          setTimeout(() => { restoreSavedWindowSize(); }, 50);
        }
      });
    }

    OBR.player.onChange((player) => {
      if (player) {
        if (player.id) user.id = player.id;
        updateUserRole(player.role, player.name);
        registerKnownPlayer(user.id, user.name, user.role);
        let charsUpdated = false;
        Object.values(state.characters || {}).forEach((c) => {
          if (c.ownerId === user.id && c.ownerName !== user.name) {
            c.ownerName = user.name;
            c.updatedAt = Date.now();
            charsUpdated = true;
          }
        });
        if (charsUpdated && user.role === 'GM') {
          queueSave(500);
        }
        render();
      }
    });

    OBR.party.onChange((nextPlayers) => {
      players = nextPlayers || [];
      updateKnownPlayers(players);
      let charsUpdated = false;
      Object.values(state.characters || {}).forEach((c) => {
        if (c.ownerId) {
          const matching = players.find((p) => p.id === c.ownerId);
          if (matching && matching.name && c.ownerName !== matching.name) {
            c.ownerName = matching.name;
            c.updatedAt = Date.now();
            charsUpdated = true;
          }
        }
      });
      const me = players.find((p) => p.id === user.id);
      if (me) {
        updateUserRole(me.role, me.name);
      }
      try {
        localStorage.setItem('terranova.players', JSON.stringify(players));
      } catch (e) {}
      if (charsUpdated && user.role === 'GM') {
        queueSave(500);
      }
      render();
    });

    OBR.broadcast.onMessage('terranova/character-update', (event) => {
      const data = event.data;
      if (!data) return;
      if (data.senderId && data.senderId === user.id) {
        return;
      }
      if (data.characterId && data.character) {
        const existing = state.characters[data.characterId];
        const existingTime = existing?.updatedAt || 0;
        const incomingTime = data.updatedAt || data.character.updatedAt || 0;
        if (!existing || incomingTime > existingTime) {
          state.characters[data.characterId] = data.character;
          state.updatedAt = Math.max(state.updatedAt || 0, incomingTime || Date.now());
          // Never store character sheets in browser storage
          purgeBrowserCharacterCache();
          if (user.role === 'GM') {
            queueSave(500);
          }
          render();
        }
      }
    });

    OBR.broadcast.onMessage('terranova/stat-roll-start', (event) => {
      const rollInfo = event.data;
      if (rollInfo && rollInfo.rollId) {
        pendingStatRolls.set(rollInfo.rollId, rollInfo);
      }
    });

    OBR.broadcast.onMessage('dice-plus/roll-result', (event) => {
      const data = event.data;
      if (!data || !data.result) return;
      const rollId = data.rollId;

      const resultObj = data.result;
      const rawDie = resultObj.groups?.[0]?.dice?.[0]?.value ?? resultObj.groups?.[0]?.total;
      const totalVal = resultObj.totalValue ?? resultObj.total;

      let rollInfo = pendingStatRolls.get(rollId);
      if (!rollInfo) {
        for (const [pId, pInfo] of pendingStatRolls.entries()) {
          if (pInfo.playerId === data.playerId && Date.now() - pInfo.timestamp < 45000) {
            rollInfo = pInfo;
            pendingStatRolls.delete(pId);
            break;
          }
        }
      } else {
        pendingStatRolls.delete(rollId);
      }

      if (rollInfo) {
        const isMyRoll = rollInfo.playerId === user.id;
        if (rollInfo.type === 'damage') {
          const finalRoll = typeof totalVal === 'number' ? totalVal : (typeof rawDie === 'number' ? rawDie : 1);
          const diceList = resultObj.groups?.flatMap((g) => g.dice?.map((d) => d.value) || []) || [];
          displayAndAnnounceDamageResult(
            rollInfo.weaponName || rollInfo.label,
            rollInfo.modLabel || '',
            rollInfo.diceStr || (rollInfo.count && rollInfo.sides ? `${rollInfo.count}D${rollInfo.sides}` : '1D10'),
            rollInfo.sides || 10,
            diceList,
            rollInfo.flatBonus || 0,
            finalRoll,
            rollInfo.charName,
            data.playerName || rollInfo.playerName,
            isMyRoll,
            rollInfo.rollId
          );
        } else if (rollInfo.type === 'initiative') {
          const bonus = parseInt(rollInfo.bonus) || 0;
          let d12 = typeof rawDie === 'number' ? rawDie : (typeof totalVal === 'number' ? totalVal - bonus : 0);
          let finalTotal = typeof totalVal === 'number' ? totalVal : (d12 + bonus);

          // If totalVal was missing the modifier addition or only had raw die
          if (finalTotal === d12 && bonus !== 0) {
            finalTotal = d12 + bonus;
          }

          displayAndAnnounceInitiativeResult(
            rollInfo.label,
            bonus,
            d12,
            finalTotal,
            rollInfo.charName,
            data.playerName || rollInfo.playerName,
            isMyRoll,
            rollInfo.characterId
          );
        } else {
          const finalRoll = typeof rawDie === 'number' ? rawDie : (typeof totalVal === 'number' ? totalVal : 1);
          displayAndAnnounceRollResult(
            rollInfo.statName,
            rollInfo.statValue,
            finalRoll,
            rollInfo.charName,
            data.playerName || rollInfo.playerName,
            isMyRoll,
            rollInfo.rollId,
            rollInfo.targetTier || 'standard',
            rollInfo.columnShift || 0
          );
        }
      } else {
        const isD100 = data.diceNotation?.toLowerCase().includes('d100') || data.diceCounts?.d100 > 0;
        const isD12 = data.diceNotation?.toLowerCase().includes('d12') || data.diceCounts?.d12 > 0;
        const finalRoll = typeof rawDie === 'number' ? rawDie : (typeof totalVal === 'number' ? totalVal : null);
        if (isD100) {
          if (finalRoll === 1) {
            playCritSound('crit-fail', data.rollId || Date.now());
          } else if (finalRoll === 100) {
            playCritSound('crit-success', data.rollId || Date.now());
          }
        }

        if (finalRoll !== null) {
          addRollToHistory({
            id: data.rollId || `tray_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
            timestamp: data.timestamp || Date.now(),
            type: isD100 ? 'd100' : (isD12 ? 'd12' : 'dice-tray'),
            charName: data.playerName || 'Player',
            playerName: data.playerName || 'Player',
            statName: `Dice Roll (${data.diceNotation || 'Dice Tray'})`,
            detail: `Result: ${finalRoll} (Notation: ${data.diceNotation || 'Tray'})`,
            roll: finalRoll,
            outcomeType: finalRoll === 1 && isD100 ? 'crit-fail' : (finalRoll === 100 && isD100 ? 'crit-success' : 'tray'),
            outcomeLabel: finalRoll === 1 && isD100 ? 'Critical Failure' : (finalRoll === 100 && isD100 ? 'Critical Success' : `Total: ${finalRoll}`),
            colorTone: finalRoll === 1 && isD100 ? 'crit' : (finalRoll === 100 && isD100 ? 'crit' : 'white')
          });
          render();
        }
      }
    });

    OBR.broadcast.onMessage('terranova/stat-roll-result', (event) => {
      const data = event.data;
      if (data && (typeof data.roll === 'number' || typeof data.total === 'number')) {
        const outcome = data.outcomeType || (data.roll === 1 ? 'crit-fail' : (data.roll === 100 ? 'crit-success' : null));
        if (outcome) {
          playCritSound(outcome, data.rollId || data.timestamp);
        }

        if (data.type === 'initiative') {
          addRollToHistory({
            id: data.rollId || `ini_${data.timestamp}_${data.charName}`,
            timestamp: data.timestamp || Date.now(),
            type: 'initiative',
            charName: data.charName || 'Character',
            playerName: data.playerName || 'Player',
            statName: `Initiative (${data.label || 'Standard'})`,
            detail: `1D12 (${data.d12}) ${data.bonus >= 0 ? `+ ${data.bonus}` : `- ${Math.abs(data.bonus)}`} = ${data.total}`,
            roll: data.total,
            outcomeType: 'initiative',
            outcomeLabel: `Initiative: ${data.total}`,
            colorTone: 'green'
          });
          recordInitiative(data.characterId, data.charName, data.playerName, null, data.label, data.bonus, data.d12, data.total);
        } else if (data.statName) {
          const shiftSuffix = (typeof data.columnShift === 'number' && data.columnShift !== 0) ? ` [CS: ${data.columnShift > 0 ? '+' + data.columnShift : data.columnShift}]` : '';
          const targetSuffix = data.targetTier && data.targetTier !== 'standard' ? ` [Target: ${data.targetTier.toUpperCase()}${data.karmaCost > 0 ? ', Karma: ' + data.karmaCost : ''}]` : '';
          addRollToHistory({
            id: data.rollId || `stat_${data.timestamp}_${data.charName}`,
            timestamp: data.timestamp || Date.now(),
            type: 'stat',
            charName: data.charName || 'Character',
            playerName: data.playerName || 'Player',
            statName: data.targetTier && data.targetTier !== 'standard' ? `${data.statName} (${data.targetTier.toUpperCase()})` : data.statName,
            statValue: data.statValue,
            rankName: data.rankName,
            detail: `D100 = ${data.roll} (${data.statValue} ➔ ${data.rankName})${shiftSuffix}${targetSuffix}`,
            roll: data.roll,
            outcomeType: data.outcomeType,
            outcomeLabel: data.outcomeLabel,
            colorTone: data.colorTone
          });
        }

        render();
      }
    });
  }
  await load();
  await restoreSavedWindowSize();
  restoreSavedFontScale();
  render();
}

function bindEvents() {
  app.querySelectorAll('[data-tab]').forEach((button) => button.addEventListener('click', () => {
    const tabName = button.dataset.tab;
    if (getAvailableTabs().includes(tabName)) {
      activeTab = tabName;
      try {
        localStorage.setItem('terranova.activeTab', activeTab);
      } catch (e) {}
      render();
    }
  }));
  app.querySelectorAll('textarea').forEach((textarea) => {
    autoResizeTextarea(textarea);
    textarea.addEventListener('input', () => {
      autoResizeTextarea(textarea);
    });
  });
  app.querySelector('#dismiss-roll-result')?.addEventListener('click', () => {
    activeRollResult = null;
    render();
  });
  app.querySelectorAll('[data-roll-initiative]').forEach((cell) => {
    cell.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const label = cell.dataset.rollInitiative;
      const bonus = cell.dataset.bonus ?? 0;
      if (label) {
        rollInitiative(label, bonus);
      }
    });
  });
  app.querySelectorAll('[data-roll-stat]').forEach((cell) => {
    cell.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const stat = cell.dataset.rollStat;
      if (stat) {
        rollDicePlus(stat);
      }
    });
  });
  app.querySelectorAll('[data-qa-universal-roll]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const name = btn.dataset.qaUniversalRoll;
      const statVal = parseFloat(btn.dataset.statVal) || 0;
      const targetTier = btn.dataset.targetTier || 'standard';
      const csLevel = parseInt(btn.dataset.csLevel) || 0;
      if (name) {
        rollUniversalCheck(name, statVal, targetTier, csLevel);
      }
    });
  });
  app.querySelectorAll('.rollable-qa-dmg').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const weaponName = btn.dataset.weaponName || 'Weapon';
      const dice = btn.dataset.dice || '1D10';
      const baseBonus = parseInt(btn.dataset.baseBonus) || 0;
      const modLabel = btn.dataset.modLabel || '';
      const modBonus = parseInt(btn.dataset.modBonus) || 0;
      rollWeaponDamage(weaponName, dice, baseBonus, modLabel, modBonus);
    });
  });
  app.querySelectorAll('.qa-weapon-select').forEach((select) => {
    select.addEventListener('change', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      const slot = parseInt(select.dataset.qaSlot) || 0;
      const val = parseInt(select.value);
      const character = currentCharacter();
      if (character) {
        character.data.quickAccessWeaponSlot = val;
        character.data.quickAccessWeaponSlots = [val];
        await save();
        render();
      }
    });
  });
  app.querySelectorAll('.qa-skill-select').forEach((select) => {
    select.addEventListener('change', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      const val = parseInt(select.value);
      const character = currentCharacter();
      if (character) {
        character.data.quickAccessSkillSlot = val;
        await save();
        render();
      }
    });
  });
  app.querySelectorAll('.qa-spell-select').forEach((select) => {
    select.addEventListener('change', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      const val = parseInt(select.value);
      const character = currentCharacter();
      if (character) {
        character.data.quickAccessSpellSlot = val;
        await save();
        render();
      }
    });
  });
  app.querySelectorAll('.rollable-qa-effect').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const actionName = btn.dataset.qaEffectName || 'Action';
      const tierLabel = btn.dataset.qaTierLabel || 'Effect';
      const expr = btn.dataset.qaEffectExpr || '';
      if (expr && expr !== '—') {
        rollFormulaEffect(actionName, tierLabel, expr);
      }
    });
  });
  app.querySelector('#font-decrease-btn')?.addEventListener('click', () => {
    applyFontScale(currentFontScale - 0.1, true);
  });
  app.querySelector('#font-increase-btn')?.addEventListener('click', () => {
    applyFontScale(currentFontScale + 0.1, true);
  });
  app.querySelector('#font-scale-select')?.addEventListener('change', (e) => {
    const val = parseFloat(e.target.value);
    if (!isNaN(val)) {
      applyFontScale(val, true);
    }
  });
  app.querySelectorAll('[data-path]').forEach((input) => {
    const handleUpdate = () => {
      if (input.dataset.integer) {
        input.value = input.value.match(/^-?\d*/)?.[0] || '';
      }
      setPath(input.dataset.path, input.dataset.checkbox ? input.checked : input.value);
      if (activeTab === 'Stats') {
        updateStatsCalculations();
      }
      const formulaCell = input.closest('.formula-cell');
      if (formulaCell) {
        const resultTextEl = formulaCell.querySelector('.formula-result-text');
        if (resultTextEl) {
          const statsMap = getCharacterStatsMap(currentCharacter());
          const val = input.value;
          const hasVal = Boolean(val && val.trim());
          const translated = translateFormula(val, statsMap);
          resultTextEl.textContent = hasVal ? (translated || val) : '—';
          if (hasVal) {
            resultTextEl.classList.remove('formula-result-empty');
          } else {
            resultTextEl.classList.add('formula-result-empty');
          }
        }
      }
      queueSave(300);
    };
    input.addEventListener('input', handleUpdate);
    input.addEventListener('change', async () => {
      handleUpdate();
      if (input.dataset.specialisationLevel) {
        const pathParts = input.dataset.specialisationLevel.split('.');
        const row = getPath(pathParts.slice(0, -1).join('.'));
        if (row) {
          applySpecialisationLevel(row, input.value);
          await save();
          render();
        }
        return;
      }
      if (input.classList.contains('power-roll-select')) {
        await save();
        render();
        return;
      }
      queueSave(200);
    });
    input.addEventListener('blur', () => queueSave());
    input.addEventListener('keydown', async (event) => {
      if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        setPath(input.dataset.path, input.value);
        if (activeTab === 'Stats') {
          updateStatsCalculations();
        }
        queueSave(200);

        const allInputs = Array.from(app.querySelectorAll('.sheet-body [data-path]'));
        const currentIndex = allInputs.indexOf(input);

        if (currentIndex !== -1 && currentIndex + 1 < allInputs.length) {
          const next = allInputs[currentIndex + 1];
          next.focus();
          next.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
          next.select?.();
        } else if (activeTab === 'Unique Power') {
          const character = currentCharacter();
          if (character && canEditCurrent()) {
            const themes = getPowerThemes(character);
            const pathParts = input.dataset.path?.split('.') || [];
            const themeIdx = parseInt(pathParts[1]) || 0;
            if (themes[themeIdx]) {
              themes[themeIdx].powers ??= [];
              const newPIdx = themes[themeIdx].powers.length;
              themes[themeIdx].powers.push({ name: '', description: '', roll: 'No Roll', cost: '', charges: '' });
              await save();
              const targetPath = `powerThemes.${themeIdx}.powers.${newPIdx}.name`;
              render(targetPath, true);
            }
          }
        } else if (tables[activeTab]) {
          const character = currentCharacter();
          if (character && canEditCurrent()) {
            character.data.tables ??= {};
            if (!character.data.tables[activeTab] || !Array.isArray(character.data.tables[activeTab])) {
              const stored = character.data.tables[activeTab];
              character.data.tables[activeTab] = Array.isArray(stored)
                ? stored
                : stored && typeof stored === 'object'
                  ? Object.keys(stored).sort((a, b) => Number(a) - Number(b)).map((k) => stored[k])
                  : Array.from({ length: activeTab === 'Note du joueur' ? 1 : DEFAULT_TABLE_ROWS }, () => ({}));
            }
            const newRowIndex = character.data.tables[activeTab].length;
            character.data.tables[activeTab].push({});
            await save();
            const targetPath = `tables.${activeTab}.${newRowIndex}.0`;
            render(targetPath, true);
          }
        }
      }
    });
  });
  app.querySelectorAll('[data-special-effect-path]').forEach((input) => {
    const updateEffect = () => {
      const rowPath = input.dataset.specialEffectPath.split('.').slice(0, -1).join('.');
      const row = getPath(rowPath);
      if (!row) return;
      if (!Array.isArray(row[4])) row[4] = [row[4] || ''];
      row[4][Number(input.dataset.specialEffectIndex)] = input.value;
      const character = currentCharacter();
      if (character) character.updatedAt = Date.now();
      state.updatedAt = Date.now();
      queueSave();
    };
    input.addEventListener('input', updateEffect);
    input.addEventListener('blur', updateEffect);
  });
  bindArmorRuneInputs(app);
  app.querySelectorAll('[data-armor-runes-slots]').forEach((input) => {
    const handleSlotsChange = () => {
      const pathParts = input.dataset.path.split('.');
      const rowIndex = pathParts[2];
      const rowPath = pathParts.slice(0, -1).join('.');
      const row = getPath(rowPath);
      if (!row) return;
      const slotsCount = Math.max(0, parseInt(input.value) || 0);
      row[3] = String(slotsCount);
      if (!Array.isArray(row[4])) {
        row[4] = typeof row[4] === 'string' && row[4] ? [row[4]] : [];
      }
      const character = currentCharacter();
      if (character) character.updatedAt = Date.now();
      state.updatedAt = Date.now();
      const container = app.querySelector(`[data-armor-runes-container="${rowIndex}"]`);
      if (container) {
        const runePath = `tables.Armor.${rowIndex}.4`;
        container.outerHTML = armorRunesInputs(runePath, row[4], slotsCount, rowIndex);
        const newContainer = app.querySelector(`[data-armor-runes-container="${rowIndex}"]`);
        if (newContainer) {
          bindArmorRuneInputs(newContainer);
        }
      }
      queueSave(200);
    };
    input.addEventListener('input', handleSlotsChange);
    input.addEventListener('change', handleSlotsChange);
  });
  const nameInput = app.querySelector('#sheet-name-input');
  if (nameInput) {
    nameInput.addEventListener('input', (event) => {
      const character = currentCharacter();
      if (character) {
        character.name = event.target.value;
        character.updatedAt = Date.now();
        state.updatedAt = Date.now();
        const select = app.querySelector('#character-select');
        const activeOption = select?.querySelector(`option[value="${activeCharacterId}"]`);
        if (activeOption) {
          activeOption.textContent = character.name || 'Unnamed Character';
        }
      }
    });
    nameInput.addEventListener('blur', async () => {
      const character = currentCharacter();
      if (character) {
        character.name = nameInput.value.trim() || 'Unnamed Character';
        character.updatedAt = Date.now();
        state.updatedAt = Date.now();
        await save();
        render();
      }
    });
    nameInput.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        nameInput.blur();
      }
    });
  }
  app.querySelector('#character-select')?.addEventListener('change', (event) => {
    if (user.role !== 'GM') return;
    activeCharacterId = event.target.value;
    try {
      localStorage.setItem('terranova.activeCharId', activeCharacterId);
    } catch (e) {}
    render();
  });
  app.querySelector('#player-character-select')?.addEventListener('change', (event) => {
    const val = event.target.value;
    const myChars = getAssignedCharacters(user.id);
    if (myChars.some(([id]) => id === val)) {
      activeCharacterId = val;
      try {
        localStorage.setItem('terranova.activeCharId', activeCharacterId);
      } catch (e) {}
      render();
    }
  });
  app.querySelector('#new-character')?.addEventListener('click', async () => {
    if (user.role !== 'GM') return;
    activeCharacterId = crypto.randomUUID();
    state.characters[activeCharacterId] = blankCharacter(`Character ${Object.keys(state.characters).length + 1}`);
    state.updatedAt = Date.now();
    render();
    await save();
  });
  app.querySelector('#delete-character')?.addEventListener('click', async () => {
    if (user.role !== 'GM') return;
    const character = currentCharacter();
    if (!character || !activeCharacterId) return;

    const charName = character.name || 'this character sheet';
    const confirmed = window.confirm(`Are you sure you want to delete "${charName}"? This action will permanently remove it from Render cloud storage.`);
    if (!confirmed) return;

    const deletedId = activeCharacterId;
    delete state.characters[deletedId];
    state.updatedAt = Date.now();

    const newAssignments = {};
    Object.entries(state.characters).forEach(([cId, c]) => {
      if (c.ownerId) {
        newAssignments[c.ownerId] ??= [];
        if (!newAssignments[c.ownerId].includes(cId)) {
          newAssignments[c.ownerId].push(cId);
        }
      }
    });
    state.assignments = newAssignments;

    const remaining = getSortedDmCharacterEntries();
    if (remaining.length === 0) {
      activeCharacterId = crypto.randomUUID();
      state.characters[activeCharacterId] = blankCharacter('Character 1');
    } else {
      activeCharacterId = remaining[0][0];
    }

    await deleteCloudCharacter(deletedId);
    await save();
    render();
  });

  app.querySelector('#export-backup-btn')?.addEventListener('click', () => {
    try {
      const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(state, null, 2));
      const dateStr = new Date().toISOString().slice(0, 10);
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute('href', dataStr);
      downloadAnchor.setAttribute('download', `terranova-characters-backup-${dateStr}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
    } catch (err) {
      window.open(`${CLOUD_API_BASE}/api/export`, '_blank');
    }
  });

  const importInput = app.querySelector('#import-backup-input');
  app.querySelector('#import-backup-btn')?.addEventListener('click', () => {
    importInput?.click();
  });

  if (importInput) {
    importInput.addEventListener('change', (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          const parsed = JSON.parse(event.target.result);
          if (parsed && typeof parsed === 'object' && parsed.characters) {
            const count = Object.keys(parsed.characters).length;
            if (window.confirm(`Import backup containing ${count} character sheets? This will merge with and update your cloud character sheets.`)) {
              state = mergeStates(state, parsed);
              state.updatedAt = Date.now();
              await save();
              render();
              alert(`Successfully imported ${count} character sheets and saved to Render cloud!`);
            }
          } else {
            alert('Invalid backup JSON format: Missing character data.');
          }
        } catch (err) {
          alert('Failed to parse backup file: ' + err.message);
        }
      };
      reader.readAsText(file);
    });
  }
  app.querySelector('#owner-select')?.addEventListener('change', async (event) => {
    if (user.role !== 'GM') return;
    const character = currentCharacter();
    if (character) {
      const selectedId = event.target.value || null;
      character.ownerId = selectedId;
      if (selectedId) {
        const assignable = getAssignablePlayers(character);
        const selectedPlayer = assignable.find((p) => p.id === selectedId);
        character.ownerName = selectedPlayer?.name || (selectedId === user.id ? user.name : '');
        registerKnownPlayer(selectedId, character.ownerName, selectedPlayer?.role || (selectedId === user.id ? user.role : 'PLAYER'));
      } else {
        character.ownerName = '';
      }
      character.updatedAt = Date.now();
      state.updatedAt = Date.now();
      const newAssignments = {};
      Object.entries(state.characters).forEach(([cId, c]) => {
        if (c.ownerId) {
          newAssignments[c.ownerId] ??= [];
          if (!newAssignments[c.ownerId].includes(cId)) {
            newAssignments[c.ownerId].push(cId);
          }
        }
      });
      state.assignments = newAssignments;
      await save();
      render();
    }
  });
  app.querySelectorAll('[data-add-row]').forEach((button) => button.addEventListener('click', async (event) => {
    event.preventDefault();
    const character = currentCharacter();
    if (!character || !canEditCurrent()) return;
    const name = button.dataset.addRow;
    activeTab = name;
    character.data.tables ??= {};
    if (!character.data.tables[name] || !Array.isArray(character.data.tables[name])) {
      const stored = character.data.tables[name];
      character.data.tables[name] = Array.isArray(stored)
        ? stored
        : stored && typeof stored === 'object'
          ? Object.keys(stored).sort((a, b) => Number(a) - Number(b)).map((k) => stored[k])
          : Array.from({ length: name === 'Note du joueur' ? 1 : DEFAULT_TABLE_ROWS }, () => ({}));
    }
    const newRowIndex = character.data.tables[name].length;
    character.data.tables[name].push({});
    character.updatedAt = Date.now();
    state.updatedAt = Date.now();
    await save();
    const targetPath = `tables.${name}.${newRowIndex}.0`;
    render(targetPath, true);
  }));
  app.querySelectorAll('[data-delete-row]').forEach((button) => button.addEventListener('click', async (event) => {
    event.preventDefault();
    const character = currentCharacter();
    if (!character || !canEditCurrent()) return;
    const name = button.dataset.deleteRow;
    const rowIndex = Number(button.dataset.rowIndex);
    const rows = character.data.tables[name];
    if (!Array.isArray(rows) || !Number.isInteger(rowIndex)) return;
    rows.splice(rowIndex, 1);
    character.updatedAt = Date.now();
    state.updatedAt = Date.now();
    await save();
    render();
  }));

  app.querySelector('#clear-initiative-btn')?.addEventListener('click', () => {
    if (user.role !== 'GM') return;
    if (window.confirm('Are you sure you want to clear all initiative scores?')) {
      state.initiativeTracker = {};
      queueSave(200);
      render();
    }
  });
  app.querySelector('#clear-rolls-btn')?.addEventListener('click', () => {
    if (user.role !== 'GM') return;
    if (window.confirm('Are you sure you want to clear the roll history?')) {
      state.rollHistory = [];
      queueSave(200);
      render();
    }
  });
  app.querySelector('#roll-unassigned-ini-btn')?.addEventListener('click', () => {
    if (user.role !== 'GM') return;
    rollAllUnassignedInitiative('First round');
  });
  app.querySelector('#roll-unassigned-next-ini-btn')?.addEventListener('click', () => {
    if (user.role !== 'GM') return;
    rollAllUnassignedInitiative('Next Rounds');
  });
  app.querySelector('#all-npcs-enter-combat-btn')?.addEventListener('click', async () => {
    if (user.role !== 'GM') return;
    Object.entries(state.characters).forEach(([id, c]) => {
      if (!c.ownerId && (!state.assignments || !state.assignments[c.ownerId])) {
        c.data ??= {};
        c.data.inCombat = true;
      }
    });
    await save();
    render();
  });
  app.querySelector('#all-npcs-leave-combat-btn')?.addEventListener('click', async () => {
    if (user.role !== 'GM') return;
    Object.entries(state.characters).forEach(([id, c]) => {
      if (!c.ownerId && (!state.assignments || !state.assignments[c.ownerId])) {
        c.data ??= {};
        c.data.inCombat = false;
        if (state.initiativeTracker?.[id]) {
          delete state.initiativeTracker[id];
        }
      }
    });
    await save();
    render();
  });
  app.querySelectorAll('[data-ini-toggle-combat]').forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      if (user.role !== 'GM') return;
      e.preventDefault();
      e.stopPropagation();
      const charId = btn.dataset.iniToggleCombat;
      if (!charId) return;
      const character = state.characters[charId];
      if (character) {
        character.data ??= {};
        const currentStatus = character.data.inCombat !== false;
        character.data.inCombat = !currentStatus;
        if (character.data.inCombat === false && state.initiativeTracker?.[charId]) {
          delete state.initiativeTracker[charId];
        }
        await save();
        render();
      } else if (state.initiativeTracker?.[charId]) {
        const tVal = state.initiativeTracker[charId];
        tVal.inCombat = !(tVal.inCombat !== false);
        if (tVal.inCombat === false) {
          delete state.initiativeTracker[charId];
        }
        await save();
        render();
      }
    });
  });
  app.querySelectorAll('[data-ini-roll-char]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      if (user.role !== 'GM') return;
      e.preventDefault();
      e.stopPropagation();
      const charId = btn.dataset.iniRollChar;
      const label = btn.dataset.iniLabel || 'Initiative';
      const bonus = parseInt(btn.dataset.iniBonus) || 0;
      if (charId) {
        rollInitiativeForCharacter(charId, label, bonus);
      }
    });
  });
  app.querySelectorAll('[data-ini-clear-char]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      if (user.role !== 'GM') return;
      e.preventDefault();
      e.stopPropagation();
      const charId = btn.dataset.iniClearChar;
      if (charId && state.initiativeTracker) {
        delete state.initiativeTracker[charId];
        queueSave(200);
        render();
      }
    });
  });
  app.querySelectorAll('[data-ini-set-score]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      if (user.role !== 'GM') return;
      e.preventDefault();
      e.stopPropagation();
      const charId = btn.dataset.iniSetScore;
      const charName = btn.dataset.charName || 'Character';
      const current = state.initiativeTracker?.[charId]?.total ?? '';
      const inputVal = window.prompt(`Set initiative score for ${charName}:`, current);
      if (inputVal !== null) {
        const num = parseInt(inputVal);
        if (!isNaN(num)) {
          recordInitiative(charId, charName, 'Manual', null, 'Manual', 0, num, num);
          render();
        }
      }
    });
  });
  app.querySelectorAll('[data-roll-filter]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      rollFilter = btn.dataset.rollFilter || 'all';
      render();
    });
  });

  const imgContainer = app.querySelector('#character-image-container');
  const cornerHandle = app.querySelector('#image-corner-handle');
  const infoLayout = app.querySelector('.info-layout');
  const removeBtn = app.querySelector('#remove-image-btn');

  app.querySelector('#owlbear-asset-btn')?.addEventListener('click', (e) => {
    e.stopPropagation();
    chooseOwlbearAsset();
  });
  app.querySelector('#image-url-btn')?.addEventListener('click', (e) => {
    e.stopPropagation();
    promptImageUrl();
  });
  app.querySelector('#add-xp-btn')?.addEventListener('click', (e) => {
    e.stopPropagation();
    openAddXpModal();
  });

  if (isAddXpModalOpen) {
    const input = app.querySelector('#xp-modal-amount-input');
    const submitBtn = app.querySelector('#xp-modal-submit-btn');
    const cancelBtn = app.querySelector('#xp-modal-cancel-btn');
    const closeBtn = app.querySelector('#xp-modal-close-btn');
    const backdrop = app.querySelector('#xp-modal-backdrop');

    const handleModalSubmit = () => {
      const valStr = input?.value?.trim() || '';
      let val = evaluateSafeMath(valStr);
      if (val === null) {
        const parsed = parseInt(valStr.replace(/^\+/, ''), 10);
        if (!isNaN(parsed)) val = parsed;
      }
      if (val === null || isNaN(val) || !isFinite(val)) {
        input?.focus();
        return;
      }
      applyAddExperience(val);
    };

    submitBtn?.addEventListener('click', handleModalSubmit);
    cancelBtn?.addEventListener('click', closeAddXpModal);
    closeBtn?.addEventListener('click', closeAddXpModal);

    backdrop?.addEventListener('click', (e) => {
      if (e.target === backdrop) {
        closeAddXpModal();
      }
    });

    app.querySelectorAll('[data-xp-preset]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const presetVal = parseInt(btn.dataset.xpPreset, 10);
        if (!isNaN(presetVal) && input) {
          const currentInputVal = parseInt(input.value, 10) || 0;
          input.value = currentInputVal ? currentInputVal + presetVal : presetVal;
          input.focus();
        }
      });
    });

    input?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleModalSubmit();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        closeAddXpModal();
      }
    });

    requestAnimationFrame(() => {
      input?.focus();
      input?.select?.();
    });
  }

  if (imgContainer) {
    imgContainer.addEventListener('click', (e) => {
      if (e.target.closest('button') || e.target.closest('#image-corner-handle')) return;
      if (!currentCharacter()?.data.image) {
        if (OBR.isAvailable) {
          chooseOwlbearAsset();
        } else {
          promptImageUrl();
        }
      }
    });
  }

  if (cornerHandle && imgContainer && infoLayout) {
    cornerHandle.addEventListener('pointerdown', (e) => {
      if (e.button !== 0 && e.pointerType === 'mouse') return;
      e.preventDefault();
      e.stopPropagation();

      try {
        cornerHandle.setPointerCapture(e.pointerId);
      } catch (err) {}

      const startScreenX = typeof e.screenX === 'number' && e.screenX !== 0 ? e.screenX : e.clientX;
      const startScreenY = typeof e.screenY === 'number' && e.screenY !== 0 ? e.screenY : e.clientY;
      const startWidth = imgContainer.offsetWidth;
      const startHeight = imgContainer.offsetHeight;
      let currentWidth = startWidth;
      let currentHeight = startHeight;

      cornerHandle.classList.add('resizing');
      const prevCursor = document.body.style.cursor;
      document.body.style.cursor = 'nwse-resize';
      document.body.style.userSelect = 'none';

      const onPointerMove = (moveEvent) => {
        const currScreenX = typeof moveEvent.screenX === 'number' && moveEvent.screenX !== 0 ? moveEvent.screenX : moveEvent.clientX;
        const currScreenY = typeof moveEvent.screenY === 'number' && moveEvent.screenY !== 0 ? moveEvent.screenY : moveEvent.clientY;
        const deltaX = currScreenX - startScreenX;
        const deltaY = currScreenY - startScreenY;

        currentWidth = Math.max(180, Math.min(850, Math.round(startWidth + deltaX)));
        currentHeight = Math.max(180, Math.min(1200, Math.round(startHeight + deltaY)));
        infoLayout.style.setProperty('--portrait-width', `${currentWidth}px`);
        infoLayout.style.setProperty('--portrait-height', `${currentHeight}px`);
      };

      const onPointerUp = (upEvent) => {
        try {
          if (cornerHandle.hasPointerCapture(upEvent.pointerId)) {
            cornerHandle.releasePointerCapture(upEvent.pointerId);
          }
        } catch (err) {}

        cornerHandle.removeEventListener('pointermove', onPointerMove);
        cornerHandle.removeEventListener('pointerup', onPointerUp);
        cornerHandle.removeEventListener('pointercancel', onPointerUp);

        cornerHandle.classList.remove('resizing');
        document.body.style.cursor = prevCursor;
        document.body.style.userSelect = '';

        const character = currentCharacter();
        if (character) {
          character.data.imageSettings = {
            width: currentWidth,
            height: currentHeight
          };
          queueSave(300);
        }
      };

      cornerHandle.addEventListener('pointermove', onPointerMove);
      cornerHandle.addEventListener('pointerup', onPointerUp);
      cornerHandle.addEventListener('pointercancel', onPointerUp);
    });
  }

  if (removeBtn) {
    removeBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const character = currentCharacter();
      if (character && canEditCurrent()) {
        delete character.data.image;
        await save();
        render();
      }
    });
  }

  app.querySelectorAll('[data-add-mount]').forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      e.preventDefault();
      const character = currentCharacter();
      if (!character || !canEditCurrent()) return;
      if (!Array.isArray(character.data.tables.Monture)) {
        character.data.tables.Monture = [];
      }
      const newIndex = character.data.tables.Monture.length;
      character.data.tables.Monture.push({});
      await save();
      const targetPath = `tables.Monture.${newIndex}.0`;
      render(targetPath, true);
    });
  });

  app.querySelectorAll('[data-delete-mount]').forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      e.preventDefault();
      const character = currentCharacter();
      if (!character || !canEditCurrent()) return;
      const mountIndex = Number(btn.dataset.deleteMount);
      if (!Array.isArray(character.data.tables.Monture) || !Number.isInteger(mountIndex)) return;
      character.data.tables.Monture.splice(mountIndex, 1);
      if (character.data.tables.Monture.length === 0) {
        character.data.tables.Monture.push({});
      }
      await save();
      render();
    });
  });

  app.querySelectorAll('[data-mount-owlbear-btn]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const idx = Number(btn.dataset.mountOwlbearBtn);
      chooseOwlbearAssetForMount(idx);
    });
  });

  app.querySelectorAll('[data-mount-url-btn]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const idx = Number(btn.dataset.mountUrlBtn);
      promptMountImageUrl(idx);
    });
  });

  app.querySelectorAll('[data-mount-remove-btn]').forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const character = currentCharacter();
      if (!character || !canEditCurrent()) return;
      const idx = Number(btn.dataset.mountRemoveBtn);
      removeMountImage(character, idx);
      await save();
      render();
    });
  });

  app.querySelectorAll('[data-mount-image-container]').forEach((container) => {
    container.addEventListener('click', (e) => {
      if (e.target.closest('button') || e.target.closest('.image-corner-handle')) return;
      const idx = Number(container.dataset.mountImageContainer);
      const character = currentCharacter();
      if (!character) return;
      const currentImg = getMountImage(character, idx);
      if (!currentImg) {
        if (OBR.isAvailable) {
          chooseOwlbearAssetForMount(idx);
        } else {
          promptMountImageUrl(idx);
        }
      }
    });
  });

  app.querySelectorAll('[data-mount-corner-handle]').forEach((cornerHandle) => {
    const mountIndex = Number(cornerHandle.dataset.mountCornerHandle);
    const mountCard = cornerHandle.closest('.mount-card');
    const imgContainer = mountCard?.querySelector(`[data-mount-image-container="${mountIndex}"]`);
    const mountLayout = mountCard?.querySelector('.mount-layout');

    if (!imgContainer || !mountLayout) return;

    cornerHandle.addEventListener('pointerdown', (e) => {
      if (e.button !== 0 && e.pointerType === 'mouse') return;
      e.preventDefault();
      e.stopPropagation();

      try {
        cornerHandle.setPointerCapture(e.pointerId);
      } catch (err) {}

      const startScreenX = typeof e.screenX === 'number' && e.screenX !== 0 ? e.screenX : e.clientX;
      const startScreenY = typeof e.screenY === 'number' && e.screenY !== 0 ? e.screenY : e.clientY;
      const startWidth = imgContainer.offsetWidth;
      const startHeight = imgContainer.offsetHeight;
      let currentWidth = startWidth;
      let currentHeight = startHeight;

      cornerHandle.classList.add('resizing');
      const prevCursor = document.body.style.cursor;
      document.body.style.cursor = 'nwse-resize';
      document.body.style.userSelect = 'none';

      const onPointerMove = (moveEvent) => {
        const currScreenX = typeof moveEvent.screenX === 'number' && moveEvent.screenX !== 0 ? moveEvent.screenX : moveEvent.clientX;
        const currScreenY = typeof moveEvent.screenY === 'number' && moveEvent.screenY !== 0 ? moveEvent.screenY : moveEvent.clientY;
        const deltaX = currScreenX - startScreenX;
        const deltaY = currScreenY - startScreenY;

        currentWidth = Math.max(180, Math.min(850, Math.round(startWidth + deltaX)));
        currentHeight = Math.max(180, Math.min(1200, Math.round(startHeight + deltaY)));
        mountLayout.style.setProperty('--portrait-width', `${currentWidth}px`);
        mountLayout.style.setProperty('--portrait-height', `${currentHeight}px`);
      };

      const onPointerUp = (upEvent) => {
        try {
          if (cornerHandle.hasPointerCapture(upEvent.pointerId)) {
            cornerHandle.releasePointerCapture(upEvent.pointerId);
          }
        } catch (err) {}

        cornerHandle.removeEventListener('pointermove', onPointerMove);
        cornerHandle.removeEventListener('pointerup', onPointerUp);
        cornerHandle.removeEventListener('pointercancel', onPointerUp);

        cornerHandle.classList.remove('resizing');
        document.body.style.cursor = prevCursor;
        document.body.style.userSelect = '';

        const character = currentCharacter();
        if (character) {
          ensureMountRow(character, mountIndex);
          const row = character.data.tables.Monture[mountIndex];
          if (row) {
            row.imageSettings = {
              width: currentWidth,
              height: currentHeight
            };
            queueSave(300);
          }
        }
      };

      cornerHandle.addEventListener('pointermove', onPointerMove);
      cornerHandle.addEventListener('pointerup', onPointerUp);
      cornerHandle.addEventListener('pointercancel', onPointerUp);
    });
  });

  app.querySelectorAll('[data-add-power-theme]').forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      e.preventDefault();
      const character = currentCharacter();
      if (!character || !canEditCurrent()) return;
      const themes = getPowerThemes(character);
      const newIdx = themes.length;
      themes.push({
        title: `Power Theme ${newIdx + 1}`,
        description: '',
        image: '',
        imageSettings: { width: 320, height: 420 },
        powers: [
          { name: '', description: '', roll: 'No Roll', cost: '', charges: '' },
          { name: '', description: '', roll: 'No Roll', cost: '', charges: '' }
        ]
      });
      await save();
      const targetPath = `powerThemes.${newIdx}.title`;
      render(targetPath, true);
    });
  });

  app.querySelectorAll('[data-delete-power-theme]').forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      e.preventDefault();
      const character = currentCharacter();
      if (!character || !canEditCurrent()) return;
      const themeIdx = Number(btn.dataset.deletePowerTheme);
      const themes = getPowerThemes(character);
      if (!Number.isInteger(themeIdx) || !themes[themeIdx]) return;
      const themeTitle = themes[themeIdx].title || `Power Theme ${themeIdx + 1}`;
      if (window.confirm(`Are you sure you want to delete "${themeTitle}"?`)) {
        themes.splice(themeIdx, 1);
        if (themes.length === 0) {
          themes.push({
            title: 'Power Theme 1',
            description: '',
            image: '',
            imageSettings: { width: 320, height: 420 },
            powers: [{ name: '', description: '', roll: 'No Roll', cost: '', charges: '' }]
          });
        }
        await save();
        render();
      }
    });
  });

  app.querySelectorAll('[data-add-power-row]').forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      e.preventDefault();
      const character = currentCharacter();
      if (!character || !canEditCurrent()) return;
      const themeIdx = Number(btn.dataset.addPowerRow);
      const themes = getPowerThemes(character);
      if (!themes[themeIdx]) return;
      themes[themeIdx].powers ??= [];
      const newPIdx = themes[themeIdx].powers.length;
      themes[themeIdx].powers.push({
        name: '',
        description: '',
        roll: 'No Roll',
        cost: '',
        charges: ''
      });
      await save();
      const targetPath = `powerThemes.${themeIdx}.powers.${newPIdx}.name`;
      render(targetPath, true);
    });
  });

  app.querySelectorAll('[data-delete-power-row]').forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      e.preventDefault();
      const character = currentCharacter();
      if (!character || !canEditCurrent()) return;
      const [tStr, pStr] = (btn.dataset.deletePowerRow || '').split('.');
      const themeIdx = Number(tStr);
      const pIdx = Number(pStr);
      const themes = getPowerThemes(character);
      if (!themes[themeIdx]?.powers || !Number.isInteger(pIdx)) return;
      themes[themeIdx].powers.splice(pIdx, 1);
      if (themes[themeIdx].powers.length === 0) {
        themes[themeIdx].powers.push({ name: '', description: '', roll: 'No Roll', cost: '', charges: '' });
      }
      await save();
      render();
    });
  });

  app.querySelectorAll('[data-roll-power-theme]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const themeIdx = Number(btn.dataset.rollPowerTheme);
      const pIdx = Number(btn.dataset.rollPowerIdx);
      const character = currentCharacter();
      if (!character) return;
      const themes = getPowerThemes(character);
      const theme = themes[themeIdx];
      const power = theme?.powers?.[pIdx];
      if (!power) return;

      const rollRank = power.roll || 'No Roll';
      const rankVal = getUniversalRankVal(rollRank);
      if (rankVal === null) return;

      const powerName = power.name?.trim() || `Power ${pIdx + 1}`;
      const themeTitle = theme.title?.trim() || `Power Theme ${themeIdx + 1}`;
      const fullName = `${themeTitle} — ${powerName}`;

      rollUniversalCheck(fullName, rankVal, 'standard', 0);
    });
  });

  app.querySelectorAll('[data-theme-owlbear-btn]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const idx = Number(btn.dataset.themeOwlbearBtn);
      chooseOwlbearAssetForTheme(idx);
    });
  });

  app.querySelectorAll('[data-theme-url-btn]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const idx = Number(btn.dataset.themeUrlBtn);
      promptThemeImageUrl(idx);
    });
  });

  app.querySelectorAll('[data-theme-remove-btn]').forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const character = currentCharacter();
      if (!character || !canEditCurrent()) return;
      const idx = Number(btn.dataset.themeRemoveBtn);
      removeThemeImage(character, idx);
      await save();
      render();
    });
  });

  app.querySelectorAll('[data-theme-image-container]').forEach((container) => {
    container.addEventListener('click', (e) => {
      if (e.target.closest('button') || e.target.closest('.image-corner-handle')) return;
      const idx = Number(container.dataset.themeImageContainer);
      const character = currentCharacter();
      if (!character) return;
      const currentImg = getThemeImage(character, idx);
      if (!currentImg) {
        if (OBR.isAvailable) {
          chooseOwlbearAssetForTheme(idx);
        } else {
          promptThemeImageUrl(idx);
        }
      }
    });
  });

  app.querySelectorAll('[data-theme-corner-handle]').forEach((cornerHandle) => {
    const themeIndex = Number(cornerHandle.dataset.themeCornerHandle);
    const themeCard = cornerHandle.closest('.power-theme-card');
    const imgContainer = themeCard?.querySelector(`[data-theme-image-container="${themeIndex}"]`);
    const themeLayout = themeCard?.querySelector('.power-theme-layout');

    if (!imgContainer || !themeLayout) return;

    cornerHandle.addEventListener('pointerdown', (e) => {
      if (e.button !== 0 && e.pointerType === 'mouse') return;
      e.preventDefault();
      e.stopPropagation();

      try {
        cornerHandle.setPointerCapture(e.pointerId);
      } catch (err) {}

      const startScreenX = typeof e.screenX === 'number' && e.screenX !== 0 ? e.screenX : e.clientX;
      const startScreenY = typeof e.screenY === 'number' && e.screenY !== 0 ? e.screenY : e.clientY;
      const startWidth = imgContainer.offsetWidth;
      const startHeight = imgContainer.offsetHeight;
      let currentWidth = startWidth;
      let currentHeight = startHeight;

      cornerHandle.classList.add('resizing');
      const prevCursor = document.body.style.cursor;
      document.body.style.cursor = 'nwse-resize';
      document.body.style.userSelect = 'none';

      const onPointerMove = (moveEvent) => {
        const currScreenX = typeof moveEvent.screenX === 'number' && moveEvent.screenX !== 0 ? moveEvent.screenX : moveEvent.clientX;
        const currScreenY = typeof moveEvent.screenY === 'number' && moveEvent.screenY !== 0 ? moveEvent.screenY : moveEvent.clientY;
        const deltaX = currScreenX - startScreenX;
        const deltaY = currScreenY - startScreenY;

        currentWidth = Math.max(180, Math.min(850, Math.round(startWidth + deltaX)));
        currentHeight = Math.max(180, Math.min(1200, Math.round(startHeight + deltaY)));
        themeLayout.style.setProperty('--portrait-width', `${currentWidth}px`);
        themeLayout.style.setProperty('--portrait-height', `${currentHeight}px`);
      };

      const onPointerUp = (upEvent) => {
        try {
          if (cornerHandle.hasPointerCapture(upEvent.pointerId)) {
            cornerHandle.releasePointerCapture(upEvent.pointerId);
          }
        } catch (err) {}

        cornerHandle.removeEventListener('pointermove', onPointerMove);
        cornerHandle.removeEventListener('pointerup', onPointerUp);
        cornerHandle.removeEventListener('pointercancel', onPointerUp);

        cornerHandle.classList.remove('resizing');
        document.body.style.cursor = prevCursor;
        document.body.style.userSelect = '';

        const character = currentCharacter();
        if (character) {
          const themes = getPowerThemes(character);
          const theme = themes[themeIndex];
          if (theme) {
            theme.imageSettings = {
              width: currentWidth,
              height: currentHeight
            };
            queueSave(300);
          }
        }
      };

      cornerHandle.addEventListener('pointermove', onPointerMove);
      cornerHandle.addEventListener('pointerup', onPointerUp);
      cornerHandle.addEventListener('pointercancel', onPointerUp);
    });
  });

  // Sortable table headers
  app.querySelectorAll('.sortable-header[data-sort-table]').forEach((th) => {
    th.addEventListener('click', async (event) => {
      if (event.target.closest('.col-resize-handle')) return;
      const tableName = th.dataset.sortTable;
      const colIndex = parseInt(th.dataset.colIndex, 10);
      if (tableName && !isNaN(colIndex)) {
        await sortTable(tableName, colIndex);
      }
    });
  });

  app.querySelectorAll('.sortable-header[data-sort-power-theme]').forEach((th) => {
    th.addEventListener('click', async (event) => {
      if (event.target.closest('.col-resize-handle')) return;
      const themeIdx = parseInt(th.dataset.sortPowerTheme, 10);
      const colKey = th.dataset.powerCol;
      if (!isNaN(themeIdx) && colKey) {
        await sortPowerThemeTable(themeIdx, colKey);
      }
    });
  });

  app.querySelectorAll('.sortable-header[data-sort-ini-col]').forEach((th) => {
    th.addEventListener('click', (event) => {
      if (event.target.closest('.col-resize-handle')) return;
      const colKey = th.dataset.sortIniCol;
      if (colKey) {
        if (iniSortState.colKey === colKey) {
          iniSortState.direction = iniSortState.direction === 'asc' ? 'desc' : 'asc';
        } else {
          iniSortState.colKey = colKey;
          iniSortState.direction = 'asc';
        }
        render();
      }
    });
  });

  app.querySelectorAll('.sortable-header[data-sort-roll-col]').forEach((th) => {
    th.addEventListener('click', (event) => {
      if (event.target.closest('.col-resize-handle')) return;
      const colKey = th.dataset.sortRollCol;
      if (colKey) {
        if (rollHistorySortState.colKey === colKey) {
          rollHistorySortState.direction = rollHistorySortState.direction === 'asc' ? 'desc' : 'asc';
        } else {
          rollHistorySortState.colKey = colKey;
          rollHistorySortState.direction = 'asc';
        }
        render();
      }
    });
  });

  bindColumnResizing();
  bindPageResizing();
}

function bindColumnResizing() {
  app.querySelectorAll('.col-resize-handle').forEach((handle) => {
    const tableName = handle.dataset.tableName || activeTab;
    const colName = handle.dataset.colResize;
    const th = handle.closest('th');
    if (!th) return;

    const onPointerDown = (e) => {
      if (e.button !== 0 && e.pointerType === 'mouse') return;
      e.preventDefault();
      e.stopPropagation();

      try {
        handle.setPointerCapture(e.pointerId);
      } catch (err) {}

      const startScreenX = typeof e.screenX === 'number' && e.screenX !== 0 ? e.screenX : e.clientX;
      const startWidth = th.getBoundingClientRect().width;
      let currentWidth = startWidth;

      document.body.classList.add('col-resizing');
      handle.classList.add('resizing');

      const onPointerMove = (moveEvent) => {
        const currScreenX = typeof moveEvent.screenX === 'number' && moveEvent.screenX !== 0 ? moveEvent.screenX : moveEvent.clientX;
        const deltaX = currScreenX - startScreenX;
        currentWidth = Math.max(35, Math.min(1600, Math.round(startWidth + deltaX)));

        th.style.width = `${currentWidth}px`;
        th.style.minWidth = `${currentWidth}px`;
      };

      const onPointerUp = (upEvent) => {
        try {
          if (handle.hasPointerCapture(upEvent.pointerId)) {
            handle.releasePointerCapture(upEvent.pointerId);
          }
        } catch (err) {}

        handle.removeEventListener('pointermove', onPointerMove);
        handle.removeEventListener('pointerup', onPointerUp);
        handle.removeEventListener('pointercancel', onPointerUp);

        document.body.classList.remove('col-resizing');
        handle.classList.remove('resizing');

        savePlayerColumnWidth(tableName, colName, currentWidth);
      };

      handle.addEventListener('pointermove', onPointerMove);
      handle.addEventListener('pointerup', onPointerUp);
      handle.addEventListener('pointercancel', onPointerUp);
    };

    handle.addEventListener('pointerdown', onPointerDown);

    handle.addEventListener('dblclick', (e) => {
      e.preventDefault();
      e.stopPropagation();
      savePlayerColumnWidth(tableName, colName, null);
      th.style.width = '';
      th.style.minWidth = '';
      render();
    });
  });
}

function bindPageResizing() {
  const frame = app.querySelector('.sheet-frame');
  if (!frame) return;

  app.querySelectorAll('.page-resize-handle').forEach((handle) => {
    const dir = handle.dataset.direction;

    const onPointerDown = (e) => {
      if (e.button !== 0 && e.pointerType === 'mouse') return;
      e.preventDefault();
      e.stopPropagation();

      try {
        handle.setPointerCapture(e.pointerId);
      } catch (err) {}

      const startScreenX = typeof e.screenX === 'number' && e.screenX !== 0 ? e.screenX : e.clientX;
      const startScreenY = typeof e.screenY === 'number' && e.screenY !== 0 ? e.screenY : e.clientY;

      const currentStyle = getComputedStyle(document.documentElement);
      const initialWidth = parseInt(currentStyle.getPropertyValue('--sheet-width')) || frame.offsetWidth || window.innerWidth;
      const initialHeight = parseInt(currentStyle.getPropertyValue('--sheet-height')) || frame.offsetHeight || window.innerHeight;

      let currentWidth = initialWidth;
      let currentHeight = initialHeight;

      document.body.classList.add('page-resizing');
      handle.classList.add('active');
      const prevCursor = document.body.style.cursor;
      document.body.style.cursor = getComputedStyle(handle).cursor;

      const onPointerMove = (moveEvent) => {
        const currScreenX = typeof moveEvent.screenX === 'number' && moveEvent.screenX !== 0 ? moveEvent.screenX : moveEvent.clientX;
        const currScreenY = typeof moveEvent.screenY === 'number' && moveEvent.screenY !== 0 ? moveEvent.screenY : moveEvent.clientY;

        const deltaX = currScreenX - startScreenX;
        const deltaY = currScreenY - startScreenY;

        if (dir.includes('r')) {
          currentWidth = Math.max(480, Math.min(2560, Math.round(initialWidth + deltaX)));
        } else if (dir.includes('l')) {
          currentWidth = Math.max(480, Math.min(2560, Math.round(initialWidth - deltaX)));
        }

        if (dir.includes('b')) {
          currentHeight = Math.max(400, Math.min(2000, Math.round(initialHeight + deltaY)));
        }

        applyPageSize(currentWidth, currentHeight, false);
      };

      const onPointerUp = (upEvent) => {
        try {
          if (handle.hasPointerCapture(upEvent.pointerId)) {
            handle.releasePointerCapture(upEvent.pointerId);
          }
        } catch (err) {}

        handle.removeEventListener('pointermove', onPointerMove);
        handle.removeEventListener('pointerup', onPointerUp);
        handle.removeEventListener('pointercancel', onPointerUp);

        document.body.classList.remove('page-resizing');
        handle.classList.remove('active');
        document.body.style.cursor = prevCursor;

        applyPageSize(currentWidth, currentHeight, true);
      };

      handle.addEventListener('pointermove', onPointerMove);
      handle.addEventListener('pointerup', onPointerUp);
      handle.addEventListener('pointercancel', onPointerUp);
    };

    handle.addEventListener('pointerdown', onPointerDown);

    handle.addEventListener('dblclick', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      const defaults = await getDefaultWindowDimensions();
      applyPageSize(defaults.width, defaults.height, true, true);
    });
  });
}

if (typeof window !== 'undefined') {
  const flushSave = () => {
    if (saveTimeout) {
      clearTimeout(saveTimeout);
      saveTimeout = null;
    }
    try {
      state.updatedAt = Date.now();
      const payload = JSON.stringify({
        ...state,
        deletedCharacterIds: Array.from(pendingDeletedCharacterIds)
      });
      if (navigator.sendBeacon) {
        const blob = new Blob([payload], { type: 'application/json' });
        navigator.sendBeacon(`${CLOUD_API_BASE}/api/sync`, blob);
      } else {
        fetch(`${CLOUD_API_BASE}/api/sync`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: payload,
          keepalive: true
        }).catch(() => {});
      }
    } catch (e) {}
    save();
  };
  window.addEventListener('beforeunload', flushSave);
  window.addEventListener('pagehide', flushSave);
}

initialise().catch((error) => {
  console.error(error);
  app.innerHTML = '<div class="empty-note">Unable to connect to the character sheet service.</div>';
});


