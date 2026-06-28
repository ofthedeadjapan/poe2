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

            // 分割されたボタンとフローティングボタンの取得
            this.btnOpenAll = document.getElementById('btnOpenAll');
            this.btnCloseAll = document.getElementById('btnCloseAll');
            this.btnBackToTop = document.getElementById('btnBackToTop');

            this.bossModal = document.getElementById('bossModal');
            this.bossModalImg = document.getElementById('bossModalImg');
            this.bossPreview = document.getElementById('bossPreview');
            this.bossPreviewImg = document.getElementById('bossPreviewImg');

            // 新規ドロップダウン用
            this.btnFormatText = document.getElementById('btn-format-text');
      }
};

// ==========================================
// 3. UIロジック・調整用 (Services)
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
      // forceOpen (true: すべて開く, false: すべて閉じる)
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
            AppState.save();
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
      }
};

// ==========================================
// 5. イベント登録 & 委譲 (Events)
// ==========================================

const CLICK_ACTIONS = {
      toggleSection: el => ToggleService.toggleSection(el.closest('.act-section')),
      showModal: el => ModalService.show(el.dataset.imgSrc),
      closeModal: () => ModalService.close(),
      setFormat: el => FormatController.setFormat(el.dataset.format)
};

function setupEventListeners() {
      // 全開・全閉ボタン
      if (DOM.btnOpenAll) {
            DOM.btnOpenAll.addEventListener('click', () => ToggleService.toggleAll(true));
      }
      if (DOM.btnCloseAll) {
            DOM.btnCloseAll.addEventListener('click', () => ToggleService.toggleAll(false));
      }

      // フローティングボタンのスクロール制御
      if (DOM.btnBackToTop) {
            window.addEventListener('scroll', () => {
                  if (window.scrollY > 300) {
                        DOM.btnBackToTop.classList.remove('is-hidden');
                  } else {
                        DOM.btnBackToTop.classList.add('is-hidden');
                  }
            });
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

            // ドロップダウン開閉処理
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

// ドロップダウンのトグル処理
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
      const wasOpen = parent.classList.contains('show');

      if (!wasOpen) {
            parent.classList.add('show');
            dropdownBtn.setAttribute('aria-expanded', 'true');
      }
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

// エリア名セル
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

            // 対象の属性が存在するか正規表現でチェック
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

                  slot.appendChild(img);
            } else {
                  slot.classList.add('is-empty');
            }

            grid.appendChild(slot);
      });

      td.appendChild(grid);
}

// メモセル (敵ライフを独立させたため、純粋なメモのみ表示)
function renderMemoCell(td, boss) {
      const memoText = boss['メモ'] ? String(boss['メモ']).trim() : '';
      const div = document.createElement('div');
      div.className = 'cell-memo';
      div.innerHTML = memoText ? memoText.replace(/\n/g, '<br>') : '-';
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

            // 永続バフ テーブルリスト
            if (group.buffs && group.buffs.length > 0) {
                  const buffWrapper = document.createElement('div');
                  buffWrapper.className = 'buff-list-wrapper';

                  const bTitle = document.createElement('h3');
                  bTitle.className = 'buff-list-title';
                  bTitle.textContent = '◆ 獲得可能な永続バフ・報酬';
                  buffWrapper.appendChild(bTitle);

                  const buffTableWrapper = document.createElement('div');
                  buffTableWrapper.className = 'buff-table-wrapper';

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

                        // セル1：チェックボックス
                        const tdCheck = document.createElement('td');
                        tdCheck.style.textAlign = 'center';
                        const chk = document.createElement('input');
                        chk.type = 'checkbox';
                        chk.className = 'buff-checkbox';
                        chk.checked = isChecked;
                        tdCheck.appendChild(chk);

                        // チェックイベントのロジック
                        const toggleCheck = () => {
                              const willBeChecked = !chk.checked;
                              chk.checked = willBeChecked;
                              if (willBeChecked) {
                                    AppState.user.checkedBuffs.add(buff.id);
                                    tr.classList.add('is-checked');
                              } else {
                                    AppState.user.checkedBuffs.delete(buff.id);
                                    tr.classList.remove('is-checked');
                              }
                              AppState.save();
                        };

                        // 行クリックでトグル（リンクや別のアクションと競合しないようにする）
                        tr.addEventListener('click', (e) => {
                              if (e.target.tagName !== 'INPUT' && e.target.tagName !== 'A') {
                                    toggleCheck();
                              }
                        });
                        chk.addEventListener('change', toggleCheck);

                        // セル2：永続バフ内容
                        const tdBuff = document.createElement('td');
                        const buffData = buff['永続バフ'];

                        if (Array.isArray(buffData)) {
                              // データが配列（選択式）の場合の処理
                              const choiceContainer = document.createElement('div');
                              choiceContainer.className = 'buff-choice-container';

                              const label = document.createElement('div');
                              label.className = 'buff-choice-label';
                              label.textContent = '※以下から1つを選択';
                              choiceContainer.appendChild(label);

                              const ul = document.createElement('ul');
                              ul.className = 'buff-choice-list';

                              buffData.forEach(choiceText => {
                                    const li = document.createElement('li');
                                    // 同一選択肢内の改行（メリットとデメリットなど）を <br> に変換
                                    li.innerHTML = String(choiceText).trim().replace(/\n/g, '<br>');
                                    ul.appendChild(li);
                              });

                              choiceContainer.appendChild(ul);
                              tdBuff.appendChild(choiceContainer);
                        } else {
                              // 従来の単一バフ（文字列）の場合の処理
                              tdBuff.innerHTML = String(buffData || '-').trim().replace(/\n/g, '<br>');
                        }

                        // セル3：エリア
                        const tdArea = document.createElement('td');
                        tdArea.textContent = buff['エリア'] || '-';

                        // セル4：獲得方法
                        const tdMethod = document.createElement('td');
                        tdMethod.textContent = buff['獲得方法'] || '-';

                        tr.appendChild(tdCheck);
                        tr.appendChild(tdBuff);
                        tr.appendChild(tdArea);
                        tr.appendChild(tdMethod);
                        buffTbody.appendChild(tr);
                  });

                  buffTableWrapper.appendChild(buffTable);
                  buffWrapper.appendChild(buffTableWrapper);
                  content.appendChild(buffWrapper);
            }

            // ボステーブル (列の追加とヘッダー2段化)
            if (group.bosses && group.bosses.length > 0) {
                  const tableWrapper = document.createElement('div');
                  tableWrapper.className = 'table-wrapper';

                  const table = document.createElement('table');
                  // ヘッダー構成（幅を調整し、カッコ内を小文字化）
                  table.innerHTML = `
        <thead>
         <tr>
          <th style="width: 170px;">エリア</th>
          <th style="width: 220px;">ボス</th>
          <th style="width: 176px;">耐性アイコン</th>
          <th style="width: 130px; text-align:center; line-height: 1.3;">攻撃属性<br><span class="th-sub">（物理以外）</span></th>
          <th style="width: 75px; text-align:center; line-height: 1.3;">レベル<br><span class="th-sub">（多分）</span></th>
          <th style="width: 90px; text-align:center; line-height: 1.3;">ライフ<br><span class="th-sub">（大体）</span></th>
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

                        // ボス名セル
                        const tdBoss = document.createElement('td');
                        renderBossCell(tdBoss, boss);
                        tr.appendChild(tdBoss);

                        // 耐性セル
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

                        // レベルセル (+2 加算計算)
                        const tdLevel = document.createElement('td');
                        tdLevel.style.textAlign = 'center';
                        const rawLv = parseInt(boss['モンスターレベル'], 10);
                        tdLevel.textContent = !isNaN(rawLv) ? `Lv. ${rawLv + 2}` : '-';
                        tr.appendChild(tdLevel);

                        // ライフセル
                        const tdLife = document.createElement('td');
                        tdLife.style.textAlign = 'center';
                        tdLife.textContent = String(boss['敵ライフ（大体）'] || '-').trim();
                        tr.appendChild(tdLife);

                        // メモセル
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