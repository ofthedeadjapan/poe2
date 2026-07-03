// ==========================================
// 1. 定数・定義 (Constants & Definitions)
// ==========================================

const STORAGE_KEYS = {
  CAMPAIGN_STATE: 'poe2:campaignState'
};

// 6枠固定の耐性アイコン順序（エンドゲームマップ仕様に準拠）
const RESIST_ORDER = ['Armour', 'Evasion', 'Fire', 'Cold', 'Lightning', 'Chaos'];

// ==========================================
// 2. ユーティリティ関数群 (Utilities)
// ==========================================

function escapeHTML(str) {
  return str.replace(/[&<>'"]/g, tag => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    "'": '&#39;',
    '"': '&quot;'
  }[tag] || tag));
}

function getText(obj, key) {
  return obj[key] ? String(obj[key]).trim() : '';
}

function formatMultilineHTML(value, empty = '-') {
  if (value == null) return empty;
  const text = String(value).trim();
  if (!text) return empty;
  return escapeHTML(text).replace(/\n/g, '<br>');
}

function createCell(align = null) {
  const td = document.createElement('td');
  if (align) td.style.textAlign = align;
  return td;
}

function createDiv(className = '') {
  const div = document.createElement('div');
  if (className) div.className = className;
  return div;
}

function createLanguageContainer(ja, en, defaultJa = '-', defaultEn = '') {
  const container = createDiv('cell-lang-container');
  const jaDiv = createDiv('lang-ja');
  jaDiv.innerHTML = formatMultilineHTML(ja, defaultJa);
  const enDiv = createDiv('lang-en');
  enDiv.innerHTML = formatMultilineHTML(en, defaultEn);
  container.append(jaDiv, enDiv);
  return container;
}

// ==========================================
// 3. 状態管理 & キャッシュ (State & DOM Cache)
// ==========================================

const AppState = {
  user: {
    checkedBuffs: new Set(),
    format: 'ja-en'
  },
  init() {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.CAMPAIGN_STATE);
      if (saved) {
        const parsed = JSON.parse(saved);

        this.user.checkedBuffs = new Set(parsed.checkedBuffs || []);

        if (typeof parsed.format === 'string') {
          this.user.format = parsed.format;
        }
      }
    } catch (e) {
      console.warn('AppState: データの読み込みに失敗しました', e);
    }
  },
  save() {
    try {
      localStorage.setItem(STORAGE_KEYS.CAMPAIGN_STATE, JSON.stringify({
        checkedBuffs: Array.from(this.user.checkedBuffs),
        format: this.user.format
      }));
    } catch (e) {
      console.warn('AppState: データの保存に失敗しました', e);
    }
  }
};

const DOM = {
  initCache() {
    this.campaignContainer = document.getElementById('campaignContainer');
    this.actNav = document.getElementById('actNav');

    this.btnOpenAll = document.getElementById('btnOpenAll');
    this.btnCloseAll = document.getElementById('btnCloseAll');
    this.btnResetBuffs = document.getElementById('btnResetBuffs');
    this.btnBackToTop = document.getElementById('btnBackToTop');

    this.bossModal = document.getElementById('boss-modal');
    this.bossModalImg = document.getElementById('boss-modal-img');
    this.bossPreview = document.getElementById('boss-preview');
    this.bossPreviewImg = document.getElementById('boss-preview-img');

    this.btnFormatText = document.getElementById('btn-format-text');
  }
};

// ==========================================
// 4. UIロジック・調整用 (Services)
// ==========================================

const ToggleService = {
  toggleSection(section, forceState = null) {
    if (!section) return;
    const isOpen = forceState !== null ? forceState : !section.classList.contains('is-open');
    section.classList.toggle('is-open', isOpen);

    const iconText = section.querySelector('.toggle-icon-text');
    if (iconText) {
      iconText.textContent = isOpen ? '▲ 閉じる' : '▼ 開く';
    }
  },
  toggleAll(forceOpen) {
    const sections = document.querySelectorAll('.act-section');
    sections.forEach(sec => this.toggleSection(sec, forceOpen));
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
  hideTimeout: null,

  show(imgSrc, x, y) {
    if (this.isTouchDevice || !imgSrc) return;

    if (this.hideTimeout) {
      clearTimeout(this.hideTimeout);
      this.hideTimeout = null;
    }

    if (this.currentSrc === imgSrc && DOM.bossPreview.classList.contains('show')) {
      this.move(x, y);
      return;
    }

    this.currentSrc = imgSrc;
    const fullPath = `images/bosses/${imgSrc}.webp`;

    DOM.bossPreviewImg.src = fullPath;
    DOM.bossPreview.classList.remove('is-hidden');

    requestAnimationFrame(() => {
      const rect = DOM.bossPreview.getBoundingClientRect();
      this.cachedWidth = rect.width || 200;
      this.cachedHeight = rect.height || 200;
      this.move(x, y);
      DOM.bossPreview.classList.add('show');
    });
  },

  move(x, y) {
    if (!this.cachedWidth || !this.cachedHeight) return;
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

    DOM.bossPreview.style.left = `${left}px`;
    DOM.bossPreview.style.top = `${top}px`;
  },

  hide() {
    this.currentSrc = '';
    DOM.bossPreview.classList.remove('show');

    if (this.hideTimeout) {
      clearTimeout(this.hideTimeout);
    }

    this.hideTimeout = setTimeout(() => {
      DOM.bossPreview.classList.add('is-hidden');
      DOM.bossPreviewImg.src = '';
      this.cachedWidth = 0;
      this.cachedHeight = 0;
    }, 50);
  }
};

// ==========================================
// 5. コントローラー層 (Controllers)
// ==========================================

const FormatController = {
  setFormat(mode) {
    if (AppState.user.format === mode) return;
    AppState.user.format = mode;
    AppState.save();
    this.updateUI();
  },
  updateUI() {
    const mode = AppState.user.format || 'ja-en';

    const labels = {
      'ja-en': '日＋英',
      'en-ja': '英＋日',
      'ja-only': '日のみ',
      'en-only': '英のみ'
    };

    if (DOM.btnFormatText) {
      DOM.btnFormatText.innerText = labels[mode];
    }

    document.querySelectorAll('[data-click="setFormat"]').forEach(btn => {
      const isActive = btn.dataset.format === mode;
      btn.classList.toggle('is-active', isActive);
    });

    // エンドゲームマップ仕様と統一: data属性ではなくbodyのクラスを付与/削除する
    document.body.classList.remove('lang-ja-en', 'lang-en-ja', 'lang-ja-only', 'lang-en-only');
    document.body.classList.add(`lang-${mode}`);
  }
};

const ResetController = {
  resetBuffs() {
    if (!window.confirm('すべての永続バフのチェックをリセットしますか？')) {
      return;
    }

    AppState.user.checkedBuffs.clear();
    AppState.save();

    document.querySelectorAll('.buff-checkbox').forEach(chk => {
      chk.checked = false;
    });
    document.querySelectorAll('.buff-row.is-checked').forEach(row => {
      row.classList.remove('is-checked');
    });
  }
};

// ==========================================
// 6. イベント登録 & 委譲 (Events)
// ==========================================

const CLICK_ACTIONS = {
  toggleSection: el => ToggleService.toggleSection(el.closest('.act-section')),
  showModal: el => ModalService.show(el.dataset.imgSrc),
  closeModal: () => ModalService.close(),
  setFormat: el => FormatController.setFormat(el.dataset.format)
};

function setupEventListeners() {
  if (DOM.btnOpenAll) {
    DOM.btnOpenAll.addEventListener('click', () => ToggleService.toggleAll(true));
  }
  if (DOM.btnCloseAll) {
    DOM.btnCloseAll.addEventListener('click', () => ToggleService.toggleAll(false));
  }

  if (DOM.btnResetBuffs) {
    DOM.btnResetBuffs.addEventListener('click', () => ResetController.resetBuffs());
  }

  if (DOM.btnBackToTop) {
    let isTicking = false;
    window.addEventListener('scroll', () => {
      if (!isTicking) {
        window.requestAnimationFrame(() => {
          DOM.btnBackToTop.classList.toggle('is-hidden', window.scrollY <= 300);
          isTicking = false;
        });
        isTicking = true;
      }
    }, { passive: true });

    DOM.btnBackToTop.addEventListener('click', () => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && DOM.bossModal.classList.contains('show')) {
      ModalService.close();
    }
  });

  document.addEventListener('click', e => {
    if (e.target === DOM.bossModal) {
      ModalService.close();
      return;
    }

    handleDropdownClick(e);

    const el = e.target.closest('[data-click]');
    if (el) CLICK_ACTIONS[el.dataset.click]?.(el);
  });

  document.addEventListener('pointerenter', e => {
    const el = e.target.closest('[data-img-src]');
    if (!el) return;
    PreviewService.show(el.dataset.imgSrc, e.clientX, e.clientY);
  }, true);

  document.addEventListener('pointermove', e => {
    const el = e.target.closest('[data-img-src]');
    if (!el) return;
    PreviewService.move(e.clientX, e.clientY);
  }, true);

  document.addEventListener('pointerleave', e => {
    if (!e.target.closest('[data-img-src]')) return;
    PreviewService.hide();
  }, true);
}

function handleDropdownClick(e) {
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

// ==========================================
// 7. データ集計 & ソート (Data Processor)
// ==========================================

function groupDataByAct(data) {
  const groups = {};
  const getGroup = (actStr) => {
    const key = actStr || 'その他';
    if (!groups[key]) groups[key] = { bosses: [], buffs: [] };
    return groups[key];
  };

  data.bosses.forEach(item => {
    if (item) getGroup(getText(item, 'アクト')).bosses.push(item);
  });
  data.buffs.forEach(item => {
    if (item) getGroup(getText(item, 'アクト')).buffs.push(item);
  });
  return groups;
}

// ==========================================
// 8. 動的DOMレンダリング (Renderers)
// ==========================================

function renderAreaCell(td, item) {
  const jaText = getText(item, 'エリア日本語');
  const enText = getText(item, 'エリア英語');

  const wrapper = createDiv('area-cell-wrapper');
  wrapper.style.display = 'flex';
  wrapper.style.justifyContent = 'space-between';
  wrapper.style.alignItems = 'center';
  wrapper.style.gap = '8px';
  wrapper.style.width = '100%';

  wrapper.append(createLanguageContainer(jaText, enText));

  const rawLv = parseInt(item['モンスターレベル'], 10);
  if (!isNaN(rawLv)) {
    const lvSpan = document.createElement('span');
    lvSpan.className = 'area-level';
    lvSpan.textContent = `Lv.${rawLv}`;
    lvSpan.style.color = 'var(--text-muted)';
    lvSpan.style.fontSize = '13px';
    lvSpan.style.whiteSpace = 'nowrap';
    wrapper.append(lvSpan);
  }

  td.append(wrapper);
}

function renderBossCell(td, boss) {
  const jaText = getText(boss, 'ボス日本語');
  const enText = getText(boss, 'ボス英語');
  if (!jaText && !enText) { td.textContent = '-'; return; }

  const jaNames = jaText.split('\n');
  const enNames = getText(boss, 'ボス英語').split('\n');
  const images = getText(boss, 'bossimage').split('\n');

  const maxLines = Math.max(jaNames.length, enNames.length);

  for (let i = 0; i < maxLines; i++) {
    const jName = jaNames[i] ? jaNames[i].trim() : '';
    const eName = enNames[i] ? enNames[i].trim() : '';
    const imgName = images[i] ? images[i].trim() : '';

    if (!jName && !eName) continue;

    const itemWrapper = createDiv('boss-item-wrapper cell-lang-container');

    if (imgName) {
      itemWrapper.classList.add('has-image');
      Object.assign(itemWrapper.dataset, { click: 'showModal', imgSrc: imgName });
    }

    const dJa = createDiv('lang-ja');
    dJa.textContent = jName || '-';

    const dEn = createDiv('lang-en');
    dEn.textContent = eName || '';

    itemWrapper.append(dJa, dEn);
    td.append(itemWrapper);
  }
}

function renderResistCell(td, boss) {
  const resistText = getText(boss, '耐性アイコン');
  const grid = createDiv('resist-grid');

  RESIST_ORDER.forEach(type => {
    const slot = createDiv('resist-slot');
    const regex = new RegExp(`${type}(Strong|Weak)?`, 'i');
    const match = resistText.match(regex);

    if (match) {
      const strength = match[1] ? match[1].toLowerCase() : 'normal';
      const fileName = `${type.toLowerCase()}${strength !== 'normal' ? '-' + strength : ''}`;

      if (strength === 'strong') {
        slot.classList.add('is-strong');
      } else if (strength === 'weak') {
        slot.classList.add('is-weak');
      } else {
        slot.classList.add('is-normal');
      }

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

  td.append(grid);
}

function renderMemoCell(td, boss) {
  const div = createDiv('cell-memo');
  div.innerHTML = formatMultilineHTML(boss['メモ']);
  td.append(div);
}

function renderCampaign(groups) {
  DOM.campaignContainer.innerHTML = '';
  DOM.actNav.innerHTML = '';

  const sortedActs = Object.keys(groups).sort((a, b) => {
    const numA = parseInt(a, 10);
    const numB = parseInt(b, 10);
    if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
    return String(a).localeCompare(String(b));
  });

  const navFragment = document.createDocumentFragment();
  const mainFragment = document.createDocumentFragment();

  sortedActs.forEach(act => {
    const actId = `act-sec-${act}`;
    const group = groups[act];

    const navLink = document.createElement('a');
    navLink.href = `#${actId}`;
    navLink.className = 'act-nav-link';
    navLink.textContent = isNaN(parseInt(act, 10)) ? act : `アクト ${act}`;
    navLink.addEventListener('click', (e) => {
      e.preventDefault();
      const target = document.getElementById(actId);
      if (target) {
        ToggleService.toggleSection(target, true);
        target.scrollIntoView({ behavior: 'smooth' });
      }
    });
    navFragment.append(navLink);

    const section = document.createElement('section');
    section.className = 'act-section is-open';
    section.id = actId;

    const header = createDiv('act-header');
    header.dataset.click = 'toggleSection';

    const h2 = document.createElement('h2');
    h2.textContent = isNaN(parseInt(act, 10)) ? act : `アクト ${act}`;

    const toggleIcon = document.createElement('span');
    toggleIcon.className = 'toggle-icon-text';
    toggleIcon.textContent = '▲ 閉じる';

    header.append(h2, toggleIcon);
    section.append(header);

    const content = createDiv('act-content');

    if (group.buffs && group.buffs.length > 0) {
      const buffWrapper = createDiv('buff-list-wrapper');

      const bTitle = document.createElement('h3');
      bTitle.className = 'buff-list-title';
      bTitle.textContent = '◆ 獲得可能な永続バフ・報酬';
      buffWrapper.append(bTitle);

      const buffTableWrapper = createDiv('buff-table-wrapper');
      const buffTable = document.createElement('table');
      buffTable.className = 'buff-table';
      buffTable.innerHTML = `
    <thead>
     <tr>
      <th style="width: 50px; text-align: center;">☑</th>
      <th style="width: 35%;">永続バフ</th>
      <th style="width: 25%;">エリア</th>
      <th style="width: 40%;">獲得方法</th>
     </tr>
    </thead>
    <tbody></tbody>
   `;
      const buffTbody = buffTable.querySelector('tbody');

      group.buffs.forEach(buff => {
        if (!buff.id) return;
        const tr = document.createElement('tr');
        tr.className = 'buff-row';

        const isChecked = AppState.user.checkedBuffs.has(buff.id);
        if (isChecked) {
          tr.classList.add('is-checked');
        }

        const tdCheck = createCell('center');
        const chk = document.createElement('input');
        chk.type = 'checkbox';
        chk.className = 'buff-checkbox';
        chk.checked = isChecked;
        tdCheck.append(chk);

        tr.addEventListener('click', (e) => {
          if (e.target.tagName !== 'INPUT' && e.target.tagName !== 'A') {
            chk.click();
          }
        });

        chk.addEventListener('change', () => {
          if (chk.checked) {
            AppState.user.checkedBuffs.add(buff.id);
            tr.classList.add('is-checked');
          } else {
            AppState.user.checkedBuffs.delete(buff.id);
            tr.classList.remove('is-checked');
          }
          AppState.save();
        });

        const tdBuff = createCell();
        const buffData = buff['永続バフ'];

        if (Array.isArray(buffData)) {
          const choiceContainer = createDiv('buff-choice-container');

          const label = createDiv('buff-choice-label');
          label.textContent = '※以下から1つを選択';

          const ul = document.createElement('ul');
          ul.className = 'buff-choice-list';

          buffData.forEach(choiceText => {
            const li = document.createElement('li');
            li.innerHTML = formatMultilineHTML(choiceText, '');
            ul.append(li);
          });

          choiceContainer.append(label, ul);
          tdBuff.append(choiceContainer);
        } else {
          tdBuff.innerHTML = formatMultilineHTML(buffData);
        }

        const tdArea = createCell();
        renderAreaCell(tdArea, buff);

        const tdMethod = createCell();
        tdMethod.textContent = getText(buff, '獲得方法') || '-';

        tr.append(tdCheck, tdBuff, tdArea, tdMethod);
        buffTbody.append(tr);
      });

      buffTableWrapper.append(buffTable);
      buffWrapper.append(buffTableWrapper);
      content.append(buffWrapper);
    }

    if (group.bosses && group.bosses.length > 0) {
      const tableWrapper = createDiv('table-wrapper');
      const table = document.createElement('table');
      table.innerHTML = `
 <thead>
  <tr>
   <th style="width: 220px;">エリア</th>
   <th style="width: 220px;">ボス</th>
   <th style="width: 176px;">耐性アイコン</th>
   <th style="width: 130px; line-height: 1.3;">攻撃属性<br><span class="th-sub">（物理以外）</span></th>
   <th>メモ</th>
  </tr>
 </thead>
`;
      const tbody = document.createElement('tbody');

      group.bosses.forEach(boss => {
        const tr = document.createElement('tr');

        const tdArea = createCell();
        renderAreaCell(tdArea, boss);

        const tdBoss = createCell();
        renderBossCell(tdBoss, boss);

        const tdResist = createCell();
        renderResistCell(tdResist, boss);

        const tdAtk = createCell();
        const divAtk = createDiv('cell-atk-type');
        divAtk.innerHTML = formatMultilineHTML(boss['攻撃属性（物理以外）']);
        tdAtk.append(divAtk);

        const tdMemo = createCell();
        renderMemoCell(tdMemo, boss);

        tr.append(tdArea, tdBoss, tdResist, tdAtk, tdMemo);
        tbody.append(tr);
      });

      table.append(tbody);
      tableWrapper.append(table);
      content.append(tableWrapper);
    }

    section.append(content);
    mainFragment.append(section);
  });

  DOM.actNav.append(navFragment);
  DOM.campaignContainer.append(mainFragment);
}

// ==========================================
// 9. 初期化 (App Initializer)
// ==========================================

const App = {
  async init() {
    try {
      DOM.initCache();
      AppState.init();
      FormatController.updateUI();
      setupEventListeners();
      await this.loadData();
    } catch (e) {
      console.error('App初期化エラー:', e);
    }
  },

  async loadData() {
    try {
      // 2つのJSONファイルを並行して取得
      const [bossesRes, buffsRes] = await Promise.all([
        fetch('json/poe2-campaign-bosses.json'),
        fetch('json/poe2-campaign-buffs.json')
      ]);

      if (!bossesRes.ok) throw new Error(`Bosses HTTP status: ${bossesRes.status}`);
      if (!buffsRes.ok) throw new Error(`Buffs HTTP status: ${buffsRes.status}`);

      const bossesData = await bossesRes.json();
      const buffsData = await buffsRes.json();

      // 既存の groupDataByAct 関数が期待する形式にデータを結合
      const combinedData = {
        bosses: Array.isArray(bossesData) ? bossesData : [],
        buffs: Array.isArray(buffsData) ? buffsData : []
      };

      const groups = groupDataByAct(combinedData);
      renderCampaign(groups);
    } catch (e) {
      console.error('JSON読み込み失敗:', e);
      if (DOM.campaignContainer) {
        DOM.campaignContainer.innerHTML = `
     <p style="text-align: center; color: #ef4444; padding: 40px 0; font-weight: bold;">
      データの読み込みに失敗しました。<br>
      "json/poe2-campaign-bosses.json" と "json/poe2-campaign-buffs.json" が正しく出力・配置されているか確認してください。
     </p>
    `;
      }
    }
  }
};

document.addEventListener('DOMContentLoaded', () => App.init());