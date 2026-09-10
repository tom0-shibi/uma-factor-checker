import { SKILL_EXAM_HIGH_EFFICIENCY_PRESET } from "./skill-exam-high-efficiency.js";
import {
  loadUserPresets,
  saveUserPresets,
  saveSelectedPresetId
} from "./preset-storage.js";
import {
  parsePresetImport,
  exportUserPresets,
  createTsv
} from "./preset-import-export.js";
import {
  markRequirementsDirty,
  clearRequirementApplyStatus
} from "../ui/ui.js";

const RANKS = ["S", "A", "B", "C"];
const DEFAULT_LABELS = {
  S: "優先度: S",
  A: "優先度: A",
  B: "優先度: B",
  C: "優先度: C"
};
const BUILTIN_PRESETS = [SKILL_EXAM_HIGH_EFFICIENCY_PRESET];

let userPresets = [];
let selectedPresetId = "";
let deletePendingId = "";

function getAllPresets() {
  return [...BUILTIN_PRESETS, ...userPresets];
}

function getSelectedPreset() {
  return getAllPresets().find(
    preset => preset.id === selectedPresetId
  ) || null;
}

function getRequirementRankLabel(rank) {
  return getSelectedPreset()?.labels?.[rank] || DEFAULT_LABELS[rank];
}

function readTextareaSkills() {
  return Object.fromEntries(RANKS.map(rank => {
    const value = document.getElementById(
      `input-${rank.toLowerCase()}`
    )?.value || "";
    return [rank, [...new Set(
      value.split(/\r?\n/)
        .map(skill => skill.trim())
        .filter(Boolean)
    )]];
  }));
}

function updateLabels() {
  RANKS.forEach(rank => {
    const label = document.querySelector(
      `.priority-header[data-rank="${rank}"]`
    );
    if (label) {
      label.textContent = getRequirementRankLabel(rank);
    }
  });
}

function applyPreset(preset) {
  RANKS.forEach(rank => {
    const textarea = document.getElementById(
      `input-${rank.toLowerCase()}`
    );
    if (textarea) {
      textarea.value = preset.skills[rank].join("\n");
    }
  });
  updateLabels();
  markRequirementsDirty();
  closeRequirementAccordions();
}

function closeRequirementAccordions() {
  document.querySelectorAll(".requirement-accordion").forEach(
    accordion => {
      accordion.open = false;
    }
  );
}

function clearWorkingRequirements() {
  selectedPresetId = "";
  deletePendingId = "";
  saveSelectedPresetId("");
  RANKS.forEach(rank => {
    const textarea = document.getElementById(
      `input-${rank.toLowerCase()}`
    );
    if (textarea) {
      textarea.value = "";
    }
  });
  updateLabels();
  document.getElementById("apply-requirements")?.click();
  clearRequirementApplyStatus();
  const resultContainer = document.getElementById(
    "factor-result-summary"
  );
  if (resultContainer) {
    resultContainer.innerHTML = "";
  }
  closeRequirementAccordions();
  renderPresetOptions();
}

function setStatus(message, isError = false) {
  const status = document.getElementById("preset-status");
  if (status) {
    status.textContent = message;
    status.classList.toggle("is-error", isError);
  }
}

function createUserPresetId() {
  return `user:${Date.now()}:${Math.random().toString(36).slice(2)}`;
}

function createUniqueName(name) {
  const names = new Set(userPresets.map(preset => preset.name));
  if (!names.has(name)) {
    return name;
  }
  let suffix = 2;
  while (names.has(`${name} (${suffix})`)) {
    suffix++;
  }
  return `${name} (${suffix})`;
}

function renderPresetOptions() {
  const select = document.getElementById("preset-select");
  if (!select) {
    return;
  }
  select.innerHTML = "";
  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = "プリセットを選択してください";
  select.appendChild(placeholder);
  getAllPresets().forEach(preset => {
    const option = document.createElement("option");
    option.value = preset.id;
    option.textContent = preset.readonly
      ? `${preset.name}（固定）`
      : preset.name;
    select.appendChild(option);
  });
  select.value = selectedPresetId;
  const readonly = getSelectedPreset()?.readonly !== false;
  document.getElementById("preset-overwrite").disabled = readonly;
  const deleteButton = document.getElementById("preset-delete");
  deleteButton.disabled = readonly;
  deleteButton.textContent = "削除";
  document.getElementById("preset-reset").disabled =
    getSelectedPreset()?.readonly === true;
}

function selectPreset(presetId) {
  if (!presetId) {
    clearWorkingRequirements();
    setStatus("スキル要件を空にしました。");
    return;
  }
  const preset = getAllPresets().find(item => item.id === presetId);
  if (!preset) {
    return;
  }
  selectedPresetId = preset.id;
  deletePendingId = "";
  saveSelectedPresetId(selectedPresetId);
  renderPresetOptions();
  applyPreset(preset);
  setStatus(`${preset.name}を読み込みました。`);
}

function initializePresetManager() {
  userPresets = loadUserPresets().filter(
    preset =>
      preset &&
      typeof preset.id === "string" &&
      typeof preset.name === "string" &&
      preset.readonly === false &&
      preset.skills
  );
  selectedPresetId = "";
  renderPresetOptions();
  clearWorkingRequirements();

  document.getElementById("preset-select")?.addEventListener(
    "change",
    event => selectPreset(event.target.value)
  );
  document.getElementById("preset-save-new")?.addEventListener(
    "click",
    () => {
      const nameInput = document.getElementById("preset-name");
      const name = nameInput?.value.trim();
      if (!name) {
        setStatus("新しいプリセット名を入力してください。", true);
        nameInput?.focus();
        return;
      }
      const preset = {
        id: createUserPresetId(),
        name: createUniqueName(name),
        readonly: false,
        labels: null,
        skills: readTextareaSkills()
      };
      userPresets.push(preset);
      saveUserPresets(userPresets);
      selectPreset(preset.id);
      nameInput.value = "";
      setStatus(`${preset.name}を保存しました。`);
    }
  );
  document.getElementById("preset-overwrite")?.addEventListener(
    "click",
    () => {
      const preset = getSelectedPreset();
      if (!preset || preset.readonly) {
        setStatus("固定プリセットは上書きできません。", true);
        return;
      }
      preset.skills = readTextareaSkills();
      saveUserPresets(userPresets);
      setStatus(`${preset.name}を上書きしました。`);
    }
  );
  document.getElementById("preset-delete")?.addEventListener(
    "click",
    () => {
      const preset = getSelectedPreset();
      if (!preset || preset.readonly) {
        return;
      }
      if (deletePendingId !== preset.id) {
        deletePendingId = preset.id;
        document.getElementById("preset-delete").textContent =
          "本当に削除";
        setStatus(
          `「${preset.name}」を削除する場合は、もう一度押してください。`
        );
        return;
      }
      userPresets = userPresets.filter(item => item.id !== preset.id);
      saveUserPresets(userPresets);
      clearWorkingRequirements();
      setStatus(`${preset.name}を削除しました。`);
    }
  );
  document.getElementById("preset-export")?.addEventListener(
    "click",
    () => {
      exportUserPresets(userPresets);
      setStatus("ユーザープリセットをエクスポートしました。");
    }
  );
  document.getElementById("preset-import")?.addEventListener(
    "click",
    () => document.getElementById("preset-import-file")?.click()
  );
  document.getElementById("preset-import-file")?.addEventListener(
    "change",
    async event => {
      const file = event.target.files?.[0];
      if (!file) {
        return;
      }
      try {
        const imported = parsePresetImport(await file.text());
        imported.forEach(item => {
          userPresets.push({
            id: createUserPresetId(),
            name: createUniqueName(item.name.trim()),
            readonly: false,
            labels: null,
            skills: item.skills
          });
        });
        saveUserPresets(userPresets);
        renderPresetOptions();
        setStatus(`${imported.length}件をインポートしました。`);
      } catch (error) {
        setStatus(error.message || "インポートに失敗しました。", true);
      } finally {
        event.target.value = "";
      }
    }
  );
  document.getElementById("preset-copy-tsv")?.addEventListener(
    "click",
    async () => {
      try {
        await navigator.clipboard.writeText(createTsv(readTextareaSkills()));
        setStatus("TSVをクリップボードへコピーしました。");
      } catch (error) {
        console.error("TSVをコピーできませんでした", error);
        setStatus("TSVをコピーできませんでした。", true);
      }
    }
  );
  document.getElementById("preset-reset")?.addEventListener(
    "click",
    () => {
      if (getSelectedPreset()?.readonly) {
        return;
      }
      clearWorkingRequirements();
      setStatus("現在のスキル要件をリセットしました。");
    }
  );
}

export { initializePresetManager, getRequirementRankLabel };
