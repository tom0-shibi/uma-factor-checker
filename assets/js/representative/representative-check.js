import { members, requirements } from "../config.js";
import { drawOriginalImage, analyzeFactorImage } from "../analysis/image-analysis.js";
import {
  createOcrWorker,
  runOcrForFactorMetadata,
  runOcrForWhiteCards
} from "../ocr/ocr.js";
import {
  clearManualCorrection,
  getEffectiveRecognition,
  getOriginalRecognition,
  ignoreRecognition,
  setManualCorrection
} from "../result/result-model.js?v=20260916-ocr-regression-02";
import {
  getRequirementRank,
  normalizeSkillText
} from "../matching/matching.js";
import { getCanonicalSkillCandidates } from "../matching/candidate-provider.js";
import { getSelectedPresetNameOrEmpty } from "../preset/preset-manager.js";
import {
  MAX_SHARE_SKILLS,
  addShareSkill,
  clearShareSkills,
  getRequirementSkillCandidates,
  getShareSkillLimitWarning,
  getShareSkills,
  removeShareSkill,
  replaceShareSkillsFromS
} from "../export/share-skills.js?v=20260916-ocr-regression-02";
import {
  REPRESENTATIVE_MEMBER_ORDER,
  representativeMembers,
  resetRepresentativeAnalysis,
  getRepresentativeImageExportPattern
} from "./representative-state.js";
import {
  TRAINER_ID_STORAGE_KEY,
  TRAINER_ID_VISIBLE_STORAGE_KEY,
  buildRepresentativeSkillSummaries,
  formatRepresentativeXText,
  sanitizeTrainerId
} from "./representative-share.js";
import {
  createRepresentativeImage,
  showRepresentativeImagePreview
} from "./representative-image-export.js";

let pasteTargetMember = "target";

function createImageItem(file) {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    file
  };
}

function setRepresentativePasteTarget(memberId) {
  pasteTargetMember = memberId;
  document.querySelectorAll(".representative-member-panel").forEach(panel => {
    panel.classList.toggle(
      "active-paste-target",
      panel.dataset.representativeMember === memberId
    );
  });
  const label = document.getElementById("representative-paste-target-label");
  if (label) {
    label.textContent = representativeMembers[memberId].label;
  }
}

function renderRepresentativePreviews(memberId) {
  const member = representativeMembers[memberId];
  const container = document.getElementById(`representative-preview-${memberId}`);
  if (!container) {
    return;
  }
  container.innerHTML = "";
  member.images.forEach((image, index) => {
    const item = document.createElement("div");
    item.className = "image-preview-item";
    const preview = document.createElement("img");
    const url = URL.createObjectURL(image.file);
    preview.src = url;
    preview.alt = `${member.label} 画像${index + 1}`;
    preview.addEventListener("load", () => URL.revokeObjectURL(url), { once: true });
    const caption = document.createElement("span");
    caption.textContent = `画像${index + 1}`;
    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "image-delete-button";
    remove.textContent = "削除";
    remove.addEventListener("click", () => {
      member.images = member.images.filter(itemImage => itemImage.id !== image.id);
      member.analysisResults = member.analysisResults.filter(
        result => result.imageId !== image.id
      );
      member.source = "separate";
      renderRepresentativePreviews(memberId);
      updateRepresentativeState();
    });
    item.append(preview, caption, remove);
    container.appendChild(item);
  });
}

function addRepresentativeImages(memberId, files) {
  const images = [...files]
    .filter(file => file.type.startsWith("image/"))
    .map(createImageItem);
  if (images.length === 0) {
    return;
  }
  representativeMembers[memberId].images.push(...images);
  representativeMembers[memberId].source = "separate";
  resetRepresentativeAnalysis(memberId);
  renderRepresentativePreviews(memberId);
  updateRepresentativeState();
}

function reuseRequirementMember(memberId) {
  const source = members[memberId];
  const target = representativeMembers[memberId];
  target.images = [...source.images];
  target.analysisResults = [...source.analysisResults];
  target.source = "skill-check";
  renderRepresentativePreviews(memberId);
  updateRepresentativeState();
  setRepresentativeStatus(
    source.images.length > 0
      ? `${target.label}にスキル要件チェックの画像を読み込みました。`
      : `スキル要件チェックの${target.label}に画像がありません。`,
    source.images.length === 0
  );
}

function getRepresentativeImageCount() {
  return REPRESENTATIVE_MEMBER_ORDER.reduce(
    (total, memberId) => total + representativeMembers[memberId].images.length,
    0
  );
}

function hasRepresentativeResults() {
  return REPRESENTATIVE_MEMBER_ORDER.some(memberId =>
    representativeMembers[memberId].analysisResults.some(
      result => result.analysis?.supported === true
    )
  );
}

function setRepresentativeStatus(message, isError = false) {
  const status = document.getElementById("representative-analysis-status");
  if (status) {
    status.textContent = message;
    status.classList.toggle("is-error", isError);
  }
}

function buildCanonicalNamesByMember() {
  return Object.fromEntries(REPRESENTATIVE_MEMBER_ORDER.map(memberId => {
    const names = new Set();
    representativeMembers[memberId].analysisResults.forEach(imageResult => {
      [
        ...(imageResult.analysis?.leftCards ?? []),
        ...(imageResult.analysis?.rightCards ?? [])
      ].forEach(card => {
        if (card.factorType !== "white") {
          return;
        }
        const recognition = getEffectiveRecognition(card);
        if (recognition.status === "confirmed" && recognition.canonicalName) {
          names.add(recognition.canonicalName);
        }
      });
    });
    return [memberId, names];
  }));
}

function getRegisteredRepresentativeMemberIds() {
  return REPRESENTATIVE_MEMBER_ORDER.filter(
    memberId => representativeMembers[memberId].images.length > 0
  );
}

function getRepresentativeXText() {
  const selectedSkills = getShareSkills();
  const registeredIds = getRegisteredRepresentativeMemberIds();
  const skillSummaries = buildRepresentativeSkillSummaries(
    registeredIds,
    selectedSkills,
    buildCanonicalNamesByMember()
  );
  return formatRepresentativeXText({
    title: getSelectedPresetNameOrEmpty(),
    trainerId: document.getElementById("representative-trainer-id")?.value ?? "",
    showTrainerId: document.getElementById("representative-show-trainer-id")?.checked,
    skillSummaries
  });
}

function formatResultStars(stars) {
  const count = Math.min(3, Math.max(0, Number(stars) || 0));
  return count > 0
    ? `${"★".repeat(count)}${"☆".repeat(3 - count)}`
    : "-";
}

function aggregateRepresentativeMemberSkills(memberId) {
  const skillMap = new Map();
  representativeMembers[memberId].analysisResults.forEach(imageResult => {
    [
      ...(imageResult.analysis?.leftCards ?? []),
      ...(imageResult.analysis?.rightCards ?? [])
    ].forEach(card => {
      if (card.factorType !== "white") {
        return;
      }
      const recognition = getEffectiveRecognition(card);
      if (
        recognition.status !== "confirmed" ||
        !recognition.canonicalName
      ) {
        return;
      }
      const rank = getRequirementRank(recognition.canonicalName);
      if (!rank) {
        return;
      }
      const key = normalizeSkillText(recognition.canonicalName);
      const existing = skillMap.get(key);
      if (!existing || card.stars > existing.stars) {
        skillMap.set(key, {
          canonicalName: recognition.canonicalName,
          rank,
          stars: card.stars
        });
      }
    });
  });
  return skillMap;
}

function getRepresentativeReviewItems() {
  const items = [];
  REPRESENTATIVE_MEMBER_ORDER.forEach(memberId => {
    representativeMembers[memberId].analysisResults.forEach(imageResult => {
      [
        ...(imageResult.analysis?.leftCards ?? []),
        ...(imageResult.analysis?.rightCards ?? [])
      ].forEach(card => {
        if (card.factorType !== "white") {
          return;
        }
        const original = getOriginalRecognition(card);
        if (
          original.status === "review" ||
          original.status === "unresolved" ||
          card.manualCorrection
        ) {
          items.push({ memberId, imageResult, card, original });
        }
      });
    });
  });
  return items;
}

function renderRepresentativeReviewItems(container) {
  const items = getRepresentativeReviewItems();
  if (items.length === 0) {
    return;
  }
  const section = document.createElement("section");
  const heading = document.createElement("h3");
  heading.textContent = "要確認・手動訂正";
  const note = document.createElement("p");
  note.className = "description";
  note.textContent = "訂正後はOCRを再実行せず、現在の判定対象で再集計します。";
  const list = document.createElement("ul");
  list.className = "representative-review-list";
  const candidates = getCanonicalSkillCandidates();
  items.forEach(item => {
    const row = document.createElement("li");
    const label = document.createElement("span");
    label.textContent = `${representativeMembers[item.memberId].label} / ${item.original.ocrText || "読み取りなし"}`;
    const select = document.createElement("select");
    select.appendChild(new Option("正式名称を選択", ""));
    candidates.forEach(candidate => {
      select.appendChild(new Option(candidate, candidate));
    });
    if (item.card.manualCorrection?.canonicalName) {
      select.value = item.card.manualCorrection.canonicalName;
    }
    const confirm = document.createElement("button");
    confirm.type = "button";
    confirm.className = "secondary-button compact-button";
    confirm.textContent = "確定";
    confirm.addEventListener("click", () => {
      if (select.value) {
        setManualCorrection(item.card, select.value);
        renderRepresentativeOutput();
      }
    });
    const ignore = document.createElement("button");
    ignore.type = "button";
    ignore.className = "secondary-button compact-button";
    ignore.textContent = "対象外";
    ignore.addEventListener("click", () => {
      ignoreRecognition(item.card);
      renderRepresentativeOutput();
    });
    row.append(label, select, confirm, ignore);
    if (item.card.manualCorrection) {
      const clear = document.createElement("button");
      clear.type = "button";
      clear.className = "secondary-button compact-button";
      clear.textContent = "訂正を解除";
      clear.addEventListener("click", () => {
        clearManualCorrection(item.card);
        renderRepresentativeOutput();
      });
      row.appendChild(clear);
    }
    list.appendChild(row);
  });
  section.append(heading, note, list);
  container.appendChild(section);
}

function renderRepresentativeResults() {
  const container = document.getElementById("representative-results");
  if (!container) {
    return;
  }
  container.innerHTML = "";
  const registeredIds = getRegisteredRepresentativeMemberIds();
  if (!hasRepresentativeResults()) {
    return;
  }
  const title = document.createElement("h2");
  title.textContent = "代表ウマ娘 判定結果";
  const target = document.createElement("p");
  target.textContent = `今回の判定対象: ${registeredIds.length}面`;
  container.append(title, target);
  const memberSkillMaps = Object.fromEntries(
    registeredIds.map(memberId => [
      memberId,
      aggregateRepresentativeMemberSkills(memberId)
    ])
  );
  ["S", "A", "B", "C"].forEach(rank => {
    if ((requirements[rank] ?? []).length === 0) {
      return;
    }
    const section = document.createElement("section");
    const heading = document.createElement("h3");
    heading.textContent = rank;
    const table = document.createElement("table");
    table.className = "representative-result-table";
    const header = document.createElement("tr");
    ["スキル", ...registeredIds.map(id => representativeMembers[id].label), "面数"]
      .forEach(text => {
        const th = document.createElement("th");
        th.textContent = text;
        header.appendChild(th);
      });
    const thead = document.createElement("thead");
    thead.appendChild(header);
    const tbody = document.createElement("tbody");
    requirements[rank].forEach(skillName => {
      const row = document.createElement("tr");
      const name = document.createElement("td");
      name.textContent = skillName;
      row.appendChild(name);
      let ownedCount = 0;
      registeredIds.forEach(memberId => {
        const found = memberSkillMaps[memberId].get(normalizeSkillText(skillName));
        const cell = document.createElement("td");
        cell.textContent = found ? formatResultStars(found.stars) : "-";
        if (found) {
          ownedCount++;
        }
        row.appendChild(cell);
      });
      const count = document.createElement("td");
      count.textContent = `${ownedCount}面`;
      row.appendChild(count);
      tbody.appendChild(row);
    });
    table.append(thead, tbody);
    section.append(heading, table);
    container.appendChild(section);
  });
  renderRepresentativeReviewItems(container);
}

function renderRepresentativeShareSkills() {
  const root = document.getElementById("representative-share-skills");
  if (!root) {
    return;
  }
  const selected = getShareSkills();
  const selectedIds = new Set(selected.map(skill => skill.id));
  const available = getRequirementSkillCandidates(requirements).filter(
    skill => !selectedIds.has(skill.id)
  );
  root.innerHTML = "";
  const heading = document.createElement("h4");
  heading.textContent = "共有スキル";
  const controls = document.createElement("div");
  controls.className = "share-skill-controls";
  const loadS = document.createElement("button");
  loadS.type = "button";
  loadS.className = "secondary-button compact-button";
  loadS.textContent = "Sスキルを読み込む";
  loadS.addEventListener("click", () => {
    replaceShareSkillsFromS(requirements.S);
    renderRepresentativeOutput();
  });
  const clear = document.createElement("button");
  clear.type = "button";
  clear.className = "secondary-button compact-button";
  clear.textContent = "すべて削除";
  clear.disabled = selected.length === 0;
  clear.addEventListener("click", () => {
    clearShareSkills();
    renderRepresentativeOutput();
  });
  controls.append(loadS, clear);
  const list = document.createElement("ul");
  list.className = "share-skill-list";
  selected.forEach(skill => {
    const item = document.createElement("li");
    const name = document.createElement("span");
    name.textContent = skill.canonicalName;
    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "share-skill-remove";
    remove.textContent = "×";
    remove.setAttribute("aria-label", `${skill.canonicalName}を共有から削除`);
    remove.addEventListener("click", () => {
      removeShareSkill(skill.id);
      renderRepresentativeOutput();
    });
    item.append(name, remove);
    list.appendChild(item);
  });
  const count = document.createElement("p");
  count.className = "share-skill-count";
  count.textContent = `${selected.length} / ${MAX_SHARE_SKILLS}`;
  const addRow = document.createElement("div");
  addRow.className = "share-skill-add-row";
  const select = document.createElement("select");
  select.setAttribute("aria-label", "代表共有スキルを追加");
  select.appendChild(new Option("スキルを選択してください", ""));
  available.forEach(skill => select.appendChild(
    new Option(skill.canonicalName, skill.canonicalName)
  ));
  const add = document.createElement("button");
  add.type = "button";
  add.className = "secondary-button compact-button";
  add.textContent = "スキルを追加";
  add.disabled = selected.length >= MAX_SHARE_SKILLS || available.length === 0;
  add.addEventListener("click", () => {
    if (select.value) {
      addShareSkill(select.value);
      renderRepresentativeOutput();
    }
  });
  addRow.append(select, add);
  root.append(heading, controls, list, count, addRow);
  const warningText = getShareSkillLimitWarning(selected);
  if (warningText) {
    const warning = document.createElement("p");
    warning.className = "share-skill-warning";
    warning.textContent = warningText;
    root.appendChild(warning);
  }
}

function renderRepresentativeOutput() {
  renderRepresentativeShareSkills();
  renderRepresentativeResults();
  const preview = document.getElementById("representative-x-preview");
  if (preview) {
    preview.textContent = getRepresentativeXText();
  }
  const createImageButton = document.getElementById("create-representative-image");
  const registeredIds = getRegisteredRepresentativeMemberIds();
  const exportPattern = getRepresentativeImageExportPattern(registeredIds);
  const allRegisteredSupported = registeredIds.length > 0 && registeredIds.every(
    memberId => representativeMembers[memberId].analysisResults.some(
      result => result.analysis?.supported === true
    )
  );
  if (createImageButton) {
    createImageButton.disabled = !exportPattern || !allRegisteredSupported;
  }
  const guidance = document.getElementById("representative-image-guidance");
  if (guidance) {
    if (!exportPattern) {
      guidance.hidden = false;
      guidance.textContent = registeredIds.includes("target")
        ? "ⓘ 代表画像は「本体のみ」または「本体・親A・親B」の構成で生成できます。"
        : "ⓘ 代表画像を生成する場合は本体を登録してください。単体共有は本体枠を使用してください。";
    } else if (!allRegisteredSupported) {
      guidance.hidden = false;
      guidance.textContent = "ⓘ 登録画像を解析すると代表画像を生成できます。";
    } else {
      guidance.hidden = true;
    }
  }
}

function updateRepresentativeState() {
  const count = getRepresentativeImageCount();
  const countNode = document.getElementById("representative-image-count");
  if (countNode) {
    countNode.textContent = count;
  }
  const analyze = document.getElementById("analyze-representative-images");
  if (analyze) {
    analyze.disabled = count === 0;
  }
  const registeredCount = getRegisteredRepresentativeMemberIds().length;
  const faceCount = document.getElementById("representative-registered-face-count");
  if (faceCount) {
    faceCount.textContent = `${registeredCount}面`;
  }
  const disabledReason = document.getElementById("representative-analysis-disabled-reason");
  if (disabledReason) {
    disabledReason.hidden = count > 0;
  }
  renderRepresentativeOutput();
}

async function analyzeRepresentativeImages() {
  const button = document.getElementById("analyze-representative-images");
  button.disabled = true;
  setRepresentativeStatus("代表画像を解析しています…");
  let worker = null;
  try {
    worker = await createOcrWorker();
    for (const memberId of REPRESENTATIVE_MEMBER_ORDER) {
      const member = representativeMembers[memberId];
      if (member.source !== "skill-check") {
        member.analysisResults = [];
      }
      for (let index = 0; index < member.images.length; index++) {
        const imageItem = member.images[index];
        if (member.source === "skill-check" && member.analysisResults.some(
          result => result.imageId === imageItem.id
        )) {
          continue;
        }
        setRepresentativeStatus(`${member.label} / 画像${index + 1}を解析しています…`);
        const { canvas, ctx, width, height } = await drawOriginalImage(imageItem.file);
        const analysis = analyzeFactorImage(ctx, width, height);
        if (analysis.supported === true) {
          await runOcrForFactorMetadata(worker, canvas, analysis);
          await runOcrForWhiteCards(worker, canvas, analysis, member.label, index);
        }
        member.analysisResults.push({ imageId: imageItem.id, imageIndex: index, analysis });
      }
    }
    setRepresentativeStatus("代表画像の解析が完了しました。");
  } catch (error) {
    console.error("代表画像の解析に失敗しました", error);
    setRepresentativeStatus(error.message || "代表画像の解析に失敗しました。", true);
  } finally {
    await worker?.terminate().catch(() => {});
    button.disabled = getRepresentativeImageCount() === 0;
    renderRepresentativeOutput();
  }
}

function loadRepresentativePreferences() {
  const trainerId = document.getElementById("representative-trainer-id");
  const visible = document.getElementById("representative-show-trainer-id");
  try {
    trainerId.value = sanitizeTrainerId(localStorage.getItem(TRAINER_ID_STORAGE_KEY));
    visible.checked = localStorage.getItem(TRAINER_ID_VISIBLE_STORAGE_KEY) === "true";
  } catch (error) {
    console.warn("トレーナーID設定を読み込めませんでした。", error);
  }
}

function initializeModeSwitch() {
  let representativeMode = false;
  const updateModeVisibility = () => {
    const imagesTab = document.getElementById("images");
    const imagesTabActive = imagesTab?.classList.contains("active") === true;
    imagesTab?.classList.toggle("representative-mode", representativeMode);
    document.getElementById("representative-check-workspace").hidden =
      !representativeMode || !imagesTabActive;
  };

  document.querySelectorAll(".mode-switch-button").forEach(button => {
    button.addEventListener("click", () => {
      representativeMode = button.dataset.mode === "representative-check";
      document.querySelectorAll(".mode-switch-button").forEach(item => {
        item.classList.toggle("active", item === button);
      });
      updateModeVisibility();
      if (representativeMode) {
        renderRepresentativeOutput();
      }
    });
  });

  document.querySelectorAll(".tab-button").forEach(button => {
    button.addEventListener("click", updateModeVisibility);
  });
}

function initializeRepresentativeCheck() {
  initializeModeSwitch();
  loadRepresentativePreferences();
  document.addEventListener("requirements-applied", renderRepresentativeOutput);
  document.querySelectorAll(".representative-image-input").forEach(input => {
    input.addEventListener("change", () => {
      addRepresentativeImages(input.dataset.representativeMember, input.files);
      input.value = "";
    });
  });
  document.querySelectorAll(".representative-image-drop-zone").forEach(zone => {
    const memberId = zone.dataset.representativeMember;
    zone.addEventListener("click", () => {
      setRepresentativePasteTarget(memberId);
      zone.querySelector("input")?.click();
    });
    zone.addEventListener("dragover", event => {
      event.preventDefault();
      zone.classList.add("drag-over");
    });
    zone.addEventListener("dragleave", () => zone.classList.remove("drag-over"));
    zone.addEventListener("drop", event => {
      event.preventDefault();
      zone.classList.remove("drag-over");
      setRepresentativePasteTarget(memberId);
      addRepresentativeImages(memberId, event.dataTransfer.files);
    });
  });
  document.querySelectorAll(".representative-member-panel").forEach(panel => {
    panel.addEventListener("click", event => {
      if (!event.target.closest("button")) {
        setRepresentativePasteTarget(panel.dataset.representativeMember);
      }
    });
  });
  document.querySelectorAll(".representative-reuse-button").forEach(button => {
    button.addEventListener("click", () => reuseRequirementMember(button.dataset.sourceMember));
  });
  document.addEventListener("paste", event => {
    if (document.getElementById("representative-check-workspace")?.hidden) {
      return;
    }
    const files = [...(event.clipboardData?.items ?? [])]
      .filter(item => item.kind === "file" && item.type.startsWith("image/"))
      .map(item => item.getAsFile())
      .filter(Boolean);
    if (files.length > 0) {
      event.preventDefault();
      addRepresentativeImages(pasteTargetMember, files);
    }
  });
  document.getElementById("analyze-representative-images")?.addEventListener(
    "click",
    analyzeRepresentativeImages
  );
  const trainerId = document.getElementById("representative-trainer-id");
  trainerId?.addEventListener("input", () => {
    trainerId.value = sanitizeTrainerId(trainerId.value);
    try {
      localStorage.setItem(TRAINER_ID_STORAGE_KEY, trainerId.value);
    } catch (error) {
      console.warn("トレーナーIDを保存できませんでした。", error);
    }
    renderRepresentativeOutput();
  });
  const showTrainerId = document.getElementById("representative-show-trainer-id");
  showTrainerId?.addEventListener("change", () => {
    try {
      localStorage.setItem(TRAINER_ID_VISIBLE_STORAGE_KEY, String(showTrainerId.checked));
    } catch (error) {
      console.warn("トレーナーID表示設定を保存できませんでした。", error);
    }
    renderRepresentativeOutput();
  });
  document.getElementById("copy-representative-x")?.addEventListener("click", async () => {
    const status = document.getElementById("representative-share-status");
    try {
      await navigator.clipboard.writeText(getRepresentativeXText());
      status.textContent = "X用テキストをコピーしました。";
      status.classList.remove("is-error");
    } catch (error) {
      status.textContent = "コピーできませんでした。ブラウザの権限を確認してください。";
      status.classList.add("is-error");
    }
  });
  document.getElementById("create-representative-image")?.addEventListener("click", async () => {
    const status = document.getElementById("representative-share-status");
    const result = await createRepresentativeImage(
      representativeMembers,
      REPRESENTATIVE_MEMBER_ORDER
    );
    if (!result) {
      status.textContent = "出力できる解析済み画像がありません。";
      return;
    }
    await showRepresentativeImagePreview(result);
    status.textContent = result.warning || "代表ウマ娘画像を生成しました。";
  });
  setRepresentativePasteTarget("target");
  updateRepresentativeState();
}

export {
  initializeRepresentativeCheck,
  getRegisteredRepresentativeMemberIds,
  buildCanonicalNamesByMember,
  getRepresentativeXText
};
