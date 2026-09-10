const PRESET_STORAGE_KEYS = {
  presets: "umaFactorChecker.requirementPresets",
  selectedPreset: "umaFactorChecker.selectedRequirementPreset"
};

function loadUserPresets() {
  try {
    const value = localStorage.getItem(PRESET_STORAGE_KEYS.presets);
    const presets = value ? JSON.parse(value) : [];
    return Array.isArray(presets) ? presets : [];
  } catch (error) {
    console.warn("ユーザープリセットを読み込めませんでした", error);
    return [];
  }
}

function saveUserPresets(presets) {
  localStorage.setItem(PRESET_STORAGE_KEYS.presets, JSON.stringify(presets));
}

function loadSelectedPresetId() {
  return localStorage.getItem(PRESET_STORAGE_KEYS.selectedPreset);
}

function saveSelectedPresetId(presetId) {
  localStorage.setItem(PRESET_STORAGE_KEYS.selectedPreset, presetId);
}

export {
  loadUserPresets,
  saveUserPresets,
  loadSelectedPresetId,
  saveSelectedPresetId
};
