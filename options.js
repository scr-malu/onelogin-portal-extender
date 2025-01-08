document.addEventListener("DOMContentLoaded", () => {
    const form = document.getElementById("options-form");
    const status = document.getElementById("status");
  
    // 保存済み設定をフォームに反映
    chrome.storage.sync.get("tabOption", (data) => {
      const selectedOption = data.tabOption || "1"; // デフォルトは"1"
      form.tab.value = selectedOption;
    });
  
    // フォーム送信時の処理
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const selectedOption = form.tab.value;
      chrome.storage.sync.set({ tabOption: selectedOption }, () => {
        status.textContent = "設定が保存されました！";
        setTimeout(() => status.textContent = "", 2000); // ステータスメッセージを消す
      });
    });
  });