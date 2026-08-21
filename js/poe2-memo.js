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
      { key: 'effect' }
    ]
  },
  {
    tbodyId: 'store-tbody',
    data: storeData,
    columns: [
      { key: 'category', grouped: true }, // nowrapは #store-table td 側の一括指定で対応済み
      { key: 'name', className: 'col-align-left' },
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
