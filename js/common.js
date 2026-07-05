// ==========================================================================
// 1. 定数・設定 (Constants & Config)
// ==========================================================================
export const RESIST_TYPES = ['Armour', 'Evasion', 'Fire', 'Cold', 'Lightning', 'Chaos'];

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
export function escapeHTML(str) {
  if (typeof str !== 'string') return str;
  return str.replace(/[&'`"<>]/g, function(match) {
    return {
      '&': '&amp;',
      "'": '&#x27;',
      '`': '&#x60;',
      '"': '&quot;',
      '<': '&lt;',
      '>': '&gt;',
    }[match]
  });
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
 * テーブルに行(tr)とセル(td)を生成して追加する共通関数
 */
export function appendRow(parent, cells) {
  const tr = document.createElement('tr');
  cells.forEach(cell => {
    const td = document.createElement('td');
    if (cell && typeof cell === 'object') {
      td.textContent = cell.text == null ? '' : cell.text;
      if (cell.className) td.className = cell.className;
    } else {
      td.textContent = cell == null ? '' : cell;
    }
    tr.append(td);
  });
  parent.append(tr);
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
  td.append(listWrapper);
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

// ==========================================================================
// 5. UI・フォーマット制御 (UI & Formatting)
// ==========================================================================

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
    const btn = d.querySelector('.btn-dropdown, .card-dropdown-btn');
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
    'lang-ja-only', 'lang-en-only', 'lang-both',
    'lang-ja-main', 'lang-en-main', 'lang-ja-en', 'lang-en-ja'
  );
  document.body.classList.add(`lang-${mode}`);
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

export const ImagePreviewService = {
  isTouchDevice: window.matchMedia('(hover: none)').matches,
  cachedWidth: 0,
  cachedHeight: 0,
  currentSrc: '',
  hideTimeout: null,

  show(imagePath, x, y) {
    const { preview, previewImg: img } = ImageDOM;
    if (this.isTouchDevice || !preview || !img || !imagePath) return;

    if (this.hideTimeout) {
      clearTimeout(this.hideTimeout);
      this.hideTimeout = null;
    }

    if (this.currentSrc === imagePath && preview.classList.contains('show')) {
      this.move(x, y);
      return;
    }

    img.onerror = () => {
      img.onerror = null;
      this.hide();
      img.removeAttribute('src');
    };

    this.currentSrc = imagePath;

    if (img.getAttribute('src') !== imagePath) {
      img.src = imagePath;
    }

    // display:none を解除
    preview.classList.remove('is-hidden');

    requestAnimationFrame(() => {
      const rect = preview.getBoundingClientRect();
      this.cachedWidth = rect.width || 200;
      this.cachedHeight = rect.height || 200;
      this.move(x, y);

      preview.classList.add('show');
    });
  },

  move(x, y) {
    const { preview } = ImageDOM;
    if (!preview || !this.cachedWidth || !this.cachedHeight) return;

    const offset = 15;
    const padding = 10;
    let left = x + offset;
    let top = y + offset;

    if (left + this.cachedWidth > window.innerWidth - padding) {
      left = Math.max(padding, x - this.cachedWidth - offset);
    }
    if (top + this.cachedHeight > window.innerHeight - padding) {
      top = Math.max(padding, y - this.cachedHeight - offset);
    }

    preview.style.left = `${left}px`;
    preview.style.top = `${top}px`;
  },

  hide() {
    const { preview, previewImg: img } = ImageDOM;
    if (!preview) return;

    this.currentSrc = '';

    preview.classList.remove('show');

    if (this.hideTimeout) {
      clearTimeout(this.hideTimeout);
    }

    this.hideTimeout = setTimeout(() => {
      preview.classList.add('is-hidden');
      if (img) {
        img.removeAttribute('src');
        img.onerror = null;
      }
      this.cachedWidth = 0;
      this.cachedHeight = 0;
    }, 50);
  }
};

export const ImageModalService = {
  show(imagePath) {
    const { modal, modalImg: img } = ImageDOM;
    if (!modal || !img) return;

    img.onerror = () => {
      img.onerror = null;
      this.close();
      img.removeAttribute('src');
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

    modal.classList.remove('show');
    document.body.style.overflow = '';

    setTimeout(() => {
      if (img) {
        img.removeAttribute('src');
        img.onerror = null;
      }
    }, UI_CONFIG.MODAL_FADE_DURATION);
  }
};