// OneLogin Portal Extender - オプション画面
const DEFAULTS = {
  tabMode: "company",
  tabName: "",
  domains: "",
  pinnedApps: [],
};

document.addEventListener("DOMContentLoaded", async () => {
  const FREE_INPUT = "__free__";

  const form = document.getElementById("options-form");
  const status = document.getElementById("status");
  const tabSelect = document.getElementById("tab-select");
  const tabNameInput = document.getElementById("tab-name");
  const pinnedList = document.getElementById("pinned-list");
  const pinnedEmpty = document.getElementById("pinned-empty");

  const settings = await chrome.storage.sync.get(DEFAULTS);

  // ポータル閲覧時にキャッシュしたタブ名でプルダウンを構築
  const { tabLabels = [] } = await chrome.storage.local.get("tabLabels");
  const candidates = [...tabLabels];
  // 保存済みのタブ名がキャッシュに無い場合も選択肢として残す
  if (settings.tabName && !candidates.includes(settings.tabName)) {
    candidates.unshift(settings.tabName);
  }
  for (const label of candidates) {
    const option = document.createElement("option");
    option.value = label;
    option.textContent = label;
    tabSelect.appendChild(option);
  }
  const freeOption = document.createElement("option");
  freeOption.value = FREE_INPUT;
  freeOption.textContent = "その他（直接入力）";
  tabSelect.appendChild(freeOption);

  // 保存済み設定をフォームに反映
  form.tabMode.value = settings.tabMode;
  form.domains.value = settings.domains;
  if (settings.tabName && candidates.includes(settings.tabName)) {
    tabSelect.value = settings.tabName;
  } else {
    // 未設定またはキャッシュ無し: 候補があれば先頭、なければ直接入力
    tabSelect.value = candidates.length > 0 ? candidates[0] : FREE_INPUT;
    tabNameInput.value = settings.tabName;
  }
  syncTabNameState();

  renderPinned(settings.pinnedApps);

  form.addEventListener("change", syncTabNameState);

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const tabName =
      tabSelect.value === FREE_INPUT ? tabNameInput.value.trim() : tabSelect.value;
    await chrome.storage.sync.set({
      tabMode: form.tabMode.value,
      tabName,
      domains: form.domains.value.trim(),
    });
    status.textContent = "設定を保存しました。";
    setTimeout(() => (status.textContent = ""), 2000);
  });

  function syncTabNameState() {
    const customEnabled = form.tabMode.value === "custom";
    tabSelect.disabled = !customEnabled;
    tabNameInput.disabled = !customEnabled;
    // 直接入力欄は「その他」を選んだときだけ表示する
    tabNameInput.style.display =
      tabSelect.value === FREE_INPUT ? "" : "none";
  }

  function renderPinned(apps) {
    pinnedList.replaceChildren();
    pinnedEmpty.style.display = apps.length === 0 ? "" : "none";
    for (const app of apps) {
      const li = document.createElement("li");
      if (app.icon) {
        const img = document.createElement("img");
        img.src = app.icon;
        img.alt = "";
        li.appendChild(img);
      }
      const name = document.createElement("span");
      name.textContent = app.name;
      li.appendChild(name);
      const removeBtn = document.createElement("button");
      removeBtn.type = "button";
      removeBtn.textContent = "削除";
      removeBtn.addEventListener("click", async () => {
        const remaining = apps.filter((a) => a.id !== app.id);
        await chrome.storage.sync.set({ pinnedApps: remaining });
        renderPinned(remaining);
      });
      li.appendChild(removeBtn);
      pinnedList.appendChild(li);
    }
  }
});
