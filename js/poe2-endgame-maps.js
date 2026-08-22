import {
  RESIST_TYPES,
  StorageService,
  initImageServices,
  ImageModalService,
  createDiv,
  renderMultiLineCell,
  buildResistGrid,
  getResistIconPath,
  handleDropdownClick,
  applyFormatBodyClass,
  createFormatController,
  escapeHTML,
  splitLines,
  loadVersionedState,
  renderErrorBox,
  createLangDiv,
  createLanguageContainer,
  createDebouncedSaver,
  setupPersistenceEvents,
  setupImagePreviewEvents,
  fetchWithTimeout,
  describeLoadError,
} from './common.js';

// ==========================================
// 1. 定数・定義 (Constants & Definitions)
// ==========================================

const STORAGE_VERSION = 2;

const STORAGE_KEYS = {
  USER_STATE: 'poe2:userState'
};

const MARK_DEFINITIONS = {
  skull: { icon: '💀', title: '💀' }
};

const DUMMY_RESISTS = new Set([
  'ArmourWeak',
  'EvasionWeak',
  'ChaosWeak'
]);

// ローマ字入力の「まだ確定していない末尾」を曖昧マッチさせるための変換テーブル。
// 例えば「らくえん」を"rakue"まで入力した時点では、末尾の"e"はまだひらがなに
// 変換されずローマ字のまま残る。この末尾の子音（＋拗音用の半母音）を、
// 変換され得るひらがな候補の文字クラスに置き換えることで、
// 入力確定を待たずに検索結果へ反映できるようにする（下のcreateRegex()で使用）。
// キー: ローマ字の子音や拗音表記（k, ky, sh 等） / 値: マッチしうるひらがなの文字クラス
const ROMAJI_TO_KANA_REGEX = {
  'a': '[あぁ]', 'i': '[いぃ]', 'u': '[うぅ]', 'e': '[えぇ]', 'o': '[おぉ]',
  'k': '[かきくけこきゃきゅきょっ]', 'ky': '[きゃきゅきょっ]',
  's': '[さしすせそしゃしゅしょっ]', 'sh': '[しゃしゅしょしっ]', 'sy': '[しゃしゅしょっ]',
  't': '[たちつてとちゃちゅちょっ]', 'c': '[かきくけこさしすせそちゃちゅちょっ]', 'ch': '[ちゃちゅちょちっ]', 'ty': '[ちゃちゅちょっ]', 'cy': '[ちゃちゅちょっ]',
  'ts': '[つっ]', 'n': '[なにぬねのんにゃにゅにょっ]', 'ny': '[にゃにゅにょっ]',
  'h': '[はひふへほひゃひゅひょっ]', 'hy': '[ひゃひゅひょっ]',
  'f': '[ふぁふぃふふぇふぉっ]', 'fy': '[ふゃふゅふょっ]',
  'm': '[まみむめもみゃみゅみょっ]', 'my': '[みゃみゅみょっ]',
  'y': '[やゆよゃゅょっ]',
  'r': '[らりるれろりゃりゅりょっ]', 'ry': '[りゃりゅりょっ]',
  'w': '[わうをんっ]',
  'g': '[がぎぐげごぎゃぎゅぎょっ]', 'gy': '[ぎゃぎゅぎょっ]',
  'z': '[ざじずぜぞじゃじゅじょっ]', 'j': '[じゃじゅじょじっ]', 'zy': '[じゃじゅじょっ]', 'jy': '[じゃじゅじょっ]',
  'd': '[だぢづでどっ]', 'dy': '[ぢゃぢゅぢょっ]',
  'b': '[ばびぶべぼびゃびゅびょっ]', 'by': '[びゃびゅびょっ]',
  'p': '[ぱぴぷぺぽぴゃぴゅぴょっ]', 'py': '[ぴゃぴゅぴょっ]',
  'v': '[ゔぁゔぃゔゔぇゔぉっ]', 'vy': '[ゔゃゔゅゔょっ]',
  'q': '[くぁくぃくくぇくぉっ]', 'x': '[ぁぃぅぇぉっゃゅょ]', 'l': '[ぁぃぅぇぉっゃゅょ]'
};

const JA_COLLATOR = new Intl.Collator('ja', { numeric: true });
const EN_COLLATOR = new Intl.Collator('en', { numeric: true });

// 複数箇所で参照されるデータのフィールド名（タイポ検出・変更時の一括修正のために集約）
const FIELDS = {
  ACT: '元ボスアクト',
  AREA_JA: '元ボスエリア日',
  AREA_EN: '元ボスエリア英',
  RESIST: '耐性アイコン',
  KANA: 'よみがな',
  MAP_EN: 'マップ英'
};

// --- 列定義用ファクトリ関数 ---
const textCol = (id, defaultVisible = true, isSearchable = true) => ({
  id, className: 'text-multiline', label: id, defaultVisible, isSearchable, type: 'text'
});
const textMultilineCol = (id, defaultVisible = true, isSearchable = true) => ({
  id, className: 'text-multiline', label: id, defaultVisible, isSearchable, type: 'textMultiline'
});
const interleavedCol = (id, keys, isSearchable = true) => ({
  id, className: 'text-normal', label: id, defaultVisible: true, isSearchable, type: 'interleaved', keys
});
const interleavedMultilineCol = (id, keys, isSearchable = true) => ({
  id, className: 'text-normal', label: id, defaultVisible: true, isSearchable, type: 'interleavedMultiline', keys
});
const resistCol = () => ({
  id: FIELDS.RESIST, className: 'resist-icon', label: FIELDS.RESIST, defaultVisible: true, isSearchable: false, type: 'resistIcon'
});
const actAreaCol = () => ({
  id: '元ボスアクト/エリア', className: 'text-normal', label: '元ボスアクト/エリア', defaultVisible: true, isSearchable: true, type: 'actArea',
  searchKeys: [FIELDS.ACT, FIELDS.AREA_JA, FIELDS.AREA_EN]
});
const markCol = () => ({
  id: 'マーク', className: 'mark', label: 'マーク', defaultVisible: true, isSearchable: false, type: 'mark'
});

const bilingualKeys = base => [`${base}日`, `${base}英`];

const COLUMN_DEFINITIONS = [
  interleavedCol('マップ', bilingualKeys('マップ')),
  interleavedMultilineCol('ボス', [...bilingualKeys('ボス'), 'bossimage']),
  resistCol(),
  actAreaCol(),
  interleavedMultilineCol('元ボス', bilingualKeys('元ボス名')),
  textCol('元ボス特徴'),
  textMultilineCol('メモ'),
  markCol()
];

const createSorter = (key, collator, isDesc = false) => (a, b) => {
  const valA = a.data[key] || '';
  const valB = b.data[key] || '';
  const cmp = isDesc ? collator.compare(valB, valA) : collator.compare(valA, valB);
  return cmp || (a.cache.defaultOrder - b.cache.defaultOrder);
};

const SORTERS = {
  'default': (a, b) => a.cache.defaultOrder - b.cache.defaultOrder,
  'kana-asc': createSorter(FIELDS.KANA, JA_COLLATOR, false),
  'kana-desc': createSorter(FIELDS.KANA, JA_COLLATOR, true),
  'eng-asc': createSorter(FIELDS.MAP_EN, EN_COLLATOR, false),
  'eng-desc': createSorter(FIELDS.MAP_EN, EN_COLLATOR, true)
};

// ==========================================
// 2. ユーティリティ (Utilities & Helpers)
// ==========================================

function normalizeText(str) {
  if (!str) return '';
  return String(str).normalize('NFKC').replace(/[\u30a1-\u30f6]/g, m => String.fromCharCode(m.charCodeAt(0) - 0x60)).toLowerCase();
}

function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function createCell(className = '') {
  const td = document.createElement('td');
  if (className) td.className = className;
  return td;
}

// ==========================================
// 3. ストレージ・状態管理 (Storage & State)
// ==========================================

const AppState = {
  data: { items: [], itemMap: new Map() },
  ui: { currentSort: 'default' },
  filters: { text: '', resists: new Set(), marks: new Set() },
  stats: { visibleCount: 0, hasVisibleColumn: true },
  user: null
};

const DataStore = {
  setItems(items) {
    AppState.data.items = items;
    AppState.data.itemMap = new Map(items.map(item => [item.id, item]));
  },
  getById(id) {
    return AppState.data.itemMap.get(id);
  }
};

const ViewStore = {
  rows: new Map(),
  columns: new Map(),
  headers: new Map(),
  columnMenuItems: new Map(),
  sortItems: new Map(),
  resistFilters: new Map(),
  markFilters: new Map()
};

const UserStateService = {
  createDefaultColumns() {
    return Object.fromEntries(COLUMN_DEFINITIONS.map(col => [col.id, col.defaultVisible]));
  },
  normalizeColumns(savedColumns = {}) {
    savedColumns ??= {}; // 保存データのcolumnsがnullの場合に備えたガード（デフォルト引数はundefinedにしか効かないため）
    const defaults = this.createDefaultColumns();
    return Object.fromEntries(
      Object.keys(defaults).map(key => [key, savedColumns[key] ?? defaults[key]])
    );
  },
  load() {
    const saved = loadVersionedState(STORAGE_KEYS.USER_STATE, STORAGE_VERSION, () => ({
      marks: {},
      columns: this.createDefaultColumns(),
      format: 'ja-en'
    }));

    return {
      version: STORAGE_VERSION,
      marks: this.validateMarks(saved.marks),
      columns: this.normalizeColumns(saved.columns),
      format: typeof saved.format === 'string' ? saved.format : 'ja-en'
    };
  },
  validateMarks(rawMarks = {}) {
    rawMarks ??= {}; // 保存データのmarksがnullの場合に備えたガード（デフォルト引数はundefinedにしか効かないため）
    const validMarkKeys = new Set(Object.keys(MARK_DEFINITIONS));
    const validated = {};
    for (const [id, marks] of Object.entries(rawMarks)) {
      if (!Array.isArray(marks)) continue;
      const filtered = marks.filter(mark => validMarkKeys.has(mark));
      if (filtered.length > 0) validated[id] = filtered;
    }
    return validated;
  },
  save() {
    StorageService.save(STORAGE_KEYS.USER_STATE, AppState.user);
  }
}

const PersistenceService = createDebouncedSaver(() => UserStateService.save());

// ==========================================
// 4. サービス・ロジック (Services & Processors)
// ==========================================

const ItemFactory = {
  createSearchIndex(item, searchIndexKeys) {
    return searchIndexKeys.map(k => normalizeText(item[k])).filter(Boolean).join('\t');
  },
  createResistIndex(item) {
    return new Set(String(item[FIELDS.RESIST] || '-').replace(/\r\n/g, '\n').split(/[\n,]+/).map(r => r.trim()).filter(r => r && r !== '-'));
  },
  createEnhancedItem(item, idx, searchIndexKeys) {
    return {
      id: item.id,
      data: { ...item },
      user: { marks: new Set(AppState.user.marks[item.id] || []) },
      cache: {
        defaultOrder: idx,
        searchIndex: this.createSearchIndex(item, searchIndexKeys),
        resistIndex: this.createResistIndex(item),
        kanaIndex: normalizeText(item[FIELDS.KANA])
      },
      view: { visible: true, lastVisible: undefined, lastIsEven: undefined }
    };
  },
  buildItems(rawData) {
    const searchIndexKeys = COLUMN_DEFINITIONS
      .filter(d => d.isSearchable)
      .flatMap(d => d.searchKeys || d.keys || [d.id]);
    return rawData.map((item, idx) => this.createEnhancedItem(item, idx, searchIndexKeys));
  }
};

const SearchService = {
  /**
   * 検索キーワードを、IME入力途中の状態でもマッチできる正規表現に変換する。
   * wanakanaでひらがな変換した結果、末尾に変換しきれないローマ字が残っていたら、
   * その部分だけROMAJI_TO_KANA_REGEXの文字クラスに置き換えて「まだ確定していない
   * 1文字」を曖昧マッチさせる。変換や正規表現の構築に失敗した場合はnullを返し、
   * 呼び出し側（match()）で通常の部分一致検索にフォールバックする。
   */
  createRegex(rawKeyword) {
    if (!rawKeyword || typeof wanakana === 'undefined') return null;
    if (/([a-mop-z])\1{2,}/i.test(rawKeyword) || /n{4,}/i.test(rawKeyword)) return null;

    let hiraConverted = wanakana.toHiragana(rawKeyword, { IMEMode: true }).replace(/([a-z])\1+/gi, 'っ$1');
    const tailMatch = hiraConverted.match(/([a-z]+)$/i);

    try {
      if (tailMatch) {
        const tailAlpha = tailMatch[1].toLowerCase();
        const prefix = escapeRegExp(hiraConverted.slice(0, -tailAlpha.length));
        const regexSuffix = ROMAJI_TO_KANA_REGEX[tailAlpha];
        return new RegExp(prefix + (regexSuffix !== undefined ? regexSuffix : escapeRegExp(tailAlpha)));
      }
      return new RegExp(escapeRegExp(hiraConverted));
    } catch (e) { return null; }
  },
  match(item, ctx) {
    if (!ctx.rawKeyword) return true;
    const isRawMatch = (ctx.needsRegex && ctx.searchRegex)
      ? ctx.searchRegex.test(item.cache.searchIndex) || item.cache.searchIndex.includes(ctx.rawKeyword)
      : item.cache.searchIndex.includes(ctx.rawKeyword);
    let isKanaMatch = false;
    if (item.cache.kanaIndex) {
      isKanaMatch = ctx.needsRegex && ctx.searchRegex
        ? ctx.searchRegex.test(item.cache.kanaIndex)
        : item.cache.kanaIndex.includes(ctx.rawKeyword);
    }
    return isRawMatch || isKanaMatch;
  }
};

const FilterService = {
  apply() {
    const ctx = this.getFilterContext();
    AppState.stats.visibleCount = 0;
    AppState.stats.hasVisibleColumn = ctx.hasVisibleColumn;

    AppState.data.items.forEach(item => {
      item.view.visible = this.matchesFilter(item, ctx);
      if (item.view.visible) AppState.stats.visibleCount++;
    });
  },
  getFilterContext() {
    const rawKeyword = AppState.filters.text;
    const needsRegex = /[a-z]/i.test(rawKeyword);
    return {
      hasVisibleColumn: Object.values(AppState.user.columns).some(v => v),
      activeResists: Array.from(AppState.filters.resists),
      activeMarks: Array.from(AppState.filters.marks),
      rawKeyword, needsRegex,
      searchRegex: needsRegex ? SearchService.createRegex(rawKeyword) : null
    };
  },
  matchesFilter(item, ctx) {
    return ctx.hasVisibleColumn &&
      ctx.activeMarks.every(m => item.user.marks.has(m)) &&
      ctx.activeResists.every(r => item.cache.resistIndex.has(r)) &&
      SearchService.match(item, ctx);
  }
};

const RenderCoordinator = {
  refreshAll() {
    FilterService.apply();
    TableRenderer.updateTableState();
    FooterRenderer.updateFooter();
  },
  refreshColumns() {
    ColumnRenderer.updateButtonUI();
    COLUMN_DEFINITIONS.forEach(def => {
      ColumnRenderer.updateColumnVisibility(def.id, AppState.user.columns[def.id]);
    });
    TableRenderer.applyColumnWidths();
    ColumnRenderer.updateFirstVisibleCol();
    this.refreshAll();
  },
  refreshFilters() {
    FilterUIRenderer.updateResistUI();
    FilterUIRenderer.updateMarkUI();
    this.refreshAll();
  },
  refreshSort() {
    TableRenderer.reorderRows();
    TableRenderer.updateTableState();
  }
};

// ==========================================
// 5. DOM・UIレンダリング (DOM, Views & Renderers)
// ==========================================

const DOM = {
  initCache() {
    const map = {
      searchInput: 'searchInput', searchCounter: 'search-counter',
      resistGrid: 'resist-grid', markGrid: 'mark-grid',
      btnSortText: 'btn-sort-text', btnColumnText: 'btn-column-text',
      btnFormatText: 'btn-format-text', tbody: 'endgame-maps-table-body',
      loadingRow: 'loading-row', loadingCell: 'loading-cell',
      noResultRow: 'no-result-row', noResultCell: 'no-result-cell',
      msgEmptyData: 'msg-empty-data', msgNoColumn: 'msg-no-column', msgNoMatch: 'msg-no-match',
      fatalErrorMessage: 'fatal-error-message'
    };
    Object.entries(map).forEach(([prop, id]) => { this[prop] = document.getElementById(id); });
  },
  showFatalError(message) {
    const lines = Array.isArray(message) ? message : [message];
    renderErrorBox(this.fatalErrorMessage, lines);
  }
};

const UIFactory = {
  createMenuItem({ dataset = {}, text, checked = false }) {
    const div = document.createElement('div');
    div.className = `dropdown-item${checked ? ' is-checked' : ''}`;
    Object.assign(div.dataset, dataset);
    div.innerHTML = `<span class="checkmark">✔</span>${text}`;
    return div;
  },
  createFilterButton({ dataset = {}, title = '', iconType = 'text', iconValue = '', isDummy = false }) {
    const wrapper = document.createElement('div');
    wrapper.className = isDummy ? 'icon-dummy' : 'icon-wrapper';
    Object.assign(wrapper.dataset, dataset);
    wrapper.title = title;
    if (isDummy) { wrapper.textContent = '-'; return wrapper; }
    wrapper.setAttribute('aria-pressed', 'false');
    wrapper.innerHTML = `
      ${iconType === 'image' ? `<img src="${iconValue}" class="icon-filter" alt="${title}">` : `<span class="icon-filter">${iconValue}</span>`}
      <div class="badge-check">✔</div>
    `;
    return wrapper;
  }
};

function setupDynamicUI() {
  buildTableHeader();
  buildColumnMenu();
  buildResistFilter();
  buildMarkFilter();
  document.querySelectorAll('[data-sort]').forEach(el => { ViewStore.sortItems.set(el.dataset.sort, el); });
}

function buildTableHeader() {
  const headerRow = document.getElementById('endgame-maps-table-head-row');
  COLUMN_DEFINITIONS.forEach(def => {
    const th = document.createElement('th');
    th.className = `col-${def.className}`;
    th.textContent = def.label;
    headerRow.append(th);
    ViewStore.headers.set(def.id, th);
  });
}

function buildColumnMenu() {
  const colDropdown = document.getElementById('column-dropdown-content');
  COLUMN_DEFINITIONS.forEach(def => {
    const item = UIFactory.createMenuItem({
      dataset: { click: 'toggleColumn', column: def.id },
      text: def.label,
      checked: AppState.user.columns[def.id]
    });
    colDropdown.append(item);
    ViewStore.columnMenuItems.set(def.id, item);
  });
}

function buildResistFilter() {
  const suffixes = ['Weak', '', 'Strong'];
  const fragment = document.createDocumentFragment();
  suffixes.forEach(suffix => {
    RESIST_TYPES.forEach(type => {
      const key = `${type}${suffix}`;
      const btn = UIFactory.createFilterButton({
        dataset: { click: 'toggleResist', resist: key },
        title: key,
        iconType: 'image',
        iconValue: getResistIconPath(type, suffix || 'normal'),
        isDummy: DUMMY_RESISTS.has(key)
      });
      fragment.append(btn);
      if (!DUMMY_RESISTS.has(key)) ViewStore.resistFilters.set(key, btn);
    });
  });
  DOM.resistGrid.append(fragment);
}

function buildMarkFilter() {
  Object.entries(MARK_DEFINITIONS).forEach(([key, def]) => {
    const btn = UIFactory.createFilterButton({
      dataset: { click: 'toggleMark', mark: key },
      title: def.title,
      iconType: 'text',
      iconValue: def.icon
    });
    DOM.markGrid.append(btn);
    ViewStore.markFilters.set(key, btn);
  });
}

// メモ欄専用: 次の2パターンをリンクに変換するための正規表現（1回のマッチで両対応）。
// 1) "[表示文字](URL)"         → 「表示文字」というテキストのリンクになる（表示文字を自由に指定可）
//    例: "[動画](https://www.twitch.tv/videos/2852378489)" → 「動画」というリンク
// 2) "[]"で囲まない生のURL単体 → URLそのものをテキストにしたリンクになる（自動リンク化）
//    例: "https://www.twitch.tv/videos/2852378489" → そのURL文字列自体がリンクになる
const MEMO_LINK_REGEX = /\[([^\]\n]+)\]\((https?:\/\/[^\s)]+)\)|(https?:\/\/[^\s<>()]+)/g;

// メモ欄のテキストをHTML化する。common.js の formatMultilineHTML() (改行→<br>変換のみ) に
// 上記2パターンのリンク変換を加えたもの。メモ欄専用で、他の列では使用しない。
function formatMemoHTML(value) {
  if (value == null) return '';
  const text = String(value).trim();
  if (!text) return '';
  const escaped = escapeHTML(text);
  const withLinks = escaped.replace(MEMO_LINK_REGEX, (match, label, bracketUrl, rawUrl) => {
    const url = bracketUrl || rawUrl;
    const linkText = label || rawUrl;
    return `<a href="${url}" class="memo-link" target="_blank" rel="noopener noreferrer">${linkText}</a>`;
  });
  return withLinks.replace(/\n/g, '<br>');
}

// --- CELL_RENDERERS (独立したセル描画ロジック群) ---
const CELL_RENDERERS = {
  text: {
    getLineCount(item, def) { return 1; },
    render(td, item, def) {
      td.textContent = item.data[def.id] || '';
    }
  },
  textMultiline: {
    getLineCount(item, def) { return 1; },
    render(td, item, def) {
      td.innerHTML = formatMemoHTML(item.data[def.id]);
    }
  },
  interleaved: {
    getLineCount(item, def) { return 1; },
    render(td, item, def) {
      const jaText = String(item.data[def.keys[0]] || '').trim();
      const enText = String(item.data[def.keys[1]] || '').trim();
      if (!jaText && !enText) {
        td.textContent = '-';
        return;
      }
      td.append(createLanguageContainer(jaText, enText));
    }
  },
  interleavedMultiline: {
    getLineCount(item, def) {
      let max = 1;
      def.keys.forEach(k => {
        max = Math.max(max, splitLines(item.data[k]).length);
      });
      return max;
    },
    render(td, item, def, maxLines) {
      const jaLines = splitLines(item.data[def.keys[0]]);
      const enLines = splitLines(item.data[def.keys[1]]);
      const imgLines = def.keys[2] ? splitLines(item.data[def.keys[2]]) : [];

      const isAllEmpty = jaLines.every(l => !l) && enLines.every(l => !l);
      if (isAllEmpty && maxLines === 1) {
        td.textContent = '-';
        return;
      }

      renderMultiLineCell(td, maxLines, (itemWrapper, i) => {
        const jaText = jaLines[i] || '';
        const enText = enLines[i] || '';
        const imgSrc = imgLines[i] || '';

        if (!jaText && !enText) {
          itemWrapper.innerHTML = '<span class="text-muted">-</span>';
          return;
        }
        itemWrapper.append(createLanguageContainer(jaText, enText, imgSrc));
      });
    }
  },
  resistIcon: {
    getLineCount(item, def) {
      return splitLines(item.data[FIELDS.RESIST]).length || 1;
    },
    render(td, item, def, maxLines) {
      const resistLines = splitLines(item.data[FIELDS.RESIST]);
      if (resistLines.length === 0 && maxLines === 1) {
        td.textContent = '-';
        return;
      }

      renderMultiLineCell(td, maxLines, (itemWrapper, i) => {
        const resistText = resistLines[i] || '';
        if (!resistText) {
          itemWrapper.innerHTML = '<span class="text-muted">-</span>';
          return;
        }
        itemWrapper.append(buildResistGrid(resistText));
      });
    }
  },
  actArea: {
    getLineCount(item, def) {
      return 1;
    },
    render(td, item, def) {
      const actRaw = String(item.data[FIELDS.ACT] || '');
      const actNum = actRaw.replace(/[０-９]/g, s => String.fromCharCode(s.charCodeAt(0) - 0xFEE0));

      const areaJa = item.data[FIELDS.AREA_JA] || '';
      const areaEn = item.data[FIELDS.AREA_EN] || '';

      const combinedJa = [actRaw ? `${actRaw}章` : '', areaJa].filter(Boolean).join(' ');
      const combinedEn = [actNum ? `Act ${actNum}` : '', areaEn].filter(Boolean).join(' ');

      if (!combinedJa && !combinedEn) {
        td.textContent = '-';
        return;
      }

      td.append(createLanguageContainer(combinedJa, combinedEn));
    }
  },
  mark: {
    getLineCount(item, def) { return 1; },
    render(td, item, def) {
      const container = document.createDocumentFragment();
      Object.entries(MARK_DEFINITIONS).forEach(([markKey, markDef]) => {
        const span = document.createElement('button');
        span.type = 'button';
        span.className = `mark-btn-table ${item.user.marks.has(markKey) ? 'active' : ''}`;
        Object.assign(span.dataset, { click: 'toggleRowMark', mapKey: item.id, markType: markKey });
        span.textContent = markDef.icon;
        span.title = markDef.title;
        container.append(span);
      });
      td.append(container);
    }
  }
};

// --- TableRenderer (テーブル全体のレンダリング制御) ---

function updateTableStripes(tbody) {
  let visibleIndex = 0;

  for (const tr of tbody.rows) {
    if (tr.classList.contains("is-hidden")) {
      tr.classList.remove("row-even");
      continue;
    }

    tr.classList.toggle("row-even", visibleIndex % 2 === 1);
    visibleIndex++;
  }
}

const TableRenderer = {
  colgroup: null,
  table: null,
  cols: new Map(),
  naturalWidths: new Map(),

  buildColGroup() {
    if (!this.colgroup) {
      this.colgroup = document.createElement('colgroup');
      this.table = DOM.tbody.closest('table');
      if (this.table) this.table.prepend(this.colgroup);
    } else {
      this.colgroup.innerHTML = '';
    }
    this.cols.clear();

    COLUMN_DEFINITIONS.forEach(def => {
      const col = document.createElement('col');
      col.className = `col-${def.className}`;
      this.colgroup.append(col);
      this.cols.set(def.id, col);
    });
  },

  measureNaturalWidths() {
    if (this.table) this.table.style.tableLayout = 'auto';
    this.cols.forEach(col => { col.style.width = ''; });
    COLUMN_DEFINITIONS.forEach(def => {
      const th = ViewStore.headers.get(def.id);
      if (th) {
        const w = th.offsetWidth;
        if (w > 0) this.naturalWidths.set(def.id, w);
      }
    });
  },

  // 記憶した自然な幅から、現在の表示列に応じてpx幅を割り当てる。
  // マーク列は常に自然な幅で固定。それ以外は、マーク列分を除いた残り幅を
  // 表示中の列だけで自然な幅の比率に応じて分け合う（非表示列の分がここに回る）
  applyColumnWidths() {
    const markDef = COLUMN_DEFINITIONS.find(def => def.className === 'mark');
    const markW = this.naturalWidths.get(markDef.id) || 0;
    const totalW = [...this.naturalWidths.values()].reduce((a, b) => a + b, 0);
    const availableForOthers = totalW - markW;

    const visibleOtherSum = COLUMN_DEFINITIONS
      .filter(def => def.className !== 'mark' && AppState.user.columns[def.id])
      .reduce((sum, def) => sum + (this.naturalWidths.get(def.id) || 0), 0);

    COLUMN_DEFINITIONS.forEach(def => {
      const col = this.cols.get(def.id);
      if (!col) return;
      if (def.className === 'mark') {
        col.style.width = `${markW}px`;
      } else if (AppState.user.columns[def.id] && visibleOtherSum > 0) {
        const share = (this.naturalWidths.get(def.id) || 0) / visibleOtherSum;
        col.style.width = `${share * availableForOthers}px`;
      } else {
        col.style.width = '';
      }
    });

    if (this.table) this.table.style.tableLayout = 'fixed';
  },

  resetAndFixWidths() {
    COLUMN_DEFINITIONS.forEach(def => {
      ColumnRenderer.updateColumnVisibility(def.id, true);
    });

    this.measureNaturalWidths();
    COLUMN_DEFINITIONS.forEach(def => {
      ColumnRenderer.updateColumnVisibility(def.id, AppState.user.columns[def.id]);
    });
    this.applyColumnWidths();
  },

  buildTable() {
    ViewStore.rows.clear();
    ViewStore.columns.clear();
    COLUMN_DEFINITIONS.forEach(def => { ViewStore.columns.set(def.id, []); });

    const fragment = document.createDocumentFragment();

    AppState.data.items.forEach(item => {
      const tr = document.createElement('tr');
      ViewStore.rows.set(item.id, tr);

      let maxRowLines = 1;
      COLUMN_DEFINITIONS.forEach(def => {
        const renderer = CELL_RENDERERS[def.type];
        maxRowLines = Math.max(maxRowLines, renderer.getLineCount(item, def));
      });

      COLUMN_DEFINITIONS.forEach(def => {
        const td = createCell(`col-${def.className}`);
        const renderer = CELL_RENDERERS[def.type];
        renderer.render(td, item, def, maxRowLines);
        ViewStore.columns.get(def.id).push(td);
        tr.append(td);
      });
      fragment.append(tr);
    });

    DOM.tbody.replaceChildren(fragment);
  },

  updateTableState() {
    AppState.data.items.forEach(item => {
      const isVisible = item.view.visible;

      if (item.view.lastVisible !== isVisible) {
        const tr = ViewStore.rows.get(item.id);
        if (tr) {
          tr.classList.toggle('is-hidden', !isVisible);
        }
        item.view.lastVisible = isVisible;
      }
    });

    updateTableStripes(DOM.tbody);
  },

  reorderRows() {
    const fragment = document.createDocumentFragment();
    AppState.data.items.forEach(item => {
      const tr = ViewStore.rows.get(item.id);
      if (tr) fragment.append(tr);
    });
    DOM.tbody.replaceChildren(fragment);
  },

  updateRowMarkUI(btnElement, isActive) {
    btnElement.classList.toggle('active', isActive);
  }
};

const ColumnRenderer = {
  currentFirstColumn: null,
  updateButtonUI() {
    let visibleCount = 0;
    Object.entries(AppState.user.columns).forEach(([key, isVisible]) => {
      const menuItem = ViewStore.columnMenuItems.get(key);
      if (menuItem) menuItem.classList.toggle('is-checked', isVisible);
      if (isVisible) visibleCount++;
    });
    const toFullWidth = str => String(str).replace(/[0-9]/g, s => String.fromCharCode(s.charCodeAt(0) + 0xFEE0));
    DOM.btnColumnText.innerText = `${toFullWidth(visibleCount)} ／ ${toFullWidth(COLUMN_DEFINITIONS.length)}`;
  },
  updateColumnVisibility(columnKey, visible) {
    ViewStore.columns.get(columnKey)?.forEach(el => el.classList.toggle('is-hidden', !visible));
    ViewStore.headers.get(columnKey)?.classList.toggle('is-hidden', !visible);
    // col要素の表示・非表示も同期
    TableRenderer.cols.get(columnKey)?.classList.toggle('is-hidden', !visible);
  },
  updateFirstVisibleCol() {
    if (this.currentFirstColumn) {
      ViewStore.columns.get(this.currentFirstColumn)?.forEach(el => el.classList.remove('first-visible-cell'));
    }
    const firstVisibleDef = COLUMN_DEFINITIONS.find(def => AppState.user.columns[def.id] !== false);
    if (!firstVisibleDef) { this.currentFirstColumn = null; return; }
    ViewStore.columns.get(firstVisibleDef.id)?.forEach(el => el.classList.add('first-visible-cell'));
    this.currentFirstColumn = firstVisibleDef.id;
  }
};

const FilterUIRenderer = {
  updateResistUI() {
    const resists = AppState.filters.resists;
    ViewStore.resistFilters.forEach((el, key) => {
      const isActive = resists.has(key);
      el.classList.toggle('active', isActive);
      el.setAttribute('aria-pressed', String(isActive));
    });
    DOM.resistGrid.classList.toggle('has-active', resists.size > 0);
  },
  updateMarkUI() {
    const marks = AppState.filters.marks;
    ViewStore.markFilters.forEach((el, key) => {
      const isActive = marks.has(key);
      el.classList.toggle('active', isActive);
      el.setAttribute('aria-pressed', String(isActive));
    });
  }
};

const FooterRenderer = {
  updateFooter() {
    DOM.searchCounter.textContent = `検索結果: ${AppState.stats.visibleCount}件 / 全${AppState.data.items.length}件`;
    if (!DOM.noResultRow) return;

    const visibleColCount = Object.values(AppState.user.columns).filter(v => v).length || 1;
    DOM.noResultCell.colSpan = visibleColCount;

    DOM.msgEmptyData.classList.add('is-hidden');
    DOM.msgNoColumn.classList.add('is-hidden');
    DOM.msgNoMatch.classList.add('is-hidden');

    if (AppState.data.items.length === 0) {
      DOM.noResultRow.classList.remove('is-hidden');
      DOM.msgEmptyData.classList.remove('is-hidden');
    } else if (!AppState.stats.hasVisibleColumn) {
      DOM.noResultRow.classList.remove('is-hidden');
      DOM.msgNoColumn.classList.remove('is-hidden');
    } else if (AppState.stats.visibleCount === 0) {
      DOM.noResultRow.classList.remove('is-hidden');
      DOM.msgNoMatch.classList.remove('is-hidden');
    } else {
      DOM.noResultRow.classList.add('is-hidden');
    }
  }
};

// ==========================================
// 6. コントローラー (Controllers)
// ==========================================

// FormatController: common.js のファクトリで生成（campaign.js/endgame-maps.js共通ロジック）
const FormatController = createFormatController(AppState, PersistenceService, DOM);

const MarkController = {
  toggleRowMark(itemId, markType, btnElement) {
    const item = DataStore.getById(itemId);
    if (!item) return;

    const marks = item.user.marks;
    marks.has(markType) ? marks.delete(markType) : marks.add(markType);
    AppState.user.marks[itemId] = [...marks];
    if (marks.size === 0) delete AppState.user.marks[itemId];
    PersistenceService.scheduleSave();

    if (btnElement) TableRenderer.updateRowMarkUI(btnElement, marks.has(markType));
    if (AppState.filters.marks.has(markType)) RenderCoordinator.refreshAll();
  }
};

const ColumnController = {
  toggleVisibility(columnId) {
    AppState.user.columns[columnId] = !AppState.user.columns[columnId];
    PersistenceService.scheduleSave();
    RenderCoordinator.refreshColumns();
  },
  setAllVisibility(visible) {
    Object.keys(AppState.user.columns).forEach(k => AppState.user.columns[k] = visible);
    PersistenceService.scheduleSave();
    RenderCoordinator.refreshColumns();
  }
};

const SortController = {
  apply(mode, textName) {
    AppState.ui.currentSort = mode;
    ViewStore.sortItems.forEach((item, key) => {
      const isMatch = key === mode;
      item.classList.toggle('is-active', isMatch);
    });
    if (textName) DOM.btnSortText.innerText = textName;
    if (SORTERS[mode]) AppState.data.items.sort(SORTERS[mode]);
    RenderCoordinator.refreshSort();
  }
};

const SearchController = {
  _toggleFilterSet(setObj, value) { setObj.has(value) ? setObj.delete(value) : setObj.add(value); },
  updateText(rawText) { AppState.filters.text = rawText; RenderCoordinator.refreshAll(); },
  clearText(skipFilter = false) {
    DOM.searchInput.value = '';
    AppState.filters.text = '';
    if (!skipFilter) { RenderCoordinator.refreshAll(); DOM.searchInput.focus(); }
  },
  toggleResist(resist) { this._toggleFilterSet(AppState.filters.resists, resist); RenderCoordinator.refreshFilters(); },
  toggleMark(mark) { this._toggleFilterSet(AppState.filters.marks, mark); RenderCoordinator.refreshFilters(); },
  clearAllFilters() {
    this.clearText(true);
    AppState.filters.resists.clear();
    AppState.filters.marks.clear();
    RenderCoordinator.refreshFilters();
  }
};

const AppController = {
  resetView() {
    SortController.apply('default', '初期');
    FormatController.setFormat('ja-en');
    const defaults = UserStateService.createDefaultColumns();
    Object.keys(AppState.user.columns).forEach(k => AppState.user.columns[k] = defaults[k]);
    PersistenceService.scheduleSave();
    RenderCoordinator.refreshColumns();
    SearchController.clearAllFilters();
  }
};

// ==========================================
// 7. イベント管理 (Events)
// ==========================================

const CLICK_ACTIONS = {
  resetView: () => AppController.resetView(),
  clearAllFilters: () => SearchController.clearAllFilters(),
  clearSearchText: () => SearchController.clearText(),
  sort: el => SortController.apply(el.dataset.sort, el.dataset.sortName),
  toggleColumn: el => ColumnController.toggleVisibility(el.dataset.column),
  setAllColumns: el => ColumnController.setAllVisibility(el.dataset.visible === 'true'),
  toggleResist: el => SearchController.toggleResist(el.dataset.resist),
  toggleMark: el => SearchController.toggleMark(el.dataset.mark),
  toggleRowMark: el => MarkController.toggleRowMark(el.dataset.mapKey, el.dataset.markType, el),
  showModal: el => ImageModalService.show(`images/bosses/${el.dataset.imgSrc}.webp`, el.textContent.trim() || 'ボス画像'),
  closeModal: () => ImageModalService.close(),
  setFormat: el => FormatController.setFormat(el.dataset.format)
};

function setupSearchEvents() {
  let searchTimer;
  DOM.searchInput.addEventListener('input', (e) => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      SearchController.updateText(normalizeText(e.target.value));
    }, 150);
  });
}

function setupKeyboardEvents() {
  window.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f' && DOM.searchInput && !DOM.searchInput.disabled) {
      e.preventDefault();
      DOM.searchInput.focus();
      DOM.searchInput.select();
    }
  });
}

function setupClickEvents() {
  document.addEventListener('click', e => {
    if (e.target.classList.contains('modal-overlay')) {
      ImageModalService.close();
      return;
    }
    handleDropdownClick(e);
    const el = e.target.closest('[data-click]');
    if (el) CLICK_ACTIONS[el.dataset.click]?.(el);
  });
}

function setupResizeEvents() {
  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      TableRenderer.resetAndFixWidths();
    }, 200);
  });
}

function setupEventListeners() {
  setupSearchEvents();
  setupKeyboardEvents();
  setupClickEvents();
  setupImagePreviewEvents();
  setupPersistenceEvents(PersistenceService);
  setupResizeEvents();
}

// ==========================================
// 8. アプリ初期化 (App Initializer)
// ==========================================

function initializeWanakana() {
  if (typeof wanakana !== 'undefined') {
    DOM.searchInput.disabled = false;
    DOM.searchInput.placeholder = '楽園　らくえん　rakuen　等で検索可能';
  } else {
    DOM.searchInput.placeholder = 'かな　ローマ字検索が無効です';
    DOM.searchInput.disabled = false;
  }
}

const App = {
  async init() {
    try {
      DOM.initCache();
      if (DOM.loadingCell) DOM.loadingCell.colSpan = COLUMN_DEFINITIONS.length;
      initImageServices();
      AppState.user = UserStateService.load();
      FormatController.updateUI();
      setupDynamicUI();
      initializeWanakana();
      setupEventListeners();
      await this.loadData();
    } catch (e) {
      console.error('Initialization Failed:', e);
      DOM.loadingRow?.classList.add('is-hidden');
      DOM.showFatalError([
        'ページの初期化に失敗しました。再読み込みしても改善しない場合はご連絡ください。',
        `詳細: ${e.message}`
      ]);
    }
  },

  async loadData() {
    try {
      const response = await fetchWithTimeout('json/poe2-endgame-maps.json');
      if (!response.ok) throw new Error(`"json/poe2-endgame-maps.json" の読み込みに失敗しました (HTTP ${response.status})`);

      const data = await response.json();
      this.validateAndInitialize(data);
    } catch (e) {
      console.error('JSONデータの読み込みに失敗しました。', e);
      DOM.loadingRow?.classList.add('is-hidden');
      DOM.showFatalError([
        'データの読み込みに失敗しました。',
        describeLoadError(e)
      ]);
    }
  },

  validateAndInitialize(data) {
    const idSet = new Set();
    data.forEach((item, idx) => {
      if (!item.id) throw new Error(`マップデータの ${idx + 1} 件目に id がありません。`);
      if (idSet.has(item.id)) throw new Error(`マップデータの id が重複しています: ${item.id}`);
      idSet.add(item.id);
    });
    DOM.loadingRow?.classList.add('is-hidden');
    DataStore.setItems(ItemFactory.buildItems(data));
    TableRenderer.buildColGroup();
    TableRenderer.buildTable();
    TableRenderer.measureNaturalWidths();
    RenderCoordinator.refreshColumns();
  }
};

App.init();