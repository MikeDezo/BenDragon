// Universal Resolution Chart Matrix Data (from Fiche de personnage.xlsx)
export const chartRankCodes = [
  '0', 'Fe', 'Pr', 'Ty', 'Gd', 'Ex', 'Rm', 'In', 'Am', 'Mn', 'Un', 'X', 'Y', 'Z',
  '|', '1000', '3000', '5000', 'B'
];

export const chartRankNames = [
  'Shift 0', 'Feeble', 'Poor', 'Typical', 'Good', 'Excelent', 'Remarkable', 'Incredible', 'Amazing', 'Monstrous', 'Unearthly', 'Shift X', 'Shift Y', 'Shift Z',
  '|', 'Class 1000', 'Class 3000', 'Class 5000', 'Beyond'
];

export const chartRankValues = [
  '0', '2', '4', '6', '10', '20', '30', '40', '50', '75', '100', '150', '250', '500',
  '|', '1000', '3000', '5000', '∞'
];

export const chartStatRanges = [
  '0', '1-2', '3-4', '5-7', '8-15', '16-25', '26-35', '36-45', '46-62', '63-87', '88-125', '126-175', '176-350', '351+',
  '|', '1000', '3000', '5000', 'Beyond'
];

export const chartRows = [
  { roll: '1', cells: ['1:crit', '1:crit', '1:crit', '1:crit', '1:crit', '1:crit', '1:crit', '1:crit', '1:crit', '1:crit', '1:crit', '1:crit', '1:crit', '1:crit', '|', '1:crit', '1:crit', '1:crit', '1:crit'] },
  { roll: '2-3', cells: [':white', ':white', ':white', ':white', ':white', ':white', ':white', ':white', ':white', ':white', ':white', ':white', ':white', ':white', '|', '2:green', '2:green', '2:green', '2:green'] },
  { roll: '4-6', cells: [':white', ':white', ':white', ':white', ':white', ':white', ':white', ':white', ':white', ':white', ':white', ':white', ':white', '4:green', '|', ':green', ':green', ':green', ':green'] },
  { roll: '7-10', cells: [':white', ':white', ':white', ':white', ':white', ':white', ':white', ':white', ':white', ':white', ':white', ':white', '7:green', ':green', '|', ':green', ':green', ':green', ':green'] },
  { roll: '11-15', cells: [':white', ':white', ':white', ':white', ':white', ':white', ':white', ':white', ':white', ':white', ':white', '11:green', ':green', ':green', '|', ':green', ':green', ':green', ':green'] },
  { roll: '16-20', cells: [':white', ':white', ':white', ':white', ':white', ':white', ':white', ':white', ':white', ':white', '16:green', ':green', ':green', ':green', '|', ':green', ':green', ':green', ':green'] },
  { roll: '21-25', cells: [':white', ':white', ':white', ':white', ':white', ':white', ':white', ':white', ':white', '21:green', ':green', ':green', ':green', ':green', '|', ':green', ':green', ':green', '21:yellow'] },
  { roll: '26-30', cells: [':white', ':white', ':white', ':white', ':white', ':white', ':white', ':white', '26:green', ':green', ':green', ':green', ':green', ':green', '|', ':green', ':green', '26:yellow', ':yellow'] },
  { roll: '31-35', cells: [':white', ':white', ':white', ':white', ':white', ':white', ':white', '31:green', ':green', ':green', ':green', ':green', ':green', ':green', '|', ':green', '31:yellow', ':yellow', ':yellow'] },
  { roll: '36-40', cells: [':white', ':white', ':white', ':white', ':white', ':white', '36:green', ':green', ':green', ':green', ':green', ':green', ':green', '36:yellow', '|', '36:yellow', ':yellow', ':yellow', ':yellow'] },
  { roll: '41-45', cells: [':white', ':white', ':white', ':white', ':white', '41:green', ':green', ':green', ':green', ':green', ':green', '41:yellow', '41:yellow', ':yellow', '|', ':yellow', ':yellow', ':yellow', ':yellow'] },
  { roll: '46-50', cells: [':white', ':white', ':white', ':white', '46:green', ':green', ':green', ':green', ':green', ':green', '46:yellow', ':yellow', ':yellow', ':yellow', '|', ':yellow', ':yellow', ':yellow', ':yellow'] },
  { roll: '51-55', cells: [':white', ':white', ':white', '51:green', ':green', ':green', ':green', ':green', ':green', '51:yellow', ':yellow', ':yellow', ':yellow', ':yellow', '|', ':yellow', ':yellow', ':yellow', ':yellow'] },
  { roll: '56-60', cells: [':white', ':white', '56:green', ':green', ':green', ':green', ':green', ':green', '56:yellow', ':yellow', ':yellow', ':yellow', ':yellow', ':yellow', '|', ':yellow', ':yellow', ':yellow', ':yellow'] },
  { roll: '61-65', cells: [':white', '61:green', ':green', ':green', ':green', ':green', ':green', '61:yellow', ':yellow', ':yellow', ':yellow', ':yellow', ':yellow', ':yellow', '|', ':yellow', ':yellow', ':yellow', '61:red'] },
  { roll: '66-70', cells: ['66:green', ':green', ':green', ':green', ':green', ':green', '66:yellow', ':yellow', ':yellow', ':yellow', ':yellow', ':yellow', ':yellow', ':yellow', '|', ':yellow', ':yellow', '66:red', ':red'] },
  { roll: '71-75', cells: [':green', ':green', ':green', ':green', ':green', '71:yellow', ':yellow', ':yellow', ':yellow', ':yellow', ':yellow', ':yellow', ':yellow', ':yellow', '|', ':yellow', '71:red', ':red', ':red'] },
  { roll: '76-80', cells: [':green', ':green', ':green', ':green', '76:yellow', ':yellow', ':yellow', ':yellow', ':yellow', ':yellow', ':yellow', ':yellow', ':yellow', '76:red', '|', '76:red', ':red', ':red', ':red'] },
  { roll: '81-85', cells: [':green', ':green', ':green', '81:yellow', ':yellow', ':yellow', ':yellow', ':yellow', ':yellow', ':yellow', ':yellow', '81:red', '81:red', ':red', '|', ':red', ':red', ':red', ':red'] },
  { roll: '86-90', cells: [':green', ':green', '86:yellow', ':yellow', ':yellow', ':yellow', ':yellow', ':yellow', ':yellow', '86:red', '86:red', ':red', ':red', ':red', '|', ':red', ':red', ':red', ':red'] },
  { roll: '91-94', cells: [':green', '91:yellow', ':yellow', ':yellow', ':yellow', ':yellow', ':yellow', '91:red', '91:red', ':red', ':red', ':red', ':red', ':red', '|', ':red', ':red', ':red', ':red'] },
  { roll: '95-97', cells: ['95:yellow', ':yellow', ':yellow', ':yellow', ':yellow', '95:red', '95:red', ':red', ':red', ':red', ':red', ':red', ':red', ':red', '|', ':red', ':red', ':red', ':red'] },
  { roll: '98-99', cells: [':yellow', ':yellow', ':yellow', '98:red', '98:red', ':red', ':red', ':red', ':red', ':red', ':red', ':red', ':red', ':red', '|', ':red', ':red', ':red', ':red'] },
  { roll: '100', cells: ['100:crit', '100:crit', '100:crit', '100:crit', '100:crit', '100:crit', '100:crit', '100:crit', '100:crit', '100:crit', '100:crit', '100:crit', '100:crit', '100:crit', '|', '100:crit', '100:crit', '100:crit', '100:crit'] }
];

export const statRankRanges = [
  { min: -Infinity, max: 0, code: '0', name: 'Shift 0', colIndex: 0 },
  { min: 1, max: 2, code: 'Fe', name: 'Feeble', colIndex: 1 },
  { min: 3, max: 4, code: 'Pr', name: 'Poor', colIndex: 2 },
  { min: 5, max: 7, code: 'Ty', name: 'Typical', colIndex: 3 },
  { min: 8, max: 15, code: 'Gd', name: 'Good', colIndex: 4 },
  { min: 16, max: 25, code: 'Ex', name: 'Excelent', colIndex: 5 },
  { min: 26, max: 35, code: 'Rm', name: 'Remarkable', colIndex: 6 },
  { min: 36, max: 45, code: 'In', name: 'Incredible', colIndex: 7 },
  { min: 46, max: 62, code: 'Am', name: 'Amazing', colIndex: 8 },
  { min: 63, max: 87, code: 'Mn', name: 'Monstrous', colIndex: 9 },
  { min: 88, max: 125, code: 'Un', name: 'Unearthly', colIndex: 10 },
  { min: 126, max: 175, code: 'X', name: 'Shift X', colIndex: 11 },
  { min: 176, max: 350, code: 'Y', name: 'Shift Y', colIndex: 12 },
  { min: 351, max: 999, code: 'Z', name: 'Shift Z', colIndex: 13 },
  { min: 1000, max: 2999, code: '1000', name: 'Class 1000', colIndex: 15 },
  { min: 3000, max: 4999, code: '3000', name: 'Class 3000', colIndex: 16 },
  { min: 5000, max: 9999, code: '5000', name: 'Class 5000', colIndex: 17 },
  { min: 10000, max: Infinity, code: 'B', name: 'Beyond', colIndex: 18 }
];

export const chartRollRanges = [
  { min: 1, max: 1, rowIndex: 0 },
  { min: 2, max: 3, rowIndex: 1 },
  { min: 4, max: 6, rowIndex: 2 },
  { min: 7, max: 10, rowIndex: 3 },
  { min: 11, max: 15, rowIndex: 4 },
  { min: 16, max: 20, rowIndex: 5 },
  { min: 21, max: 25, rowIndex: 6 },
  { min: 26, max: 30, rowIndex: 7 },
  { min: 31, max: 35, rowIndex: 8 },
  { min: 36, max: 40, rowIndex: 9 },
  { min: 41, max: 45, rowIndex: 10 },
  { min: 46, max: 50, rowIndex: 11 },
  { min: 51, max: 55, rowIndex: 12 },
  { min: 56, max: 60, rowIndex: 13 },
  { min: 61, max: 65, rowIndex: 14 },
  { min: 66, max: 70, rowIndex: 15 },
  { min: 71, max: 75, rowIndex: 16 },
  { min: 76, max: 80, rowIndex: 17 },
  { min: 81, max: 85, rowIndex: 18 },
  { min: 86, max: 90, rowIndex: 19 },
  { min: 91, max: 94, rowIndex: 20 },
  { min: 95, max: 97, rowIndex: 21 },
  { min: 98, max: 99, rowIndex: 22 },
  { min: 100, max: 100, rowIndex: 23 }
];

export function resolveUniversalRoll(statValue, rollNumber, columnShift = 0) {
  const numVal = parseFloat(statValue) || 0;
  const roll = Math.max(1, Math.min(100, Math.round(parseFloat(rollNumber) || 1)));
  const shift = parseInt(columnShift) || 0;

  const baseRankIdx = statRankRanges.findIndex((r) => numVal >= r.min && numVal <= r.max);
  const effectiveBaseIdx = baseRankIdx >= 0 ? baseRankIdx : 0;
  const targetIdx = Math.max(0, Math.min(statRankRanges.length - 1, effectiveBaseIdx + shift));
  const rank = statRankRanges[targetIdx];
  const rowInfo = chartRollRanges.find((r) => roll >= r.min && roll <= r.max) || chartRollRanges[0];

  const rowData = chartRows[rowInfo.rowIndex];
  const cell = rowData.cells[rank.colIndex] || ':white';
  const color = cell.includes(':') ? cell.split(':')[1] : (cell === '1:crit' || cell === '100:crit' ? 'crit' : 'white');

  let outcomeType = 'fail';
  let outcomeLabel = 'Failure';
  let colorTone = 'white';

  if (roll === 1) {
    outcomeType = 'crit-fail';
    outcomeLabel = 'Critical Failure';
    colorTone = 'crit';
  } else if (roll === 100) {
    outcomeType = 'crit-success';
    outcomeLabel = 'Critical Success';
    colorTone = 'crit';
  } else if (color === 'green') {
    outcomeType = 'green';
    outcomeLabel = 'Green Success';
    colorTone = 'green';
  } else if (color === 'yellow') {
    outcomeType = 'yellow';
    outcomeLabel = 'Yellow Success';
    colorTone = 'yellow';
  } else if (color === 'red') {
    outcomeType = 'red';
    outcomeLabel = 'Red Success';
    colorTone = 'red';
  } else {
    outcomeType = 'fail';
    outcomeLabel = 'Failure';
    colorTone = 'white';
  }

  return {
    statValue: numVal,
    roll,
    rankCode: rank.code,
    rankName: rank.name,
    colIndex: rank.colIndex,
    rowIndex: rowInfo.rowIndex,
    colorTone,
    outcomeType,
    outcomeLabel,
    columnShift: shift
  };
}

