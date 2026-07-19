// OneLogin Portal Extender - オプション画面
const DEFAULTS = {
  tabMode: "company",
  tabName: "",
  subTabName: "",
  domains: "",
  pinnedApps: [],
};

const FREE_INPUT = "__free__";

document.addEventListener("DOMContentLoaded", async () => {
  const form = document.getElementById("options-form");
  const status = document.getElementById("status");
  const tabSelect = document.getElementById("tab-select");
  const tabNameInput = document.getElementById("tab-name");
  const subTabSelect = document.getElementById("sub-tab-select");
  const subTabNameInput = document.getElementById("sub-tab-name");
  const pinnedList = document.getElementById("pinned-list");
  const pinnedEmpty = document.getElementById("pinned-empty");

  const settings = await chrome.storage.sync.get(DEFAULTS);
  const { tabLabels = [], subTabLabels = [] } = await chrome.storage.local.get([
    "tabLabels",
    "subTabLabels",
  ]);

  // タブ名のプルダウン(ポータル閲覧時にキャッシュした実際のタブ名 + 直接入力)
  setupTabPicker(tabSelect, tabNameInput, tabLabels, settings.tabName, null);
  // サブタブは「指定しない(OneLoginの初期値)」を先頭に置く
  setupTabPicker(subTabSelect, subTabNameInput, subTabLabels, settings.subTabName, {
    value: "",
    label: "指定しない（OneLoginの初期値に従う）",
  });

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
      subTabName: pickedValue(subTabSelect, subTabNameInput),
      domains: form.domains.value.trim(),
    });
    status.textContent = "設定を保存しました。";
    setTimeout(() => (status.textContent = ""), 2000);
  });

  // select と直接入力欄のペアを構築する。
  // emptyOption を渡すと「指定しない」のような空値の選択肢を先頭に追加する
  function setupTabPicker(select, input, cachedLabels, savedValue, emptyOption) {
    const candidates = [...cachedLabels];
    if (savedValue && !candidates.includes(savedValue)) {
      candidates.unshift(savedValue);
    }
    if (emptyOption) {
      const option = document.createElement("option");
      option.value = emptyOption.value;
      option.textContent = emptyOption.label;
      select.appendChild(option);
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
    } else if (emptyOption) {
      select.value = emptyOption.value;
    } else {
      select.value = candidates.length > 0 ? candidates[0] : FREE_INPUT;
    }
  }

  function pickedValue(select, input) {
    return select.value === FREE_INPUT ? input.value.trim() : select.value;
  }

  function syncControlStates() {
    const mode = form.tabMode.value;
    // タブ名指定は custom のときだけ、サブタブは切り替えが有効なときだけ操作可能
    tabSelect.disabled = mode !== "custom";
    tabNameInput.disabled = mode !== "custom";
    subTabSelect.disabled = mode === "off";
    subTabNameInput.disabled = mode === "off";
    // 直接入力欄は「その他」を選んだときだけ表示する
    tabNameInput.style.display = tabSelect.value === FREE_INPUT ? "" : "none";
    subTabNameInput.style.display = subTabSelect.value === FREE_INPUT ? "" : "none";
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
