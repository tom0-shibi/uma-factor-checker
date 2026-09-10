import { requirements, members, analysisProgress } from "../config.js";

let pasteTargetMember = "parentA";

/* =========================================================
  動的UI用CSS追加処理
  既存HTML/CSSを変更せず解析中表示と集計表を追加する。
  ========================================================= */

function ensureDynamicStyles() {
  if (
    document.getElementById(
      "dynamic-analysis-style"
    )
  ) {
    return;
  }

  const style =
    document.createElement("style");

  style.id =
    "dynamic-analysis-style";

  style.textContent = `
    .analysis-progress-overlay {
      position: fixed;
      inset: 0;
      z-index: 99999;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
      background: rgba(20, 24, 30, 0.58);
      backdrop-filter: blur(2px);
    }

    .analysis-progress-overlay[hidden] {
      display: none;
    }

    .analysis-progress-dialog {
      width: min(520px, 100%);
      box-sizing: border-box;
      padding: 28px;
      border-radius: 18px;
      background: #ffffff;
      box-shadow:
        0 24px 70px
        rgba(0, 0, 0, 0.25);
    }

    .analysis-progress-spinner {
      width: 42px;
      height: 42px;
      margin: 0 auto 18px;
      border: 5px solid #e4e7eb;
      border-top-color: #6f63d9;
      border-radius: 50%;
      animation:
        analysis-progress-spin
        0.85s linear infinite;
    }

    @keyframes analysis-progress-spin {
      to {
        transform: rotate(360deg);
      }
    }

    .analysis-progress-title {
      margin: 0 0 8px;
      text-align: center;
      font-size: 1.2rem;
      font-weight: 700;
    }

    .analysis-progress-detail {
      min-height: 1.5em;
      margin: 0 0 6px;
      text-align: center;
      font-weight: 600;
    }

    .analysis-progress-subdetail {
      min-height: 1.5em;
      margin: 0 0 18px;
      text-align: center;
      color: #666666;
      font-size: 0.92rem;
    }

    .analysis-progress-track {
      width: 100%;
      height: 13px;
      overflow: hidden;
      border-radius: 999px;
      background: #e8e8ee;
    }

    .analysis-progress-bar {
      width: 0%;
      height: 100%;
      border-radius: inherit;
      background:
        linear-gradient(
          90deg,
          #7167df,
          #9d66d9
        );
      transition:
        width 0.18s ease;
    }

    .analysis-progress-percent {
      margin-top: 8px;
      text-align: right;
      color: #555555;
      font-size: 0.85rem;
    }

    .factor-result-summary {
      margin-bottom: 28px;
    }

    .factor-result-summary h2 {
      margin-bottom: 8px;
    }

    .factor-result-note {
      margin: 0 0 18px;
      color: #666666;
      font-size: 0.9rem;
    }

    .factor-result-rank {
      margin: 22px 0;
    }

    .factor-result-rank-title {
      margin: 0 0 10px;
      font-size: 1.1rem;
    }

    .factor-result-table-wrap {
      overflow-x: auto;
    }

    .factor-result-table {
      width: 100%;
      min-width: 900px;
      border-collapse: collapse;
      background: #ffffff;
    }

    .factor-result-table th,
    .factor-result-table td {
      padding: 9px 10px;
      border: 1px solid #dddddd;
      text-align: center;
      white-space: nowrap;
    }

    .factor-result-table th {
      background: #f4f4f7;
    }

    .factor-result-table td.skill-name-cell {
      text-align: left;
      font-weight: 600;
    }

    .factor-result-empty {
      padding: 14px;
      border: 1px dashed #cccccc;
      border-radius: 10px;
      color: #777777;
    }

    .factor-result-hit {
      font-weight: 700;
    }

    .factor-result-missing {
      color: #aaaaaa;
    }

    .factor-result-count {
      font-weight: 700;
    }

    body.analysis-running {
      overflow: hidden;
    }
  `;

  document.head.appendChild(
    style
  );
}

/* =========================================================
  解析中オーバーレイ生成処理
  ========================================================= */

function ensureAnalysisProgressOverlay() {
  let overlay =
    document.getElementById(
      "analysis-progress-overlay"
    );

  if (overlay) {
    return overlay;
  }

  overlay =
    document.createElement("div");

  overlay.id =
    "analysis-progress-overlay";

  overlay.className =
    "analysis-progress-overlay";

  overlay.hidden = true;

  overlay.innerHTML = `
    <div
      class="analysis-progress-dialog"
      role="status"
      aria-live="polite"
    >
      <div
        class="analysis-progress-spinner"
        aria-hidden="true"
      ></div>

      <p
        id="analysis-progress-title"
        class="analysis-progress-title"
      >
        画像を解析しています
      </p>

      <p
        id="analysis-progress-detail"
        class="analysis-progress-detail"
      ></p>

      <p
        id="analysis-progress-subdetail"
        class="analysis-progress-subdetail"
      ></p>

      <div
        class="analysis-progress-track"
      >
        <div
          id="analysis-progress-bar"
          class="analysis-progress-bar"
        ></div>
      </div>

      <div
        id="analysis-progress-percent"
        class="analysis-progress-percent"
      >
        0%
      </div>
    </div>
  `;

  document.body.appendChild(
    overlay
  );

  return overlay;
}

/* =========================================================
  判定結果集計領域生成処理
  既存デバッグ表示より上へ集計結果を挿入する。
  ========================================================= */

function ensureResultSummaryContainer() {
  let container =
    document.getElementById(
      "factor-result-summary"
    );

  if (container) {
    return container;
  }

  container =
    document.createElement("section");

  container.id =
    "factor-result-summary";

  container.className =
    "factor-result-summary";

  const debugContainer =
    document.getElementById(
      "analysis-debug"
    );

  if (
    debugContainer &&
    debugContainer.parentNode
  ) {
    debugContainer.parentNode.insertBefore(
      container,
      debugContainer
    );
  } else {
    document.body.appendChild(
      container
    );
  }

  return container;
}

/* =========================================================
  解析進捗率計算処理
  画像単位＋現在画像内のOCR進捗を合わせて算出する。
  ========================================================= */

function calculateOverallProgress() {
  if (
    analysisProgress.totalImages <= 0
  ) {
    return 0;
  }

  const completedImages =
    Math.max(
      0,
      analysisProgress.currentImageNumber - 1
    );

  let currentImageProgress = 0;

  if (
    analysisProgress.totalWhiteCards > 0
  ) {
    const completedCards =
      Math.max(
        0,
        analysisProgress.currentWhiteCard - 1
      );

    currentImageProgress =
      (
        completedCards +
        analysisProgress.tesseractProgress
      ) /
      analysisProgress.totalWhiteCards;
  }

  const progress =
    (
      completedImages +
      currentImageProgress
    ) /
    analysisProgress.totalImages;

  return Math.max(
    0,
    Math.min(
      1,
      progress
    )
  );
}

/* =========================================================
  解析中表示更新処理
  ========================================================= */

function updateAnalysisProgressDisplay(
  detail,
  subdetail = ""
) {
  const detailElement =
    document.getElementById(
      "analysis-progress-detail"
    );

  const subdetailElement =
    document.getElementById(
      "analysis-progress-subdetail"
    );

  const bar =
    document.getElementById(
      "analysis-progress-bar"
    );

  const percent =
    document.getElementById(
      "analysis-progress-percent"
    );

  if (detailElement) {
    detailElement.textContent =
      detail;
  }

  if (subdetailElement) {
    subdetailElement.textContent =
      subdetail;
  }

  const progress =
    calculateOverallProgress();

  const progressPercent =
    Math.round(
      progress * 100
    );

  if (bar) {
    bar.style.width =
      `${progressPercent}%`;
  }

  if (percent) {
    percent.textContent =
      `${progressPercent}%`;
  }
}

/* =========================================================
  解析中表示開始処理
  ========================================================= */

function showAnalysisProgress(
  totalImages
) {
  ensureDynamicStyles();

  const overlay =
    ensureAnalysisProgressOverlay();

  analysisProgress.active = true;
  analysisProgress.totalImages =
    totalImages;
  analysisProgress.currentImageNumber = 1;
  analysisProgress.currentMemberLabel = "";
  analysisProgress.currentImageIndex = 0;
  analysisProgress.currentWhiteCard = 0;
  analysisProgress.totalWhiteCards = 0;
  analysisProgress.tesseractProgress = 0;

  const title =
    document.getElementById(
      "analysis-progress-title"
    );

  if (title) {
    title.textContent =
      "画像を解析しています";
  }

  overlay.hidden = false;

  document.body.classList.add(
    "analysis-running"
  );

  updateAnalysisProgressDisplay(
    "OCRを準備しています...",
    `全体 0 / ${totalImages}画像`
  );
}

/* =========================================================
  解析中表示終了処理
  ========================================================= */

function hideAnalysisProgress() {
  analysisProgress.active = false;

  const overlay =
    document.getElementById(
      "analysis-progress-overlay"
    );

  if (overlay) {
    overlay.hidden = true;
  }

  document.body.classList.remove(
    "analysis-running"
  );
}

/* =========================================================
  解析完了表示処理
  結果タブへ移動する直前に100%を表示する。
  ========================================================= */

async function showAnalysisCompleteProgress() {
  analysisProgress.currentImageNumber =
    analysisProgress.totalImages + 1;

  analysisProgress.currentWhiteCard = 0;
  analysisProgress.totalWhiteCards = 0;
  analysisProgress.tesseractProgress = 0;

  const title =
    document.getElementById(
      "analysis-progress-title"
    );

  if (title) {
    title.textContent =
      "解析が完了しました";
  }

  updateAnalysisProgressDisplay(
    "判定結果を表示します...",
    `${analysisProgress.totalImages}画像の解析が完了しました`
  );

  const bar =
    document.getElementById(
      "analysis-progress-bar"
    );

  const percent =
    document.getElementById(
      "analysis-progress-percent"
    );

  if (bar) {
    bar.style.width =
      "100%";
  }

  if (percent) {
    percent.textContent =
      "100%";
  }

  await new Promise(
    resolve =>
      setTimeout(
        resolve,
        450
      )
  );
}

/* =========================================================
  タブ切り替え処理
  ========================================================= */

const tabButtons =
  document.querySelectorAll(
    ".tab-button"
  );

const tabContents =
  document.querySelectorAll(
    ".tab-content"
  );

tabButtons.forEach(button => {
  button.addEventListener(
    "click",
    () => {
      const tabId =
        button.dataset.tab;

      tabButtons.forEach(btn => {
        btn.classList.remove(
          "active"
        );
      });

      tabContents.forEach(content => {
        content.classList.remove(
          "active"
        );
      });

      button.classList.add(
        "active"
      );

      const target =
        document.getElementById(
          tabId
        );

      if (target) {
        target.classList.add(
          "active"
        );
      }
    }
  );
});

/* =========================================================
  スキル入力整形処理
  ========================================================= */

function parseSkillInput(value) {
  return [
    ...new Set(
      value
        .split(/\r?\n/)
        .map(
          skill =>
            skill.trim()
        )
        .filter(
          skill =>
            skill !== ""
        )
    )
  ];
}

/* =========================================================
  スキルカード表示処理
  ========================================================= */

function renderSkillCards(rank) {
  const container =
    document.getElementById(
      `cards-${rank.toLowerCase()}`
    );

  if (!container) {
    return;
  }

  const count =
    document.querySelector(
      `[data-rank-count="${rank}"]`
    );

  if (count) {
    count.textContent =
      `${requirements[rank].length}件`;
  }

  container.innerHTML = "";

  requirements[rank].forEach(skill => {
    const card =
      document.createElement("div");

    card.className =
      "skill-card";

    const text =
      document.createElement("span");

    text.textContent =
      skill;

    const deleteButton =
      document.createElement("button");

    deleteButton.type =
      "button";

    deleteButton.textContent =
      "×";

    deleteButton.addEventListener(
      "click",
      () => {
        requirements[rank] =
          requirements[rank].filter(
            item =>
              item !== skill
          );

        renderSkillCards(rank);
      }
    );

    card.appendChild(text);
    card.appendChild(
      deleteButton
    );

    container.appendChild(
      card
    );
  });
}

/* =========================================================
  スキル要件反映処理
  ========================================================= */

const applyRequirementsButton =
  document.getElementById(
    "apply-requirements"
  );

const requirementApplyStatus =
  document.getElementById(
    "requirement-apply-status"
  );

function setRequirementApplyStatus(state) {
  if (!requirementApplyStatus) {
    return;
  }

  requirementApplyStatus.classList.remove(
    "is-applied",
    "is-dirty"
  );

  if (state === "applied") {
    requirementApplyStatus.textContent = "✓ 反映済み";
    requirementApplyStatus.classList.add("is-applied");
    return;
  }

  if (state === "dirty") {
    requirementApplyStatus.textContent = "● 未反映の変更があります";
    requirementApplyStatus.classList.add("is-dirty");
    return;
  }

  requirementApplyStatus.textContent = "";
}

function markRequirementsDirty() {
  ["S", "A", "B", "C"].forEach(rank => {
    const textarea = document.getElementById(
      `input-${rank.toLowerCase()}`
    );
    const count = document.querySelector(
      `[data-rank-count="${rank}"]`
    );
    if (count) {
      count.textContent =
        `${parseSkillInput(textarea?.value || "").length}件`;
    }
  });
  setRequirementApplyStatus("dirty");
}

function clearRequirementApplyStatus() {
  setRequirementApplyStatus("");
}

document.querySelectorAll(
  "#input-s, #input-a, #input-b, #input-c"
).forEach(textarea => {
  textarea.addEventListener("input", markRequirementsDirty);
});

if (applyRequirementsButton) {
  applyRequirementsButton.addEventListener(
    "click",
    () => {
      requirements.S =
        parseSkillInput(
          document.getElementById(
            "input-s"
          )?.value || ""
        );

      requirements.A =
        parseSkillInput(
          document.getElementById(
            "input-a"
          )?.value || ""
        );

      requirements.B =
        parseSkillInput(
          document.getElementById(
            "input-b"
          )?.value || ""
        );

      requirements.C =
        parseSkillInput(
          document.getElementById(
            "input-c"
          )?.value || ""
        );

      renderSkillCards("S");
      renderSkillCards("A");
      renderSkillCards("B");
      renderSkillCards("C");

      setRequirementApplyStatus("applied");

      console.log(
        "現在のスキル要件:",
        requirements
      );
    }
  );
}

/* =========================================================
  画像登録画面DOM取得処理
  ========================================================= */

const fileInputs =
  document.querySelectorAll(
    ".image-file-input"
  );

const dropZones =
  document.querySelectorAll(
    ".image-drop-zone"
  );

const memberPanels =
  document.querySelectorAll(
    ".member-panel"
  );

/* =========================================================
  画像追加処理
  ========================================================= */

function addImages(
  memberId,
  files
) {
  const imageFiles =
    Array.from(files).filter(
      file =>
        file.type.startsWith(
          "image/"
        )
    );

  imageFiles.forEach(file => {
    members[memberId].images.push({
      id:
        `${Date.now()}-${Math.random()}`,
      file,
      url:
        URL.createObjectURL(
          file
        )
    });
  });

  renderImagePreviews(
    memberId
  );

  updateImageSummary();
}

/* =========================================================
  画像プレビュー表示処理
  ========================================================= */

function renderImagePreviews(
  memberId
) {
  const container =
    document.getElementById(
      `preview-${memberId}`
    );

  if (!container) {
    return;
  }

  container.innerHTML = "";

  members[
    memberId
  ].images.forEach(
    (
      imageData,
      index
    ) => {
      const item =
        document.createElement(
          "div"
        );

      item.className =
        "image-preview-item";

      const image =
        document.createElement(
          "img"
        );

      image.src =
        imageData.url;

      image.alt =
        `${members[memberId].label} 画像${index + 1}`;

      const number =
        document.createElement(
          "span"
        );

      number.className =
        "image-number";

      number.textContent =
        `画像 ${index + 1}`;

      const deleteButton =
        document.createElement(
          "button"
        );

      deleteButton.type =
        "button";

      deleteButton.className =
        "image-delete-button";

      deleteButton.textContent =
        "×";

      deleteButton.addEventListener(
        "click",
        event => {
          event.stopPropagation();

          removeImage(
            memberId,
            imageData.id
          );
        }
      );

      item.appendChild(image);
      item.appendChild(number);
      item.appendChild(
        deleteButton
      );

      container.appendChild(
        item
      );
    }
  );
}

/* =========================================================
  画像削除処理
  ========================================================= */

function removeImage(
  memberId,
  imageId
) {
  const target =
    members[
      memberId
    ].images.find(
      image =>
        image.id === imageId
    );

  if (target) {
    URL.revokeObjectURL(
      target.url
    );
  }

  members[
    memberId
  ].images =
    members[
      memberId
    ].images.filter(
      image =>
        image.id !== imageId
    );

  members[
    memberId
  ].analysisResults = [];

  renderImagePreviews(
    memberId
  );

  updateImageSummary();
}

/* =========================================================
  登録画像数・解析ボタン状態更新処理
  ========================================================= */

function updateImageSummary() {
  const total =
    Object.values(
      members
    ).reduce(
      (
        sum,
        member
      ) =>
        sum +
        member.images.length,
      0
    );

  const countElement =
    document.getElementById(
      "total-image-count"
    );

  if (countElement) {
    countElement.textContent =
      total;
  }

  const analyzeButton =
    document.getElementById(
      "analyze-images"
    );

  if (analyzeButton) {
    analyzeButton.disabled =
      total === 0;
  }
}

/* =========================================================
  ファイル選択による画像追加処理
  ========================================================= */

fileInputs.forEach(input => {
  input.addEventListener(
    "change",
    event => {
      addImages(
        input.dataset.member,
        event.target.files
      );

      input.value = "";
    }
  );
});

/* =========================================================
  ドロップエリアクリック処理
  ========================================================= */

dropZones.forEach(zone => {
  zone.addEventListener(
    "click",
    () => {
      const memberId =
        zone.dataset.member;

      setPasteTarget(
        memberId
      );

      const input =
        document.querySelector(
          `.image-file-input[data-member="${memberId}"]`
        );

      if (input) {
        input.click();
      }
    }
  );
});

/* =========================================================
  ドラッグ&ドロップ処理
  ========================================================= */

dropZones.forEach(zone => {
  zone.addEventListener(
    "dragover",
    event => {
      event.preventDefault();

      zone.classList.add(
        "drag-over"
      );
    }
  );

  zone.addEventListener(
    "dragleave",
    () => {
      zone.classList.remove(
        "drag-over"
      );
    }
  );

  zone.addEventListener(
    "drop",
    event => {
      event.preventDefault();

      zone.classList.remove(
        "drag-over"
      );

      const memberId =
        zone.dataset.member;

      setPasteTarget(
        memberId
      );

      addImages(
        memberId,
        event.dataTransfer.files
      );
    }
  );
});

/* =========================================================
  クリップボード貼り付け先変更処理
  ========================================================= */

function setPasteTarget(
  memberId
) {
  pasteTargetMember =
    memberId;

  memberPanels.forEach(panel => {
    panel.classList.remove(
      "active-paste-target"
    );
  });

  const targetPanel =
    document.querySelector(
      `.member-panel[data-member="${memberId}"]`
    );

  if (targetPanel) {
    targetPanel.classList.add(
      "active-paste-target"
    );
  }

  const label =
    document.getElementById(
      "paste-target-label"
    );

  if (label) {
    label.textContent =
      members[
        memberId
      ].label;
  }
}

/* =========================================================
  人物枠全体の選択処理
  ========================================================= */

memberPanels.forEach(panel => {
  panel.setAttribute(
    "tabindex",
    "0"
  );

  panel.addEventListener(
    "click",
    event => {
      if (
        event.target.closest(
          ".image-delete-button"
        )
      ) {
        return;
      }

      setPasteTarget(
        panel.dataset.member
      );
    }
  );

  panel.addEventListener(
    "keydown",
    event => {
      if (
        event.key === "Enter" ||
        event.key === " "
      ) {
        event.preventDefault();

        setPasteTarget(
          panel.dataset.member
        );
      }
    }
  );
});

/* =========================================================
  クリップボード画像貼り付け処理
  ========================================================= */

document.addEventListener(
  "paste",
  event => {
    const items =
      event.clipboardData?.items;

    if (!items) {
      return;
    }

    const files = [];

    for (
      const item
      of items
    ) {
      if (
        item.kind === "file" &&
        item.type.startsWith(
          "image/"
        )
      ) {
        const file =
          item.getAsFile();

        if (file) {
          files.push(file);
        }
      }
    }

    if (
      files.length === 0
    ) {
      return;
    }

    event.preventDefault();

    addImages(
      pasteTargetMember,
      files
    );
  }
);


export { ensureDynamicStyles, ensureAnalysisProgressOverlay, ensureResultSummaryContainer, updateAnalysisProgressDisplay, showAnalysisProgress, hideAnalysisProgress, showAnalysisCompleteProgress, setPasteTarget, updateImageSummary, markRequirementsDirty, clearRequirementApplyStatus };
