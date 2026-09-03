// ==========================================================================
// PoE2 メモページ
// ジェム / 改造手術 / スタッシュ価格の参照データをテーブルへ描画する
// ==========================================================================

// --- ジェムデータ ---
const gemData = [
  { gem_level: 1, req_level: 1, req_stat_single: 4, req_stat_dual: 4, drop_ilvl: "1-3", socket_info: "" },
  { gem_level: 2, req_level: 3, req_stat_single: 9, req_stat_dual: 7, drop_ilvl: "3-6", socket_info: "" },
  { gem_level: 3, req_level: 6, req_stat_single: 14, req_stat_dual: 9, drop_ilvl: "7-10", socket_info: "" },
  { gem_level: 4, req_level: 10, req_stat_single: 21, req_stat_dual: 13, drop_ilvl: "11-14", socket_info: "" },
  { gem_level: 5, req_level: 14, req_stat_single: 28, req_stat_dual: 17, drop_ilvl: "15-18", socket_info: "" },
  { gem_level: 6, req_level: 18, req_stat_single: 35, req_stat_dual: 20, drop_ilvl: "19-22", socket_info: "" },
  { gem_level: 7, req_level: 22, req_stat_single: 41, req_stat_dual: 24, drop_ilvl: "23-26", socket_info: "" },
  { gem_level: 8, req_level: 26, req_stat_single: 48, req_stat_dual: 28, drop_ilvl: "27-31", socket_info: "" },
  { gem_level: 9, req_level: 31, req_stat_single: 57, req_stat_dual: 32, drop_ilvl: "32-36", socket_info: "" },
  { gem_level: 10, req_level: 36, req_stat_single: 65, req_stat_dual: 37, drop_ilvl: "37-41", socket_info: "キャラLv36 スキルLv10 ソケット数 3" },
  { gem_level: 11, req_level: 41, req_stat_single: 74, req_stat_dual: 41, drop_ilvl: "42-46", socket_info: "" },
  { gem_level: 12, req_level: 46, req_stat_single: 82, req_stat_dual: 46, drop_ilvl: "47-52", socket_info: "" },
  { gem_level: 13, req_level: 52, req_stat_single: 92, req_stat_dual: 51, drop_ilvl: "53-58", socket_info: "" },
  { gem_level: 14, req_level: 58, req_stat_single: 103, req_stat_dual: 57, drop_ilvl: "59-64", socket_info: "" },
  { gem_level: 15, req_level: 64, req_stat_single: 113, req_stat_dual: 62, drop_ilvl: "65-66", socket_info: "キャラLv64 スキルLv15 ソケット数 4" },
  { gem_level: 16, req_level: 66, req_stat_single: 116, req_stat_dual: 64, drop_ilvl: "67-72", socket_info: "" },
  { gem_level: 17, req_level: 72, req_stat_single: 126, req_stat_dual: 70, drop_ilvl: "73-78", socket_info: "" },
  { gem_level: 18, req_level: 78, req_stat_single: 137, req_stat_dual: 75, drop_ilvl: "79-84", socket_info: "" },
  { gem_level: 19, req_level: 84, req_stat_single: 147, req_stat_dual: 80, drop_ilvl: "85-90", socket_info: "" },
  { gem_level: 20, req_level: 90, req_stat_single: 157, req_stat_dual: 86, drop_ilvl: "91-", socket_info: "キャラLv90 スキルLv20 ソケット数 5" },
];

// --- 改造手術データ ---
const transcendentData = [
  { type: "超越の義手", name: "守護の腕", effect: "ブロック率が(8—12)%増加する" },
  { type: "超越の義手", name: "戦闘の腕", effect: "アタックスピードが(6—10)%増加する" },
  { type: "超越の義手", name: "キャスターの腕", effect: "キャストスピードが(6—10)%増加する" },
  { type: "超越の義手", name: "衰弱の腕", effect: "呪いの強度が(12—16)%増加する" },
  { type: "超越の義手", name: "偏向の腕", effect: "受け流し力が(6—10)%増加する" },
  { type: "超越の義手", name: "号令の腕", effect: "存在下の効果範囲が(15—25)%増加する" },
  { type: "超越の義足", name: "回避の脚", effect: "回避力が(20—30)%増加する" },
  { type: "超越の義足", name: "疾走の脚", effect: "スプリント中に移動スピードが(6—10)%増加する" },
  { type: "超越の義足", name: "頑丈な脚", effect: "スタン閾値が(15—25)%増加する" },
  { type: "超越の義足", name: "堅脚の脚", effect: "移動中にスキルを使用することによる移動スピードペナルティが(5—10)%減少する" },
  { type: "超越の義足", name: "冷静の脚", effect: "移動中はマナ自動回復レートが(20—30)%増加する" },
  { type: "超越の義足", name: "回復の脚", effect: "受けたダメージの(6—10)%をライフとして回収する" },
];

// --- 汎用性の高い強化方法データ ---
const enhanceData = [
  { method: "アノイント", item: "アミュレット\n液化した感情", effect: "アミュレットにパッシブスキルを割り当て", note: "", source: "シミュラクラム" },
  { method: "アノイント", item: "兜\nレイヴンタッチシャード\n液化した感情", effect: "兜にパッシブスキルを割り当て", note: "高額", source: "シミュラクラム\nボス：鴉の欺く者？" },
  { method: "特殊なジュエル", item: "英雄の悲劇\nタイムレスジュエル", effect: "？？？", note: "？？？", source: "" },
  { method: "特殊なジュエル", item: "不死の憎しみ\nタイムレスジュエル", effect: "？？？", note: "？？？", source: "" },
  { method: "特殊なジュエル", item: "グランド・スペクトラム ルビー", effect: "グランドスペクトラム1個ごとに最大ライフが2%増加する", note: "３つまで？\nルビー３つなら\n(2+2+2)*3=18%", source: "セケマの試練" },
  { method: "特殊なジュエル", item: "グランド・スペクトラム エメラルド", effect: "グランドスペクトラム1個ごとにスピリットが2%増加する", note: "３つまで？\nエメラルド３つなら\n(2+2+2)*3=18%", source: "セケマの試練" },
  { method: "特殊なジュエル", item: "グランド・スペクトラム サファイア", effect: "ソケットされたグランドスペクトラム1個ごとに全ての元素耐性が+6%される", note: "３つまで？\nサファイア３つなら\n(6+6+6)*3=54%", source: "セケマの試練" },
  { method: "特殊なジュエル", item: "分裂した人格\nルビー", effect: "各クラスの開始地点からパッシブスキルを割り当てられるようになる\nコラプト状態", note: "", source: "シミュラクラム\nボス：鴉の欺く者？" },
  { method: "特殊なジュエル", item: "ボイス\nサファイア", effect: "シニスタージュエルソケットを2-4個割り当てる\nコラプト状態", note: "独立したソケットを2-4追加\nユニークジュエルは不可", source: "マップ：妄想のシミュラクラム\nコシス＆コンナル？" },
  { method: "特殊なジュエル", item: "メガロマニアック\nダイヤモンド", effect: "Passive Skill を割り当てる\nPassive Skill を割り当てる\n(Passive Skill を割り当てる)", note: "２から３のパッシブスキルのついたジュエル", source: "マップ：妄想のシミュラクラム\nコシス＆コンナル？" },
  { method: "特殊なジュエル", item: "虚空より来たる\nダイヤモンド", effect: "Passive Skillを中心とする範囲内のパッシブはツリーと繋げることなく割り当てることができる\nコラプト状態", note: "", source: "リチュアル\n霧の王" },
  { method: "特殊なジュエル", item: "制御された変質\nダイヤモンド", effect: "中大型リング内のパッシブにのみ影響する\n範囲内のパッシブはツリーと繋げることなく割り当てることができる\n全ての元素耐性 (-20—-5)%", note: "", source: "ブリーチ\n一つの我ら、ゼシュト" },
  { method: "特殊なジュエル", item: "信仰のプリズム\nダイヤモンド", effect: "全てのSpecific Skillスキルのレベル +(1—3)", note: "スキルレベル＋１～３", source: "灰のアービター" },
  { method: "特殊なジュエル", item: "飾り立てられしもの\nダイヤモンド", effect: "コラプト状態のマジックジュエルをはめている\nソケットパッシブスキルの効果が(0—150)%増加する\nコラプト状態", note: "マジックジュエルをはめ込めることが出来て、効果が2.5倍？", source: "カオス寺院\nトライアルマスター" },
  { method: "特殊なジュエル", item: "井戸の心臓\nダイヤモンド", effect: "[Custom Desecrated prefix]\n[Custom Desecrated prefix]\n[Custom Desecrated suffix]\n[Custom Desecrated suffix]", note: "プレフィックス２\nサフィックス２\nの冒涜モッド４つ", source: "アビス化したローグエグザイル" },
  { method: "特殊なジュエル", item: "肉のるつぼ\nダイヤモンド", effect: "Random 1 Keystone Passive Skill [1,33]\n(20-10)% less [random stat]\nコラプト状態", note: "キーストーンパッシブがついている？\nただし(20-10)%のランダムステータスダウン", source: "アッツィリの神殿\nアッツィリ" },
  { method: "特殊なジュエル", item: "闇との対立\nタイムロストダイヤモンド", effect: "[2 Random Jewel Modifiers]", note: "範囲内のパッシブにいろいろな効果を追加？", source: "セケマの試練\n時のザロク" },
  { method: "汎用性の高い装備", item: "不在のアミュレット", effect: "スキルを付与: レベル 12 元素系状態異常時キャスト\nスキルを付与: レベル 12 クリティカル時キャスト\nスキルを付与: レベル 12 ドッジ時キャスト\nスキルを付与: レベル 12 ロア騎乗\nスキルを付与: レベル 12 アーチメイジ\nスキルを付与: レベル 12 トリニティ\nスキルを付与: レベル 12 エターナルレイジ\nプレフィックスモッド -1個\nサフィックスモッド -1個", note: "いずれかのスピリットスキルつき\nただし\nプレフィックスモッド -1個\nサフィックスモッド -1個\n※スキルレベルは12から20？", source: "ブリーチ\nアミュレット　母胎　ツリーの「理解を超えた姿」ノード" },
  { method: "汎用性の高い装備", item: "メイジブラッド（ベルト）", effect: "全てのメイジの遺産は重複したメイジの遺産ごとに効果が(25—50)%増加する\nMages Legacyの遺産\nMages Legacyの遺産\nMages Legacyの遺産\nMages Legacyの遺産", note: "ルビーの遺産＝火耐性 +60%および火耐性の最大値 +5%\nサファイアの遺産＝冷気耐性 +60%および冷気耐性の最大値 +5%\nトパーズの遺産＝雷耐性 +60%および雷耐性の最大値 +5%\nビスマスの遺産＝全ての元素耐性 +45%\nアメジストの遺産＝混沌耐性 +45%\nグラナイトの遺産＝アーマー +2000\nバサルトの遺産＝アーマー150%増加\nヒスイの遺産＝回避力 +2000\nスティブナイトの遺産＝回避力 150%増加\n硫黄の遺産＝ダメージ60%増加付与および静止状態の時にプレイヤーの周囲2.5mを神聖領域\nダイアモンドの遺産＝クリティカルヒット率75%増加\nシルバーの遺産＝スキルスピード 30%増加\n水銀の遺産＝移動スピード30%増加\n金の遺産＝見つかるアイテムのレアリティ 45%増加", source: "どこからでも？" },
];

// --- ストアアイテムデータ ---
const storeData = [
  { category: "基本系？", name: "スタッシュ", normal: 30, sale: "20", exiles_stash_bundle: "" },
  { category: "基本系？", name: "スタッシュタブ ×６", normal: 150, sale: "110", exiles_stash_bundle: "" },
  { category: "基本系？", name: "プレミアムスタッシュにアップグレード", normal: 15, sale: "10", exiles_stash_bundle: "" },
  { category: "基本系？", name: "プレミアムスタッシュ", normal: 40, sale: "30", exiles_stash_bundle: "" },
  { category: "基本系？", name: "プレミアムスタッシュ ×６", normal: 200, sale: "165", exiles_stash_bundle: "" },
  { category: "基本系？", name: "プレミアムクアッド", normal: 150, sale: "120", exiles_stash_bundle: "〇" },
  { category: "基本系？", name: "クアッドタブスタッシュ ×４", normal: 500, sale: "", exiles_stash_bundle: "" },
  { category: "カレンシー系？", name: "カレンシー", normal: 75, sale: "60", exiles_stash_bundle: "〇" },
  { category: "カレンシー系？", name: "オーグメント", normal: 50, sale: "40", exiles_stash_bundle: "〇" },
  { category: "カレンシー系？", name: "ジェム", normal: 40, sale: "30", exiles_stash_bundle: "〇" },
  { category: "カレンシー系？", name: "フラグメント", normal: 75, sale: "55", exiles_stash_bundle: "〇" },
  { category: "カレンシー系？", name: "エッセンス", normal: 40, sale: "30", exiles_stash_bundle: "〇" },
  { category: "カレンシー系？", name: "フラスコ", normal: 40, sale: "30", exiles_stash_bundle: "〇" },
  { category: "カレンシー系？", name: "ユニークコレクション", normal: 140, sale: "110", exiles_stash_bundle: "〇" },
  { category: "エンドゲーム？", name: "マップ", normal: 150, sale: "120", exiles_stash_bundle: "" },
  { category: "エンドゲーム？", name: "ブリーチ", normal: 40, sale: "30", exiles_stash_bundle: "〇" },
  { category: "エンドゲーム？", name: "エクスペディション", normal: 40, sale: "30", exiles_stash_bundle: "〇" },
  { category: "エンドゲーム？", name: "デリリウム", normal: 40, sale: "30", exiles_stash_bundle: "〇" },
  { category: "エンドゲーム？", name: "リチュアル", normal: 40, sale: "30", exiles_stash_bundle: "〇" },
  { category: "エンドゲーム？", name: "アビス", normal: 40, sale: "30", exiles_stash_bundle: "" },
  { category: "商売系？", name: "マーチャントタブ", normal: 40, sale: "30", exiles_stash_bundle: "〇" },
  { category: "商売系？", name: "マーチャントタブ ×６", normal: 200, sale: "165", exiles_stash_bundle: "" },
  { category: "その他", name: "エグザイルのスタッシュバンドル（計810）", normal: 605, sale: "500", exiles_stash_bundle: "" },
  { category: "その他", name: "エグザイルの盗みの指輪（拾ったカレンシー数）", normal: 120, sale: "", exiles_stash_bundle: "" },
  { category: "その他", name: "銅の時の守り人（マップ時間）", normal: 270, sale: "", exiles_stash_bundle: "" },
];

// ==========================================================================
// テーブル定義
// data・columns（表示するキー／CSSクラス／グループ化の有無）をまとめて記述する。
// grouped: true の列は、直前の行と同じ値が続く間は空欄にする
// （改造手術の『手か足』、スタッシュ価格の『系統』のような繰り返し表示の省略用）。
// ==========================================================================
const TABLES = [
  {
    tbodyId: 'gem-tbody',
    data: gemData,
    columns: [
      { key: 'gem_level' },
      { key: 'req_level' },
      { key: 'req_stat_single' },
      { key: 'req_stat_dual' },
      { key: 'drop_ilvl' },
      { key: 'socket_info' }
    ]
  },
  {
    tbodyId: 'transcendent-tbody',
    data: transcendentData,
    columns: [
      { key: 'type', className: 'nowrap', grouped: true },
      { key: 'name', className: 'nowrap' },
      { key: 'effect', className: 'col-effect' }
    ]
  },
  {
    tbodyId: 'enhance-tbody',
    data: enhanceData,
    columns: [
      { key: 'method', className: 'nowrap col-align-left', grouped: true },
      { key: 'item', className: 'col-enhance-text col-align-left' },
      { key: 'effect', className: 'col-enhance-text col-align-left' },
      { key: 'note', className: 'col-enhance-text col-align-left' },
      { key: 'source', className: 'col-enhance-text col-align-left' }
    ]
  },
  {
    tbodyId: 'store-tbody',
    data: storeData,
    columns: [
      { key: 'category', grouped: true }, // nowrapは #store-table td 側の一括指定で対応済み
      { key: 'name' },
      { key: 'normal', className: 'col-align-right' },
      { key: 'sale', className: 'col-align-right' },
      { key: 'exiles_stash_bundle' }
    ]
  }
];

/**
 * テーブル定義1件分をレンダリングする。
 * grouped列は、直前行と同じ値が続く間は空欄にする。
 */
function renderTable({ tbodyId, data, columns }) {
  const tbody = document.getElementById(tbodyId);
  if (!tbody) return;

  const fragment = document.createDocumentFragment();
  const GROUP_START = Symbol('group-start'); // 1行目を必ず表示させるための番人（実データとは一致しない値）
  const lastGroupValues = {}; // col.keyごとに直前の値を記憶する（列をまたいで混線しないように）

  data.forEach(row => {
    const tr = document.createElement('tr');

    columns.forEach(col => {
      const td = document.createElement('td');
      let value = row[col.key] ?? '';

      if (col.grouped) {
        const lastValue = lastGroupValues[col.key] ?? GROUP_START;
        if (value === lastValue) {
          value = '';
        } else {
          lastGroupValues[col.key] = value;
        }
      }

      td.textContent = value;
      if (col.className) td.className = col.className;
      tr.append(td);
    });

    fragment.append(tr);
  });

  tbody.append(fragment);
}

TABLES.forEach(renderTable);
