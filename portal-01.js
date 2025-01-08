// ユーザーの設定を取得してタブをクリック
chrome.storage.sync.get("tabOption", (data) => {
    const selectedTabIndex = data.tabOption === "2" ? 2 : 1; // デフォルトは[1]
  
    const observer = new MutationObserver((mutationsList, observer) => {
      const tabs = document.getElementsByClassName("tab-item-content");
      if (tabs[selectedTabIndex]) {
        tabs[selectedTabIndex].click(); // 指定されたタブをクリック
        observer.disconnect(); // 監視を停止
      }
    });
  
    // DOMの変更を監視
    observer.observe(document.body, { childList: true, subtree: true });
  });