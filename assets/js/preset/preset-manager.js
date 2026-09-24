import { EVENT_PRESETS } from "./event-presets.js";
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
} from "../ui/ui.js?v=20260921-duplicate-paste-01";

const RANKS = ["S", "A", "B", "C"];
const DEFAULT_LABELS = {
  S: "優先度: S",
  A: "優先度: A",
  B: "優先度: B",
  C: "優先度: C"
};
const BUILTIN_PRESETS = [];

let userPresets = [];
let selectedPresetId = "";
let deletePendingId = "";
let manualCreationStarted = false;
let selectedEventPresetId = "";
let selectedEventStyle = "all";


const EVENT_STYLES = ["all", "逃げ", "先行", "差し", "追込"];
const EVENT_STYLE_LABELS = { all: "すべて", 逃げ: "逃げ", 先行: "先行", 差し: "差し", 追込: "追込" };

function isPastEvent(preset, now = new Date()) {
  if (preset.persistent) return false;
  const currentMonth = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}`;
  return preset.eventMonth < currentMonth;
}

function getSelectedEventPreset() {
  return EVENT_PRESETS.find(preset => preset.id === selectedEventPresetId) || null;
}

function getEventCandidateCount(preset) {
  if (!preset) return 0;
  if (preset.candidates?.length) return preset.candidates.length;
  return RANKS.reduce((sum, rank) => sum + (preset.skills?.[rank]?.length || 0), 0);
}

function getFilteredEventCandidates(preset) {
  if (!preset?.candidates?.length) return [];
  if (selectedEventStyle === "all") return preset.candidates;
  return preset.candidates.filter(candidate =>
    candidate.styles.includes("all") || candidate.styles.includes(selectedEventStyle)
  );
}

function renderEventPresetList() {
  const select = document.getElementById("event-preset-select");
  if (!select) return;
  const showPast = document.getElementById("event-show-past")?.checked === true;
  const visible = EVENT_PRESETS.filter(preset => showPast || !isPastEvent(preset));
  const previous = selectedEventPresetId;
  select.innerHTML = '<option value="">イベントプリセットを選択してください</option>';

  const appendOption = (parent, preset) => {
    const option = document.createElement("option");
    option.value = preset.id;
    option.textContent = `${preset.name}${preset.sample ? "（画面確認用サンプル）" : ""}`;
    parent.appendChild(option);
  };

  const persistent = visible.filter(preset => preset.persistent);
  const dated = visible
    .filter(preset => !preset.persistent)
    .sort((a, b) => b.eventMonth.localeCompare(a.eventMonth));

  if (persistent.length) {
    const group = document.createElement("optgroup");
    group.label = "常設・特殊";
    persistent.forEach(preset => appendOption(group, preset));
    select.appendChild(group);
  }

  const byYear = new Map();
  dated.forEach(preset => {
    const year = preset.eventMonth.slice(0, 4);
    if (!byYear.has(year)) byYear.set(year, []);
    byYear.get(year).push(preset);
  });
  byYear.forEach((presets, year) => {
    const group = document.createElement("optgroup");
    group.label = `${year}年`;
    presets.forEach(preset => appendOption(group, preset));
    select.appendChild(group);
  });
  if (visible.some(preset => preset.id === previous)) {
    select.value = previous;
  } else {
    selectedEventPresetId = "";
    select.value = "";
  }
  renderEventPresetDetail();
}

function renderEventPresetDetail() {
  const detail = document.getElementById("event-preset-detail");
  const preset = getSelectedEventPreset();
  if (!detail) return;
  detail.hidden = !preset;
  if (!preset) return;
  document.getElementById("event-detail-name").textContent = preset.name;
  document.getElementById("event-detail-note").textContent = preset.sample
    ? "画面確認用のサンプル候補です。本番の候補スキルは後から差し替えます。"
    : preset.candidates?.length
      ? "イベント候補スキルを脚質で絞り込めます。"
      : "あらかじめS/A/B/Cへ分類されたイベントプリセットです。";

  const styleFilter = document.querySelector(".event-style-filter");
  const candidateSummary = document.querySelector(".event-candidate-summary");
  const candidateList = document.getElementById("event-candidate-list");
  const phaseNote = document.querySelector(".event-phase-note");
  const hasCandidates = Boolean(preset.candidates?.length);
  if (styleFilter) styleFilter.hidden = !hasCandidates;
  if (candidateSummary) candidateSummary.hidden = !hasCandidates;
  if (candidateList) candidateList.hidden = !hasCandidates;
  if (phaseNote) phaseNote.hidden = !hasCandidates;

  if (hasCandidates) {
    const styleButtons = document.getElementById("event-style-buttons");
    styleButtons.innerHTML = "";
    EVENT_STYLES.forEach(style => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "event-style-button";
      button.classList.toggle("is-active", style === selectedEventStyle);
      button.textContent = EVENT_STYLE_LABELS[style];
      button.addEventListener("click", () => {
        selectedEventStyle = style;
        renderEventPresetDetail();
      });
      styleButtons.appendChild(button);
    });
    const candidates = getFilteredEventCandidates(preset);
    document.getElementById("event-candidate-count").textContent = `${candidates.length}件`;
    candidateList.innerHTML = "";
    candidates.forEach(candidate => {
      const item = document.createElement("div");
      item.className = "event-candidate-item";
      const styles = candidate.styles.includes("all") ? ["全脚質"] : candidate.styles;
      item.innerHTML = `<strong>${candidate.name}</strong><span>${styles.map(style => `<small>${style}</small>`).join("")}</span>`;
      candidateList.appendChild(item);
    });
  }
}

function closeEventPresetDetail() {
  selectedEventPresetId = "";
  selectedEventStyle = "all";
  const select = document.getElementById("event-preset-select");
  if (select) select.value = "";
  renderEventPresetDetail();
}

function copySelectedEventPreset() {
  const preset = getSelectedEventPreset();
  if (!preset) return;
  const suggestedName = `${preset.name} 自分用`;
  const input = window.prompt("コピー後のプリセット名を入力してください。", suggestedName);
  if (input === null) return;
  const name = input.trim();
  if (!name) {
    setStatus("プリセット名を入力してください。", true);
    return;
  }
  const copied = {
    id: createUserPresetId(),
    name: createUniqueName(name),
    readonly: false,
    labels: preset.labels ? { ...preset.labels } : null,
    skills: preset.skills
      ? Object.fromEntries(RANKS.map(rank => [rank, [...preset.skills[rank]]]))
      : createEmptySkills(),
    unclassified: (preset.candidates || []).map(candidate => ({ ...candidate, styles: [...candidate.styles] })),
    sourceEventId: preset.id
  };
  userPresets.push(copied);
  saveUserPresets(userPresets);
  selectPreset(copied.id);
  const unclassifiedCount = copied.unclassified.length;
  setStatus(unclassifiedCount
    ? `${copied.name}を作成しました。候補${unclassifiedCount}件は未分類として保持しています。`
    : `${copied.name}を作成しました。S/A/B/Cの分類を引き継いでいます。`);
}

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

function getSelectedPresetName() {
  return getSelectedPreset()?.name || "カスタム設定";
}

function getSelectedPresetNameOrEmpty() {
  return getSelectedPreset()?.name || "";
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

function createEmptySkills() {
  return Object.fromEntries(RANKS.map(rank => [rank, []]));
}

function hasWorkingRequirements() {
  return Object.values(readTextareaSkills()).some(skills => skills.length > 0);
}

function updateRequirementEmptyState() {
  const emptyState = document.getElementById("requirements-empty-state");
  if (!emptyState) {
    return;
  }
  emptyState.hidden = Boolean(
    selectedPresetId || hasWorkingRequirements() || manualCreationStarted
  );
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
  manualCreationStarted = false;
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
  updateRequirementEmptyState();
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
  manualCreationStarted = false;
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
  updateRequirementEmptyState();
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

function saveNewPreset(skills) {
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
    skills
  };
  userPresets.push(preset);
  saveUserPresets(userPresets);
  selectPreset(preset.id);
  nameInput.value = "";
  document.getElementById("preset-create-panel").hidden = true;
  const toggle = document.getElementById("preset-create-toggle");
  toggle?.setAttribute("aria-expanded", "false");
  setStatus(`${preset.name}を保存しました。`);
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
  document.getElementById("preset-export").disabled =
    readonly;
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
  renderEventPresetList();
  renderEventPresetDetail();

  RANKS.forEach(rank => {
    document.getElementById(`input-${rank.toLowerCase()}`)?.addEventListener(
      "input",
      updateRequirementEmptyState
    );
  });

  document.getElementById("empty-use-builtin")?.addEventListener(
    "click",
    () => {
      selectedEventPresetId = "event:skill-exam-high-efficiency";
      selectedEventStyle = "all";
      const select = document.getElementById("event-preset-select");
      if (select) select.value = selectedEventPresetId;
      renderEventPresetDetail();
      document.getElementById("event-preset-detail")?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  );
  document.getElementById("empty-create-own")?.addEventListener(
    "click",
    () => {
      manualCreationStarted = true;
      updateRequirementEmptyState();
      const firstAccordion = document.querySelector(
        '.requirement-accordion[data-rank="S"]'
      );
      if (firstAccordion) {
        firstAccordion.open = true;
      }
      document.getElementById("input-s")?.focus();
    }
  );
  document.getElementById("event-show-past")?.addEventListener("change", renderEventPresetList);
  document.getElementById("event-preset-select")?.addEventListener("change", event => {
    selectedEventPresetId = event.target.value;
    selectedEventStyle = "all";
    renderEventPresetDetail();
  });
  document.getElementById("event-copy-preset")?.addEventListener("click", copySelectedEventPreset);
  document.getElementById("event-close-detail")?.addEventListener("click", closeEventPresetDetail);

  document.getElementById("preset-create-toggle")?.addEventListener(
    "click",
    event => {
      const panel = document.getElementById("preset-create-panel");
      if (!panel) {
        return;
      }
      panel.hidden = !panel.hidden;
      event.currentTarget.setAttribute("aria-expanded", String(!panel.hidden));
      if (!panel.hidden) {
        document.getElementById("preset-name")?.focus();
      }
    }
  );
  document.getElementById("preset-create-empty")?.addEventListener(
    "click",
    () => saveNewPreset(createEmptySkills())
  );

  document.getElementById("preset-select")?.addEventListener(
    "change",
    event => selectPreset(event.target.value)
  );
  document.getElementById("preset-save-new")?.addEventListener(
    "click",
    () => saveNewPreset(readTextareaSkills())
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
      const preset = getSelectedPreset();
      if (!preset || preset.readonly) {
        setStatus("カスタムプリセットを選択してください。", true);
        return;
      }
      exportUserPresets([preset]);
      setStatus(`${preset.name}をエクスポートしました。`);
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

export {
  initializePresetManager,
  getRequirementRankLabel,
  getSelectedPresetName,
  getSelectedPresetNameOrEmpty
};
