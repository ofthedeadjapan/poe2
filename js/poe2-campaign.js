import {
  getText,
  formatMultilineHTML,
  splitLines,
  initImageServices,
  StorageService,
  ImageModalService,
  handleDropdownClick,
  applyFormatBodyClass,
  createFormatController,
  createDiv,
  renderMultiLineCell,
  buildResistGrid,
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

const STORAGE_VERSION = 1;

const STORAGE_KEYS = {
  CAMPAIGN_STATE: 'poe2:campaignState'
};

// 複数箇所で参照されるデータのフィールド名（タイポ検出・変更時の一括修正のために集約）
const FIELDS = {
  ACT: 'アクト',
  AREA_JA: 'エリア日本語',
  AREA_EN: 'エリア英語',
  MONSTER_LV: 'モンスターレベル',
  BUFF_CHOICES: '永続バフ',
  BUFF_METHOD: '獲得方法',
  BOSS_JA: 'ボス日本語',
  BOSS_EN: 'ボス英語',
  BOSS_IMAGE: 'bossimage',
  RESIST: '耐性アイコン',
  ATTACK_TYPE: '攻撃属性（物理以外）',
  MEMO: 'メモ'
};

// ==========================================
// 2. ストレージ・状態管理 (Storage & State)
// ==========================================

// 状態（データ）を保持するオブジェクト
const AppState = {
  user: null,
  init() {
    this.user = UserStateService.load();
  }
};

const UserStateService = {
  load() {
    const saved = loadVersionedState(STORAGE_KEYS.CAMPAIGN_STATE, STORAGE_VERSION, () => ({
      checkedBuffs: [],
      format: 'ja-en'
    }));

    return {
      checkedBuffs: new Set(Array.isArray(saved.checkedBuffs) ? saved.checkedBuffs : []),
      format: typeof saved.format === 'string' ? saved.format : 'ja-en'
    };
  },
  save() {
    StorageService.save(STORAGE_KEYS.CAMPAIGN_STATE, {
      version: STORAGE_VERSION,
      checkedBuffs: Array.from(AppState.user.checkedBuffs),
      format: AppState.user.format
    });
  }
};

const PersistenceService = createDebouncedSaver(() => UserStateService.save());

const ViewStore = {
  buffRows: new Map(),
  buffCheckboxes: new Map()
};

// ==========================================
// 3. サービス・ロジック (Services & Processors)
// ==========================================

function validateBuffIds(buffs) {
  const seenIds = new Set();
  buffs.forEach((buff, idx) => {
    if (!buff || !buff.id) {
      throw new Error(`永続バフデータの ${idx + 1} 件目に id がありません。`);
    }
    if (seenIds.has(buff.id)) {
      throw new Error(`永続バフデータの id が重複しています: ${buff.id}`);
    }
    seenIds.add(buff.id);
  });
}

// 現在のデータに存在しないbuff.idを、保存済みのchecked状態から除去する
// （JSON側でidが変更・削除された場合に、古いidがlocalStorageへ残留し続けるのを防ぐ）
function pruneCheckedBuffs(buffs) {
  const validIds = new Set(buffs.map(b => b.id));
  const staleIds = [...AppState.user.checkedBuffs].filter(id => !validIds.has(id));
  if (staleIds.length === 0) return;
  staleIds.forEach(id => AppState.user.checkedBuffs.delete(id));
  PersistenceService.scheduleSave();
}

function groupDataByAct(data) {
  const groups = {};
  const getGroup = (actStr) => {
    const key = actStr || 'その他';
    if (!groups[key]) groups[key] = { bosses: [], buffs: [] };
    return groups[key];
  };

  data.bosses.forEach(item => {
    if (item) getGroup(getText(item, FIELDS.ACT)).bosses.push(item);
  });
  data.buffs.forEach(item => {
    if (item) getGroup(getText(item, FIELDS.ACT)).buffs.push(item);
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

    const header = section.querySelector('.act-header');
    if (header) header.setAttribute('aria-expanded', String(isOpen));
  },
  toggleAll(forceOpen) {
    const sections = document.querySelectorAll('.act-section');
    sections.forEach(sec => this.toggleSection(sec, forceOpen));
  }
};

// ==========================================
// 4. DOM・UIレンダリング (DOM, Views & Renderers)
// ==========================================

const DOM = {
  initCache() {
    this.campaignContainer = document.getElementById('campaignContainer');
    this.actNav = document.getElementById('actNav');
    this.btnBackToTop = document.getElementById('btnBackToTop');
    this.btnFormatText = document.getElementById('btn-format-text');
    this.fatalErrorMessage = document.getElementById('fatal-error-message');
  },
  showFatalError(message) {
    const lines = Array.isArray(message) ? message : [message];
    renderErrorBox(this.fatalErrorMessage, lines);
  }
};

function createCell(align = null) {
  const td = document.createElement('td');
  if (align) td.style.textAlign = align;
  return td;
}

function renderAreaCell(td, item) {
  const jaText = getText(item, FIELDS.AREA_JA);
  const enText = getText(item, FIELDS.AREA_EN);

  const wrapper = createDiv('area-cell-wrapper');
  wrapper.style.display = 'flex';
  wrapper.style.justifyContent = 'space-between';
  wrapper.style.alignItems = 'center';
  wrapper.style.gap = '8px';
  wrapper.style.width = '100%';

  wrapper.append(createLanguageContainer(jaText, enText));

  const rawLv = parseInt(item[FIELDS.MONSTER_LV], 10);
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

    const itemWrapper = createDiv('boss-item-wrapper');
    // createLanguageContainer 側で自動的に画像リンク処理（has-imageなど）が行われる
    itemWrapper.append(createLanguageContainer(jName, eName, imgName));
    wrapper.append(itemWrapper);
  });
}

function renderResistCell(td, resistLines, maxLines) {
  renderMultiLineCell(td, maxLines, (wrapper, i) => {
    wrapper.append(buildResistGrid(resistLines[i] || ''));
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
  div.innerHTML = formatMultilineHTML(boss[FIELDS.MEMO]);
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
        <th class="col-buff-check">☑</th>
        <th class="col-buff-name">永続バフ</th>
        <th class="col-buff-area">エリア</th>
        <th class="col-buff-method">獲得方法</th>
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
    const buffData = buff[FIELDS.BUFF_CHOICES];

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
    tdMethod.textContent = getText(buff, FIELDS.BUFF_METHOD) || '-';

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
        <th class="col-boss-area">エリア</th>
        <th class="col-boss-name">ボス</th>
        <th class="col-boss-resist">耐性アイコン</th>
        <th class="col-boss-attack">攻撃属性<br><span class="th-sub">（物理以外）</span></th>
        <th class="col-boss-memo">メモ</th>
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
    const jaNames = splitLines(boss[FIELDS.BOSS_JA]);
    const enNames = splitLines(boss[FIELDS.BOSS_EN]);
    const images = splitLines(boss[FIELDS.BOSS_IMAGE]);
    const resistLines = splitLines(boss[FIELDS.RESIST]);
    const atkLines = splitLines(boss[FIELDS.ATTACK_TYPE]);
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
    header.setAttribute('aria-expanded', 'true'); // セクションは開いた状態で生成されるため

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
      if (isNaN(numA) && !isNaN(numB)) return 1;
      if (!isNaN(numA) && isNaN(numB)) return -1;

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
// 5. コントローラー (Controllers)
// ==========================================



// FormatController: common.js のファクトリで生成（campaign.js/endgame-maps.js共通ロジック）
const FormatController = createFormatController(AppState, PersistenceService, DOM);

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
// 6. イベント管理 (Events)
// ==========================================

const CLICK_ACTIONS = {
  toggleSection: el => ToggleService.toggleSection(el.closest('.act-section')),
  showModal: el => ImageModalService.show(`images/bosses/${el.dataset.imgSrc}.webp`, el.textContent.trim() || 'ボス画像'),
  closeModal: () => ImageModalService.close(),
  setFormat: el => FormatController.setFormat(el.dataset.format),
  openAll: () => ToggleService.toggleAll(true),
  closeAll: () => ToggleService.toggleAll(false),
  resetBuffs: () => ResetController.resetBuffs()
};

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

function updateBackToTopVisibility() {
  if (!DOM.btnBackToTop) return;
  DOM.btnBackToTop.classList.toggle('is-hidden', window.scrollY <= 300);
}

function setupScrollEvents() {
  if (!DOM.btnBackToTop) return;
  let isTicking = false;
  window.addEventListener('scroll', () => {
    if (!isTicking) {
      window.requestAnimationFrame(() => {
        updateBackToTopVisibility();
        isTicking = false;
      });
      isTicking = true;
    }
  }, { passive: true });

  DOM.btnBackToTop.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
}

function setupEventListeners() {
  setupClickEvents();
  setupImagePreviewEvents();
  setupScrollEvents();
  setupPersistenceEvents(PersistenceService);
}

// ==========================================
// 7. アプリ初期化 (App Initializer)
// ==========================================

const App = {
  async init() {
    try {
      DOM.initCache();
      initImageServices();
      AppState.init();
      FormatController.updateUI();
      setupEventListeners();
      await this.loadData();
    } catch (e) {
      console.error('Initialization Failed:', e);
      DOM.showFatalError([
        'ページの初期化に失敗しました。再読み込みしても改善しない場合はご連絡ください。',
        `詳細: ${e.message}`
      ]);
    }
  },

  async loadData() {
    try {
      const [bossesRes, buffsRes] = await Promise.all([
        fetchWithTimeout('json/poe2-campaign-bosses.json'),
        fetchWithTimeout('json/poe2-campaign-buffs.json')
      ]);

      if (!bossesRes.ok) throw new Error(`"json/poe2-campaign-bosses.json" の読み込みに失敗しました (HTTP ${bossesRes.status})`);
      if (!buffsRes.ok) throw new Error(`"json/poe2-campaign-buffs.json" の読み込みに失敗しました (HTTP ${buffsRes.status})`);

      const bossesData = await bossesRes.json();
      const buffsData = await buffsRes.json();

      const combinedData = {
        bosses: Array.isArray(bossesData) ? bossesData : [],
        buffs: Array.isArray(buffsData) ? buffsData : []
      };

      validateBuffIds(combinedData.buffs);
      pruneCheckedBuffs(combinedData.buffs);

      const groups = groupDataByAct(combinedData);

      CampaignRenderer.renderAll(groups);
      updateBackToTopVisibility();

    } catch (e) {
      console.error('JSONデータの読み込みに失敗しました。', e); // コンソール文言を統一
      DOM.showFatalError([
        'データの読み込みに失敗しました。',
        describeLoadError(e)
      ]);
    }
  }
};

App.init();