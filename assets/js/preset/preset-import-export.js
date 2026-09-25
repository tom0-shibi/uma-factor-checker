const PRESET_EXPORT_FORMAT = "uma-factor-checker-requirement-presets";
const PRESET_EXPORT_VERSION = 2;
const SUPPORTED_VERSIONS = new Set([1, 2]);
const RANKS = ["S", "A", "B", "C"];

function isValidSkills(skills) {
  return skills && RANKS.every(
    rank =>
      Array.isArray(skills[rank]) &&
      skills[rank].every(skill => typeof skill === "string")
  );
}

function isValidUnclassified(items) {
  if (items === undefined) return true;
  return Array.isArray(items) && items.every(item =>
    typeof item === "string" ||
    (item && typeof item.name === "string" &&
      (item.styles === undefined ||
        (Array.isArray(item.styles) && item.styles.every(style => typeof style === "string"))))
  );
}

function parsePresetImport(text) {
  const data = JSON.parse(text);
  if (
    data.format !== PRESET_EXPORT_FORMAT ||
    !SUPPORTED_VERSIONS.has(data.version) ||
    !Array.isArray(data.presets)
  ) {
    throw new Error("対応していないプリセット形式です。");
  }
  if (!data.presets.every(
    preset =>
      preset &&
      typeof preset.name === "string" &&
      preset.name.trim() !== "" &&
      isValidSkills(preset.skills) &&
      isValidUnclassified(preset.unclassified)
  )) {
    throw new Error("プリセットの内容が正しくありません。");
  }
  return data.presets.map(preset => ({ ...preset }));
}

function createPresetExportData(presets) {
  return {
    format: PRESET_EXPORT_FORMAT,
    version: PRESET_EXPORT_VERSION,
    presets: presets.map(preset => {
      const exported = { name: preset.name, skills: preset.skills };
      if (preset.labels) exported.labels = preset.labels;
      if (Array.isArray(preset.unclassified) && preset.unclassified.length) {
        exported.unclassified = preset.unclassified;
      }
      return exported;
    })
  };
}

function exportUserPresets(presets) {
  const data = createPresetExportData(presets);
  const blob = new Blob(
    [JSON.stringify(data, null, 2)],
    { type: "application/json" }
  );
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "uma-factor-checker-preset.json";
  link.click();
  URL.revokeObjectURL(url);
}

function createTsv(skills) {
  const lines = ["ランク\tスキル名"];
  RANKS.forEach(rank => {
    skills[rank].forEach(skill => lines.push(`${rank}\t${skill}`));
  });
  return lines.join("\n");
}

export {
  parsePresetImport,
  createPresetExportData,
  exportUserPresets,
  createTsv
};
