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
const STORAGE_KEY = 'terranova.characterSheets';
const infoFields = [['Player Name', 'playerName'], ['Name', 'name'], ['Gender', 'gender'], ['Origins', 'origins'], ['Age', 'age'], ['Heigth', 'height'], ['Weigth', 'weight'], ['Eyes Color', 'eyesColor'], ['Hairs Color', 'hairColor'], ['Skin Color', 'skinColor'], ['Languages', 'languages'], ['Alphabet', 'alphabet'], ['Gods', 'gods'], ['Xp to spend/Total', 'xp'], ['BackGround', 'background']];
const DEFAULT_TABLE_ROWS = 2;
const stats = ['Fighting', 'Strength', 'Agility', 'Endurance', 'Speed', 'Intelligence', 'Wisdom', 'Intuition', 'Psyche', 'Luck', 'Karma'];
const tables = {
  'Action Types': ['Name', 'Action Type', 'Description', 'Critical 1', 'White', 'Green', 'Yellow', 'Red', 'Natural Red', 'Critical 100'], Skills: ['Skill Type', 'Stat', 'CS Level', 'Focus Cost', 'White', 'Green', 'Yellow', 'Red'], Spell: ['Scell Value', 'Mana Cost', 'Scells', 'Intention', 'Description'], Specialisations: ['Name', 'Actual LVL', 'Touch Bonus', 'Potential Bonus', 'Special Effect', 'Ini Bonus'], Weapons: ['Name', 'Description', 'Specialisation', 'Touch Stat', 'Touch Bonus', 'Damage Bonus Stat', 'Effective Range', 'Yellow Range', 'Red Range', 'Dice', 'Two handed?', 'Quality'], Armor: ['Name', 'Base Armor', 'Quality', 'Runes Slots', 'Runes', 'Description'], Inventory: ['Qte', 'Name', 'Description', 'Localisation'], Relations: ['Name', 'Race', 'Genre', 'Age', 'Link', 'Relation Type', 'Description'], Monture: ['Name', 'Type', 'Speed', 'Armor', 'Notes'], 'Note du joueur': ['Note'], 'Unique Power': ['Name', 'Description', 'Cost'], 'Universale Chart': ['Class', 'Poor', 'Typical', 'Good', 'Excelent', 'Remarkable', 'Incredible', 'Amazing', 'Monstrous', 'Unearthly']
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

const app = document.querySelector('#root');
let activeTab = 'Infos';
let state = { characters: {}, assignments: {}, rollHistory: [], initiativeTracker: {} };
let user = { id: 'local-player', name: 'Local Player', role: 'GM' };
let players = [];
let activeCharacterId = null;

function getAvailableTabs() {
  if (user.role === 'GM') {
    return ['Rolls & Ini', ...tabs];
  }
  return tabs;
}

const esc = (value = '') => String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const blankCharacter = (name = 'New Character') => ({
  name,
  ownerId: null,
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
    tables: {},
    imageSettings: { width: 320, height: 480 }
  }
});

function getAssignedCharacters(userId) {
  return Object.entries(state.characters).filter(([id, char]) => {
    if (char.ownerId === userId) return true;
    const direct = state.assignments[userId];
    if (Array.isArray(direct)) return direct.includes(id);
    return direct === id;
  });
}

function currentCharacter() {
  if (user.role === 'GM') {
    return state.characters[activeCharacterId] || Object.values(state.characters)[0] || null;
  }
  const myChars = getAssignedCharacters(user.id);
  if (!myChars.length) {
    return state.characters[activeCharacterId] || Object.values(state.characters)[0] || null;
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

const specialisationLevels = {
  Unspecialised: { touch: '0', potential: '0', ini: '0', colors: [], defaults: [] },
  Novice: { touch: '+5', potential: '+5', ini: '+1', colors: [null], defaults: ['Quick Draw'] },
  Apprentice: { touch: '+10', potential: '+10', ini: '+2', colors: [null, 'red'] },
  Adept: { touch: '+15', potential: '+15', ini: '+3', colors: [null, 'yellow'] },
  Expert: { touch: '+20', potential: '+20', ini: '+4', colors: [null, 'yellow', 'red'], defaults: [null, null, 'Combo on naturel red'] },
  Master: { touch: '+25', potential: '+25', ini: '+5', colors: [null, 'yellow', 'red', 'dark-red'] }
};

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
        const mountName = row[0] || (rows.length > 1 ? `Monture ${mountIndex + 1}` : 'Monture');

        return `<div class="mount-card" data-mount-card="${mountIndex}">
          ${rows.length > 1 ? `<div class="mount-header"><span>${esc(mountName)}</span></div>` : ''}
          <div class="grid-sheet info-layout mount-layout" style="--portrait-width: ${widthVal}px; --portrait-height: ${heightVal}px;">
            <div class="portrait-column">
              <div class="character-image mount-image ${image ? 'has-image' : ''}" data-mount-image-container="${mountIndex}" tabindex="0" role="button" aria-label="Mount image">
                ${image ? `
                  <img src="${esc(image)}" alt="Mount image" class="character-image-preview" />
                  <div class="image-overlay">
                    <div class="image-overlay-actions">
                      ${OBR.isAvailable ? `<button type="button" class="img-btn" data-mount-owlbear-btn="${mountIndex}">Owlbear Cloud</button>` : ''}
                      <button type="button" class="img-btn" data-mount-url-btn="${mountIndex}">Set URL</button>
                    </div>
                    <button type="button" class="image-remove-btn" data-mount-remove-btn="${mountIndex}" title="Remove image">&times;</button>
                  </div>
                ` : `
                  <div class="empty-image-placeholder">
                    <span class="image-label">INSERT MOUNT IMAGE</span>
                    <div class="image-choice-buttons">
                      ${OBR.isAvailable ? `<button type="button" class="img-choice-btn" data-mount-owlbear-btn="${mountIndex}">Owlbear Cloud</button>` : ''}
                      <button type="button" class="img-choice-btn" data-mount-url-btn="${mountIndex}">Image URL</button>
                    </div>
                  </div>
                `}
                <div class="image-corner-handle" data-mount-corner-handle="${mountIndex}" title="Drag corner to resize mount box"></div>
              </div>
              <div class="mount-actions">
                <button type="button" class="add-row mount-action-btn" data-add-mount title="Add a new mount">+ Add Mount</button>
                <button type="button" class="delete-row mount-action-btn" data-delete-mount="${mountIndex}" title="Delete this mount">Delete Mount</button>
              </div>
            </div>
            <div class="info-fields">
              <label class="field-row"><span class="field-label">Name</span>${editable(`tables.Monture.${mountIndex}.0`, row[0] || '', 'field-input', 'Name')}</label>
              <label class="field-row"><span class="field-label">Type</span>${editable(`tables.Monture.${mountIndex}.1`, row[1] || '', 'field-input', 'Type')}</label>
              <label class="field-row"><span class="field-label">Speed</span>${editable(`tables.Monture.${mountIndex}.2`, row[2] || '', 'field-input', 'Speed')}</label>
              <label class="field-row"><span class="field-label">Armor</span>${editable(`tables.Monture.${mountIndex}.3`, row[3] || '', 'field-input', 'Armor')}</label>
              <label class="field-row tall"><span class="field-label">Notes</span>${editable(`tables.Monture.${mountIndex}.4`, row[4] || '', 'field-input', 'Notes')}</label>
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
              <button type="button" class="img-btn" id="image-url-btn">Set URL</button>
            </div>
            <button type="button" class="image-remove-btn" id="remove-image-btn" title="Remove image">&times;</button>
          </div>
        ` : `
          <div class="empty-image-placeholder">
            <span class="image-label">INSERT CHARACTER IMAGE</span>
            <div class="image-choice-buttons">
              ${OBR.isAvailable ? '<button type="button" class="img-choice-btn" id="owlbear-asset-btn">Owlbear Cloud</button>' : ''}
              <button type="button" class="img-choice-btn" id="image-url-btn">Image URL</button>
            </div>
          </div>
        `}
        <div class="image-corner-handle" id="image-corner-handle" title="Drag corner to resize portrait box"></div>
      </div>
    </div>
    <div class="info-fields">
      ${infoFields.map(([label, key], index) => {
        if (key === 'xp') {
          return `<div class="field-row xp-split-row">
            <span class="field-label">${label}</span>
            <div class="xp-split-inputs">
              <div class="xp-cell">
                <span class="xp-cell-tag">To spend</span>
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

  const targetTag = activeRollResult.targetTier && activeRollResult.targetTier !== 'standard'
    ? `<span class="roll-target-tag">Target: <strong>${activeRollResult.targetTier.toUpperCase()}</strong> ${typeof activeRollResult.karmaCost === 'number' ? `&bull; Karma Cost: <strong>${activeRollResult.karmaCost}</strong>` : ''}</span>`
    : '';

  return `<div class="roll-result-banner banner-${activeRollResult.colorTone}">
    <div class="roll-result-info">
      <div class="roll-result-title">
        <span class="roll-char-name">${esc(activeRollResult.charName)}</span>
        <span class="roll-stat-tag">${esc(activeRollResult.statName)} (Value: <strong>${activeRollResult.statValue}</strong> &rarr; Rank: <strong>${esc(activeRollResult.rankName)}</strong>)</span>
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

  state.initiativeTracker[effectiveId] = {
    characterId: effectiveId,
    charName: charName || 'Character',
    playerName: playerName || (effectiveAssigned ? 'Assigned' : 'Unassigned (NPC)'),
    isAssigned: effectiveAssigned,
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

function displayAndAnnounceRollResult(statName, statValue, rolledTotal, charName, playerName, broadcast = true, rollId = null, targetTier = 'standard') {
  const resolution = resolveUniversalRoll(statValue, rolledTotal);
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
    charName: charName || 'Character',
    playerName: playerName || 'Player',
    playerId: user.id,
    timestamp: Date.now()
  };

  playCritSound(resolution.outcomeType, currentRollId);

  const targetSuffix = targetTier && targetTier !== 'standard' ? ` [Target: ${targetTier.toUpperCase()}, Karma: ${karmaCost}]` : '';
  addRollToHistory({
    id: currentRollId,
    timestamp: Date.now(),
    type: 'stat',
    charName: charName || 'Character',
    playerName: playerName || 'Player',
    statName: targetTier && targetTier !== 'standard' ? `${statName} (${targetTier.toUpperCase()})` : statName,
    statValue: resolution.statValue,
    rankName: resolution.rankName,
    detail: `D100 = ${resolution.roll} (${resolution.statValue} ➔ ${resolution.rankName})${targetSuffix}`,
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
    OBR.notification.show(
      `🎲 ${activeRollResult.charName} (${playerName || 'Player'}) rolled ${statName} [${activeRollResult.statValue} ➔ ${resolution.rankName}]: D100 = ${resolution.roll} ➔ ${resolution.outcomeLabel.toUpperCase()}${karmaNote}`,
      isSuccess ? 'DEFAULT' : 'WARNING'
    );
  }

  render();
}

function displayAndAnnounceDamageResult(weaponName, modLabel, count, sides, individualRolls, flatBonus, totalDamage, charName, playerName, broadcast = true, rollId = null) {
  const currentRollId = rollId || `roll_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  const label = `${weaponName}${modLabel ? ' (' + modLabel + ')' : ''}`;
  const diceStr = `${count}D${sides}`;
  const bonusStr = flatBonus >= 0 ? `+ ${flatBonus}` : `- ${Math.abs(flatBonus)}`;

  activeRollResult = {
    rollId: currentRollId,
    type: 'damage',
    label,
    weaponName,
    modLabel,
    diceStr,
    flatBonus,
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

  addRollToHistory({
    id: currentRollId,
    timestamp: Date.now(),
    type: 'damage',
    charName: charName || 'Character',
    playerName: playerName || 'Player',
    statName: `Damage - ${label}`,
    detail: `${diceStr} (${(individualRolls || []).join(', ') || (totalDamage - flatBonus)}) ${bonusStr} = ${totalDamage}`,
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
      `💥 ${charName || 'Character'} (${playerName || 'Player'}) rolled Damage (${label}): ${diceStr} ${bonusStr} = ${totalDamage}`,
      'DEFAULT'
    );
  }

  render();
}

async function rollUniversalCheck(name, statValue, targetTier = 'standard') {
  const character = currentCharacter();
  const charId = activeCharacterId || Object.entries(state.characters).find(([_, c]) => c === character)?.[0] || null;
  const numVal = parseFloat(statValue) || 0;
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
        const preview = resolveUniversalRoll(numVal, 50);
        OBR.notification.show(`Rolling 1D100 for ${name} (${numVal} ➔ ${preview.rankName})...`);
      }
    } catch (err) {
      try {
        await OBR.broadcast.sendMessage('dice-plus/roll-request', payload, { destination: 'ALL' });
      } catch (e) {}
    }
  } else {
    const roll = Math.floor(Math.random() * 100) + 1;
    displayAndAnnounceRollResult(name, numVal, roll, charName, playerName, false, rollId, targetTier);
  }
}

async function rollWeaponDamage(weaponName, diceString, baseBonus, modLabel = '', modBonus = 0) {
  const character = currentCharacter();
  const charId = activeCharacterId || Object.entries(state.characters).find(([_, c]) => c === character)?.[0] || null;
  const charName = character?.name || 'Character';

  const bBonus = parseInt(baseBonus) || 0;
  const mBonus = parseInt(modBonus) || 0;
  const totalFlat = bBonus + mBonus;

  const match = (diceString || '1D10').match(/^(\d*)\s*[dD]\s*(\d+)/);
  const count = match ? (parseInt(match[1]) || 1) : 1;
  const sides = match ? parseInt(match[2]) : 10;

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

  const notation = totalFlat > 0 ? `${count}d${sides} + ${totalFlat}` : (totalFlat < 0 ? `${count}d${sides} - ${Math.abs(totalFlat)}` : `${count}d${sides}`);

  const rollInfo = {
    rollId,
    type: 'damage',
    label: `${weaponName}${modLabel ? ' (' + modLabel + ')' : ''}`,
    weaponName,
    modLabel,
    count,
    sides,
    flatBonus: totalFlat,
    notation,
    charName,
    characterId: charId,
    playerName,
    playerId,
    timestamp
  };

  pendingStatRolls.set(rollId, rollInfo);

  const countsKey = `d${sides}`;
  const diceCounts = { d1: 0, d2: 0, d3: 0, d4: 0, d6: 0, d8: 0, d10: 0, d12: 0, d20: 0, d100: 0, dF: 0 };
  const diceIndices = { d1: 0, d2: 0, d3: 0, d4: 0, d6: 0, d8: 0, d10: 0, d12: 0, d20: 0, d100: 0, dF: 0 };
  if (diceCounts[countsKey] !== undefined) {
    diceCounts[countsKey] = count;
  }

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
    for (let i = 0; i < count; i++) {
      const die = Math.floor(Math.random() * sides) + 1;
      individualRolls.push(die);
      diceTotal += die;
    }
    const totalDamage = diceTotal + totalFlat;
    displayAndAnnounceDamageResult(weaponName, modLabel, count, sides, individualRolls, totalFlat, totalDamage, charName, playerName, false, rollId);
  }
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
  const unassigned = Object.entries(state.characters).filter(([id, c]) => !c.ownerId && (!state.assignments || !state.assignments[c.ownerId]));
  if (unassigned.length === 0) {
    if (OBR.isAvailable && OBR.notification?.show) {
      OBR.notification.show('No unassigned characters found.');
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
  character.data.quickAccessWeaponSlot ??= 0;

  const rawWeapons = Array.isArray(character.data.tables?.Weapons) ? character.data.tables.Weapons : [];
  const rawSpecs = Array.isArray(character.data.tables?.Specialisations) ? character.data.tables.Specialisations : [];

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

  const weapon = (rawWeapons.length > 0 && rawWeapons[selectedWIdx]) ? rawWeapons[selectedWIdx] : [];
  const weaponName = weapon[0] || (rawWeapons.length > 0 ? `Weapon ${selectedWIdx + 1}` : 'Weapon');
  const specName = weapon[9] || '';
  const touchStatName = weapon[1] || 'Fighting';
  const weaponTouchBonus = parseInt(weapon[11]) || 0;
  const damageBonusStatName = weapon[2] || 'Strength';
  const diceStr = weapon[6] || '1D10';
  const twoHanded = weapon[10] === true || weapon[10] === 'true' || weapon[10] === 'on';

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
        <div class="qa-cell bg-green rollable-qa-dmg" data-weapon-name="${esc(weaponName)}" data-dice="${finalDiceStr}" data-base-bonus="${totalFlatBonus}" data-mod-label="Block" data-mod-bonus="10" title="Click to roll Damage (+10 Block): ${finalDiceStr} + ${totalFlatBonus + 10}">Block</div>
        <div class="qa-cell bg-yellow rollable-qa-dmg" data-weapon-name="${esc(weaponName)}" data-dice="${finalDiceStr}" data-base-bonus="${totalFlatBonus}" data-mod-label="Yellow" data-mod-bonus="20" title="Click to roll Damage (+20 Yellow): ${finalDiceStr} + ${totalFlatBonus + 20}">Yellow</div>
        <div class="qa-cell bg-red rollable-qa-dmg" data-weapon-name="${esc(weaponName)}" data-dice="${finalDiceStr}" data-base-bonus="${totalFlatBonus}" data-mod-label="Red" data-mod-bonus="30" title="Click to roll Damage (+30 Red): ${finalDiceStr} + ${totalFlatBonus + 30}">Red</div>
        <div class="qa-cell bg-dark-red rollable-qa-dmg" data-weapon-name="${esc(weaponName)}" data-dice="${finalDiceStr}" data-base-bonus="${totalFlatBonus}" data-mod-label="Natural Red" data-mod-bonus="40" title="Click to roll Damage (+40 Natural Red): ${finalDiceStr} + ${totalFlatBonus + 40}">NaturalRed</div>
      </div>
    </div>
  `;

  return `
    <div class="quick-access-section">
      <h3 class="quick-access-main-title">⚡ Quick Access</h3>
      ${defenseTableHtml}
      <div class="qa-separator"></div>
      ${weaponTableHtml}
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
      const p = players.find((pl) => pl.id === c.ownerId);
      ownerName = p ? p.name : 'Player';
    }
    const intuitionVal = parseFloat(c.data?.stats?.Intuition ?? '6') || 0;
    const speedVal = parseFloat(c.data?.stats?.Speed ?? c.data?.stats?.Movement ?? '6') || 0;
    const firstRoundBonus = Math.floor(intuitionVal / 10);
    const nextRoundsBonus = Math.floor(speedVal / 10);

    const tracked = trackerMap[id] || Object.values(trackerMap).find((t) => t.charName === c.name);

    allEntriesMap.set(id, {
      characterId: id,
      charName: c.name || 'Unnamed',
      isAssigned,
      ownerName,
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
      allEntriesMap.set(tId, {
        characterId: tId,
        charName: tVal.charName || 'Character',
        isAssigned: Boolean(tVal.isAssigned),
        ownerName: tVal.playerName || (tVal.isAssigned ? 'Assigned' : 'Unassigned (NPC)'),
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

  const rolledList = allEntries
    .filter((e) => e.hasRolled)
    .sort((a, b) => (b.total - a.total) || (b.bonus - a.bonus) || a.charName.localeCompare(b.charName));

  const unrolledList = allEntries
    .filter((e) => !e.hasRolled)
    .sort((a, b) => a.charName.localeCompare(b.charName));

  const sortedIniList = [...rolledList, ...unrolledList];

  const allRolls = state.rollHistory || [];
  const filteredRolls = allRolls.filter((r) => {
    if (rollFilter === 'stats') return r.type === 'stat';
    if (rollFilter === 'initiative') return r.type === 'initiative';
    if (rollFilter === 'crits') return r.outcomeType === 'crit-fail' || r.outcomeType === 'crit-success' || r.roll === 1 || r.roll === 100;
    return true;
  });

  return `<div class="roll-tracker-layout">
    ${rollResultBannerHtml()}

    <!-- Section 1: Initiative Tracker -->
    <div class="tracker-card">
      <div class="tracker-card-header">
        <div class="tracker-title-wrap">
          <h2 class="tracker-card-title">⚔️ Initiative Tracker (All Players &amp; Non-Assigned Characters)</h2>
          <span class="tracker-count-badge">${rolledList.length}/${allEntries.length} Rolled</span>
        </div>
        <div class="tracker-btn-group">
          <button type="button" class="tracker-btn tracker-btn-primary" id="roll-unassigned-ini-btn" title="Roll 1st Round Initiative for all Unassigned / NPC characters">🎲 Roll Unassigned (1st Round)</button>
          <button type="button" class="tracker-btn tracker-btn-primary" id="roll-unassigned-next-ini-btn" title="Roll Next Rounds Initiative for all Unassigned / NPC characters">🎲 Roll Unassigned (Next Rounds)</button>
          <button type="button" class="tracker-btn tracker-btn-danger" id="clear-initiative-btn" title="Clear all initiative scores">🗑️ Clear Initiative</button>
        </div>
      </div>
      <div class="tracker-table-wrap">
        ${sortedIniList.length === 0 ? `
          <div class="tracker-empty-state">No characters created yet. Create characters in the top toolbar to track their initiative.</div>
        ` : `
          <table class="tracker-table">
            <thead>
              <tr>
                <th style="width: 60px; text-align: center;">Order</th>
                <th>Character</th>
                <th>Assignment</th>
                <th>Initiative Mods</th>
                <th>Rolled Result</th>
                <th style="text-align: right;">Actions</th>
              </tr>
            </thead>
            <tbody>
              ${sortedIniList.map((item, idx) => {
                const isLeader = item.hasRolled && idx === 0;
                const rankText = item.hasRolled ? `${idx + 1}` : '-';
                return `<tr class="${isLeader ? 'row-leader' : ''}">
                  <td style="text-align: center;">
                    <span class="ini-rank-badge ${item.hasRolled ? (isLeader ? 'leader' : 'active') : 'unrolled'}">${rankText}</span>
                  </td>
                  <td>
                    <span class="tracker-char-name">${esc(item.charName)}</span>
                  </td>
                  <td>
                    <span class="tracker-tag ${item.isAssigned ? 'tag-player' : 'tag-npc'}">
                      ${item.isAssigned ? `👤 ${esc(item.ownerName)}` : '🤖 Unassigned (NPC)'}
                    </span>
                  </td>
                  <td>
                    <span class="tracker-mod-tag" title="First round bonus (Intuition / 10)">1st: <strong>+${item.firstRoundBonus}</strong></span>
                    <span class="tracker-mod-tag" title="Next rounds bonus (Speed / 10)">Next: <strong>+${item.nextRoundsBonus}</strong></span>
                  </td>
                  <td>
                    ${item.hasRolled ? `
                      <div class="ini-score-box">
                        <span class="ini-score-number">${item.total}</span>
                        <span class="ini-score-detail">(1D12: ${item.d12} ${item.bonus >= 0 ? `+ ${item.bonus}` : `- ${Math.abs(item.bonus)}`}) &bull; <em>${esc(item.label || '1st round')}</em></span>
                      </div>
                    ` : `
                      <span class="ini-unrolled-note">Waiting for roll...</span>
                    `}
                  </td>
                  <td style="text-align: right;">
                    <div class="tracker-btn-group" style="justify-content: flex-end;">
                      <button type="button" class="tracker-btn-mini" data-ini-roll-char="${esc(item.characterId)}" data-ini-label="First round" data-ini-bonus="${item.firstRoundBonus}" title="Roll 1st Round: 1D12 + ${item.firstRoundBonus}">Roll 1st</button>
                      <button type="button" class="tracker-btn-mini" data-ini-roll-char="${esc(item.characterId)}" data-ini-label="Next Rounds" data-ini-bonus="${item.nextRoundsBonus}" title="Roll Next Rounds: 1D12 + ${item.nextRoundsBonus}">Roll Next</button>
                      <button type="button" class="tracker-btn-mini" data-ini-set-score="${esc(item.characterId)}" data-char-name="${esc(item.charName)}" title="Manually set initiative score">Set</button>
                      ${item.hasRolled ? `<button type="button" class="tracker-btn-mini remove-btn" data-ini-clear-char="${esc(item.characterId)}" title="Clear this character's initiative">&times;</button>` : ''}
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
          <h2 class="tracker-card-title">📜 All Rolls History</h2>
          <span class="tracker-count-badge">${allRolls.length} Recorded</span>
          <div class="tracker-filter-pills">
            <button type="button" class="tracker-filter-btn ${rollFilter === 'all' ? 'active' : ''}" data-roll-filter="all">All (${allRolls.length})</button>
            <button type="button" class="tracker-filter-btn ${rollFilter === 'stats' ? 'active' : ''}" data-roll-filter="stats">D100 Stats</button>
            <button type="button" class="tracker-filter-btn ${rollFilter === 'initiative' ? 'active' : ''}" data-roll-filter="initiative">Initiative</button>
            <button type="button" class="tracker-filter-btn ${rollFilter === 'crits' ? 'active' : ''}" data-roll-filter="crits">Crits (1/100)</button>
          </div>
        </div>
        <div class="tracker-btn-group">
          <button type="button" class="tracker-btn tracker-btn-danger" id="clear-rolls-btn" title="Clear all rolls from history">🗑️ Clear Rolls</button>
        </div>
      </div>
      <div class="tracker-table-wrap roll-history-scroll-wrap">
        ${filteredRolls.length === 0 ? `
          <div class="tracker-empty-state">${allRolls.length === 0 ? 'No rolls have been recorded yet. Rolls from character stats, initiative, and dice tray will appear here in real-time.' : 'No rolls match the current filter.'}</div>
        ` : `
          <table class="tracker-table">
            <thead>
              <tr>
                <th style="width: 85px;">Time</th>
                <th>Character / Player</th>
                <th>Roll / Stat</th>
                <th>Formula &amp; Details</th>
                <th style="text-align: right;">Outcome</th>
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
  const storedRows = character.data.tables[name];
  let rows = Array.isArray(storedRows)
    ? storedRows
    : storedRows && typeof storedRows === 'object'
      ? Object.keys(storedRows).sort((a, b) => Number(a) - Number(b)).map((key) => storedRows[key])
      : Array.from({ length: name === 'Note du joueur' ? 1 : DEFAULT_TABLE_ROWS }, () => ({}));
  const isActionTypes = name === 'Action Types';
  if (isActionTypes) rows = ACTION_TYPES_ROWS;
  if (storedRows && !Array.isArray(storedRows)) {
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

  const tableClass = name === 'Action Types' ? ' sheet-table-action-types' : name === 'Specialisations' ? ' sheet-table-specialisations' : name === 'Weapons' ? ' sheet-table-weapons' : name === 'Armor' ? ' sheet-table-armor' : name === 'Inventory' ? ' sheet-table-inventory' : name === 'Relations' ? ' sheet-table-relations' : '';
  return `<section><h2 class="section-title">${esc(name)}</h2><div class="table-wrap"><table class="sheet-table${tableClass}"><thead><tr>${displayColumns.map((columnIndex) => `<th>${esc(headers[columnIndex])}</th>`).join('')}${canDeleteRows ? '<th class="row-actions">Actions</th>' : ''}</tr></thead><tbody>${rows.map((row, rowIndex) => `<tr>${displayColumns.map((columnIndex) => {
    const header = headers[columnIndex];
    const sourceColumnIndex = name === 'Weapons' ? weaponStorageColumns[columnIndex] : columnIndex;
    const specialisationDefault = name === 'Specialisations' && sourceColumnIndex === 1 ? 'Unspecialised' : (name === 'Specialisations' && [2, 3, 5].includes(sourceColumnIndex) ? '0' : '');
    const val = row[sourceColumnIndex] || specialisationDefault;
    const path = `tables.${name}.${rowIndex}.${sourceColumnIndex}`;
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
    if (isActionTypes) return `<td><span class="cell-readonly action-type-cell">${esc(val)}</span></td>`;
    return `<td>${editable(path, val, 'cell-input')}</td>`;
  }).join('')}${canDeleteRows ? `<td class="row-actions"><button type="button" class="delete-row" data-delete-row="${esc(name)}" data-row-index="${rowIndex}" title="Delete this row">Delete</button></td>` : ''}</tr>`).join('')}</tbody></table></div>${isActionTypes ? '' : `<button class="add-row" data-add-row="${esc(name)}">+ Add row</button>`}</section>`;
}

function pageFor(character) {
  if (activeTab === 'Rolls & Ini') return rollsAndIniPage();
  if (activeTab === 'Infos') return infoPage(character);
  if (activeTab === 'Stats') return statsPage(character);
  if (activeTab === 'Universale Chart') return universalChartPage();
  if (activeTab === 'Monture') return monturePage(character);
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

  const options = Object.entries(state.characters).map(([id, item]) => `<option value="${esc(id)}" ${id === activeCharacterId ? 'selected' : ''}>${esc(item.name || id)}</option>`).join('');
  const playerOptions = players.map((player) => `<option value="${esc(player.id)}" ${character?.ownerId === player.id ? 'selected' : ''}>${esc(player.name)} (${player.role})</option>`).join('');
  return `<div class="sheet-controls"><label>Character <select id="character-select">${options || '<option>No sheets</option>'}</select></label><button class="toolbar-button" id="new-character">New sheet</button>${character ? `<button class="toolbar-button danger" id="delete-character" title="Delete current character sheet">Delete sheet</button>` : ''}${character ? `<label>Sheet Name <input type="text" id="sheet-name-input" class="sheet-name-input" value="${esc(character.name || '')}" placeholder="Sheet name" /></label>` : ''}<label>Assign to <select id="owner-select"><option value="">Unassigned</option>${playerOptions}</select></label>${fontControl}</div>`;
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
  app.innerHTML = `<div class="sheet-app">
    <main class="sheet-frame">
      <div class="page-resize-handle page-resize-r" data-direction="r" title="Drag right edge to resize width (Double-click to reset to 50% width)"></div>
      <div class="page-resize-handle page-resize-b" data-direction="b" title="Drag bottom edge to resize height (Double-click to reset size)"></div>
      <div class="page-resize-handle page-resize-l" data-direction="l" title="Drag left edge to resize width (Double-click to reset to 50% width)"></div>
      <div class="page-resize-handle page-resize-br" data-direction="br" title="Drag corner to resize page (Double-click to reset to 50% width)"></div>
      <div class="page-resize-handle page-resize-bl" data-direction="bl" title="Drag corner to resize page (Double-click to reset to 50% width)"></div>
      <header class="sheet-header">
        <div>
          <p class="sheet-kicker">Terranova / Fiche de personnage ${character?.name ? `— ${esc(character.name)}` : ''}</p>
          <h1 class="sheet-title">${esc(activeTab)}</h1>
        </div>
        <div class="sheet-meta">
          <div class="sheet-meta-workspace">${user.role === 'GM' ? 'DM workspace' : 'Player workspace'}<br>${esc(user.name)}</div>
          <span class="cloud-status" id="cloud-status">Cloud ready</span>
        </div>
      </header>
      ${controls(character)}
      <nav class="sheet-tabs" aria-label="Character sheet tabs">
        ${getAvailableTabs().map((tab) => `<button class="sheet-tab${tab === activeTab ? ' active' : ''}" data-tab="${esc(tab)}">${esc(tab)}</button>`).join('')}
      </nav>
      <div class="sheet-body">
        <div class="sheet-status">
          <span>WORKSHEET <strong>${esc(activeTab)}</strong></span>
          <span>${character || activeTab === 'Rolls & Ini' ? 'INSTANT SAVE ENABLED' : 'WAITING FOR DM ASSIGNMENT'}</span>
        </div>
        ${(character || activeTab === 'Rolls & Ini') ? pageFor(character) : '<div class="empty-note">The DM has not assigned a character sheet to this player yet.</div>'}
      </div>
    </main>
  </div>`;
  bindEvents();

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
      initiativeTracker: data?.initiativeTracker || {}
    });
  } catch (e) {
    return '';
  }
}

function queueSave(delay = 400) {
  const status = document.querySelector('#cloud-status');
  if (status) status.textContent = 'Saving...';

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
  if (currentHash === lastSavedHash && lastSavedHash !== null && !pendingSave) {
    const status = document.querySelector('#cloud-status');
    if (status) status.textContent = OBR.isAvailable ? 'Saved to Owlbear cloud' : 'Saved locally';
    return;
  }

  if (isSaving) {
    pendingSave = true;
    return;
  }

  isSaving = true;
  const payload = { ...state, updatedAt: Date.now() };

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch (e) {}

  if (OBR.isAvailable) {
    try {
      await OBR.room.setMetadata({ [STORAGE_KEY]: payload });
      lastSavedHash = currentHash;
      const status = document.querySelector('#cloud-status');
      if (status) status.textContent = 'Saved to Owlbear cloud';
    } catch (err) {
      console.error('Failed to save to Owlbear room metadata:', err);
      const status = document.querySelector('#cloud-status');
      if (status) status.textContent = 'Cloud save failed';
    } finally {
      isSaving = false;
      if (pendingSave) {
        pendingSave = false;
        setTimeout(() => save(), 250);
      }
    }
  } else {
    lastSavedHash = currentHash;
    const status = document.querySelector('#cloud-status');
    if (status) status.textContent = 'Saved locally';
    isSaving = false;
    if (pendingSave) {
      pendingSave = false;
      save();
    }
  }
}

async function load() {
  let source = null;
  if (OBR.isAvailable) {
    try {
      source = await OBR.room.getMetadata();
    } catch (e) {
      console.warn('Failed to load OBR room metadata:', e);
    }
  }

  if (source && source[STORAGE_KEY]) {
    state = source[STORAGE_KEY];
  } else {
    try {
      const localStr = localStorage.getItem(STORAGE_KEY);
      if (localStr) {
        const parsed = JSON.parse(localStr);
        if (parsed && parsed[STORAGE_KEY]) {
          state = parsed[STORAGE_KEY];
        } else if (parsed && parsed.characters) {
          state = parsed;
        }
      }
    } catch (e) {}
  }

  state ??= { characters: {}, assignments: {}, rollHistory: [], initiativeTracker: {} };
  state.characters ??= {};
  state.assignments ??= {};
  state.rollHistory ??= [];
  state.initiativeTracker ??= {};

  try {
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
    const savedCharId = localStorage.getItem('terranova.activeCharId');
    if (savedCharId && state.characters[savedCharId]) {
      activeCharacterId = savedCharId;
    }
    const savedTab = localStorage.getItem('terranova.activeTab');
    if (savedTab && getAvailableTabs().includes(savedTab)) {
      activeTab = savedTab;
    }
  } catch (e) {}

  lastSavedHash = getSaveHash(state);

  if (OBR.isAvailable && user.role === 'GM' && !Object.keys(state.characters).length) {
    activeCharacterId = crypto.randomUUID();
    state.characters[activeCharacterId] = blankCharacter('Character 1');
    await save();
  }

  if (!activeCharacterId || !state.characters[activeCharacterId]) {
    if (user.role === 'GM') {
      activeCharacterId = Object.keys(state.characters)[0] || null;
    } else {
      const myChars = getAssignedCharacters(user.id);
      activeCharacterId = myChars[0]?.[0] || Object.keys(state.characters)[0] || null;
    }
  }

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...state, updatedAt: Date.now() }));
    localStorage.setItem('terranova.currentUser', JSON.stringify(user));
    localStorage.setItem('terranova.players', JSON.stringify(players));
    if (activeCharacterId) localStorage.setItem('terranova.activeCharId', activeCharacterId);
    if (activeTab) localStorage.setItem('terranova.activeTab', activeTab);
  } catch (e) {}
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
  });
}

async function initialise() {
  // Apply size as soon as script runs
  await restoreSavedWindowSize();

  if (OBR.isAvailable) {
    await new Promise((resolve) => OBR.onReady(resolve));
    isObrReady = true;
    user.id = await OBR.player.getId();
    user.name = await OBR.player.getName();
    user.role = await OBR.player.getRole();
    try {
      players = await OBR.party.getPlayers();
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
      user.name = player.name;
      user.role = player.role;
      if (user.role !== 'GM') {
        const myChars = getAssignedCharacters(user.id);
        if (!myChars.some(([id]) => id === activeCharacterId)) {
          activeCharacterId = myChars[0]?.[0] || null;
        }
        if (activeTab === 'Rolls & Ini') {
          activeTab = 'Infos';
        }
      }
      render();
    });

    OBR.room.onMetadataChange((metadata) => {
      if (metadata[STORAGE_KEY]) {
        const nextState = metadata[STORAGE_KEY];
        const nextHash = getSaveHash(nextState);
        if (nextHash === lastSavedHash) {
          return;
        }
        lastSavedHash = nextHash;
        state = nextState;
        state.characters ??= {};
        state.assignments ??= {};
        state.rollHistory ??= [];
        state.initiativeTracker ??= {};
        if (user.role === 'GM') {
          if (!activeCharacterId || !state.characters[activeCharacterId]) {
            activeCharacterId = Object.keys(state.characters)[0] || null;
          }
        } else {
          const myChars = getAssignedCharacters(user.id);
          if (!myChars.some(([id]) => id === activeCharacterId)) {
            activeCharacterId = myChars[0]?.[0] || null;
          }
        }
        render();
      }
    });

    OBR.party.onChange((nextPlayers) => {
      players = nextPlayers;
      render();
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
            rollInfo.count || 1,
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
            rollInfo.targetTier || 'standard'
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
          addRollToHistory({
            id: data.rollId || `stat_${data.timestamp}_${data.charName}`,
            timestamp: data.timestamp || Date.now(),
            type: 'stat',
            charName: data.charName || 'Character',
            playerName: data.playerName || 'Player',
            statName: data.statName,
            statValue: data.statValue,
            rankName: data.rankName,
            detail: `D100 = ${data.roll} (${data.statValue} ➔ ${data.rankName})`,
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
  app.querySelectorAll('[data-tab]').forEach((button) => button.addEventListener('click', () => { activeTab = button.dataset.tab; render(); }));
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
      if (name) {
        rollUniversalCheck(name, statVal, targetTier);
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
        } else if (tables[activeTab]) {
          const character = currentCharacter();
          if (character && canEditCurrent()) {
            if (!character.data.tables[activeTab]) {
              character.data.tables[activeTab] = Array.from({ length: activeTab === 'Note du joueur' ? 1 : 8 }, () => ({}));
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
  app.querySelector('#character-select')?.addEventListener('change', (event) => { activeCharacterId = event.target.value; render(); });
  app.querySelector('#player-character-select')?.addEventListener('change', (event) => { activeCharacterId = event.target.value; render(); });
  app.querySelector('#new-character')?.addEventListener('click', async () => { activeCharacterId = crypto.randomUUID(); state.characters[activeCharacterId] = blankCharacter(`Character ${Object.keys(state.characters).length + 1}`); render(); await save(); });
  app.querySelector('#delete-character')?.addEventListener('click', async () => {
    if (user.role !== 'GM') return;
    const character = currentCharacter();
    if (!character || !activeCharacterId) return;

    const charName = character.name || 'this character sheet';
    const confirmed = window.confirm(`Are you sure you want to delete "${charName}"? This action cannot be undone.`);
    if (!confirmed) return;

    const deletedId = activeCharacterId;
    delete state.characters[deletedId];

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

    const remainingIds = Object.keys(state.characters);
    if (remainingIds.length === 0) {
      activeCharacterId = crypto.randomUUID();
      state.characters[activeCharacterId] = blankCharacter('Character 1');
    } else {
      activeCharacterId = remainingIds[0];
    }

    await save();
    render();
  });
  app.querySelector('#owner-select')?.addEventListener('change', async (event) => {
    const character = currentCharacter();
    if (character) {
      character.ownerId = event.target.value || null;
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
    if (!character.data.tables[name]) {
      character.data.tables[name] = Array.from({ length: name === 'Note du joueur' ? 1 : DEFAULT_TABLE_ROWS }, () => ({}));
    }
    const newRowIndex = character.data.tables[name].length;
    character.data.tables[name].push({});
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
    await save();
    render();
  }));

  app.querySelector('#clear-initiative-btn')?.addEventListener('click', () => {
    if (window.confirm('Are you sure you want to clear all initiative scores?')) {
      state.initiativeTracker = {};
      queueSave(200);
      render();
    }
  });
  app.querySelector('#clear-rolls-btn')?.addEventListener('click', () => {
    if (window.confirm('Are you sure you want to clear the roll history?')) {
      state.rollHistory = [];
      queueSave(200);
      render();
    }
  });
  app.querySelector('#roll-unassigned-ini-btn')?.addEventListener('click', () => {
    rollAllUnassignedInitiative('First round');
  });
  app.querySelector('#roll-unassigned-next-ini-btn')?.addEventListener('click', () => {
    rollAllUnassignedInitiative('Next Rounds');
  });
  app.querySelectorAll('[data-ini-roll-char]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
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

  bindPageResizing();
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

initialise().catch((error) => {
  console.error(error);
  app.innerHTML = '<div class="empty-note">Unable to connect to the character sheet service.</div>';
});


