const PRESET_EXPORT_FORMAT = "uma-factor-checker-requirement-presets";
const PRESET_EXPORT_VERSION = 1;
const RANKS = ["S", "A", "B", "C"];

function isValidSkills(skills) {
  return skills && RANKS.every(
    rank =>
      Array.isArray(skills[rank]) &&
      skills[rank].every(skill => typeof skill === "string")
  );
}

function parsePresetImport(text) {
  const data = JSON.parse(text);
  if (
    data.format !== PRESET_EXPORT_FORMAT ||
    data.version !== PRESET_EXPORT_VERSION ||
    !Array.isArray(data.presets)
  ) {
    throw new Error("対応していないプリセット形式です。");
  }
  if (!data.presets.every(
    preset =>
      preset &&
      typeof preset.name === "string" &&
      preset.name.trim() !== "" &&
      isValidSkills(preset.skills)
  )) {
    throw new Error("プリセットの内容が正しくありません。");
  }
  return data.presets;
}

function exportUserPresets(presets) {
  const data = {
    format: PRESET_EXPORT_FORMAT,
    version: PRESET_EXPORT_VERSION,
    presets: presets.map(preset => ({
      name: preset.name,
      skills: preset.skills
    }))
  };
  const blob = new Blob(
    [JSON.stringify(data, null, 2)],
    { type: "application/json" }
  );
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "uma-factor-checker-presets.json";
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

export { parsePresetImport, exportUserPresets, createTsv };
