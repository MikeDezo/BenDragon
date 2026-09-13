import './character-sheet.css';
import OBR from '@owlbear-rodeo/sdk';
import { chartRankCodes, chartRankNames, chartRankValues, chartStatRanges, chartRows, resolveUniversalRoll } from './universal-chart-data.js';
import sadhornUrl from '../sounds/sadhorn.mp3';
import wowUrl from '../sounds/wow.mp3';

const tabs = [
  'Infos', 'Stats', 'Action Types', 'Skills', 'Spell', 'Specialisations',
  'Weapons', 'Armor', 'Inventory', 'Relations', 'Monture', 'Note du joueur',
  'Unique Power', 'Universale Chart'
];
const STORAGE_KEY = 'terranova.characterSheets';
const infoFields = [['Player Name', 'playerName'], ['Name', 'name'], ['Gender', 'gender'], ['Origins', 'origins'], ['Age', 'age'], ['Heigth', 'height'], ['Weigth', 'weight'], ['Eyes Color', 'eyesColor'], ['Hairs Color', 'hairColor'], ['Skin Color', 'skinColor'], ['Languages', 'languages'], ['Alphabet', 'alphabet'], ['Gods', 'gods'], ['Xp to spend/Total', 'xp'], ['BackGround', 'background']];
const stats = ['Fighting', 'Strength', 'Agility', 'Endurance', 'Speed', 'Intelligence', 'Wisdom', 'Intuition', 'Psyche', 'Luck', 'Karma'];
const tables = {
  'Action Types': ['Action Type', 'Description', 'Critical 1', 'Critical 100', 'Critical Red'], Skills: ['Skill Type', 'Stat', 'CS Level', 'Focus Cost', 'White', 'Green', 'Yellow', 'Red'], Spell: ['Scell Value', 'Mana Cost', 'Scells', 'Intention', 'Description'], Specialisations: ['Specialisations Initiative Bonuses', 'Actual LVL', 'Touch Bonus', 'Potential Bonus', 'Special Effect', 'Ini Bonus'], Weapons: ['Name', 'Touch Stat', 'Damage Bonus Stat', 'Effective Range', 'Yellow Range', 'Red Range', 'Damage', 'Ammo', 'Quality'], Armor: ['Name', 'Base Armor', 'Emplacements runiques', 'Runes', 'Quality'], Inventory: ['Object', 'Qte', 'Description', 'Localisation'], Relations: ['Name', 'Link', 'Relation type', 'Unlocked', 'Unlockable'], Monture: ['Name', 'Type', 'Speed', 'Armor', 'Notes'], 'Note du joueur': ['Note'], 'Unique Power': ['Name', 'Description', 'Cost'], 'Universale Chart': ['Class', 'Poor', 'Typical', 'Good', 'Excelent', 'Remarkable', 'Incredible', 'Amazing', 'Monstrous', 'Unearthly']
};

const app = document.querySelector('#root');
let activeTab = 'Infos';
let state = { characters: {}, assignments: {} };
let user = { id: 'local-player', name: 'Local Player', role: 'GM' };
let players = [];
let activeCharacterId = null;

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

  return `<div class="roll-result-banner banner-${activeRollResult.colorTone}">
    <div class="roll-result-info">
      <div class="roll-result-title">
        <span class="roll-char-name">${esc(activeRollResult.charName)}</span>
        <span class="roll-stat-tag">${esc(activeRollResult.statName)} (Value: <strong>${activeRollResult.statValue}</strong> &rarr; Rank: <strong>${esc(activeRollResult.rankName)}</strong>)</span>
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

function displayAndAnnounceInitiativeResult(label, bonus, d12Val, total, charName, playerName, broadcast = true) {
  activeRollResult = {
    type: 'initiative',
    label,
    bonus,
    d12: d12Val,
    total,
    colorTone: 'green',
    charName: charName || 'Character',
    playerName: playerName || 'Player',
    timestamp: Date.now()
  };

  if (broadcast && OBR.isAvailable && OBR.broadcast) {
    try {
      OBR.broadcast.sendMessage('terranova/stat-roll-result', activeRollResult, { destination: 'ALL' });
    } catch (e) {}
  }

  if (OBR.isAvailable && OBR.notification?.show) {
    const bonusStr = bonus > 0 ? `+ ${bonus}` : (bonus < 0 ? `- ${Math.abs(bonus)}` : '');
    OBR.notification.show(
      `⚔️ ${activeRollResult.charName} (${playerName || 'Player'}) rolled Initiative (${label}): 1D12 (${d12Val}) ${bonusStr} = ${total}`,
      'DEFAULT'
    );
  }

  render();
}

function displayAndAnnounceRollResult(statName, statValue, rolledTotal, charName, playerName, broadcast = true, rollId = null) {
  const resolution = resolveUniversalRoll(statValue, rolledTotal);
  const currentRollId = rollId || `roll_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
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
    outcomeLabel: resolution.outcomeLabel,
    charName: charName || 'Character',
    playerName: playerName || 'Player',
    timestamp: Date.now()
  };

  playCritSound(resolution.outcomeType, currentRollId);

  if (broadcast && OBR.isAvailable && OBR.broadcast) {
    try {
      OBR.broadcast.sendMessage('terranova/stat-roll-result', activeRollResult, { destination: 'ALL' });
    } catch (e) {}
  }

  if (OBR.isAvailable && OBR.notification?.show) {
    const isSuccess = resolution.outcomeType === 'green' || resolution.outcomeType === 'yellow' || resolution.outcomeType === 'red' || resolution.outcomeType === 'crit-success';
    OBR.notification.show(
      `🎲 ${activeRollResult.charName} (${playerName || 'Player'}) rolled ${statName} [${activeRollResult.statValue} ➔ ${resolution.rankName}]: D100 = ${resolution.roll} ➔ ${resolution.outcomeLabel.toUpperCase()}`,
      isSuccess ? 'DEFAULT' : 'WARNING'
    );
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
    displayAndAnnounceInitiativeResult(label, bonus, d12, total, charName, playerName, false);
  }
}

async function rollDicePlus(statName) {
  const character = currentCharacter();
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

  const specRows = character.data.tables?.Specialisations || [];

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

        <!-- Row 15: Specialisations Initiative Bonuses Header -->
        <div class="excel-row spec-header-row">
          <div class="excel-cell bg-light text-bold header-banner">Specialisations Initiative Bonuses</div>
        </div>

        <!-- Rows 16-21: 9 Specialisations slots in 3 columns x 3 rows -->
        <div class="excel-specs-grid">
          ${[0, 1, 2, 3, 4, 5, 6, 7, 8].map((i) => {
            const row = specRows[i] || [];
            const specName = row[0] || st[`specName_${i}`] || '';
            const specIni = Number(row[5] || st[`specIni_${i}`] || 0) || 0;
            const firstRoundVal = specName ? (specIni + firstRoundBonus) : '';
            const nextRoundsVal = specName ? (specIni + nextRoundsBonus) : '';

            return `<div class="spec-card-slot">
              <div class="spec-name-box bg-yellow">
                ${specRows[i] && specRows[i][0] !== undefined 
                  ? `<span class="spec-name-text">${esc(specName || `Spec ${i + 1}`)}</span>` 
                  : editable(`stats.specName_${i}`, specName, 'stat-input-cell spec-name-input', `Spec ${i + 1}`)}
              </div>
              <div class="spec-values-box">
                <div class="spec-ini-cell bg-blue rollable-stat" data-roll-initiative="${esc(specName || `Spec ${i + 1}`)} (First round)" data-bonus="${firstRoundVal !== '' ? firstRoundVal : 0}" title="Click to roll Initiative for ${esc(specName || `Spec ${i + 1}`)} (First round): 1D12 + ${firstRoundVal !== '' ? firstRoundVal : 0}">
                  <span class="spec-ini-val" id="calc-spec-fr-${i}">${firstRoundVal !== '' ? firstRoundVal : '-'}</span>
                </div>
                <div class="spec-ini-cell bg-coral rollable-stat" data-roll-initiative="${esc(specName || `Spec ${i + 1}`)} (Next rounds)" data-bonus="${nextRoundsVal !== '' ? nextRoundsVal : 0}" title="Click to roll Initiative for ${esc(specName || `Spec ${i + 1}`)} (Next rounds): 1D12 + ${nextRoundsVal !== '' ? nextRoundsVal : 0}">
                  <span class="spec-ini-val" id="calc-spec-nr-${i}">${nextRoundsVal !== '' ? nextRoundsVal : '-'}</span>
                </div>
              </div>
            </div>`;
          }).join('')}
        </div>
      </div>
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

  const specRows = character.data.tables?.Specialisations || [];

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

  for (let i = 0; i < 9; i++) {
    const row = specRows[i] || [];
    const specName = row[0] || st[`specName_${i}`] || '';
    const specIni = Number(row[5] || st[`specIni_${i}`] || 0) || 0;
    const frVal = specName ? (specIni + firstRoundBonus) : '-';
    const nrVal = specName ? (specIni + nextRoundsBonus) : '-';

    const frSlot = app.querySelector(`#calc-spec-fr-${i}`);
    if (frSlot) {
      frSlot.textContent = frVal;
      const frCell = frSlot.closest('.spec-ini-cell');
      if (frCell) {
        frCell.dataset.bonus = frVal !== '-' ? frVal : 0;
        frCell.title = `Click to roll Initiative for ${specName || `Spec ${i + 1}`} (First round): 1D12 + ${frVal !== '-' ? frVal : 0}`;
      }
    }

    const nrSlot = app.querySelector(`#calc-spec-nr-${i}`);
    if (nrSlot) {
      nrSlot.textContent = nrVal;
      const nrCell = nrSlot.closest('.spec-ini-cell');
      if (nrCell) {
        nrCell.dataset.bonus = nrVal !== '-' ? nrVal : 0;
        nrCell.title = `Click to roll Initiative for ${specName || `Spec ${i + 1}`} (Next rounds): 1D12 + ${nrVal !== '-' ? nrVal : 0}`;
      }
    }
  }
}

function universalChartPage() {
  return `<section><h2 class="section-title">Universale Chart</h2>${rollResultBannerHtml()}${universalChartTableHtml()}</section>`;
}

function tablePage(name, character) {
  const headers = tables[name];
  const rows = character.data.tables[name] || Array.from({ length: name === 'Note du joueur' ? 1 : 8 }, () => ({}));
  return `<section><h2 class="section-title">${esc(name)}</h2><div class="table-wrap"><table class="sheet-table"><thead><tr>${headers.map((header) => `<th>${esc(header)}</th>`).join('')}</tr></thead><tbody>${rows.map((row, rowIndex) => `<tr>${headers.map((header, columnIndex) => `<td>${editable(`tables.${name}.${rowIndex}.${columnIndex}`, row[columnIndex] || '', 'cell-input')}</td>`).join('')}</tr>`).join('')}</tbody></table></div><button class="add-row" data-add-row="${esc(name)}">+ Add row</button></section>`;
}

function pageFor(character) {
  if (activeTab === 'Infos') return infoPage(character);
  if (activeTab === 'Stats') return statsPage(character);
  if (activeTab === 'Universale Chart') return universalChartPage();
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
        <span class="cloud-status" id="cloud-status">Cloud ready</span>
      </div>`;
    } else if (myChars.length === 1 || character) {
      return `<div class="sheet-controls">
        <span class="control-note">Assigned sheet: <strong>${esc(character?.name || 'Character')}</strong></span>
        ${fontControl}
        <span class="cloud-status" id="cloud-status">Cloud ready</span>
      </div>`;
    }
    return `<div class="sheet-controls">
      <span class="control-note">No character sheet assigned by DM</span>
      ${fontControl}
      <span class="cloud-status" id="cloud-status">Cloud ready</span>
    </div>`;
  }

  const options = Object.entries(state.characters).map(([id, item]) => `<option value="${esc(id)}" ${id === activeCharacterId ? 'selected' : ''}>${esc(item.name || id)}</option>`).join('');
  const playerOptions = players.map((player) => `<option value="${esc(player.id)}" ${character?.ownerId === player.id ? 'selected' : ''}>${esc(player.name)} (${player.role})</option>`).join('');
  return `<div class="sheet-controls"><label>Character <select id="character-select">${options || '<option>No sheets</option>'}</select></label><button class="toolbar-button" id="new-character">New sheet</button>${character ? `<button class="toolbar-button danger" id="delete-character" title="Delete current character sheet">Delete sheet</button>` : ''}${character ? `<label>Sheet Name <input type="text" id="sheet-name-input" class="sheet-name-input" value="${esc(character.name || '')}" placeholder="Sheet name" /></label>` : ''}<label>Assign to <select id="owner-select"><option value="">Unassigned</option>${playerOptions}</select></label>${fontControl}<span class="cloud-status" id="cloud-status">Cloud ready</span></div>`;
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
      <div class="page-resize-handle page-resize-r" data-direction="r" title="Drag right edge to resize width"></div>
      <div class="page-resize-handle page-resize-b" data-direction="b" title="Drag bottom edge to resize height"></div>
      <div class="page-resize-handle page-resize-l" data-direction="l" title="Drag left edge to resize width"></div>
      <div class="page-resize-handle page-resize-br" data-direction="br" title="Drag corner to resize page"></div>
      <div class="page-resize-handle page-resize-bl" data-direction="bl" title="Drag corner to resize page"></div>
      <header class="sheet-header">
        <div>
          <p class="sheet-kicker">Terranova / Fiche de personnage ${character?.name ? `— ${esc(character.name)}` : ''}</p>
          <h1 class="sheet-title">${esc(activeTab)}</h1>
        </div>
        <div class="sheet-meta">${user.role === 'GM' ? 'DM workspace' : 'Player workspace'}<br>${esc(user.name)}</div>
      </header>
      ${controls(character)}
      <nav class="sheet-tabs" aria-label="Character sheet tabs">
        ${tabs.map((tab) => `<button class="sheet-tab${tab === activeTab ? ' active' : ''}" data-tab="${esc(tab)}">${esc(tab)}</button>`).join('')}
      </nav>
      <div class="sheet-body">
        <div class="sheet-status">
          <span>WORKSHEET <strong>${esc(activeTab)}</strong></span>
          <span>${character ? 'INSTANT SAVE ENABLED' : 'WAITING FOR DM ASSIGNMENT'}</span>
        </div>
        ${character ? pageFor(character) : '<div class="empty-note">The DM has not assigned a character sheet to this player yet.</div>'}
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
  parts.slice(0, -1).forEach((part) => { target[part] ??= {}; target = target[part]; });
  target[parts.at(-1)] = value;
}

let saveTimeout = null;
let isSaving = false;
let pendingSave = false;
let lastSavedHash = null;

function getSaveHash(data) {
  try {
    return JSON.stringify({ characters: data?.characters || {}, assignments: data?.assignments || {} });
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

  state ??= { characters: {}, assignments: {} };
  state.characters ??= {};
  state.assignments ??= {};

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
    if (savedTab && tabs.includes(savedTab)) {
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

async function doSyncObrSize(w, h) {
  if (!OBR.isAvailable || !OBR.action) return;
  if (isObrResizing) {
    pendingObrSize = { w, h };
    return;
  }
  isObrResizing = true;
  try {
    const promises = [];
    if (OBR.action.setWidth) promises.push(OBR.action.setWidth(w));
    if (OBR.action.setHeight) promises.push(OBR.action.setHeight(h));
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
      }, 100);
    }
  }
}

function scheduleSyncObrSize(w, h, immediate = false) {
  if (!OBR.isAvailable || !OBR.action) return;

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
  const THROTTLE_MS = 200;

  if (timeSinceLast >= THROTTLE_MS && !isObrResizing) {
    if (obrSyncTimeout) {
      clearTimeout(obrSyncTimeout);
      obrSyncTimeout = null;
    }
    doSyncObrSize(w, h);
  } else {
    if (!obrSyncTimeout) {
      const delay = Math.max(50, THROTTLE_MS - timeSinceLast);
      obrSyncTimeout = setTimeout(() => {
        obrSyncTimeout = null;
        doSyncObrSize(w, h);
      }, delay);
    } else {
      pendingObrSize = { w, h };
    }
  }
}

function applyPageSize(w, h, persist = true) {
  const clampedW = Math.max(480, Math.min(2560, Math.round(w)));
  const clampedH = Math.max(400, Math.min(2000, Math.round(h)));

  document.documentElement.style.setProperty('--sheet-width', `${clampedW}px`);
  document.documentElement.style.setProperty('--sheet-height', `${clampedH}px`);

  scheduleSyncObrSize(clampedW, clampedH, persist);

  if (persist) {
    try {
      localStorage.setItem('terranova.windowDimensions', JSON.stringify({ width: clampedW, height: clampedH }));
    } catch (e) {}
  }
}

async function restoreSavedWindowSize() {
  try {
    const saved = JSON.parse(localStorage.getItem('terranova.windowDimensions') || 'null');
    if (saved?.width && saved?.height) {
      applyPageSize(saved.width, saved.height, false);
    }
  } catch (e) {}
}

async function initialise() {
  if (OBR.isAvailable) {
    await new Promise((resolve) => OBR.onReady(resolve));
    user.id = await OBR.player.getId();
    user.name = await OBR.player.getName();
    user.role = await OBR.player.getRole();
    try {
      players = await OBR.party.getPlayers();
    } catch (e) {
      console.warn('Failed to get players:', e);
    }

    OBR.player.onChange((player) => {
      user.name = player.name;
      user.role = player.role;
      if (user.role !== 'GM') {
        const myChars = getAssignedCharacters(user.id);
        if (!myChars.some(([id]) => id === activeCharacterId)) {
          activeCharacterId = myChars[0]?.[0] || null;
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
        if (rollInfo.type === 'initiative') {
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
            isMyRoll
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
            rollInfo.rollId
          );
        }
      } else {
        const isD100 = data.diceNotation?.toLowerCase().includes('d100') || data.diceCounts?.d100 > 0;
        if (isD100) {
          const finalRoll = typeof rawDie === 'number' ? rawDie : (typeof totalVal === 'number' ? totalVal : null);
          if (finalRoll === 1) {
            playCritSound('crit-fail', data.rollId || Date.now());
          } else if (finalRoll === 100) {
            playCritSound('crit-success', data.rollId || Date.now());
          }
        }
      }
    });

    OBR.broadcast.onMessage('terranova/stat-roll-result', (event) => {
      if (event.data && (typeof event.data.roll === 'number' || typeof event.data.total === 'number')) {
        activeRollResult = event.data;
        const outcome = event.data.outcomeType || (event.data.roll === 1 ? 'crit-fail' : (event.data.roll === 100 ? 'crit-success' : null));
        if (outcome) {
          playCritSound(outcome, event.data.rollId || event.data.timestamp);
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
    input.addEventListener('input', () => {
      setPath(input.dataset.path, input.value);
      if (activeTab === 'Stats') {
        updateStatsCalculations();
      }
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
  app.querySelectorAll('[data-add-row]').forEach((button) => button.addEventListener('click', async () => {
    const character = currentCharacter();
    if (!character || !canEditCurrent()) return;
    const name = button.dataset.addRow;
    if (!character.data.tables[name]) {
      character.data.tables[name] = Array.from({ length: name === 'Note du joueur' ? 1 : 8 }, () => ({}));
    }
    const newRowIndex = character.data.tables[name].length;
    character.data.tables[name].push({});
    await save();
    const targetPath = `tables.${name}.${newRowIndex}.0`;
    render(targetPath, true);
  }));

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
  });
}

initialise().catch((error) => {
  console.error(error);
  app.innerHTML = '<div class="empty-note">Unable to connect to the character sheet service.</div>';
});


