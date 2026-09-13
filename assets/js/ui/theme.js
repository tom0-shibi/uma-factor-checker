const THEME_STORAGE_KEY = "uma-factor-checker:theme:v1";
const systemDarkQuery = window.matchMedia("(prefers-color-scheme: dark)");

function resolveTheme(preference) {
  if (preference === "system") {
    return systemDarkQuery.matches ? "dark" : "light";
  }
  return preference;
}

function applyTheme(preference) {
  document.documentElement.dataset.theme = resolveTheme(preference);
  document.documentElement.dataset.themePreference = preference;
}

function saveTheme(preference) {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, preference);
  } catch (error) {
    console.warn("テーマ設定を保存できませんでした。", error);
  }
}

function initializeTheme() {
  const select = document.getElementById("theme-select");
  const initialPreference = document.documentElement.dataset.themePreference || "system";
  if (select) {
    select.value = initialPreference;
    select.addEventListener("change", event => {
      const preference = event.target.value;
      applyTheme(preference);
      saveTheme(preference);
    });
  }
  systemDarkQuery.addEventListener("change", () => {
    if (document.documentElement.dataset.themePreference === "system") {
      applyTheme("system");
    }
  });
}

export { initializeTheme };
