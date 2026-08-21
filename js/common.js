// ==========================================================================
// 1. 定数・設定 (Constants & Config)
// ==========================================================================
export const RESIST_TYPES = ['Armour', 'Evasion', 'Fire', 'Cold', 'Lightning', 'Chaos'];

// 耐性タイプ×強弱（Strong/Weak/無印）判定用の正規表現。モジュール読み込み時に1回だけ生成して使い回す
export const RESIST_REGEXES = RESIST_TYPES.reduce((acc, type) => {
  acc[type] = new RegExp(`${type}(Strong|Weak)?`, 'i');
  return acc;
}, {});

export const UI_CONFIG = {
  PREVIEW_ID: 'boss-preview',
  PREVIEW_IMG_ID: 'boss-preview-img',
  MODAL_ID: 'boss-modal',
  MODAL_IMG_ID: 'boss-modal-img',
  MODAL_FADE_DURATION: 200
};

// DOMキャッシュ用オブジェクト（プロパティの追加・削除を禁止）
const ImageDOM = Object.seal({
  preview: null,
  previewImg: null,
  modal: null,
  modalImg: null
});

// ==========================================================================
// 2. 汎用ユーティリティ (Utilities)
// ==========================================================================

const HTML_ESCAPE_MAP = {
  '&': '&amp;',
  "'": '&#x27;',
  '`': '&#x60;',
  '"': '&quot;',
  '<': '&lt;',
  '>': '&gt;',
};

export function escapeHTML(str) {
  if (typeof str !== 'string') return str;
  return str.replace(/[&'`"<>]/g, match => HTML_ESCAPE_MAP[match]);
}

export function getText(obj, key) {
  const value = obj[key];
  return value == null ? '' : String(value).trim();
}

export function formatMultilineHTML(value, empty = '-') {
  if (value == null) return empty;
  const text = String(value).trim();
  if (!text) return empty;
  return escapeHTML(text).replace(/\n/g, '<br>');
}

export function splitLines(value) {
  if (value == null) return [];
  const text = String(value).trim();
  if (!text) return [];
  return text.split('\n').map(v => v.trim());
}

export function renderErrorBox(container, lines) {
  if (!container) return;
  container.innerHTML = '';
  const box = createDiv('error-box');
  box.setAttribute('role', 'alert');
  box.setAttribute('aria-live', 'assertive');
  box.innerHTML = lines.map(escapeHTML).join('<br>');
  container.append(box);
  container.classList.remove('is-hidden');
}

// ==========================================================================
// 3. DOMヘルパー (DOM Helpers)
// ==========================================================================

/**
 * 汎用的なDOM(div)生成ヘルパー
 */
export function createDiv(className = '') {
  const div = document.createElement('div');
  if (className) div.className = className;
  return div;
}

/**
 * @param {HTMLTableCellElement} td
 * @param {number} maxLines
 * @param {(itemWrapper: HTMLDivElement, index: number) => void} renderer
 */
export function renderMultiLineCell(td, maxLines, renderer) {
  if (maxLines <= 0) {
    td.textContent = '-';
    return;
  }
  const listWrapper = createDiv('cell-list');
  for (let i = 0; i < maxLines; i++) {
    const itemWrapper = createDiv('cell-item');
    renderer(itemWrapper, i);
    listWrapper.append(itemWrapper);
  }
  td.replaceChildren(listWrapper);
}

// 言語別セル(.lang-ja / .lang-en)のdiv要素を生成する。画像リンク付きの場合はクリック可能なspanを内包する
export function createLangDiv(className, text, imgSrc = '', defaultText = '') {
  const div = createDiv(className);

  if (imgSrc && text) {
    const link = document.createElement('span');
    link.className = 'boss-link';
    link.innerHTML = formatMultilineHTML(text);
    Object.assign(link.dataset, { click: 'showModal', imgSrc });
    div.append(link);
  } else {
    div.innerHTML = formatMultilineHTML(text, defaultText);
  }
  return div;
}

// 日本語/英語2つのcreateLangDivをまとめた言語コンテナ(.cell-lang-container)を生成する
export function createLanguageContainer(jaText, enText, imgSrc = '') {
  const container = createDiv('cell-lang-container');
  container.append(
    createLangDiv('lang-ja', jaText, imgSrc, '-'),
    createLangDiv('lang-en', enText, imgSrc, '')
  );
  return container;
}

// ==========================================================================
// 4. ストレージ管理 (Storage)
// ==========================================================================
export const StorageService = {
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

export function loadVersionedState(key, currentVersion, createDefaults) {
  const saved = StorageService.load(key, null);
  if (saved && saved.version === currentVersion) {
    return saved;
  }

  if (saved) {
    console.log(`[Storage] バージョンが変更されました (${saved.version} -> ${currentVersion})。データを初期化します。キー: [${key}]`);
  }

  return {
    version: currentVersion,
    ...createDefaults()
  };
}

// 保存処理をdelayミリ秒デバウンスするサービスを生成するファクトリ関数。
// campaign.js / endgame-maps.js 共通のPersistenceServiceパターンを解消するための共通化
export function createDebouncedSaver(saveFn, delay = 300) {
  let timer = null;

  function flush() {
    if (!timer) return; // 保留中の保存がない時はsaveFn()を呼ばない（無駄な書き込みを避ける）
    clearTimeout(timer);
    timer = null;
    saveFn();
  }

  function scheduleSave() {
    clearTimeout(timer);
    timer = setTimeout(flush, delay);
  }

  return { scheduleSave, flush };
}

// タブが非表示・離脱される直前に、デバウンス中の保存を即座にflushする
export function setupPersistenceEvents(persistenceService) {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') persistenceService.flush();
  });
  window.addEventListener('pagehide', () => persistenceService.flush());
}

// ==========================================================================
// 5. UI・フォーマット制御 (UI & Formatting)
// ==========================================================================

/**
 * ドロップダウンボタン（.btn-dropdown）のクリックをまとめて処理する。
 * 開いている全ドロップダウンを一旦閉じたあと、クリックされたのが
 * 「直前まで開いていたボタン自身」でなければ開き直すことで、
 * 同じボタンなら閉じる・別のボタンなら開き直す、という排他的な
 * トグル動作を実現している。
 */
export function handleDropdownClick(e) {
  const dropdownBtn = e.target.closest('.btn-dropdown');
  if (e.target.closest('.dropdown-content')) return;

  let wasOpen = false;
  if (dropdownBtn) {
    wasOpen = dropdownBtn.parentElement.classList.contains('show');
  }

  const openDropdowns = document.querySelectorAll('.dropdown.show');
  openDropdowns.forEach(d => {
    d.classList.remove('show');
    const btn = d.querySelector('.btn-dropdown');
    if (btn) btn.setAttribute('aria-expanded', 'false');
  });

  if (!dropdownBtn) return;
  const parent = dropdownBtn.parentElement;
  if (!wasOpen) {
    parent.classList.add('show');
    dropdownBtn.setAttribute('aria-expanded', 'true');
  }
}

export function applyFormatBodyClass(mode) {
  document.body.classList.remove(
    'lang-ja-only', 'lang-en-only', 'lang-ja-en', 'lang-en-ja'
  );
  document.body.classList.add(`lang-${mode}`);
}

export const FORMAT_LABELS = {
  'ja-en': '日＋英',
  'en-ja': '英＋日',
  'ja-only': '日のみ',
  'en-only': '英のみ'
};

/**
 * 言語表示形式（フォーマット）切り替えコントローラーを生成するファクトリ関数。
 * campaign.js / endgame-maps.js の重複実装を解消するための共通化。
 * @param {{ user: { format?: string } }} appState - .user.format を持つ状態オブジェクト（本体を渡す。呼び出し時点ではuserが未初期化でもよい）
 * @param {{ scheduleSave: () => void }} persistenceService - scheduleSave()を持つ保存サービス
 * @param {{ btnFormatText?: HTMLElement }} dom - btnFormatTextプロパティを持つDOMキャッシュ
 */
export function createFormatController(appState, persistenceService, dom) {
  return {
    setFormat(mode) {
      if (appState.user.format === mode) return;
      appState.user.format = mode;
      persistenceService.scheduleSave();
      this.updateUI();
    },
    updateUI() {
      const mode = appState.user.format || 'ja-en';
      if (dom.btnFormatText) {
        dom.btnFormatText.innerText = FORMAT_LABELS[mode] || FORMAT_LABELS['ja-en'];
      }
      document.querySelectorAll('[data-format]').forEach(btn => {
        btn.classList.toggle('is-active', btn.dataset.format === mode);
      });
      applyFormatBodyClass(mode);
    }
  };
}

// ==========================================================================
// 6. 画像プレビュー＆モーダル制御 (Image Services)
// ==========================================================================

/**
 * 画像サービスの初期化（アプリ起動時に1回だけ呼ぶ）
 */
export function initImageServices() {
  ImageDOM.preview = document.getElementById(UI_CONFIG.PREVIEW_ID);
  ImageDOM.previewImg = document.getElementById(UI_CONFIG.PREVIEW_IMG_ID);
  ImageDOM.modal = document.getElementById(UI_CONFIG.MODAL_ID);
  ImageDOM.modalImg = document.getElementById(UI_CONFIG.MODAL_IMG_ID);
}

// ホバー時に画像をプレビュー表示するサービス（タッチデバイスでは無効）
export const ImagePreviewService = {
  isTouchDevice: window.matchMedia('(hover: none)').matches,
  currentSrc: '',
  hideTimeout: null,

  show(imagePath, startX, startY) {
    const { preview, previewImg: img } = ImageDOM;
    if (this.isTouchDevice || !preview || !img || !imagePath) return;

    if (this.hideTimeout) {
      clearTimeout(this.hideTimeout);
      this.hideTimeout = null;
    }

    if (this.currentSrc === imagePath) {
      preview.classList.remove('is-hidden');
      const rect = preview.getBoundingClientRect();
      this.setPosition(startX, startY, rect.width, rect.height);
      requestAnimationFrame(() => preview.classList.add('show'));
      return;
    }

    this.currentSrc = imagePath;

    img.onerror = () => {
      img.onerror = null;
      img.onload = null;
      this.hide();
      img.removeAttribute('src');
    };

    img.onload = () => {
      if (this.currentSrc === imagePath) {
        preview.classList.remove('is-hidden');
        const rect = preview.getBoundingClientRect();
        this.setPosition(startX, startY, rect.width, rect.height);
        requestAnimationFrame(() => preview.classList.add('show'));
      }
    };

    img.src = imagePath;
  },

  setPosition(x, y, width, height) {
    const { preview } = ImageDOM;
    if (!preview || !width || !height) return;

    const offset = 15;
    const padding = 10;
    let left = x + offset;
    let top = y + offset;

    if (left + width > window.innerWidth - padding) {
      left = Math.max(padding, x - width - offset);
    }
    if (top + height > window.innerHeight - padding) {
      top = Math.max(padding, y - height - offset);
    }

    preview.style.left = `${left}px`;
    preview.style.top = `${top}px`;
  },

  hide() {
    const { preview, previewImg: img } = ImageDOM;
    if (!preview) return;

    preview.classList.remove('show');

    if (this.hideTimeout) {
      clearTimeout(this.hideTimeout);
    }

    this.hideTimeout = setTimeout(() => {
      preview.classList.add('is-hidden');
      this.currentSrc = ''; // リセット
      if (img) {
        img.removeAttribute('src');
        img.onerror = null;
        img.onload = null;
      }
    }, 100);
  }
};

// クリックで画像を拡大表示するモーダルサービス。
let modalFadeTimer = null; // close()のフェードアウト後処理を管理し、show()での再オープン時にキャンセルできるようにする

export const ImageModalService = {
  show(imagePath, altText = '画像') {
    const { modal, modalImg: img } = ImageDOM;
    if (!modal || !img) return;

    clearTimeout(modalFadeTimer); // 直前のclose()による遅延src削除が残っていればキャンセル

    img.alt = altText;

    img.onerror = () => {
      img.onerror = null;
      img.src = 'img/no-image.png';
    };

    if (img.getAttribute('src') !== imagePath) {
      img.src = imagePath;
    }

    modal.classList.add('show');
    document.body.style.overflow = 'hidden';
  },
  close() {
    const { modal, modalImg: img } = ImageDOM;
    if (!modal) return;

    clearTimeout(modalFadeTimer); // close()の連続呼び出しでタイマーが重複しないようにする

    modal.classList.remove('show');
    document.body.style.overflow = '';

    modalFadeTimer = setTimeout(() => {
      if (img) {
        img.removeAttribute('src');
        img.onerror = null;
      }
      modalFadeTimer = null;
    }, UI_CONFIG.MODAL_FADE_DURATION);
  }
};

// data-img-src属性を持つ要素へのホバーで画像プレビューを表示する（タッチデバイスでは無効）
export function setupImagePreviewEvents() {
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
    const el = e.target.closest('[data-img-src]');
    if (!el) return;
    if (el.contains(e.relatedTarget)) return; // 移動先が同じ要素の内部（子要素）なら何もしない
    ImagePreviewService.hide();
  });
}

// ==========================================================================
// 7. 耐性アイコン描画 (Resist Icon Rendering)
// ==========================================================================

// 耐性タイプ＋強弱 → アイコン画像パス（例: type='Fire', strength='weak' → images/icon-enemies/fire-weak.webp）
export function getResistIconPath(type, strength = 'normal') {
  const suffix = strength.toLowerCase() !== 'normal' ? `-${strength.toLowerCase()}` : '';
  return `images/icon-enemies/${type.toLowerCase()}${suffix}.webp`;
}

// 耐性テキスト（例: "FireStrong ColdWeak"）から6タイプ分の耐性グリッド(.resist-grid)のDOMを組み立てる
export function buildResistGrid(resistText) {
  const grid = createDiv('resist-grid');
  RESIST_TYPES.forEach(type => {
    const slot = createDiv('resist-slot');
    const match = resistText.match(RESIST_REGEXES[type]);

    if (match) {
      const strength = match[1] ? match[1].toLowerCase() : 'normal';
      slot.classList.add(`is-${strength}`);

      const img = document.createElement('img');
      img.src = getResistIconPath(type, strength);
      img.className = 'resist-icon';
      img.title = match[0];
      img.loading = 'lazy'; // 折りたたみ中の行も含め全行分生成されるため、初期表示コストを抑える
      img.onerror = () => { img.style.display = 'none'; };

      slot.append(img);
    } else {
      slot.classList.add('is-empty');
    }
    grid.append(slot);
  });
  return grid;
}

// ==========================================================================
// 8. データ取得 (Data Fetching)
// ==========================================================================

export const FETCH_TIMEOUT_MS = 10000; // データ取得のタイムアウト（ミリ秒）

// タイムアウト付きfetch。指定時間内にレスポンスが無ければAbortErrorで失敗する
export function fetchWithTimeout(url, timeoutMs = FETCH_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(url, { signal: controller.signal }).finally(() => clearTimeout(timer));
}

// loadData()で発生した例外から、ユーザー向けの説明文を組み立てる
export function describeLoadError(e) {
  if (e.name === 'AbortError') {
    return `通信がタイムアウトしました（${FETCH_TIMEOUT_MS / 1000}秒経過）。回線状況を確認して再読み込みしてください。`;
  }
  if (e instanceof TypeError) {
    return 'サーバーに接続できませんでした。回線状況を確認して再読み込みしてください。';
  }
  return e.message || '原因不明のエラーが発生しました。';
}
