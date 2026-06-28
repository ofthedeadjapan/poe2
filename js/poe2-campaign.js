// ==========================================
// 1. 定数・定義 (Constants & Definitions)
// ==========================================

const STORAGE_KEYS = {
 CAMPAIGN_STATE: 'poe2:campaignState'
};

// 6枠固定の耐性アイコン順序（エンドゲームマップ仕様に準拠）
const RESIST_ORDER = ['Armour', 'Evasion', 'Fire', 'Cold', 'Lightning', 'Chaos'];

// ==========================================
// 2. 状態管理 & キャッシュ (State & DOM Cache)
// ==========================================

const AppState = {
 user: {
  checkedBuffs: new Set(),
  format: { order: 'ja', lang: 'both' }
 },
 init() {
  try {
   const saved = localStorage.getItem(STORAGE_KEYS.CAMPAIGN_STATE);
   if (saved) {
    const parsed = JSON.parse(saved);
    this.user.checkedBuffs = new Set(parsed.checkedBuffs || []);

    // 新仕様のフォーマット設定の読み込み
    if (parsed.format) {
     this.user.format = parsed.format;
    }
   }
  } catch (e) {
   console.warn("AppState: データの読み込みに失敗しました", e);
  }
 },
 save() {
  try {
   localStorage.setItem(STORAGE_KEYS.CAMPAIGN_STATE, JSON.stringify({
    checkedBuffs: Array.from(this.user.checkedBuffs),
    format: this.user.format
   }));
  } catch (e) {
   console.warn("AppState: データの保存に失敗しました", e);
  }
 }
};

const DOM = {
 initCache() {
  this.campaignContainer = document.getElementById('campaignContainer');
  this.actNav = document.getElementById('actNav');
  this.btnToggleAll = document.getElementById('btnToggleAll');
  this.bossModal = document.getElementById('bossModal');
  this.bossModalImg = document.getElementById('bossModalImg');
  this.bossPreview = document.getElementById('bossPreview');
  this.bossPreviewImg = document.getElementById('bossPreviewImg');
  this.formatOrderGroup = document.getElementById('format-order-group');
  this.formatLangGroup = document.getElementById('format-lang-group');
 }
};

// ==========================================
// 3. UIロジック・調整用 (Services)
// ==========================================

const ToggleService = {
 allOpen: false,
 toggleSection(section, forceState = null) {
  if (!section) return;
  const isOpen = forceState !== null ? forceState : !section.classList.contains('is-open');
  section.classList.toggle('is-open', isOpen);

  const iconText = section.querySelector('.toggle-icon-text');
  if (iconText) {
   iconText.textContent = isOpen ? '▲ 閉じる' : '▼ 開く';
  }
 },
 toggleAll() {
  this.allOpen = !this.allOpen;
  const sections = document.querySelectorAll('.act-section');
  sections.forEach(sec => this.toggleSection(sec, this.allOpen));

  if (DOM.btnToggleAll) {
   DOM.btnToggleAll.textContent = this.allOpen ? '▲ すべて閉じる' : '▼ すべて開く';
  }
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
  this.currentSrc = imgSrc;

  const fullPath = `images/bosses/${imgSrc}.webp`;
  const displayImage = () => {
   if (this.currentSrc !== imgSrc) return;
   DOM.bossPreview.classList.remove('is-hidden');

   requestAnimationFrame(() => {
    const rect = DOM.bossPreview.getBoundingClientRect();
    this.cachedWidth = rect.width || 200;
    this.cachedHeight = rect.height || 200;
    this.move(x, y);
    DOM.bossPreview.classList.add('show');
   });
  };

  if (DOM.bossPreviewImg.src.endsWith(fullPath) && DOM.bossPreviewImg.complete) {
   displayImage();
  } else {
   DOM.bossPreviewImg.onload = displayImage;
   DOM.bossPreviewImg.src = fullPath;
  }
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
// 4. コントローラー層 (Controllers)
// ==========================================

const FormatController = {
 setOrder(order) {
  if (AppState.user.format.order === order) return;
  AppState.user.format.order = order;
  AppState.save();
  this.updateUI();
 },
 setLang(lang) {
  if (AppState.user.format.lang === lang) return;
  AppState.user.format.lang = lang;
  if (lang === 'ja') AppState.user.format.order = 'ja';
  if (lang === 'en') AppState.user.format.order = 'en';
  AppState.save();
  this.updateUI();
 },
 updateUI() {
  const { order, lang } = AppState.user.format;

  // UIボタンのハイライト更新
  document.querySelectorAll('[data-click="setFormatOrder"]').forEach(btn => {
   btn.classList.toggle('active', btn.dataset.order === order);
  });
  document.querySelectorAll('[data-click="setFormatLang"]').forEach(btn => {
   btn.classList.toggle('active', btn.dataset.lang === lang);
  });

  // bodyクラスの付与によるCSS制御 (テーブル内の表示を切り替え)
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

  // 片方言語のみ選択時は順序ボタンをグレーアウト
  if (DOM.formatOrderGroup) {
   DOM.formatOrderGroup.classList.toggle('is-disabled', lang !== 'both');
  }
 }
};

// ==========================================
// 5. イベント登録 & 委譲 (Events)
// ==========================================

const CLICK_ACTIONS = {
 toggleSection: el => ToggleService.toggleSection(el.closest('.act-section')),
 showModal: el => ModalService.show(el.dataset.imgSrc),
 closeModal: () => ModalService.close(),
 setFormatOrder: el => FormatController.setOrder(el.dataset.order),
 setFormatLang: el => FormatController.setLang(el.dataset.lang)
};

function setupEventListeners() {
 if (DOM.btnToggleAll) {
  DOM.btnToggleAll.addEventListener('click', () => ToggleService.toggleAll());
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

// ==========================================
// 6. データ集計 & ソート (Data Processor)
// ==========================================

function groupDataByAct(data) {
 const groups = {};
 const getGroup = (actValue) => {
  const actStr = actValue !== undefined && actValue !== null ? String(actValue).trim() : '';
  const key = actStr || 'その他';
  if (!groups[key]) groups[key] = { bosses: [], buffs: [] };
  return groups[key];
 };

 if (data && Array.isArray(data.bosses)) {
  data.bosses.forEach(item => {
   if (item) getGroup(item['アクト']).bosses.push(item);
  });
 }
 if (data && Array.isArray(data.buffs)) {
  data.buffs.forEach(item => {
   if (item) getGroup(item['アクト']).buffs.push(item);
  });
 }

 Object.keys(groups).forEach(key => {
  const sortByLevel = (a, b) => {
   const lvA = parseInt(a['モンスターレベル'], 10) || 0;
   const lvB = parseInt(b['モンスターレベル'], 10) || 0;
   return lvA - lvB;
  };
  groups[key].bosses.sort(sortByLevel);
  groups[key].buffs.sort(sortByLevel);
 });

 return groups;
}

// ==========================================
// 7. 動的DOMレンダリング (Renderers)
// ==========================================

// エリアとレベルを統合して描画（モンスターレベル表記は削除）
function renderAreaCell(td, boss) {
 const jaText = boss['エリア日本語'] ? String(boss['エリア日本語']).trim() : '';
 const enText = boss['エリア英語'] ? String(boss['エリア英語']).trim() : '';

 const container = document.createElement('div');
 container.className = 'cell-lang-container';

 const divJa = document.createElement('div');
 divJa.className = 'lang-ja';
 divJa.innerHTML = jaText ? jaText.replace(/\n/g, '<br>') : '-';

 const divEn = document.createElement('div');
 divEn.className = 'lang-en';
 divEn.innerHTML = enText ? enText.replace(/\n/g, '<br>') : '';

 container.appendChild(divJa);
 container.appendChild(divEn);
 td.appendChild(container);
}

// 複数ボス（日・英・画像の紐付け）の描画
function renderBossCell(td, boss) {
 const jaText = boss['ボス日本語'] ? String(boss['ボス日本語']) : '';
 if (!jaText) { td.textContent = '-'; return; }

 const jaNames = jaText.split('\n');
 const enNames = boss['ボス英語'] ? String(boss['ボス英語']).split('\n') : [];
 const images = boss['bossimage'] ? String(boss['bossimage']).split('\n') : [];

 const maxLines = Math.max(jaNames.length, enNames.length);

 for (let i = 0; i < maxLines; i++) {
  const jName = jaNames[i] ? jaNames[i].trim() : '';
  const eName = enNames[i] ? enNames[i].trim() : '';
  const imgName = images[i] ? images[i].trim() : '';

  if (!jName && !eName) continue;

  const itemWrapper = document.createElement('div');
  itemWrapper.className = 'boss-item-wrapper cell-lang-container';

  if (imgName) {
   itemWrapper.classList.add('has-image');
   Object.assign(itemWrapper.dataset, { click: 'showModal', imgSrc: imgName });
  }

  const dJa = document.createElement('div');
  dJa.className = 'lang-ja';
  dJa.textContent = jName || '-';

  const dEn = document.createElement('div');
  dEn.className = 'lang-en';
  dEn.textContent = eName || '';

  itemWrapper.appendChild(dJa);
  itemWrapper.appendChild(dEn);
  td.appendChild(itemWrapper);
 }
}

// 6枠固定の耐性アイコン描画
function renderResistCell(td, boss) {
 const resistText = boss['耐性アイコン'] ? String(boss['耐性アイコン']).trim() : '';

 const grid = document.createElement('div');
 grid.className = 'resist-grid';

 RESIST_ORDER.forEach(type => {
  const slot = document.createElement('div');
  slot.className = 'resist-slot';

  // 対象の属性が存在するか正規表現でチェック（大文字小文字を区別しない）
  const regex = new RegExp(`${type}(Strong|Weak)?`, 'i');
  const match = resistText.match(regex);

  if (match) {
   const strength = match[1] ? match[1].toLowerCase() : 'normal';
   const fileName = `${type.toLowerCase()}${strength !== 'normal' ? '-' + strength : ''}`;

   // 耐性の強さに応じてクラスを付与
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
   img.onerror = () => { img.style.display = 'none'; }; // 読み込み失敗時はアイコンを非表示

   slot.appendChild(img);
  } else {
   // 対象属性の耐性が無い場合はダミー枠（背景のみ）
   slot.classList.add('is-empty');
  }

  grid.appendChild(slot);
 });

 td.appendChild(grid);
}

// メモと敵ライフ（大体）を統合して描画
function renderMemoCell(td, boss) {
 const lifeText = boss['敵ライフ（大体）'] ? String(boss['敵ライフ（大体）']).trim() : '';
 const memoText = boss['メモ'] ? String(boss['メモ']).trim() : '';

 const div = document.createElement('div');
 div.className = 'cell-memo';

 let contentHTML = '';

 // 敵ライフが存在すれば、強調色で先頭に付与
 if (lifeText) {
  contentHTML += `<span style="color: #94a3b8; font-weight: bold;">[敵ライフ（大体）: ${lifeText}]</span>`;
 }

 if (lifeText && memoText) {
  contentHTML += '<br>';
 }

 if (memoText) {
  contentHTML += memoText.replace(/\n/g, '<br>');
 }

 div.innerHTML = contentHTML || '-';
 td.appendChild(div);
}

// 全体描画
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

  // ナビゲーションリンク作成
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
  navFragment.appendChild(navLink);

  // アコーディオンセクション作成
  const section = document.createElement('section');
  section.className = 'act-section';
  section.id = actId;

  const header = document.createElement('div');
  header.className = 'act-header';
  header.dataset.click = 'toggleSection';

  const h2 = document.createElement('h2');
  h2.textContent = isNaN(parseInt(act, 10)) ? act : `アクト ${act}`;

  const toggleIcon = document.createElement('span');
  toggleIcon.className = 'toggle-icon-text';
  toggleIcon.textContent = '▼ 開く';

  header.appendChild(h2);
  header.appendChild(toggleIcon);
  section.appendChild(header);

  const content = document.createElement('div');
  content.className = 'act-content';

  // 永続バフチェックリスト
  if (group.buffs && group.buffs.length > 0) {
   const buffWrapper = document.createElement('div');
   buffWrapper.className = 'buff-list-wrapper';

   const bTitle = document.createElement('h3');
   bTitle.className = 'buff-list-title';
   bTitle.textContent = '◆ 獲得可能な永続バフ・報酬';
   buffWrapper.appendChild(bTitle);

   const buffGrid = document.createElement('div');
   buffGrid.className = 'buff-grid';

   group.buffs.forEach(buff => {
    if (!buff.id) return;
    const label = document.createElement('label');
    label.className = 'buff-item';
    if (AppState.user.checkedBuffs.has(buff.id)) {
     label.classList.add('is-checked');
    }

    const chk = document.createElement('input');
    chk.type = 'checkbox';
    chk.checked = AppState.user.checkedBuffs.has(buff.id);
    chk.addEventListener('change', (e) => {
     if (e.target.checked) {
      AppState.user.checkedBuffs.add(buff.id);
      label.classList.add('is-checked');
     } else {
      AppState.user.checkedBuffs.delete(buff.id);
      label.classList.remove('is-checked');
     }
     AppState.save();
    });

    const textSpan = document.createElement('span');
    // レベル表記は不要のため除去して構築
    textSpan.textContent = `${buff['永続バフ'] || '未定義'} (${buff['エリア'] || '-'}：${buff['獲得方法'] || '-'})`;

    label.appendChild(chk);
    label.appendChild(textSpan);
    buffGrid.appendChild(label);
   });

   buffWrapper.appendChild(buffGrid);
   content.appendChild(buffWrapper);
  }

  // ボステーブル
  if (group.bosses && group.bosses.length > 0) {
   const tableWrapper = document.createElement('div');
   tableWrapper.className = 'table-wrapper';

   const table = document.createElement('table');
   // ヘッダー構成
   table.innerHTML = `
        <thead>
         <tr>
          <th style="width: 220px;">エリア</th>
          <th style="width: 260px;">ボス</th>
          <th style="width: 195px;">耐性アイコン</th>
          <th style="width: 130px; text-align:center;">攻撃属性（物理以外）</th>
          <th>メモ</th>
         </tr>
        </thead>
       `;

   const tbody = document.createElement('tbody');
   group.bosses.forEach(boss => {
    const tr = document.createElement('tr');

    // エリア名セル
    const tdArea = document.createElement('td');
    renderAreaCell(tdArea, boss);
    tr.appendChild(tdArea);

    // ボス名セル (動的リンク生成)
    const tdBoss = document.createElement('td');
    renderBossCell(tdBoss, boss);
    tr.appendChild(tdBoss);

    // 耐性セル (6枠固定グリッド)
    const tdResist = document.createElement('td');
    renderResistCell(tdResist, boss);
    tr.appendChild(tdResist);

    // 攻撃属性セル
    const tdAtk = document.createElement('td');
    tdAtk.style.textAlign = 'center';
    const divAtk = document.createElement('div');
    divAtk.className = 'cell-atk-type';
    divAtk.innerHTML = String(boss['攻撃属性（物理以外）'] || '-').trim().replace(/\n/g, '<br>');
    tdAtk.appendChild(divAtk);
    tr.appendChild(tdAtk);

    // メモセル (敵ライフ合体)
    const tdMemo = document.createElement('td');
    renderMemoCell(tdMemo, boss);
    tr.appendChild(tdMemo);

    tbody.appendChild(tr);
   });

   table.appendChild(tbody);
   tableWrapper.appendChild(table);
   content.appendChild(tableWrapper);
  }

  section.appendChild(content);
  mainFragment.appendChild(section);
 });

 DOM.actNav.appendChild(navFragment);
 DOM.campaignContainer.appendChild(mainFragment);
}

// ==========================================
// 8. 初期化 (App Initializer)
// ==========================================

const App = {
 async init() {
  try {
   DOM.initCache();
   AppState.init();

   // フォーマット設定の初期適用
   FormatController.updateUI();

   setupEventListeners();
   await this.loadData();
  } catch (e) {
   console.error("App初期化エラー:", e);
  }
 },

 async loadData() {
  try {
   const response = await fetch('json/poe2-campaign.json');
   if (!response.ok) throw new Error(`HTTP status: ${response.status}`);

   const data = await response.json();
   const groups = groupDataByAct(data);
   renderCampaign(groups);
  } catch (e) {
   console.error("JSON読み込み失敗:", e);
   if (DOM.campaignContainer) {
    DOM.campaignContainer.innerHTML = `
          <p style="text-align: center; color: #ef4444; padding: 40px 0; font-weight: bold;">
           データの読み込みに失敗しました。<br>
           "json/poe2-campaign.json" が正しく出力・配置されているか確認してください。
          </p>
         `;
   }
  }
 }
};

document.addEventListener('DOMContentLoaded', () => App.init());