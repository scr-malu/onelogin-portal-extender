// OneLogin Portal Extender - オプション画面
const DEFAULTS = {
  tabMode: "company",
  tabName: "",
  domains: "",
  pinnedApps: [],
};

const FREE_INPUT = "__free__";

document.addEventListener("DOMContentLoaded", async () => {
  const form = document.getElementById("options-form");
  const status = document.getElementById("status");
  const tabSelect = document.getElementById("tab-select");
  const tabNameInput = document.getElementById("tab-name");
  const pinnedList = document.getElementById("pinned-list");
  const pinnedEmpty = document.getElementById("pinned-empty");

  const settings = await chrome.storage.sync.get(DEFAULTS);
  const { tabLabels = [] } = await chrome.storage.local.get("tabLabels");

  // 廃止したサブタブ指定の設定が残っていれば掃除する
  chrome.storage.sync.remove("subTabName");
  chrome.storage.local.remove("subTabLabels");

  // タブ名のプルダウン(ポータル閲覧時にキャッシュした実際のタブ名 + 直接入力)
  setupTabPicker(tabSelect, tabNameInput, tabLabels, settings.tabName);

  form.tabMode.value = settings.tabMode;
  form.domains.value = settings.domains;
  syncControlStates();

  renderPinned(settings.pinnedApps);

  form.addEventListener("change", syncControlStates);

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    await chrome.storage.sync.set({
      tabMode: form.tabMode.value,
      tabName: pickedValue(tabSelect, tabNameInput),
      domains: form.domains.value.trim(),
    });
    status.textContent = "設定を保存しました。";
    setTimeout(() => (status.textContent = ""), 2000);
  });

  // select と直接入力欄のペアを構築する
  function setupTabPicker(select, input, cachedLabels, savedValue) {
    const candidates = [...cachedLabels];
    if (savedValue && !candidates.includes(savedValue)) {
      candidates.unshift(savedValue);
    }
    for (const label of candidates) {
      const option = document.createElement("option");
      option.value = label;
      option.textContent = label;
      select.appendChild(option);
    }
    const freeOption = document.createElement("option");
    freeOption.value = FREE_INPUT;
    freeOption.textContent = "その他（直接入力）";
    select.appendChild(freeOption);

    if (savedValue) {
      select.value = savedValue; // candidates に必ず含まれている
    } else {
      select.value = candidates.length > 0 ? candidates[0] : FREE_INPUT;
    }
  }

  function pickedValue(select, input) {
    return select.value === FREE_INPUT ? input.value.trim() : select.value;
  }

  function syncControlStates() {
    const customEnabled = form.tabMode.value === "custom";
    tabSelect.disabled = !customEnabled;
    tabNameInput.disabled = !customEnabled;
    // 直接入力欄は「その他」を選んだときだけ表示する
    tabNameInput.style.display = tabSelect.value === FREE_INPUT ? "" : "none";
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
