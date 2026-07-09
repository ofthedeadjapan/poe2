import {
  RESIST_TYPES,
  StorageService,
  initImageServices,
  ImagePreviewService,
  ImageModalService,
  createDiv,
  renderMultiLineCell,
  handleDropdownClick,
  applyFormatBodyClass,
  escapeHTML,
  getText,
  formatMultilineHTML,
  splitLines,
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

// --- 列定義用ファクトリ関数 ---
const textCol = (id, defaultVisible = true, isSearchable = true) => ({
  id, className: 'text-multiline', label: id, defaultVisible, isSearchable, type: 'text'
});
const interleavedCol = (id, keys, isSearchable = true) => ({
  id, className: 'text-normal', label: id, defaultVisible: true, isSearchable, type: 'interleaved', keys
});
const interleavedMultilineCol = (id, keys, isSearchable = true) => ({
  id, className: 'text-normal', label: id, defaultVisible: true, isSearchable, type: 'interleavedMultiline', keys
});
const resistCol = () => ({
  id: '耐性アイコン', className: 'resist-icon', label: '耐性アイコン', defaultVisible: true, isSearchable: false, type: 'resistIcon'
});
const actAreaCol = () => ({
  id: '元ボスアクト/エリア', className: 'text-normal', label: '元ボスアクト/エリア', defaultVisible: true, isSearchable: true, type: 'actArea',
  searchKeys: ['元ボスアクト', '元ボスエリア日', '元ボスエリア英']
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
  textCol('メモ'),
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
  'kana-asc': createSorter('よみがな', JA_COLLATOR, false),
  'kana-desc': createSorter('よみがな', JA_COLLATOR, true),
  'eng-asc': createSorter('マップ英', EN_COLLATOR, false),
  'eng-desc': createSorter('マップ英', EN_COLLATOR, true)
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

function getIconPath(key) {
  return `images/icon-enemies/${key.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase()}.webp`;
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
    const defaults = this.createDefaultColumns();
    return Object.fromEntries(
      Object.keys(defaults).map(key => [key, savedColumns[key] ?? defaults[key]])
    );
  },
  load() {
    const saved = StorageService.load(STORAGE_KEYS.USER_STATE, null);
    const validMarkKeys = new Set(Object.keys(MARK_DEFINITIONS));
    const validatedMarks = {};

    if (saved && saved.version === STORAGE_VERSION) {
      for (const [id, marks] of Object.entries(saved.marks || {})) {
        if (!Array.isArray(marks)) continue;
        const filtered = marks.filter(mark => validMarkKeys.has(mark));
        if (filtered.length > 0) validatedMarks[id] = filtered;
      }
    }

    return {
      version: STORAGE_VERSION,
      marks: validatedMarks,
      columns: this.normalizeColumns(saved?.columns || {}),
      format: (typeof saved?.format === 'string') ? saved.format : 'ja-en'
    };
  },
  save() {
    StorageService.save(STORAGE_KEYS.USER_STATE, AppState.user);
  }
};

const PersistenceService = {
  timer: null,
  delay: 300,
  scheduleSave() {
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.flush(), this.delay);
  },
  flush() {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    UserStateService.save();
  }
};

// ==========================================
// 4. サービス・ロジック (Services & Processors)
// ==========================================

const ItemFactory = {
  createSearchIndex(item, searchIndexKeys) {
    return searchIndexKeys.map(k => normalizeText(item[k])).filter(Boolean).join('\t');
  },
  createResistIndex(item) {
    return new Set(String(item.耐性アイコン || '-').replace(/\r\n/g, '\n').split(/[\n,]+/).map(r => r.trim()).filter(r => r && r !== '-'));
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
        kanaIndex: normalizeText(item.よみがな)
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
      noResultRow: 'no-result-row', noResultCell: 'no-result-cell',
      msgEmptyData: 'msg-empty-data', msgNoColumn: 'msg-no-column', msgNoMatch: 'msg-no-match',
      fallbackMessage: 'fallback-message', fatalErrorMessage: 'fatal-error-message'
    };
    Object.entries(map).forEach(([prop, id]) => { this[prop] = document.getElementById(id); });
  },
  showFatalError(msg) {
    if (this.fatalErrorMessage) {
      this.fatalErrorMessage.textContent = `致命的なエラーが発生しました: ${msg}`;
      this.fatalErrorMessage.classList.remove('is-hidden');
    }
  }
};

function createLangDiv(className, text, imgSrc = '', defaultText = '') {
  const div = createDiv(className);

  if (imgSrc && text) {
    const link = document.createElement('span');
    link.className = 'boss-link';
    link.textContent = text;
    Object.assign(link.dataset, { click: 'showModal', imgSrc });
    div.append(link);
  } else {
    div.textContent = text || defaultText;
  }
  return div;
}

function createLanguageContainer(jaText, enText, imgSrc = '') {
  const container = createDiv('cell-lang-container');
  container.append(
    createLangDiv('lang-ja', jaText, imgSrc, '-'),
    createLangDiv('lang-en', enText, imgSrc, '')
  );
  return container;
}

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
        iconValue: getIconPath(key),
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

// --- CELL_RENDERERS (独立したセル描画ロジック群) ---
const CELL_RENDERERS = {
  text: {
    getLineCount(item, def) { return 1; },
    render(td, item, def) {
      td.textContent = item.data[def.id] || '';
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
      return splitLines(item.data.耐性アイコン).length || 1;
    },
    render(td, item, def, maxLines) {
      const resistLines = splitLines(item.data.耐性アイコン);
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
        const grid = createDiv('resist-grid');
        RESIST_TYPES.forEach(type => {
          const slot = createDiv('resist-slot');
          const match = resistText.match(new RegExp(`${type}(Strong|Weak)?`, 'i'));
          if (match) {
            const strength = match[1] ? match[1].toLowerCase() : 'normal';
            slot.classList.add(`is-${strength}`);
            const fileName = `${type.toLowerCase()}${strength !== 'normal' ? '-' + strength : ''}`;
            const img = document.createElement('img');
            img.src = `images/icon-enemies/${fileName}.webp`;
            img.className = 'resist-icon';
            img.title = match[0];
            img.onerror = () => { img.style.display = 'none'; };
            slot.append(img);
          } else {
            slot.classList.add('is-empty');
          }
          grid.append(slot);
        });
        itemWrapper.append(grid);
      });
    }
  },
  actArea: {
    getLineCount(item, def) {
      return 1;
    },
    render(td, item, def) {
      const actRaw = String(item.data['元ボスアクト'] || '');
      const actNum = actRaw.replace(/[０-９]/g, s => String.fromCharCode(s.charCodeAt(0) - 0xFEE0));

      const areaJa = item.data['元ボスエリア日'] || '';
      const areaEn = item.data['元ボスエリア英'] || '';

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
        span.className = `mark-btn-table btn-base ${item.user.marks.has(markKey) ? 'active' : ''}`;
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
  cols: new Map(),

  buildColGroup() {
    if (!this.colgroup) {
      this.colgroup = document.createElement('colgroup');
      const table = DOM.tbody.closest('table');
      if (table) table.prepend(this.colgroup);
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

  fixInitialWidths() {
    COLUMN_DEFINITIONS.forEach(def => {

      const th = ViewStore.headers.get(def.id);
      if (th) {
        const w = th.offsetWidth;
        if (w > 0) {
          const col = this.cols.get(def.id);
          if (col) col.style.width = `${w}px`;
        }
      }
    });
  },

  resetAndFixWidths() {
    this.cols.forEach(col => { col.style.width = ''; });
    COLUMN_DEFINITIONS.forEach(def => {
      ColumnRenderer.updateColumnVisibility(def.id, true);
    });

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        this.fixInitialWidths();
        RenderCoordinator.refreshColumns();
      });
    });
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
    ViewStore.resistFilters.forEach((el, key) => { el.classList.toggle('active', resists.has(key)); });
    DOM.resistGrid.classList.toggle('has-active', resists.size > 0);
  },
  updateMarkUI() {
    const marks = AppState.filters.marks;
    ViewStore.markFilters.forEach((el, key) => { el.classList.toggle('active', marks.has(key)); });
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

const FormatController = {
  setFormat(mode) {
    if (AppState.user.format === mode) return;
    AppState.user.format = mode;
    PersistenceService.scheduleSave();
    this.updateUI();
  },
  updateUI() {
    const mode = AppState.user.format || 'ja-en';
    const labels = { 'ja-en': '日＋英', 'en-ja': '英＋日', 'ja-only': '日のみ', 'en-only': '英のみ' };
    if (DOM.btnFormatText) DOM.btnFormatText.innerText = labels[mode] || '日＋英';
    document.querySelectorAll('[data-format]').forEach(btn => {
      const isActive = btn.dataset.format === mode;
      btn.classList.toggle('is-active', isActive);
    });
    applyFormatBodyClass(mode);
  }
};

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
  showModal: el => ImageModalService.show(`images/bosses/${el.dataset.imgSrc}.webp`),
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
    if (e.key === 'Escape') {
      ImageModalService.close();
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

function setupImagePreviewEvents() {
  const isTouchDevice = window.matchMedia('(hover: none)').matches;
  if (isTouchDevice) return;

  document.addEventListener('pointerover', e => {
    const el = e.target.closest('[data-img-src]');
    if (!el) return;

    const imgSrc = el.dataset.imgSrc;
    if (!imgSrc) return;

    const imagePath = `images/bosses/${imgSrc}.webp`;
    ImagePreviewService.show(imagePath, e.clientX, e.clientY);
  });

  document.addEventListener('pointerout', e => {
    if (!e.target.closest('[data-img-src]')) return;
    ImagePreviewService.hide();
  });
}

function setupPersistenceEvents() {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') PersistenceService.flush();
  });
  window.addEventListener('pagehide', () => PersistenceService.flush());
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
  setupPersistenceEvents();
  setupResizeEvents();
}

// ==========================================
// 8. アプリ初期化 (App Initializer)
// ==========================================

function initializeWanakana() {
  const enableSearch = () => {
    DOM.searchInput.disabled = false;
    DOM.searchInput.placeholder = '楽園 らくえん rakuen 等で検索可能';
  };
  if (typeof wanakana !== 'undefined') {
    enableSearch();
  } else {
    const script = document.querySelector('script[src*="wanakana"]');
    if (script) {
      script.addEventListener('load', enableSearch);
      script.addEventListener('error', () => {
        DOM.searchInput.placeholder = 'ローマ字検索が無効です';
        DOM.searchInput.disabled = false;
      });
    }
  }
}

const App = {
  async init() {
    try {
      DOM.initCache();
      initImageServices();
      AppState.user = UserStateService.load();
      FormatController.updateUI();
      setupDynamicUI();
      initializeWanakana();
      setupEventListeners();
      await this.loadData();
    } catch (e) {
      console.error('Initialization Failed:', e);
      DOM.showFatalError(e.message);
    }
  },

  async loadData() {
    try {
      const response = await fetch('json/poe2-endgame-maps.json');
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      this.validateAndInitialize(await response.json());
    } catch (e) {
      console.warn('JSONデータの読み込みに失敗しました。ダミーデータを表示します。', e);
      DOM.fallbackMessage.classList.remove('is-hidden');
      const dummyData = [
        { "id": "map_001", "よみがな": "だみーまっぷ", "マップ日": "ダミーマップ", "ボス日": "ダミーボス", "マップ英": "DummyMap", "ボス英": "DummyBoss", "耐性アイコン": "", "元ボスアクト": "元ダミーアクト", "元ボスエリア日": "元ダミーエリア", "元ボスエリア英": "Dummy Area", "元ボス名日": "元ダミーボス", "元ボス名英": "Original Dummy Boss", "元ボス特徴": "ダミー", "メモ": "ダミーメモ", "bossimage": "dummyboss" },
        { "id": "map_002", "よみがな": "だみーさばんな", "マップ日": "ダミーサバンナ", "ボス日": "ハイエナロード、カエドロン", "マップ英": "Savannah", "ボス英": "Caedron, the Hyena Lord", "耐性アイコン": "FireWeak,Cold", "元ボスアクト": "２", "元ボスエリア日": "ヴァスティリ郊外", "元ボスエリア英": "Vastiri Outskirts", "元ボス名日": "ラスブレイカー", "元ボス名英": "Rustbreaker", "元ボス特徴": "獣一杯、槍一杯", "bossimage": "" },
        { "id": "map_084", "よみがな": "あらしのめ\nひすいのしま", "マップ日": "嵐の目\nヒスイの島", "ボス日": "選ばれし者、マノキ\n熱病に侵されし者、マノキ\n冒涜されし者、マノキ", "マップ英": "Eye of the Storm\nThe Jade Isles", "ボス英": "Manoki, the Chosen\nManoki, the Fevered\nManoki, the Defiled", "耐性アイコン": "ArmourStrong,Fire\nArmourStrong\nArmourStrong", "元ボスアクト": "４", "元ボスエリア日": "部族の中心", "元ボスエリア英": "Heart of the Tribe", "元ボス名日": "族長、タヴァカイ\n堕ちたタヴァカイ\n蝕まれたタヴァカイ", "元ボス名英": "Tavakai, the Chieftain\nTavakai, the Fallen\nTavakai, the Consumed", "元ボス特徴": "4章ボス", "メモ": "タウホアの加護\nカオムの狂気\nラキアタの流れ", "bossimage": "tavakai-the-chieftain\ntavakai-the-fallen\ntavakai-the-consumed" },
      ];
      this.validateAndInitialize(dummyData);
    }
  },

  validateAndInitialize(data) {
    const idSet = new Set();
    data.forEach((item, idx) => {
      if (!item.id) throw new Error(`Data is missing 'id' at index ${idx}`);
      if (idSet.has(item.id)) throw new Error(`Duplicate id found: ${item.id}`);
      idSet.add(item.id);
    });

    DataStore.setItems(ItemFactory.buildItems(data));

    TableRenderer.buildColGroup();

    TableRenderer.buildTable();

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        TableRenderer.fixInitialWidths();

        RenderCoordinator.refreshColumns();

      });
    });
  }
};

App.init();