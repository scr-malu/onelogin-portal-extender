// OneLogin Portal Extender - オプション画面
const DEFAULTS = {
  tabMode: "company",
  tabName: "",
  domains: "",
  pinnedApps: [],
};

document.addEventListener("DOMContentLoaded", async () => {
  const form = document.getElementById("options-form");
  const status = document.getElementById("status");
  const tabNameInput = document.getElementById("tab-name");
  const datalist = document.getElementById("tab-candidates");
  const pinnedList = document.getElementById("pinned-list");
  const pinnedEmpty = document.getElementById("pinned-empty");

  // 保存済み設定をフォームに反映
  const settings = await chrome.storage.sync.get(DEFAULTS);
  form.tabMode.value = settings.tabMode;
  tabNameInput.value = settings.tabName;
  form.domains.value = settings.domains;
  syncTabNameState();

  // ポータル閲覧時にキャッシュしたタブ名を入力候補として表示
  const { tabLabels = [] } = await chrome.storage.local.get("tabLabels");
  for (const label of tabLabels) {
    const option = document.createElement("option");
    option.value = label;
    datalist.appendChild(option);
  }

  renderPinned(settings.pinnedApps);

  form.addEventListener("change", syncTabNameState);

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    await chrome.storage.sync.set({
      tabMode: form.tabMode.value,
      tabName: tabNameInput.value.trim(),
      domains: form.domains.value.trim(),
    });
    status.textContent = "設定を保存しました。";
    setTimeout(() => (status.textContent = ""), 2000);
  });

  function syncTabNameState() {
    tabNameInput.disabled = form.tabMode.value !== "custom";
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
