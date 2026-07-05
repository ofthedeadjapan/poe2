import {
  RESIST_TYPES,
  escapeHTML,
  getText,
  formatMultilineHTML,
  splitLines,
  appendRow,
  ImagePreviewService,
  initImageServices,
  StorageService,
  ImageModalService,
  handleDropdownClick,
  applyFormatBodyClass,
  createDiv,
  renderMultiLineCell
} from './common.js';

// ==========================================
// 1. 定数・定義 (Constants & Definitions)
// ==========================================

const STORAGE_VERSION = 1;

const STORAGE_KEYS = {
  CAMPAIGN_STATE: 'poe2:campaignState',
  STORAGE_VERSION: 'poe2:campaignStorageVersion'
};

// ==========================================
// 2. ユーティリティ (Utilities & Helpers)
// ==========================================

// ==========================================
// 3. ストレージ・状態管理 (Storage & State)
// ==========================================

function checkStorageVersion() {
  try {
    const savedVersion = localStorage.getItem(STORAGE_KEYS.STORAGE_VERSION);
    if (!savedVersion || parseInt(savedVersion, 10) !== STORAGE_VERSION) {
      console.log(`ストレージのバージョンが変更されました (${savedVersion} -> ${STORAGE_VERSION})。データを初期化します。`);
      StorageService.remove(STORAGE_KEYS.CAMPAIGN_STATE);
      localStorage.setItem(STORAGE_KEYS.STORAGE_VERSION, String(STORAGE_VERSION));
    }
  } catch (e) {
    console.error('ストレージのバージョンチェックに失敗しました:', e);
  }
}

const AppState = {
  user: {
    checkedBuffs: new Set(),
    format: 'ja-en'
  },
  init() {
    const saved = StorageService.load(STORAGE_KEYS.CAMPAIGN_STATE);
    if (saved) {
      const savedBuffs = Array.isArray(saved.checkedBuffs) ? saved.checkedBuffs : [];
      this.user.checkedBuffs = new Set(savedBuffs);

      if (typeof saved.format === 'string') {
        this.user.format = saved.format;
      }
    }
  },
  save() {
    StorageService.save(STORAGE_KEYS.CAMPAIGN_STATE, {
      checkedBuffs: Array.from(this.user.checkedBuffs),
      format: this.user.format
    });
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
    AppState.save();
  }
};

const ViewStore = {
  buffRows: new Map(),
  buffCheckboxes: new Map()
};

// ==========================================
// 4. サービス・ロジック (Services & Processors)
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

// ==========================================
// 5. DOM・UIレンダリング (DOM, Views & Renderers)
// ==========================================

const DOM = {
  initCache() {
    this.campaignContainer = document.getElementById('campaignContainer');
    this.actNav = document.getElementById('actNav');
    this.btnOpenAll = document.getElementById('btnOpenAll');
    this.btnCloseAll = document.getElementById('btnCloseAll');
    this.btnResetBuffs = document.getElementById('btnResetBuffs');
    this.btnBackToTop = document.getElementById('btnBackToTop');
    this.bossPreview = document.getElementById('boss-preview');
    this.bossPreviewImg = document.getElementById('boss-preview-img');
    this.btnFormatText = document.getElementById('btn-format-text');
  }
};

function createCell(align = null) {
  const td = document.createElement('td');
  if (align) td.style.textAlign = align;
  return td;
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
    wrapper.append(lvSpan);
  }

  td.append(wrapper);
}

function renderBossCell(td, jaNames, enNames, images, maxLines) {
  renderMultiLineCell(td, maxLines, (wrapper, i) => {
    const jName = jaNames[i] || '';
    const eName = enNames[i] || '';
    const imgName = images[i] || '';

    if (!jName && !eName) {
      wrapper.textContent = '-';
      return;
    }

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
    wrapper.append(itemWrapper);
  });
}

function renderResistCell(td, resistLines, maxLines) {
  renderMultiLineCell(td, maxLines, (wrapper, i) => {
    const resistText = resistLines[i] || '';
    const grid = createDiv('resist-grid');

    RESIST_TYPES.forEach(type => {
      const slot = createDiv('resist-slot');
      const regex = new RegExp(`${type}(Strong|Weak)?`, 'i');
      const match = resistText.match(regex);

      if (match) {
        const strength = match[1] ? match[1].toLowerCase() : 'normal';
        const fileName = `${type.toLowerCase()}${strength !== 'normal' ? '-' + strength : ''}`;

        if (strength === 'strong') slot.classList.add('is-strong');
        else if (strength === 'weak') slot.classList.add('is-weak');
        else slot.classList.add('is-normal');

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
    wrapper.append(grid);
  });
}

function renderAttackCell(td, atkLines, maxLines) {
  renderMultiLineCell(td, maxLines, (wrapper, i) => {
    const atkText = atkLines[i] || '';
    if (atkText) {
      const div = createDiv('cell-atk-type');
      div.textContent = atkText;
      wrapper.append(div);
    } else {
      wrapper.textContent = '-';
    }
  });
}

function renderMemoCell(td, boss) {
  const div = createDiv('cell-memo');
  div.innerHTML = formatMultilineHTML(boss['メモ']);
  td.append(div);
}

const NavigationRenderer = {
  createLink(act) {
    const actId = `act-sec-${act}`;
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
    return navLink;
  }
};

const BuffTableRenderer = {
  create(buffs) {
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
    const tbody = buffTable.querySelector('tbody');

    buffs.forEach(buff => {
      if (!buff.id) return;
      const tr = this.createRow(buff);
      tbody.append(tr);
    });

    buffTableWrapper.append(buffTable);
    buffWrapper.append(buffTableWrapper);
    return buffWrapper;
  },

  createRow(buff) {
    const tr = document.createElement('tr');
    tr.className = 'buff-row';

    const isChecked = AppState.user.checkedBuffs.has(buff.id);
    if (isChecked) tr.classList.add('is-checked');

    const tdCheck = createCell('center');
    const chk = document.createElement('input');
    chk.type = 'checkbox';
    chk.className = 'buff-checkbox';
    chk.checked = isChecked;
    tdCheck.append(chk);

    ViewStore.buffRows.set(buff.id, tr);
    ViewStore.buffCheckboxes.set(buff.id, chk);

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
      PersistenceService.scheduleSave();
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
    return tr;
  }
};

const BossTableRenderer = {
  create(bosses) {
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

    bosses.forEach(boss => {
      const tr = this.createRow(boss);
      tbody.append(tr);
    });

    table.append(tbody);
    tableWrapper.append(table);
    return tableWrapper;
  },

  createRow(boss) {
    const jaNames = splitLines(boss['ボス日本語']);
    const enNames = splitLines(boss['ボス英語']);
    const images = splitLines(boss['bossimage']);
    const resistLines = splitLines(boss['耐性アイコン']);
    const atkLines = splitLines(boss['攻撃属性（物理以外）']);
    const maxLines = Math.max(jaNames.length, enNames.length, resistLines.length, atkLines.length);

    const tr = document.createElement('tr');

    const tdArea = createCell();
    tdArea.className = 'area-cell';
    renderAreaCell(tdArea, boss);

    const tdBoss = createCell();
    tdBoss.className = 'boss-cell';
    renderBossCell(tdBoss, jaNames, enNames, images, maxLines);

    const tdResist = createCell();
    tdResist.className = 'resist-cell';
    renderResistCell(tdResist, resistLines, maxLines);

    const tdAtk = createCell();
    tdAtk.className = 'attack-cell';
    renderAttackCell(tdAtk, atkLines, maxLines);

    const tdMemo = createCell();
    tdMemo.className = 'memo-cell';
    renderMemoCell(tdMemo, boss);

    tr.append(tdArea, tdBoss, tdResist, tdAtk, tdMemo);
    return tr;
  }
};

const ActSectionRenderer = {
  createSection(act, group) {
    const section = document.createElement('section');
    section.className = 'act-section is-open';
    section.id = `act-sec-${act}`;

    section.append(this.createHeader(act));

    const content = createDiv('act-content');
    if (group.buffs && group.buffs.length > 0) {
      content.append(BuffTableRenderer.create(group.buffs));
    }
    if (group.bosses && group.bosses.length > 0) {
      content.append(BossTableRenderer.create(group.bosses));
    }

    section.append(content);
    return section;
  },

  createHeader(act) {
    const header = createDiv('act-header');
    header.dataset.click = 'toggleSection';

    const h2 = document.createElement('h2');
    h2.textContent = isNaN(parseInt(act, 10)) ? act : `アクト ${act}`;

    const toggleIcon = document.createElement('span');
    toggleIcon.className = 'toggle-icon-text';
    toggleIcon.textContent = '▲ 閉じる';

    header.append(h2, toggleIcon);
    return header;
  }
};

const CampaignRenderer = {
  renderAll(groups) {
    DOM.campaignContainer.innerHTML = '';
    DOM.actNav.innerHTML = '';

    ViewStore.buffRows.clear();
    ViewStore.buffCheckboxes.clear();

    const sortedActs = Object.keys(groups).sort((a, b) => {
      const numA = parseInt(a, 10);
      const numB = parseInt(b, 10);
      if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
      return String(a).localeCompare(String(b));
    });

    const navFragment = document.createDocumentFragment();
    const mainFragment = document.createDocumentFragment();

    sortedActs.forEach(act => {
      const group = groups[act];
      navFragment.append(NavigationRenderer.createLink(act));
      mainFragment.append(ActSectionRenderer.createSection(act, group));
    });

    DOM.actNav.append(navFragment);
    DOM.campaignContainer.append(mainFragment);
  }
};

// ==========================================
// 6. コントローラー (Controllers)
// ==========================================

const RenderCoordinator = {
  refreshFormat() {
    FormatController.updateUI();
  }
};

const FormatController = {
  setFormat(mode) {
    if (AppState.user.format === mode) return;
    AppState.user.format = mode;
    PersistenceService.scheduleSave();
    RenderCoordinator.refreshFormat();
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

    applyFormatBodyClass(mode);
  }
};

const ResetController = {
  resetBuffs() {
    if (!window.confirm('すべての永続バフのチェックをリセットしますか？')) return;
    AppState.user.checkedBuffs.clear();
    PersistenceService.scheduleSave();

    ViewStore.buffCheckboxes.forEach(chk => chk.checked = false);
    ViewStore.buffRows.forEach(row => row.classList.remove('is-checked'));
  }
};

// ==========================================
// 7. イベント管理 (Events)
// ==========================================

const CLICK_ACTIONS = {
  toggleSection: el => ToggleService.toggleSection(el.closest('.act-section')),
  showModal: el => ImageModalService.show(`images/bosses/${el.dataset.imgSrc}.webp`),
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
    const imagePath = `images/bosses/${el.dataset.imgSrc}.webp`;
  ImagePreviewService.show(imagePath, e.clientX, e.clientY);
}, true);

document.addEventListener('pointermove', e => {
  const el = e.target.closest('[data-img-src]');
  if (!el) return;
  ImagePreviewService.move(e.clientX, e.clientY);
}, true);

document.addEventListener('pointerleave', e => {
  if (!e.target.closest('[data-img-src]')) return;
  ImagePreviewService.hide();
}, true);

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') PersistenceService.flush();
  });
  window.addEventListener('pagehide', () => PersistenceService.flush());
}

// ==========================================
// 8. アプリ初期化 (App Initializer)
// ==========================================

const App = {
  async init() {
    try {
      DOM.initCache();
      initImageServices();
      checkStorageVersion();
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
      const [bossesRes, buffsRes] = await Promise.all([
        fetch('json/poe2-campaign-bosses.json'),
        fetch('json/poe2-campaign-buffs.json')
      ]);

      if (!bossesRes.ok) throw new Error(`Bosses HTTP status: ${bossesRes.status}`);
      if (!buffsRes.ok) throw new Error(`Buffs HTTP status: ${buffsRes.status}`);

      const bossesData = await bossesRes.json();
      const buffsData = await buffsRes.json();

      const combinedData = {
        bosses: Array.isArray(bossesData) ? bossesData : [],
        buffs: Array.isArray(buffsData) ? buffsData : []
      };

      const groups = groupDataByAct(combinedData);

      CampaignRenderer.renderAll(groups);

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

App.init();