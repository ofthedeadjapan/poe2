// ▼ ここにナビゲーションのHTMLとCSSをすべて文字列（バッククォート ` ）で格納します
const navContent = `
<style>
  .nav-container {
    width: 100%;
    max-width: 1400px;
    margin: 10px auto 30px auto;
    display: flex;
    gap: 24px;
    justify-content: flex-start;
    flex-wrap: wrap;
    box-sizing: border-box;
    padding-left: 10px;
  }

  .nav-link {
    color: var(--text-muted);
    text-decoration: none;
    font-size: 16px;
    font-weight: 600;
    padding-bottom: 4px;
    border-bottom: 2px solid transparent;
    transition: all 0.2s ease;
  }

  .nav-link:hover,
  .nav-link.active {
    color: var(--accent-gold);
    border-color: var(--accent-gold);
  }

  .nav-link.active {
    pointer-events: none;
  }
</style>

<nav class="nav-container">
  <a href="poe2-index.html" class="nav-link">Index</a>
  <a href="poe2-campaign.html" class="nav-link">アクト</a>
  <a href="poe2-endgame-maps.html" class="nav-link">エンドゲームマップ</a>
  <a href="poe2-memo.html" class="nav-link">メモ</a>
  <a href="poe2-json-builder.html" class="nav-link">JSON Builder</a>
</nav>
`;

document.addEventListener("DOMContentLoaded", () => {
  const placeholder = document.getElementById("nav-placeholder");
  if (!placeholder) return;

  // fetchでの通信を待たず、即座にHTMLを挿入する
  placeholder.innerHTML = navContent;

  // 現在のページURLに応じて 'active' クラスを付与
  const currentFile = window.location.pathname.split("/").pop() || "poe2-index.html";
  placeholder.querySelectorAll(".nav-link").forEach(link => {
    if (link.getAttribute("href") === currentFile) {
      link.classList.add("active");
    }
  });
});