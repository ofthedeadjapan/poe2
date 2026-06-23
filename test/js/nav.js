const navContent = `
<nav class="nav-container">
  <a href="poe2-index.html" class="nav-link">Index</a>
  <a href="poe2-campaign.html" class="nav-link">アクト</a>
  <a href="poe2-endgame-maps.html" class="nav-link">エンドゲームマップ</a>
  <a href="poe2-memo.html" class="nav-link">メモ</a>
  <a href="poe2-json-builder.html" class="nav-link">JSON Builder</a>
</nav>
`;

const placeholder = document.getElementById("nav-placeholder");
if (placeholder) {
    placeholder.innerHTML = navContent;

    let currentFile = window.location.pathname.split('/').pop().split('?')[0];

    if (currentFile === "") {
        currentFile = "poe2-index.html";
    }

    placeholder.querySelectorAll(".nav-link").forEach(link => {
        if (link.getAttribute("href") === currentFile) {
            link.classList.add("active");
        }
    });
}