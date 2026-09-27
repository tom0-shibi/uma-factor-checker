import { EVENT_PRESETS } from "./event-presets.js";
import { FACTOR_MASTER } from "../data/factor-master.js";
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
let workingUnclassified = [];
let classificationSelection = new Set();
let classificationFilter = "all";

const ADDABLE_FACTOR_TYPES = new Set(["skill", "awakening", "gene"]);
const FACTOR_TYPE_ORDER = { skill: 0, awakening: 1, gene: 2 };
const ADDABLE_FACTORS = FACTOR_MASTER
  .filter(factor => ADDABLE_FACTOR_TYPES.has(factor.type))
  .slice()
  .sort((a, b) => (FACTOR_TYPE_ORDER[a.type] ?? 99) - (FACTOR_TYPE_ORDER[b.type] ?? 99) || a.name.localeCompare(b.name, "ja"));


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
      ? "イベント候補スキルです。"
      : "あらかじめS/A/B/Cへ分類されたイベントプリセットです。";

  const candidateSummary = document.querySelector(".event-candidate-summary");
  const candidateList = document.getElementById("event-candidate-list");
  const phaseNote = document.querySelector(".event-phase-note");
  const hasCandidates = Boolean(preset.candidates?.length);
  if (candidateSummary) candidateSummary.hidden = !hasCandidates;
  if (candidateList) candidateList.hidden = !hasCandidates;
  if (phaseNote) phaseNote.hidden = !hasCandidates;

  if (hasCandidates) {
    document.getElementById("event-candidate-count").textContent = `${preset.candidates.length}件`;
    candidateList.innerHTML = "";
    preset.candidates.forEach(candidate => {
      const item = document.createElement("div");
      item.className = "event-candidate-item";
      const name = document.createElement("strong");
      name.textContent = candidate.name;
      item.appendChild(name);
      candidateList.appendChild(item);
    });
  }
}

function closeEventPresetDetail() {
  selectedEventPresetId = "";
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
    unclassified: (preset.candidates || []).map(candidate => ({ name: candidate.name })),
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

function normalizeUnclassified(items) {
  if (!Array.isArray(items)) return [];
  const seen = new Set();
  return items.map(item => {
    if (typeof item === "string") return { name: item };
    if (!item || typeof item.name !== "string") return null;
    return { name: item.name.trim() };
  }).filter(item => item?.name && !seen.has(item.name) && seen.add(item.name));
}

function getClassificationItems() {
  const items = [];
  const occupied = new Set();
  workingUnclassified.forEach(item => {
    if (occupied.has(item.name)) return;
    occupied.add(item.name);
    items.push({ name: item.name, rank: "U" });
  });
  const skills = readTextareaSkills();
  RANKS.forEach(rank => {
    skills[rank].forEach(name => {
      if (occupied.has(name)) return;
      occupied.add(name);
      items.push({ name, rank });
    });
  });
  return items;
}

function getRankDisplayLabel(rank) {
  if (rank === "U") return "未分類";
  const custom = getSelectedPreset()?.labels?.[rank];
  return custom || rank;
}

function writeRankSkills(skills) {
  RANKS.forEach(rank => {
    const textarea = document.getElementById(`input-${rank.toLowerCase()}`);
    if (textarea) textarea.value = [...new Set(skills[rank])].join("\n");
  });
}

function renderRequirementBoard() {
  const items = getClassificationItems();
  ["U", ...RANKS].forEach(rank => {
    const list = document.getElementById(`board-${rank.toLowerCase()}`);
    if (!list) return;
    const rankItems = items.filter(item => item.rank === rank);
    const count = rank === "U"
      ? document.getElementById("board-count-u")
      : document.querySelector(`[data-rank-count="${rank}"]`);
    if (count) count.textContent = `${rankItems.length}件`;
    list.innerHTML = "";
    if (!rankItems.length) {
      const empty = document.createElement("span");
      empty.className = "requirement-board-empty";
      empty.textContent = "ここにスキルを移動できます";
      list.appendChild(empty);
      return;
    }
    rankItems.forEach(item => {
      const card = document.createElement("div");
      card.className = "requirement-mini-card";
      card.draggable = true;
      card.dataset.skillName = item.name;
      card.dataset.sourceRank = item.rank;
      card.title = "ドラッグして分類を移動";
      card.textContent = item.name;
      card.addEventListener("dragstart", event => {
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData("text/plain", item.name);
        event.dataTransfer.setData("application/x-uma-source-rank", item.rank);
        card.classList.add("is-dragging");
      });
      card.addEventListener("dragend", () => card.classList.remove("is-dragging"));
      list.appendChild(card);
    });
  });
}

function renderAddCandidates() {
  const input = document.getElementById("classification-add-name");
  const container = document.getElementById("classification-add-candidates");
  if (!input || !container) return;

  const query = input.value.trim().toLowerCase();
  const registered = new Map(getClassificationItems().map(item => [item.name, item.rank]));
  container.innerHTML = "";
  if (!query) {
    container.hidden = true;
    return;
  }

  const matches = ADDABLE_FACTORS.filter(factor => factor.name.toLowerCase().includes(query)).slice(0, 20);
  container.hidden = false;
  if (!matches.length) {
    container.innerHTML = '<p class="classification-candidate-empty">Factor Masterに一致する候補がありません。</p>';
    return;
  }
  matches.forEach(factor => {
    const row = document.createElement("div");
    row.className = "classification-candidate";
    const name = document.createElement("strong");
    name.textContent = factor.name;
    row.appendChild(name);
    const registeredRank = registered.get(factor.name);
    if (registeredRank) {
      const state = document.createElement("small");
      state.textContent = `登録済み：${getRankDisplayLabel(registeredRank)}`;
      row.appendChild(state);
    } else {
      const actions = document.createElement("div");
      actions.className = "classification-candidate-actions";
      ["U", ...RANKS].forEach(rank => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "classification-candidate-rank";
        button.textContent = getRankDisplayLabel(rank);
        button.addEventListener("click", () => addClassificationSkill(factor.name, rank));
        actions.appendChild(button);
      });
      row.appendChild(actions);
    }
    container.appendChild(row);
  });
}

function renderClassificationEditor() {
  const editor = document.getElementById("classification-editor");
  if (!editor) return;
  const items = getClassificationItems();
  editor.hidden = !(selectedPresetId || manualCreationStarted);
  if (editor.hidden) {
    classificationSelection.clear();
    renderRequirementBoard();
    return;
  }
  const validNames = new Set(items.map(item => item.name));
  classificationSelection.forEach(name => {
    if (!validNames.has(name)) classificationSelection.delete(name);
  });
  const query = document.getElementById("classification-search")?.value.trim().toLowerCase() || "";
  const filter = classificationFilter;
  const visible = items.filter(item =>
    (filter === "all" || item.rank === filter) &&
    (!query || item.name.toLowerCase().includes(query))
  );
  const counts = Object.fromEntries(["U", ...RANKS].map(rank => [rank, items.filter(item => item.rank === rank).length]));
  document.getElementById("classification-total-count").textContent = `${items.length}件`;
  document.getElementById("classification-selected-count").textContent = `${classificationSelection.size}件選択`;
  const summary = document.getElementById("classification-summary");
  summary.innerHTML = "";
  [{ rank: "all", label: "すべて", count: items.length }, ...["U", ...RANKS].map(rank => ({ rank, label: getRankDisplayLabel(rank), count: counts[rank] }))].forEach(({ rank, label, count }) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `classification-count-chip${rank === "all" ? "" : ` classification-rank-${rank.toLowerCase()}`}`;
    button.classList.toggle("is-active", classificationFilter === rank);
    button.setAttribute("aria-pressed", String(classificationFilter === rank));
    button.innerHTML = `${label} <strong>${count}</strong>`;
    button.addEventListener("click", () => { classificationFilter = rank; renderClassificationEditor(); });
    summary.appendChild(button);
  });
  const list = document.getElementById("classification-skill-list");
  list.innerHTML = "";
  if (!visible.length) {
    list.innerHTML = '<p class="classification-empty">条件に一致するスキルはありません。</p>';
  } else {
    visible.forEach(item => {
      const label = document.createElement("label");
      label.className = "classification-skill-item";
      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.checked = classificationSelection.has(item.name);
      checkbox.addEventListener("change", () => {
        if (checkbox.checked) classificationSelection.add(item.name);
        else classificationSelection.delete(item.name);
        renderClassificationEditor();
      });
      const name = document.createElement("span");
      name.className = "classification-skill-name";
      name.textContent = item.name;
      const badge = document.createElement("span");
      badge.className = `classification-rank-badge classification-rank-${item.rank.toLowerCase()}`;
      badge.textContent = getRankDisplayLabel(item.rank);
      label.append(checkbox, name, badge);
      list.appendChild(label);
    });
  }
  document.querySelectorAll(".classification-move-button").forEach(button => {
    button.disabled = classificationSelection.size === 0;
    const rank = button.dataset.moveRank;
    if (rank) button.textContent = getRankDisplayLabel(rank);
  });
  const deleteButton = document.getElementById("classification-delete-selected");
  if (deleteButton) deleteButton.disabled = classificationSelection.size === 0;
  renderAddCandidates();
  renderRequirementBoard();
}

function addClassificationSkill(name, targetRank) {
  const input = document.getElementById("classification-add-name");
  if (!name || !ADDABLE_FACTORS.some(factor => factor.name === name)) {
    setStatus("Factor Masterの候補から追加する因子を選択してください。", true);
    return;
  }
  if (getClassificationItems().some(item => item.name === name)) {
    setStatus(`「${name}」はすでに登録されています。`, true);
    renderAddCandidates();
    return;
  }
  if (targetRank === "U") {
    workingUnclassified.push({ name });
  } else if (RANKS.includes(targetRank)) {
    const skills = readTextareaSkills();
    skills[targetRank].push(name);
    writeRankSkills(skills);
  } else return;
  markRequirementsDirty();
  updateRequirementEmptyState();
  renderClassificationEditor();
  setStatus(`「${name}」を${getRankDisplayLabel(targetRank)}へ追加しました。保存する場合は「上書き保存」を押してください。`);
  input?.focus();
}

function moveSkillNames(skillNames, targetRank) {
  const items = getClassificationItems();
  const selectedNames = new Set(skillNames);
  const selected = items.filter(item => selectedNames.has(item.name));
  if (!selected.length) return 0;
  const skills = readTextareaSkills();
  RANKS.forEach(rank => {
    skills[rank] = skills[rank].filter(name => !selectedNames.has(name));
  });
  workingUnclassified = workingUnclassified.filter(item => !selectedNames.has(item.name));
  if (targetRank === "U") {
    selected.forEach(item => workingUnclassified.push({ name: item.name }));
  } else if (RANKS.includes(targetRank)) {
    selected.forEach(item => skills[targetRank].push(item.name));
  }
  writeRankSkills(skills);
  markRequirementsDirty();
  updateRequirementEmptyState();
  return selected.length;
}

function moveSelectedSkills(targetRank) {
  if (!classificationSelection.size) return;
  const moved = moveSkillNames([...classificationSelection], targetRank);
  classificationSelection.clear();
  renderClassificationEditor();
  setStatus(`選択した${moved}件を${getRankDisplayLabel(targetRank)}へ移動しました。保存する場合は「上書き保存」を押してください。`);
}

function deleteSelectedSkills() {
  if (!classificationSelection.size) return;
  const selectedNames = new Set(classificationSelection);
  const skills = readTextareaSkills();
  RANKS.forEach(rank => {
    skills[rank] = skills[rank].filter(name => !selectedNames.has(name));
  });
  workingUnclassified = workingUnclassified.filter(item => !selectedNames.has(item.name));
  writeRankSkills(skills);
  const deleted = selectedNames.size;
  classificationSelection.clear();
  markRequirementsDirty();
  updateRequirementEmptyState();
  renderClassificationEditor();
  setStatus(`選択した${deleted}件を削除しました。保存する場合は「上書き保存」を押してください。`);
}

function setupRequirementBoardDragAndDrop() {
  document.querySelectorAll(".requirement-board-list[data-drop-rank]").forEach(list => {
    list.addEventListener("dragover", event => {
      event.preventDefault();
      event.dataTransfer.dropEffect = "move";
      list.classList.add("is-drag-over");
    });
    list.addEventListener("dragleave", () => list.classList.remove("is-drag-over"));
    list.addEventListener("drop", event => {
      event.preventDefault();
      list.classList.remove("is-drag-over");
      const name = event.dataTransfer.getData("text/plain");
      const targetRank = list.dataset.dropRank;
      const sourceRank = event.dataTransfer.getData("application/x-uma-source-rank");
      if (!name || !targetRank || sourceRank === targetRank) return;
      const moved = moveSkillNames([name], targetRank);
      if (!moved) return;
      classificationSelection.clear();
      renderClassificationEditor();
      setStatus(`「${name}」を${getRankDisplayLabel(targetRank)}へ移動しました。保存する場合は「上書き保存」を押してください。`);
    });
  });
}

function hasWorkingRequirements() {
  return workingUnclassified.length > 0 || Object.values(readTextareaSkills()).some(skills => skills.length > 0);
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
  const preset = getSelectedPreset();
  const hasCustomLabels = Boolean(preset?.labels && RANKS.some(rank => preset.labels[rank]));
  const priorityNote = document.getElementById("priority-share-note");
  if (priorityNote) priorityNote.hidden = hasCustomLabels;

}

function applyPreset(preset) {
  manualCreationStarted = false;
  workingUnclassified = normalizeUnclassified(preset.unclassified);
  classificationSelection.clear();
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
  renderClassificationEditor();
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
  workingUnclassified = [];
  classificationSelection.clear();
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
  renderClassificationEditor();
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

function saveNewPreset(skills, unclassified = workingUnclassified) {
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
    skills,
    unclassified: normalizeUnclassified(unclassified)
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
      () => {
        updateRequirementEmptyState();
        renderClassificationEditor();
      }
    );
  });

  document.getElementById("empty-use-builtin")?.addEventListener(
    "click",
    () => {
      selectedEventPresetId = "event:skill-exam-high-efficiency";
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
      document.getElementById("classification-add-name")?.focus();
    }
  );
  document.getElementById("event-show-past")?.addEventListener("change", renderEventPresetList);
  document.getElementById("event-preset-select")?.addEventListener("change", event => {
    selectedEventPresetId = event.target.value;
      renderEventPresetDetail();
  });
  document.getElementById("event-copy-preset")?.addEventListener("click", copySelectedEventPreset);
  document.getElementById("event-close-detail")?.addEventListener("click", closeEventPresetDetail);

  document.getElementById("classification-add-name")?.addEventListener("input", () => {
    renderAddCandidates();
  });
  document.getElementById("classification-add-name")?.addEventListener("keydown", event => {
    if (event.key === "Enter") event.preventDefault();
  });
  document.getElementById("classification-search")?.addEventListener("input", renderClassificationEditor);
  document.getElementById("classification-select-visible")?.addEventListener("click", () => {
    const query = document.getElementById("classification-search")?.value.trim().toLowerCase() || "";
    const filter = classificationFilter;
    getClassificationItems().filter(item =>
      (filter === "all" || item.rank === filter) && (!query || item.name.toLowerCase().includes(query))
    ).forEach(item => classificationSelection.add(item.name));
    renderClassificationEditor();
  });
  document.getElementById("classification-clear-selection")?.addEventListener("click", () => {
    classificationSelection.clear();
    renderClassificationEditor();
  });
  document.querySelectorAll(".classification-move-button").forEach(button => {
    button.addEventListener("click", () => moveSelectedSkills(button.dataset.moveRank));
  });
  document.getElementById("classification-delete-selected")?.addEventListener("click", deleteSelectedSkills);
  setupRequirementBoardDragAndDrop();

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
    () => saveNewPreset(createEmptySkills(), [])
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
      preset.unclassified = normalizeUnclassified(workingUnclassified);
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
        const { presets: imported, excluded } = parsePresetImport(await file.text());
        imported.forEach(item => {
          userPresets.push({
            id: createUserPresetId(),
            name: createUniqueName(item.name.trim()),
            readonly: false,
            labels: item.labels || null,
            skills: item.skills,
            unclassified: normalizeUnclassified(item.unclassified)
          });
        });
        saveUserPresets(userPresets);
        renderPresetOptions();
        setStatus(excluded.length
          ? `${imported.length}件をインポートしました。Factor Masterに存在しない${excluded.length}件を除外しました：${excluded.join("、")}`
          : `${imported.length}件をインポートしました。`, excluded.length > 0);
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
