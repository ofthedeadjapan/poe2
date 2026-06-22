document.addEventListener("DOMContentLoaded", async () => {
  const placeholder = document.getElementById("nav-placeholder");
  if (!placeholder) return;

  try {
    const response = await fetch("nav.html");
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    placeholder.innerHTML = await response.text();

    // URLから現在のファイル名を取得（パスが空の場合は index とする）
    const currentFile = window.location.pathname.split("/").pop() || "poe2-index.html";

    // 対応するリンクに active クラスを付与
    placeholder.querySelectorAll(".nav-link").forEach(link => {
      if (link.getAttribute("href") === currentFile) {
        link.classList.add("active");
      }
    });
  } catch (error) {
    console.error("nav.html 読み込み失敗:", error);
  }
});