// ==========================================================================
// PoE2 JSON Generator
// スプレッドシートからコピーしたTSVデータをJSONに変換する
// ==========================================================================

const COPY_BTN_DEFAULT_TEXT = '📋 変換してコピー';

const DOM = {
  inputArea: document.getElementById('inputArea'),
  outputJsonArea: document.getElementById('outputJsonArea'),
  errorMessage: document.getElementById('errorMessage'),
  processBtn: document.getElementById('processBtn'),
  resetBtn: document.getElementById('resetBtn')
};

let currentJson = null;
let copyTimer = null;

// ==========================================================================
// TSVパース
// ==========================================================================

/**
 * タブ区切りテキストを2次元配列に変換する。
 * ダブルクォートで囲まれたセル内のタブ・改行・エスケープされた""を扱える。
 */
function parseTSV(text) {
  const rows = [];
  let row = [], cell = '', inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i], nextChar = text[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') { cell += '"'; i++; }
      else { inQuotes = !inQuotes; }
    } else if (char === '\t' && !inQuotes) {
      row.push(cell); cell = '';
    } else if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && nextChar === '\n') i++;
      row.push(cell); rows.push(row); row = []; cell = '';
    } else {
      cell += char;
    }
  }
  if (cell !== '' || row.length > 0) { row.push(cell); rows.push(row); }
  if (inQuotes) throw new Error('引用符（"）が閉じられていません。');

  return rows;
}

/**
 * セルの文字列値を、JSONに適した型（数値・真偽値・区切り配列・文字列）へ変換する。
 * Number.isFinite() を使うことで、"Infinity" のような特殊文字列が
 * 数値として素通りしてJSON上でnullになってしまう問題を避けている。
 */
function formatValue(val) {
  if (val == null) return '';
  const str = val.trim();
  if (str === '') return '';

  if (str.includes('||')) {
    return str.split('||')
      .map(item => formatValue(item))
      .filter(item => item !== '');
  }

  const lower = str.toLowerCase();
  if (lower === 'true') return true;
  if (lower === 'false') return false;

  const num = Number(str);
  if (Number.isFinite(num)) {
    return num;
  }

  return str;
}

// ==========================================================================
// データ変換処理
// ==========================================================================

/**
 * ヘッダー行を検証し、正規化されたヘッダー配列とID列のインデックスを返す。
 */
function parseHeaders(headerRow) {
  const headers = headerRow.map(h => h ? h.trim() : '');

  const duplicates = headers.filter((h, i) => h && headers.indexOf(h) !== i);
  if (duplicates.length > 0) {
    throw new Error('⚠ 列名が重複しています: ' + [...new Set(duplicates)].join(', '));
  }

  const idIndex = headers.findIndex(h => h.toLowerCase() === 'id');
  if (idIndex === -1) {
    throw new Error('ID列が見つかりません。');
  }

  return { headers, idIndex };
}

/**
 * データ行からオブジェクトの配列を組み立てる。
 * IDが空の行はスキップし、IDの重複はエラーにする。
 */
function buildDataList(validRows, headers, idIndex) {
  const dataList = [];
  const seenIds = new Set();
  const headerLen = headers.length;

  for (let i = 1; i < validRows.length; i++) {
    const row = validRows[i];
    const rawId = row[idIndex];
    if (rawId == null || rawId.trim() === '') continue;

    const idValue = rawId.trim().toLowerCase();
    if (seenIds.has(idValue)) {
      throw new Error(`⚠ IDが重複しています: ${idValue}`);
    }
    seenIds.add(idValue);

    const obj = {};
    for (let j = 0; j < headerLen; j++) {
      const h = headers[j];
      if (!h) continue;
      obj[h] = (j === idIndex) ? idValue : formatValue(row[j]);
    }
    dataList.push(obj);
  }

  return dataList;
}

function processData() {
  resetUI();
  try {
    const text = DOM.inputArea.value;
    if (!text.trim()) throw new Error('データが入力されていません');

    const rawData = parseTSV(text);
    const validRows = rawData.filter(row => row.some(cell => cell && cell.trim() !== ''));
    if (validRows.length < 2) throw new Error('有効なデータが存在しない、またはヘッダーしかありません');

    const { headers, idIndex } = parseHeaders(validRows[0]);
    const dataList = buildDataList(validRows, headers, idIndex);

    currentJson = dataList;
    DOM.outputJsonArea.value = JSON.stringify(currentJson, null, 2);
  } catch (e) {
    DOM.errorMessage.textContent = e.message;
  }
}

// ==========================================================================
// コピー・リセット
// ==========================================================================

function setCopyButtonState(stateClass, text) {
  const btn = DOM.processBtn;
  btn.textContent = text;
  btn.classList.remove('is-success', 'is-error');
  if (stateClass) btn.classList.add(stateClass);
}

async function copyJSON() {
  if (!currentJson) return;

  if (copyTimer) clearTimeout(copyTimer);

  try {
    if (!navigator.clipboard || !window.isSecureContext) {
      throw new Error('Clipboard API not available');
    }
    await navigator.clipboard.writeText(DOM.outputJsonArea.value);
    setCopyButtonState('is-success', '✅ コピーしました');
  } catch (e) {
    DOM.outputJsonArea.select();
    setCopyButtonState('is-error', '⚠ Ctrl+Cでコピーしてください');
  }

  copyTimer = setTimeout(() => setCopyButtonState(null, COPY_BTN_DEFAULT_TEXT), 2000);
}

/**
 * 変換とコピーをまとめて実行する。
 * 変換に失敗した場合はcurrentJsonがnullのままなので、
 * copyJSON()側の`if (!currentJson) return;`により後続のコピー処理は走らない。
 */
async function processAndCopy() {
  processData();
  await copyJSON();
}

function resetUI() {
  DOM.errorMessage.textContent = '';
  DOM.outputJsonArea.value = '';
  currentJson = null;
}

function resetForm() {
  DOM.inputArea.value = '';
  resetUI();
}

// ==========================================================================
// 初期化
// ==========================================================================

function setupEventListeners() {
  DOM.inputArea.addEventListener('input', () => {
    DOM.errorMessage.textContent = '';
  });
  DOM.processBtn.addEventListener('click', processAndCopy);
  DOM.resetBtn.addEventListener('click', resetForm);
}

setupEventListeners();
