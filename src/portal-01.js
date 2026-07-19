// OneLogin Portal Extender - コンテンツスクリプト
// document_start で実行され、設定に応じて以下を行う:
//   - 初期表示タブの自動切り替え(タブ名の自動検出 or 指定タブ名でマッチ)
//   - 会社タブ内のサブタブの自動切り替え(任意)
//   - 切り替え完了までページを隠すことによるチラつき防止
//   - ピン留めしたアプリをタブの上のバーに表示
//   - タブ名一覧のキャッシュ保存(オプション画面の選択肢用)

const DEFAULTS = {
  tabMode: "company", // "company"(会社タブを自動検出) | "custom"(タブ名指定) | "off"(切り替えない)
  tabName: "",
  subTabName: "", // 会社タブ内のサブタブ名。空なら OneLogin 側の初期値に従う
  domains: "", // 改行・カンマ区切りの対象ドメイン。空なら全ドメインで有効
  pinnedApps: [], // { id, name, icon, url } の配列
};

// 「利用頻度の高いもの」「個人」系のタブは会社タブの自動検出から除外する
const SKIP_TAB_PATTERN = /利用頻度|frequent|個人|personal/i;

// タブ切り替え先が見つからない場合でもページを隠しっぱなしにしないための保険
const REVEAL_TIMEOUT_MS = 4000;

// アプリタイルは a.app-cell。起動URLは /client/apps/select/{id} や
// /client/otp_prompt/{id} 形式(旧形式の /launch/{id} も念のため対応)
const TILE_SELECTOR =
  'a.app-cell[href]:not([data-olpe-decorated]), a[href*="/launch/"]:not([data-olpe-decorated])';

(async () => {
  const settings = await chrome.storage.sync.get(DEFAULTS);

  if (!isAllowedDomain(settings.domains)) return;

  let pinnedApps = Array.isArray(settings.pinnedApps) ? settings.pinnedApps : [];
  const wantsTabSwitch = settings.tabMode !== "off";
  const wantsSubTab = wantsTabSwitch && settings.subTabName.trim() !== "";
  const guard = wantsTabSwitch ? installFlickerGuard() : null;

  let tabClicked = false;
  let subTabClicked = false;
  const labelCacheJson = {};
  let renderedBarJson = null;

  // オプション画面や別タブでのピン留め変更を即時反映する
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "sync" && changes.pinnedApps) {
      pinnedApps = changes.pinnedApps.newValue || [];
      refreshStars();
      renderPinnedBar();
    }
  });

  const observer = new MutationObserver(onMutate);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  onMutate();

  function onMutate() {
    // トップレベルのタブ
    const tops = topTabs();
    if (tops.length > 0) {
      cacheLabels("tabLabels", tops);
      if (wantsTabSwitch && !tabClicked) {
        const target = pickTab(tops);
        if (target) {
          tabClicked = true;
          target.click();
          // サブタブ指定がある場合はサブタブのクリックまでガードを維持する
          if (!wantsSubTab) guard?.release();
        }
      }
    }

    // 会社タブ内のサブタブ(top-switcher の外にある tab-item-content)
    const subs = subTabs();
    if (subs.length > 0) {
      cacheLabels("subTabLabels", subs);
      if (wantsSubTab && tabClicked && !subTabClicked) {
        const target = findByLabel(subs, settings.subTabName);
        if (target) {
          subTabClicked = true;
          target.click();
          guard?.release();
        }
      }
    }

    decorateAppTiles();
    renderPinnedBar();
  }

  // ---- タブの取得 ----

  function topTabs() {
    const scoped = document.querySelectorAll(".top-switcher .tab-item-content");
    if (scoped.length > 0) return Array.from(scoped);
    // top-switcher クラスが無い(構造が変わった)場合は従来どおり全体から取得
    return Array.from(document.getElementsByClassName("tab-item-content"));
  }

  function subTabs() {
    if (!document.querySelector(".top-switcher")) return [];
    return Array.from(document.getElementsByClassName("tab-item-content")).filter(
      (t) => !t.closest(".top-switcher")
    );
  }

  function labelOf(tab) {
    return (tab.textContent || "").trim();
  }

  function findByLabel(tabs, name) {
    const want = (name || "").trim();
    if (!want) return null;
    return (
      tabs.find((t) => labelOf(t) === want) ||
      tabs.find((t) => labelOf(t).includes(want)) ||
      null
    );
  }

  function pickTab(tabs) {
    if (settings.tabMode === "custom" && settings.tabName.trim()) {
      return findByLabel(tabs, settings.tabName);
    }
    // 会社タブの自動検出: 「利用頻度」「個人」以外で最初のタブ
    const company = tabs.find((t) => {
      const label = labelOf(t);
      return label && !SKIP_TAB_PATTERN.test(label);
    });
    if (company) return company;
    // ラベルが取得できない場合は旧バージョンと同じく 2 番目のタブへ
    return tabs.every((t) => !labelOf(t)) ? tabs[1] || null : null;
  }

  function cacheLabels(key, tabs) {
    const labels = tabs.map(labelOf).filter(Boolean);
    const json = JSON.stringify(labels);
    if (labels.length === 0 || labelCacheJson[key] === json) return;
    labelCacheJson[key] = json;
    chrome.storage.local.set({ [key]: labels });
  }

  // ---- チラつき防止 ----

  function installFlickerGuard() {
    const style = document.createElement("style");
    style.textContent = "body { opacity: 0 !important; }";
    document.documentElement.appendChild(style);
    let released = false;
    const release = () => {
      if (released) return;
      released = true;
      style.remove();
    };
    setTimeout(release, REVEAL_TIMEOUT_MS);
    return { release };
  }

  // ---- アプリのピン留め ----

  function appInfoFromTile(tile) {
    const href = tile.href;
    if (!href) return null;
    const name =
      tile.querySelector(".app-cell-appname")?.textContent.trim() ||
      (tile.getAttribute("aria-label") || "").replace(/^Launch\s+/i, "").trim() ||
      (tile.textContent || "").trim();
    if (!name) return null;
    const icon = tile.querySelector("img")?.src || "";
    return { id: new URL(href).pathname, name, icon, url: href };
  }

  function decorateAppTiles() {
    const tiles = document.querySelectorAll(TILE_SELECTOR);
    for (const tile of tiles) {
      if (tile.closest("#olpe-pinned-bar")) continue;
      tile.dataset.olpeDecorated = "1";
      const info = appInfoFromTile(tile);
      if (!info) continue;
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "olpe-star";
      btn.dataset.appId = info.id;
      applyStarState(btn);
      btn.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        togglePin(info);
      });
      if (getComputedStyle(tile).position === "static") {
        tile.style.position = "relative";
      }
      tile.appendChild(btn);
    }
  }

  function applyStarState(btn) {
    const pinned = pinnedApps.some((app) => app.id === btn.dataset.appId);
    btn.classList.toggle("olpe-pinned", pinned);
    btn.textContent = "★";
    btn.title = pinned ? "ピン留めを解除" : "ピン留めする";
  }

  function refreshStars() {
    document.querySelectorAll(".olpe-star").forEach(applyStarState);
  }

  function togglePin(info) {
    if (pinnedApps.some((app) => app.id === info.id)) {
      pinnedApps = pinnedApps.filter((app) => app.id !== info.id);
    } else {
      pinnedApps = [...pinnedApps, info];
    }
    chrome.storage.sync.set({ pinnedApps });
    refreshStars();
    renderPinnedBar();
  }

  function renderPinnedBar() {
    if (!document.body) return;
    let bar = document.getElementById("olpe-pinned-bar");
    const json = JSON.stringify(pinnedApps);
    if (bar && json === renderedBarJson) return;
    renderedBarJson = json;
    if (pinnedApps.length === 0) {
      bar?.remove();
      return;
    }
    if (!bar) {
      bar = document.createElement("div");
      bar.id = "olpe-pinned-bar";
    }
    // 検索ボックスやタブの上(#apps-view-container の先頭)に配置する。
    // React の再描画で消されても MutationObserver 経由で再挿入される
    const anchor = document.getElementById("apps-view-container") || document.body;
    if (bar.parentElement !== anchor) {
      anchor.prepend(bar);
    }
    const label = document.createElement("span");
    label.className = "olpe-pin-label";
    label.textContent = "ピン留め:";
    bar.replaceChildren(
      label,
      ...pinnedApps.map((app) => {
        const link = document.createElement("a");
        link.className = "olpe-pin-app";
        link.href = app.url || `${location.origin}/launch/${app.id}`;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        if (app.icon) {
          const img = document.createElement("img");
          img.src = app.icon;
          img.alt = "";
          link.appendChild(img);
        }
        link.appendChild(document.createTextNode(app.name));
        return link;
      })
    );
  }
})();

// ---- 対象ドメインの判定 ----

function isAllowedDomain(domains) {
  const entries = (domains || "")
    .split(/[\s,]+/)
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  if (entries.length === 0) return true;
  const host = location.hostname.toLowerCase();
  return entries.some((entry) => {
    // "example" のようにサブドメインだけ書かれた場合も許容する
    const full = entry.includes(".") ? entry : `${entry}.onelogin.com`;
    return host === full;
  });
}
