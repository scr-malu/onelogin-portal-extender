const observer = new MutationObserver((mutationsList, observer) => {
    const tabs = document.getElementsByClassName("tab-item-content");
    if (tabs[2]) {
      tabs[2].click(); // [1] のタブをクリック
      observer.disconnect(); // 監視を停止
    }
  });
  
  // 監視を開始（body要素の変更を監視）
  observer.observe(document.body, { childList: true, subtree: true });