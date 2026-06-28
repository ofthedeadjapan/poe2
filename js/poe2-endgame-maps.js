// ==========================================
// 1. 定数・定義 (Constants & Definitions)
// ==========================================

const STORAGE_VERSION = 2; // バージョンを更新

const STORAGE_KEYS = {
    USER_STATE: 'poe2:userState'
};

const MARK_DEFINITIONS = {
    skull: { icon: '💀', title: '💀' }
};

const RESIST_TYPES = ['Armour', 'Evasion', 'Fire', 'Cold', 'Lightning', 'Chaos'];

const DUMMY_RESISTS = new Set([
    'ArmourWeak',
    'EvasionWeak',
    'ChaosWeak'
]);

// --- 列定義用ファクトリ関数 ---
const textCol = (id, defaultVisible = true, isSearchable = true) => ({
    id, className: 'text-normal', label: id, defaultVisible, isSearchable, type: 'text'
});

const interleavedCol = (id, keys, isSearchable = true) => ({
    id, className: 'text-normal', label: id, defaultVisible: true, isSearchable, type: 'interleaved', keys
});

const interleavedBossCol = (id, keys) => ({
    id, className: 'text-normal', label: id, defaultVisible: true, isSearchable: true, type: 'interleavedBoss', keys
});

const resistCol = () => ({
    id: '耐性アイコン', className: 'resist-icon', label: '耐性アイコン', defaultVisible: true, isSearchable: false, type: 'resistIcon'
});

const markCol = () => ({
    id: 'マーク', className: 'mark', label: 'マーク', defaultVisible: true, isSearchable: false, type: 'mark'
});

const customCol = (config) => ({
    className: 'text-normal', defaultVisible: true, isSearchable: true, type: 'custom', ...config
});

// 今回の仕様変更に合わせて列定義をシンプルに統合
const COLUMN_DEFINITIONS = [
    textCol('よみがな', false),
    interleavedCol('マップ', ['マップ日本語', 'マップ英語']),
    interleavedBossCol('ボス', ['ボス日本語', 'ボス英語', 'bossimage']),
    resistCol(),
    customCol({
        id: '元ボスアクト/エリア',
        label: '元ボスアクト/エリア',
        searchKeys: ['元ボスアクト', '元ボスエリア'],
        render: (item) => [item.data['元ボスアクト'] ? `${item.data['元ボスアクト']}章` : '', item.data['元ボスエリア'] || ''].filter(Boolean).join('\n')
    }),
    interleavedCol('元ボス', ['元ボス日本語', '元ボス英語']),
    textCol('元ボス特徴'),
    textCol('メモ'),
    markCol()
];

// ==========================================
// 2. 基盤サービス (Storage & Persistence)
// ==========================================

const StorageService = {
    load(key, fallback = null) {
        try {
            const saved = localStorage.getItem(key);
            return saved ? JSON.parse(saved) : fallback;
        } catch (e) {
            console.warn(`StorageService: 壊れたデータを削除しました [${key}]`, e);
            this.remove(key);
            return fallback;
        }
    },
    save(key, data) {
        try {
            localStorage.setItem(key, JSON.stringify(data));
        } catch (e) {
            console.warn(`StorageService: データの保存に失敗しました [${key}]`, e);
        }
    },
    remove(key) {
        try {
            localStorage.removeItem(key);
        } catch (e) {
            console.warn(`StorageService: データの削除に失敗しました [${key}]`, e);
        }
    }
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
            format: {
                order: saved?.format?.order || 'ja',
                lang: saved?.format?.lang || 'both'
            }
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

document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') PersistenceService.flush();
});
window.addEventListener('pagehide', () => PersistenceService.flush());

// ==========================================
// 3. 状態管理 (State & DOM Cache)
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

const DOM = {
    initCache() {
        const map = {
            searchInput: 'searchInput',
            searchCounter: 'search-counter',
            resistGrid: 'resist-grid',
            markGrid: 'mark-grid',
            btnSortText: 'btn-sort-text',
            btnColumnText: 'btn-column-text',
            btnFormatText: 'btn-format-text',
            tbody: 'endgame-maps-table-body',
            noResultRow: 'no-result-row',
            noResultCell: 'no-result-cell',
            msgEmptyData: 'msg-empty-data',
            msgNoColumn: 'msg-no-column',
            msgNoMatch: 'msg-no-match',
            fallbackMessage: 'fallback-message',
            fatalErrorMessage: 'fatal-error-message',
            bossModal: 'boss-modal',
            bossModalImg: 'boss-modal-img',
            bossPreview: 'boss-preview',
            bossPreviewImg: 'boss-preview-img'
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

// ==========================================
// 4. 調停役・サービス (Coordinators & Services)
// ==========================================
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

const ModalService = {
    show(imgSrc) {
        if (!imgSrc) return;
        DOM.bossModalImg.src = `images/bosses/${imgSrc}.webp`;
        DOM.bossModal.classList.add('show');
        document.body.style.overflow = 'hidden';
    },
    close() {
        DOM.bossModal.classList.remove('show');
        document.body.style.overflow = '';
        setTimeout(() => { DOM.bossModalImg.src = ''; }, 200);
    }
};

const PreviewService = {
    isTouchDevice: window.matchMedia('(hover: none)').matches,
    cachedWidth: 0,
    cachedHeight: 0,
    currentSrc: '',

    show(imgSrc, x, y) {
        if (this.isTouchDevice || !imgSrc) return;

        const img = DOM.bossPreviewImg;
        this.currentSrc = imgSrc;
        const fullPath = `images/bosses/${imgSrc}.webp`;

        const displayImage = () => {
            if (this.currentSrc !== imgSrc) return;
            DOM.bossPreview.classList.remove('is-hidden');
            requestAnimationFrame(() => {
                const rect = DOM.bossPreview.getBoundingClientRect();
                this.cachedWidth = rect.width;
                this.cachedHeight = rect.height;
                this.move(x, y);
                DOM.bossPreview.classList.add('show');
            });
        };

        if (img.src.endsWith(fullPath) && img.complete) {
            displayImage();
        } else {
            img.onload = displayImage;
            img.src = fullPath;
        }
    },

    move(x, y) {
        if (!this.cachedWidth || !this.cachedHeight) return;
        const offset = 15;
        const padding = 10;
        let left = x + offset;
        let top = y + offset;

        const maxLeft = window.innerWidth - this.cachedWidth - padding;
        const maxTop = window.innerHeight - this.cachedHeight - padding;

        if (left > maxLeft) left = Math.max(padding, x - this.cachedWidth - offset);
        if (top > maxTop) top = Math.max(padding, y - this.cachedHeight - offset);

        DOM.bossPreview.style.left = `${left}px`;
        DOM.bossPreview.style.top = `${top}px`;
    },

    hide() {
        this.currentSrc = '';
        DOM.bossPreview.classList.remove('show');
        setTimeout(() => {
            if (!DOM.bossPreview.classList.contains('show')) {
                DOM.bossPreview.classList.add('is-hidden');
                DOM.bossPreviewImg.src = '';
                this.cachedWidth = 0;
                this.cachedHeight = 0;
            }
        }, 150);
    }
};

// ==========================================
// 5. コントローラー層 (Controllers)
// ==========================================

const FormatController = {
    setFormat(mode) {
        let lang = 'both';
        let order = 'ja';

        if (mode === 'both-ja') { lang = 'both'; order = 'ja'; }
        else if (mode === 'both-en') { lang = 'both'; order = 'en'; }
        else if (mode === 'ja') { lang = 'ja'; order = 'ja'; }
        else if (mode === 'en') { lang = 'en'; order = 'en'; }

        if (AppState.user.format.lang === lang && AppState.user.format.order === order) return;

        AppState.user.format.lang = lang;
        AppState.user.format.order = order;
        PersistenceService.scheduleSave();
        this.updateUI();
    },
    updateUI() {
        const { order, lang } = AppState.user.format;

        let currentMode = '';
        let labelText = '';
        if (lang === 'ja') { currentMode = 'ja'; labelText = '日のみ'; }
        else if (lang === 'en') { currentMode = 'en'; labelText = '英のみ'; }
        else if (lang === 'both' && order === 'ja') { currentMode = 'both-ja'; labelText = '日＋英'; }
        else if (lang === 'both' && order === 'en') { currentMode = 'both-en'; labelText = '英＋日'; }

        if (DOM.btnFormatText) {
            DOM.btnFormatText.innerText = labelText;
        }

        // ドロップダウンアイテムのハイライト更新
        document.querySelectorAll('[data-click="setFormat"]').forEach(btn => {
            const isActive = btn.dataset.format === currentMode;
            btn.classList.toggle('sort-active', isActive);
            const checkmark = btn.querySelector('.checkmark');
            if (checkmark) checkmark.style.visibility = isActive ? 'visible' : 'hidden';
        });

        // bodyクラスの付与 (テーブル内の表示を切り替え)
        document.body.classList.remove('lang-ja-only', 'lang-en-only', 'lang-both', 'lang-ja-main', 'lang-en-main');

        if (lang === 'ja') {
            document.body.classList.add('lang-ja-only');
        } else if (lang === 'en') {
            document.body.classList.add('lang-en-only');
        } else {
            document.body.classList.add('lang-both');
            if (order === 'ja') document.body.classList.add('lang-ja-main');
            else if (order === 'en') document.body.classList.add('lang-en-main');
        }
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
            item.classList.toggle('sort-active', isMatch);
            const checkmark = item.querySelector('.checkmark');
            if (checkmark) checkmark.style.visibility = isMatch ? 'visible' : 'hidden';
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
        FormatController.setFormat('both-ja');
        const defaults = UserStateService.createDefaultColumns();
        Object.keys(AppState.user.columns).forEach(k => AppState.user.columns[k] = defaults[k]);
        PersistenceService.scheduleSave();
        RenderCoordinator.refreshColumns();
        SearchController.clearAllFilters();
    }
};

// ==========================================
// 6. イベント委譲 (Event Delegation)
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
    showModal: el => ModalService.show(el.dataset.imgSrc),
    closeModal: () => ModalService.close(),
    setFormat: el => FormatController.setFormat(el.dataset.format)
}

function setupEventListeners() {
    let searchTimer;
    DOM.searchInput.addEventListener('input', (e) => {
        clearTimeout(searchTimer);
        searchTimer = setTimeout(() => { SearchController.updateText(normalizeText(e.target.value)); }, 150);
    });

    window.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f' && DOM.searchInput && !DOM.searchInput.disabled) {
            e.preventDefault(); DOM.searchInput.focus(); DOM.searchInput.select();
        }
        if (e.key === 'Escape' && DOM.bossModal.classList.contains('show')) {
            ModalService.close();
        }
    });

    document.addEventListener('click', e => {
        if (e.target === DOM.bossModal) { ModalService.close(); return; }
        handleDropdownClick(e);
        const el = e.target.closest('[data-click]');
        if (el) CLICK_ACTIONS[el.dataset.click]?.(el);
    });

    document.addEventListener('pointerenter', e => {
        const el = e.target.closest('.boss-link');
        if (!el?.dataset.imgSrc) return;
        PreviewService.show(el.dataset.imgSrc, e.clientX, e.clientY);
    }, true);

    document.addEventListener('pointerleave', e => {
        if (!e.target.closest('.boss-link')) return;
        PreviewService.hide();
    }, true);
}

function handleDropdownClick(e) {
    const dropdownBtn = e.target.closest('.btn-dropdown, .card-dropdown-btn');
    if (e.target.closest('.dropdown-content')) return;

    const openDropdowns = document.querySelectorAll('.dropdown.show');

    // 全ての開いているドロップダウンを閉じ、aria-expandedをfalseにする
    openDropdowns.forEach(d => {
        d.classList.remove('show');
        const btn = d.querySelector('.btn-dropdown, .card-dropdown-btn');
        if (btn) btn.setAttribute('aria-expanded', 'false');
    });

    if (!dropdownBtn) return;

    const parent = dropdownBtn.parentElement;
    const wasOpen = parent.classList.contains('show'); // 既に上でremoveされているので常にfalseになりますが、元の状態を判定するために微調整します。

    // 正しい開閉ロジック
    if (!wasOpen) {
        parent.classList.add('show');
        dropdownBtn.setAttribute('aria-expanded', 'true');
    }
}

// ==========================================
// 7. ユーティリティとファクトリ
// ==========================================

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

const createSorter = (key, collator, isDesc = false) => (a, b) => {
    const valA = a.data[key] || '';
    const valB = b.data[key] || '';
    const cmp = isDesc ? collator.compare(valB, valA) : collator.compare(valA, valB);
    return cmp || (a.cache.defaultOrder - b.cache.defaultOrder);
};

const SORTERS = {
    'default': (a, b) => a.cache.defaultOrder - b.cache.defaultOrder,
    'kana-asc': createSorter("よみがな", JA_COLLATOR, false),
    'kana-desc': createSorter("よみがな", JA_COLLATOR, true),
    'eng-asc': createSorter("マップ英語", EN_COLLATOR, false),
    'eng-desc': createSorter("マップ英語", EN_COLLATOR, true)
};

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

// ==========================================
// 8. アプリ初期化
// ==========================================

const App = {
    async init() {
        try {
            DOM.initCache();
            AppState.user = UserStateService.load();
            FormatController.updateUI(); // フォーマット設定の初期適用
            setupDynamicUI();
            initializeWanakana();
            setupEventListeners();
            this.syncButtonTexts(); // ★ パネルの文字を読み取り、テーブル側と自動同期
            await this.loadData();
        } catch (e) {
            console.error("Initialization Failed:", e);
            DOM.showFatalError(e.message);
        }
    },

    syncButtonTexts() {
        // 1. パネルの「表示初期化」ボタンと、テーブル内のボタンを完全に同一にする
        const panelResetBtn = document.querySelector('.control-bar button[data-click="resetView"]');
        const tableResetBtn = document.querySelector('#msg-no-column button[data-click="resetView"]');
        if (panelResetBtn && tableResetBtn) {
            tableResetBtn.innerHTML = panelResetBtn.innerHTML;
        }

        // 2. パネルの「条件クリア」ボタンと、テーブル内のボタンを完全に同一にする
        const panelClearBtn = document.getElementById('btn-clear-filters');
        const tableClearBtn = document.querySelector('#msg-no-match button[data-click="clearAllFilters"]');
        if (panelClearBtn && tableClearBtn) {
            tableClearBtn.innerHTML = panelClearBtn.innerHTML;
        }
    },

    async loadData() {
        try {
            const response = await fetch('json/poe2-endgame-maps.json');
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            this.validateAndInitialize(await response.json());
        } catch (e) {
            console.warn("JSONデータの読み込みに失敗しました。ダミーデータを表示します。", e);
            DOM.fallbackMessage.classList.remove('is-hidden');
            const dummyData = [
                { "id": "map_001", "よみがな": "だみーまっぷ", "マップ日本語": "ダミーマップ", "ボス日本語": "ダミーボス", "マップ英語": "DummyMap", "ボス英語": "DummyBoss", "耐性アイコン": "", "元ボスアクト": "元ダミーアクト", "元ボスエリア": "元ダミーエリア", "元ボス日本語": "元ダミーボス", "元ボス英語": "Original Dummy Boss", "元ボス特徴": "ダミー", "メモ": "ダミーメモ", "bossimage": "dummyboss" },
                { "id": "map_002", "よみがな": "だみーさばんな", "マップ日本語": "ダミーサバンナ", "ボス日本語": "ハイエナロード、カエドロン", "マップ英語": "Savannah", "ボス英語": "Caedron, the Hyena Lord", "耐性アイコン": "FireWeak,Cold", "元ボスアクト": "２", "元ボスエリア": "ヴァスティリ郊外", "元ボス日本語": "ラスブレイカー", "元ボス英語": "Rustbreaker", "元ボス特徴": "獣一杯、槍一杯", "bossimage": "" },
                { "id": "map_084", "よみがな": "あらしのめ\nひすいのしま", "マップ日本語": "嵐の目\nヒスイの島", "ボス日本語": "選ばれし者、マノキ\n熱病に侵されし者、マノキ\n冒涜されし者、マノキ", "マップ英語": "Eye of the Storm\nThe Jade Isles", "ボス英語": "Manoki, the Chosen\nManoki, the Fevered\nManoki, the Defiled", "耐性アイコン": "ArmourStrong,Fire\nArmourStrong\nArmourStrong", "元ボスアクト": "４", "元ボスエリア": "部族の中心", "元ボス日本語": "族長、タヴァカイ\n堕ちたタヴァカイ\n蝕まれたタヴァカイ", "元ボス英語": "Tavakai, the Chieftain\nTavakai, the Fallen\nTavakai, the Consumed", "元ボス特徴": "4章ボス", "メモ": "タウホアの加護\nカオムの狂気\nラキアタの流れ", "bossimage": "tavakai-the-chieftain\ntavakai-the-fallen\ntavakai-the-consumed" },
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
        TableRenderer.buildTable();
        RenderCoordinator.refreshColumns();
        RenderCoordinator.refreshAll();
    }
};

document.addEventListener('DOMContentLoaded', () => App.init());

function initializeWanakana() {
    const enableSearch = () => {
        DOM.searchInput.disabled = false;
        DOM.searchInput.placeholder = "マップ名やボス名で検索...";
    };
    if (typeof wanakana !== 'undefined') {
        enableSearch();
    } else {
        const script = document.querySelector('script[src*="wanakana"]');
        if (script) {
            script.addEventListener('load', enableSearch);
            script.addEventListener('error', () => {
                DOM.searchInput.placeholder = "ローマ字検索が無効です";
                DOM.searchInput.disabled = false;
            });
        }
    }
}

// ==========================================
// 9. UI構築 (Views)
// ==========================================

const UIFactory = {
    createMenuItem({ dataset = {}, text, checked = false }) {
        const div = document.createElement('div');
        div.className = 'dropdown-item';
        Object.assign(div.dataset, dataset);
        div.innerHTML = `<span class="checkmark" style="visibility:${checked ? 'visible' : 'hidden'}">✔</span>${text}`;
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
        th.dataset.key = def.id;
        th.textContent = def.label;
        headerRow.appendChild(th);
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
        colDropdown.appendChild(item);
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
            fragment.appendChild(btn);
            if (!DUMMY_RESISTS.has(key)) ViewStore.resistFilters.set(key, btn);
        });
    });
    DOM.resistGrid.appendChild(fragment);
}

function buildMarkFilter() {
    Object.entries(MARK_DEFINITIONS).forEach(([key, def]) => {
        const btn = UIFactory.createFilterButton({
            dataset: { click: 'toggleMark', mark: key },
            title: def.title,
            iconType: 'text',
            iconValue: def.icon
        });
        DOM.markGrid.appendChild(btn);
        ViewStore.markFilters.set(key, btn);
    });
}

// ==========================================
// 10. 検索・フィルターサービス (Search & Filter)
// ==========================================

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
        const isRawMatch = item.cache.searchIndex.includes(ctx.rawKeyword);
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

// ==========================================
// 11. 各種 Renderer (DOMの構築と更新)
// ==========================================

// 日・英交互表示用のレンダリングユーティリティ
function renderInterleaved(td, item, keys, isBoss = false) {
    const jaLines = (item.data[keys[0]] || '').split('\n');
    const enLines = (item.data[keys[1]] || '').split('\n');
    const imgLines = isBoss ? (item.data[keys[2]] || '').split('\n') : [];

    const maxLines = Math.max(jaLines.length, enLines.length);
    if (maxLines === 0 || (maxLines === 1 && !jaLines[0] && !enLines[0])) {
        td.textContent = '-';
        return;
    }

    const container = document.createElement('div');
    container.className = 'cell-lang-container';

    for (let i = 0; i < maxLines; i++) {
        const jaText = jaLines[i]?.trim() || '';
        const enText = enLines[i]?.trim() || '';
        const imgSrc = isBoss ? imgLines[i]?.trim() : '';

        if (!jaText && !enText) continue;

        const pair = document.createElement('div');
        pair.className = 'interleaved-pair';

        // 日本語ブロック
        const divJa = document.createElement('div');
        divJa.className = 'lang-ja';
        if (isBoss && imgSrc && jaText) {
            const link = document.createElement('span');
            link.className = 'boss-link';
            link.textContent = jaText;
            Object.assign(link.dataset, { click: 'showModal', imgSrc });
            divJa.appendChild(link);
        } else {
            divJa.textContent = jaText || '-';
        }
        pair.appendChild(divJa);

        // 英語ブロック
        const divEn = document.createElement('div');
        divEn.className = 'lang-en';
        if (isBoss && imgSrc && enText) {
            const link = document.createElement('span');
            link.className = 'boss-link';
            link.textContent = enText;
            Object.assign(link.dataset, { click: 'showModal', imgSrc });
            divEn.appendChild(link);
        } else {
            divEn.textContent = enText;
        }
        pair.appendChild(divEn);

        container.appendChild(pair);
    }
    td.appendChild(container);
}

const CELL_RENDERERS = {
    text: (td, item, def) => { td.textContent = item.data[def.id] || ''; },
    interleaved: (td, item, def) => renderInterleaved(td, item, def.keys, false),
    interleavedBoss: (td, item, def) => renderInterleaved(td, item, def.keys, true),
    resistIcon: (td, item, def) => TableRenderer.createResistCell(item, td),
    mark: (td, item, def) => {
        const container = document.createElement('div');
        Object.entries(MARK_DEFINITIONS).forEach(([markKey, markDef]) => {
            container.appendChild(TableRenderer.createMarkButton(item.id, markKey, item.user.marks.has(markKey), markDef));
        });
        td.appendChild(container);
    },
    custom: (td, item, def) => { td.textContent = def.render(item); }
};

const TableRenderer = {
    buildTable() {
        ViewStore.rows.clear();
        ViewStore.columns.clear();

        if (AppState.data.items.length === 0) {
            this.renderEmptyTable();
            return;
        }

        const fragment = document.createDocumentFragment();

        AppState.data.items.forEach(item => {
            const tr = document.createElement('tr');
            ViewStore.rows.set(item.id, tr);

            COLUMN_DEFINITIONS.forEach(def => {
                const isHidden = AppState.user.columns[def.id] === false;
                const td = this.createCell(def, item, isHidden);
                if (!ViewStore.columns.has(def.id)) ViewStore.columns.set(def.id, []);
                ViewStore.columns.get(def.id).push(td);
                tr.appendChild(td);
            });
            fragment.appendChild(tr);
        });

        DOM.tbody.replaceChildren(fragment);
        ViewStore.headers.forEach((th, key) => { th.classList.toggle('is-hidden', AppState.user.columns[key] === false); });
    },

    renderEmptyTable() { DOM.tbody.replaceChildren(); },

    createCell(def, item, isHidden) {
        const td = document.createElement('td');
        td.className = `col-${def.className}`;
        if (isHidden) td.classList.add('is-hidden');

        const renderer = CELL_RENDERERS[def.type];
        renderer ? renderer(td, item, def) : (td.textContent = item.data[def.id] || '');
        return td;
    },

    createResistCell(item, td) {
        const resistText = String(item.data.耐性アイコン || '-').trim();
        const lines = resistText.replace(/\r\n/g, '\n').split('\n');

        const wrapper = document.createElement('div');
        wrapper.className = 'cell-resist-wrapper'; // コンテナクエリのトリガー用

        lines.forEach(row => {
            if (!row.trim() && lines.length > 1) return;
            const keysInRow = row.split(',').map(k => k.trim()).filter(Boolean);

            const grid = document.createElement('div');
            grid.className = 'resist-grid';

            RESIST_TYPES.forEach(attr => {
                const slot = document.createElement('div');
                slot.className = 'resist-slot';

                const regex = new RegExp(`^${attr}(Strong|Weak)?$`, 'i');
                const foundKey = keysInRow.find(k => regex.test(k));

                if (foundKey) {
                    const match = foundKey.match(regex);
                    const strength = match && match[1] ? match[1].toLowerCase() : 'normal';

                    slot.classList.add(`is-${strength}`);

                    const fileName = `${attr.toLowerCase()}${strength !== 'normal' ? '-' + strength : ''}`;
                    const img = document.createElement('img');
                    img.src = `images/icon-enemies/${fileName}.webp`;
                    img.className = 'resist-icon-img';
                    img.title = foundKey;
                    img.onerror = () => { img.style.display = 'none'; }; // エラー時は非表示

                    slot.appendChild(img);
                } else {
                    slot.classList.add('is-empty'); // 属性が存在しない場合は空枠
                }
                grid.appendChild(slot);
            });
            wrapper.appendChild(grid);
        });
        td.appendChild(wrapper);
    },

    createMarkButton(mapKey, markType, isActive, markDef) {
        const span = document.createElement('button'); // spanからbuttonに変更
        span.type = 'button'; // form送信を防ぐため
        span.className = `mark-btn-table btn-base ${isActive ? 'active' : ''}`;
        Object.assign(span.dataset, { click: 'toggleRowMark', mapKey, markType });
        span.textContent = markDef.icon;
        span.title = markDef.title;
        return span;
    },

    updateTableState() {
        let currentVisibleIndex = 0;
        AppState.data.items.forEach(item => {
            const { lastVisible: wasVisible, lastIsEven: wasEven } = item.view;
            const isVisible = item.view.visible;
            const isEven = isVisible ? (++currentVisibleIndex % 2 === 1) : undefined;

            if (wasVisible !== isVisible || wasEven !== isEven) {
                const tr = ViewStore.rows.get(item.id);
                if (tr) {
                    if (wasVisible !== isVisible) tr.classList.toggle('is-hidden', !isVisible);
                    if (isVisible && wasEven !== isEven) tr.classList.toggle('row-even', isEven);
                    else if (!isVisible && wasEven !== undefined) tr.classList.remove('row-even');
                }
                item.view.lastVisible = isVisible;
                item.view.lastIsEven = isEven;
            }
        });
    },

    reorderRows() {
        const fragment = document.createDocumentFragment();
        AppState.data.items.forEach(item => {
            const tr = ViewStore.rows.get(item.id);
            if (tr) fragment.appendChild(tr);
        });
        DOM.tbody.replaceChildren(fragment);
    },
    updateRowMarkUI(btnElement, isActive) { btnElement.classList.toggle('active', isActive); }
};

const ColumnRenderer = {
    updateButtonUI() {
        let visibleCount = 0;
        Object.entries(AppState.user.columns).forEach(([key, isVisible]) => {
            const menuItem = ViewStore.columnMenuItems.get(key);
            if (menuItem) {
                const checkmark = menuItem.querySelector('.checkmark');
                if (checkmark) checkmark.style.visibility = isVisible ? 'visible' : 'hidden';
            }
            if (isVisible) visibleCount++;
        });
        // 全角数字に変換して出力
        const toFullWidth = str => String(str).replace(/[0-9]/g, s => String.fromCharCode(s.charCodeAt(0) + 0xFEE0));
        DOM.btnColumnText.innerText = `${toFullWidth(visibleCount)} ／ ${toFullWidth(COLUMN_DEFINITIONS.length)}`;
    },
    updateColumnVisibility(columnKey, visible) {
        ViewStore.columns.get(columnKey)?.forEach(el => el.classList.toggle('is-hidden', !visible));
        ViewStore.headers.get(columnKey)?.classList.toggle('is-hidden', !visible);
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