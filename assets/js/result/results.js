import { APP_BUILD, requirements, members, MEMBER_ORDER, debugLogLines } from "../config.js";
import { ensureResultSummaryContainer } from "../ui/ui.js";
import { getRequirementRankLabel } from "../preset/preset-manager.js";
import { getCanonicalSkillCandidates } from "../matching/candidate-provider.js";
import {
  RANKS,
  buildOverallSkillSummary as buildResultModel,
  getReviewItems,
  setManualCorrection,
  ignoreRecognition,
  clearManualCorrection
} from "./result-model.js";

const openReviewGroups = new Set();

function applyReviewGroupOpenState(details, groupKey) {
  details.open = openReviewGroups.has(groupKey);
  details.addEventListener("toggle", () => {
    if (details.open) {
      openReviewGroups.add(groupKey);
    } else {
      openReviewGroups.delete(groupKey);
    }
  });
}

function resetReviewAccordionState() {
  openReviewGroups.clear();
}

/* =========================================================
  因子カード切り抜きプレビュー生成処理
  ========================================================= */

function createCardThumbnail(
  canvas,
  card
) {
  const cropCanvas =
    document.createElement(
      "canvas"
    );

  cropCanvas.width =
    card.width;

  cropCanvas.height =
    card.height;

  const cropCtx =
    cropCanvas.getContext(
      "2d"
    );

  cropCtx.drawImage(
    canvas,
    card.x,
    card.y,
    card.width,
    card.height,
    0,
    0,
    card.width,
    card.height
  );

  return cropCanvas.toDataURL(
    "image/jpeg",
    0.85
  );
}

/* =========================================================
  HTML表示用文字列エスケープ処理
  OCR文字列やユーザー入力によるHTML崩れを防止する。
  ========================================================= */

function escapeHtml(
  value
) {
  return String(
    value ?? ""
  )
    .replace(
      /&/g,
      "&amp;"
    )
    .replace(
      /</g,
      "&lt;"
    )
    .replace(
      />/g,
      "&gt;"
    )
    .replace(
      /"/g,
      "&quot;"
    )
    .replace(
      /'/g,
      "&#039;"
    );
}

/* =========================================================
  解析デバッグ結果表示処理
  ========================================================= */

function renderAnalysisDebug(
  memberLabel,
  imageIndex,
  canvas,
  analysis
) {
  const container =
    document.getElementById(
      "analysis-debug"
    );

  if (!container) {
    return;
  }

  const section =
    document.createElement(
      "section"
    );

  section.className =
    "analysis-debug-section";

  const title =
    document.createElement(
      "h3"
    );

  title.textContent =
    `${memberLabel} / 画像${imageIndex + 1}`;

  section.appendChild(
    title
  );

  const summary =
    document.createElement(
      "div"
    );

  summary.className =
    "analysis-summary";

  summary.innerHTML = `
    <span>左列：${analysis.leftCards.length}件</span>
    <span>右列：${analysis.rightCards.length}件</span>
    <span>所持因子開始Y：${analysis.factorAreaTop}</span>
    <span>行間隔：${analysis.pitch ?? "-"}</span>
  `;

  section.appendChild(
    summary
  );

  const table =
    document.createElement(
      "table"
    );

  table.className =
    "debug-table";

  table.innerHTML = `
    <thead>
      <tr>
        <th>画像</th>
        <th>OCR画像</th>
        <th>列</th>
        <th>No.</th>
        <th>種類</th>
        <th>星数</th>
        <th>OCR結果</th>
        <th>正式名称</th>
        <th>第1候補</th>
        <th>第1類似度</th>
        <th>第2候補</th>
        <th>第2類似度</th>
        <th>候補差</th>
        <th>閾値</th>
        <th>一致</th>
        <th>最終status</th>
        <th>要確認理由</th>
        <th>近似候補群</th>
        <th>fallback</th>
        <th>fallback理由</th>
        <th>通常OCR判定</th>
        <th>fallback結果</th>
        <th>要件</th>
        <th>信頼度</th>
        <th>星判定率</th>
        <th>RGB</th>
        <th>Y</th>
        <th>高さ</th>
      </tr>
    </thead>
    <tbody></tbody>
  `;

  const tbody =
    table.querySelector(
      "tbody"
    );

  const allCards = [
    ...analysis.leftCards,
    ...analysis.rightCards
  ];

  allCards.forEach(
    card => {
      const tr =
        document.createElement(
          "tr"
        );

      const preview =
        createCardThumbnail(
          canvas,
          card
        );

      if (
        card.factorType === "white" &&
        (
          card.finalStatus === "review" ||
          (
            card.finalStatus === "unresolved" &&
            !card.ocrText &&
            card.ocrFallbackAttempted
          )
        ) &&
        !card.reviewThumbnail
      ) {
        card.reviewThumbnail = preview;
      }

      const ocrPreviewHtml =
        card.ocrPreview
          ? `
            <img
              class="debug-ocr-thumbnail"
              src="${card.ocrPreview}"
              alt="OCR画像"
            >
          `
          : "-";

      const confidenceText =
        card.ocrConfidence !== null
          ? card.ocrConfidence
              .toFixed(1)
          : "-";

      const ratioText =
        card.yellowRatios
          .map(
            ratio =>
              ratio.toFixed(3)
          )
          .join("/");

      const candidateText =
        card.matchCandidate ||
        "-";

      const similarityText =
        card.factorType ===
        "white"
          ? card.matchSimilarity
              .toFixed(3)
          : "-";

      const secondCandidateText =
        card.secondMatchCandidate ||
        "-";

      const secondSimilarityText =
        card.factorType ===
        "white"
          ? card.secondMatchSimilarity
              .toFixed(3)
          : "-";

      const marginText =
        card.factorType ===
        "white"
          ? card.matchSimilarityMargin
              .toFixed(3)
          : "-";

      const thresholdText =
        card.factorType ===
        "white"
          ? card.matchThreshold
              .toFixed(3)
          : "-";

      let matchStatusText =
        "-";

      if (
        card.matchStatus ===
        "exact"
      ) {
        matchStatusText =
          "完全一致";
      } else if (
        card.matchStatus ===
        "similar"
      ) {
        matchStatusText =
          "類似一致";
      } else if (
        card.matchStatus ===
        "unmatched"
      ) {
        matchStatusText =
          "未確定";
      } else if (
        card.matchStatus ===
        "review"
      ) {
        matchStatusText =
          "要確認";
      }

      const fallbackResultsText =
        card.ocrFallbackResults?.length
          ? JSON.stringify(card.ocrFallbackResults)
          : "-";

      const normalOcrResultText =
        card.normalOcrResult
          ? JSON.stringify(card.normalOcrResult)
          : "-";

      const rankText =
        card.requirementRank ||
        "-";

      tr.innerHTML = `
        <td>
          <img
            class="debug-thumbnail"
            src="${preview}"
            alt="因子カード"
          >
        </td>

        <td>
          ${ocrPreviewHtml}
        </td>

        <td>${escapeHtml(card.column)}</td>
        <td>${card.row}</td>

        <td>
          <span
            class="factor-type factor-${escapeHtml(card.factorType)}"
          >
            ${escapeHtml(card.factorType)}
          </span>
        </td>

        <td>${card.stars}</td>

        <td>
          ${escapeHtml(card.ocrText || "-")}
        </td>

        <td>
          ${escapeHtml(card.canonicalName || "-")}
        </td>

        <td>
          ${escapeHtml(candidateText)}
        </td>

        <td>
          ${similarityText}
        </td>

        <td>
          ${escapeHtml(secondCandidateText)}
        </td>

        <td>
          ${secondSimilarityText}
        </td>

        <td>
          ${marginText}
        </td>

        <td>
          ${thresholdText}
        </td>

        <td>
          ${matchStatusText}
        </td>

        <td>${escapeHtml(card.finalStatus || "-")}</td>

        <td>${escapeHtml(card.reviewReason || "-")}</td>

        <td>${card.hasSimilarCandidateGroup ? "あり" : "なし"}</td>

        <td>${card.ocrFallbackAttempted ? "実行" : "未実行"}</td>

        <td>${escapeHtml(card.ocrFallbackReason || "-")}</td>

        <td>${escapeHtml(normalOcrResultText)}</td>

        <td>${escapeHtml(fallbackResultsText)}</td>

        <td>
          ${rankText}
        </td>

        <td>
          ${confidenceText}
        </td>

        <td>
          ${ratioText}
        </td>

        <td>
          ${card.color.r},
          ${card.color.g},
          ${card.color.b}
        </td>

        <td>${card.y}</td>
        <td>${card.height}</td>
      `;

      tbody.appendChild(
        tr
      );
    }
  );

  section.appendChild(
    table
  );

  container.appendChild(
    section
  );

  const logLines = [];

  logLines.push(
    `${memberLabel} / 画像${imageIndex + 1}`
  );

  logLines.push(
    `BUILD：${APP_BUILD}`
  );

  logLines.push(
    `左列：${analysis.leftCards.length}件`
  );

  logLines.push(
    `右列：${analysis.rightCards.length}件`
  );

  logLines.push(
    `所持因子開始Y：${analysis.factorAreaTop}`
  );

  logLines.push(
    `行間隔：${analysis.pitch ?? "-"}`
  );

  logLines.push("");

  logLines.push(
    "画像\t列\tNo.\t種類\t星数\tOCR結果\t正式名称\t第1候補\t第1類似度\t第2候補\t第2類似度\t候補差\t閾値\t一致\t最終status\t要確認理由\t近似候補群\tfallback実行\tfallback理由\t通常OCR判定\tfallback結果\t要件\t信頼度\t星判定率\tRGB\tY\t高さ"
  );

  allCards.forEach(
    card => {
      const ratioText =
        card.yellowRatios
          .map(
            ratio =>
              ratio.toFixed(3)
          )
          .join("/");

      let matchStatusText =
        "";

      if (
        card.matchStatus ===
        "exact"
      ) {
        matchStatusText =
          "完全一致";
      } else if (
        card.matchStatus ===
        "similar"
      ) {
        matchStatusText =
          "類似一致";
      } else if (
        card.matchStatus ===
        "unmatched"
      ) {
        matchStatusText =
          "未確定";
      } else if (
        card.matchStatus ===
        "review"
      ) {
        matchStatusText =
          "要確認";
      }

      logLines.push(
        [
          "因子カード",
          card.column,
          card.row,
          card.factorType,
          card.stars,
          card.ocrText || "",
          card.canonicalName || "",
          card.matchCandidate || "",
          card.factorType ===
          "white"
            ? card.matchSimilarity
                .toFixed(3)
            : "",
          card.secondMatchCandidate ||
            "",
          card.factorType ===
          "white"
            ? card.secondMatchSimilarity
                .toFixed(3)
            : "",
          card.factorType ===
          "white"
            ? card.matchSimilarityMargin
                .toFixed(3)
            : "",
          card.factorType ===
          "white"
            ? card.matchThreshold
                .toFixed(3)
            : "",
          matchStatusText,
          card.finalStatus || "",
          card.reviewReason || "",
          card.hasSimilarCandidateGroup
            ? "あり"
            : "なし",
          card.ocrFallbackAttempted
            ? "実行"
            : "未実行",
          card.ocrFallbackReason || "",
          card.normalOcrResult
            ? JSON.stringify(card.normalOcrResult)
            : "",
          card.ocrFallbackResults?.length
            ? JSON.stringify(
                card.ocrFallbackResults
              )
            : "",
          card.requirementRank ||
            "",
          card.ocrConfidence !==
          null
            ? card.ocrConfidence
                .toFixed(1)
            : "",
          ratioText,
          `${card.color.r}, ${card.color.g}, ${card.color.b}`,
          card.y,
          card.height
        ].join("\t")
      );
    }
  );

  debugLogLines.push(
    ...logLines,
    ""
  );
}

/* =========================================================
  画像単位解析エラー表示処理
  ========================================================= */

function renderAnalysisError(
  memberLabel,
  imageIndex,
  error
) {
  const container =
    document.getElementById(
      "analysis-debug"
    );

  if (container) {
    const section =
      document.createElement(
        "section"
      );

    section.className =
      "analysis-debug-section";

    const title =
      document.createElement(
        "h3"
      );

    title.textContent =
      `${memberLabel} / 画像${imageIndex + 1}`;

    const message =
      document.createElement(
        "p"
      );

    message.textContent =
      `この画像は解析できませんでした：${error.message}`;

    section.appendChild(
      title
    );

    section.appendChild(
      message
    );

    container.appendChild(
      section
    );
  }

  debugLogLines.push(
    `${memberLabel} / 画像${imageIndex + 1}`
  );

  debugLogLines.push(
    `BUILD：${APP_BUILD}`
  );

  debugLogLines.push(
    `解析エラー：${error.message}`
  );

  debugLogLines.push("");
}

/* =========================================================
  星数表示変換処理
  ========================================================= */

function formatStars(
  stars
) {
  if (
    !stars ||
    stars < 1
  ) {
    return "-";
  }

  return (
    "★".repeat(
      Math.min(
        stars,
        3
      )
    ) +
    "☆".repeat(
      Math.max(
        0,
        3 - stars
      )
    )
  );
}

function appendResultTableColumns(table) {
  const colgroup = document.createElement("colgroup");
  const columnClasses = [
    "result-col-skill",
    ...MEMBER_ORDER.map(() => "result-col-member"),
    "result-col-count",
    "result-col-stars"
  ];

  columnClasses.forEach(className => {
    const column = document.createElement("col");
    column.className = className;
    colgroup.appendChild(column);
  });
  table.appendChild(colgroup);
}

function renderMemberSummary(container, model) {
  const section = document.createElement("section");
  section.className = "result-member-summary";
  const title = document.createElement("h3");
  title.textContent = "結果サマリー";
  section.appendChild(title);

  const wrap = document.createElement("div");
  wrap.className = "result-summary-table-wrap";
  const table = document.createElement("table");
  table.className = "result-summary-table";
  table.innerHTML = `
    <thead>
      <tr>
        <th>メンバー</th>
        <th>S</th>
        <th>A</th>
        <th>B</th>
        <th>C</th>
        <th>合計</th>
      </tr>
    </thead>
  `;
  const tbody = document.createElement("tbody");

  model.memberSummary.forEach(item => {
    const row = document.createElement("tr");
    const values = item.registered
      ? [
          members[item.memberId].label,
          ...RANKS.map(rank => item.counts[rank]),
          item.total
        ]
      : [members[item.memberId].label, "-", "-", "-", "-", "-"];
    values.forEach(value => {
      const cell = document.createElement("td");
      cell.textContent = String(value);
      row.appendChild(cell);
    });
    tbody.appendChild(row);
  });

  table.appendChild(tbody);
  wrap.appendChild(table);
  section.appendChild(wrap);
  container.appendChild(section);
}

function formatCandidateButtonLabel(name, similarity) {
  return `${name} ${Math.round(similarity * 100)}%`;
}

function applyManualChoice(card, canonicalName) {
  setManualCorrection(card, canonicalName);
  renderOverallSkillSummary();
}

function renderLegacyReviewItems(container) {
  const items = getReviewItems();
  const unresolvedItems = items.filter(
    item => !item.card.manualCorrection
  );
  const section = document.createElement("section");
  section.className = "result-review-section";
  const heading = document.createElement("h3");
  heading.textContent = unresolvedItems.length > 0
    ? `要確認 ${unresolvedItems.length}件`
    : "要確認なし";
  section.appendChild(heading);

  if (items.length === 0) {
    const empty = document.createElement("p");
    empty.className = "result-review-empty";
    empty.textContent = "確認が必要なOCR結果はありません。";
    section.appendChild(empty);
    container.appendChild(section);
    return;
  }

  const candidates = getCanonicalSkillCandidates();
  items.forEach((item, itemIndex) => {
    const card = item.card;
    const article = document.createElement("article");
    article.className = "result-review-item";
    if (card.manualCorrection) {
      article.classList.add("is-resolved");
    }

    const location = document.createElement("h4");
    location.textContent =
      `${item.memberLabel} / 画像${item.imageIndex + 1} / ${card.column}${card.row}`;
    article.appendChild(location);

    const details = document.createElement("p");
    details.className = "result-review-details";
    details.textContent = item.original.ocrText
      ? `OCR: ${item.original.ocrText} / ${formatStars(card.stars)}`
      : `OCR: 取得できませんでした / ${formatStars(card.stars)}`;
    article.appendChild(details);

    if (card.manualCorrection) {
      const resolved = document.createElement("p");
      resolved.className = "result-review-resolution";
      resolved.textContent = card.manualCorrection.ignored
        ? "対応: 無視"
        : `手動確定: ${card.manualCorrection.canonicalName}`;
      article.appendChild(resolved);
      const clearButton = document.createElement("button");
      clearButton.type = "button";
      clearButton.className = "secondary-button compact-button";
      clearButton.textContent = "訂正を解除";
      clearButton.addEventListener("click", () => {
        clearManualCorrection(card);
        renderOverallSkillSummary();
      });
      article.appendChild(clearButton);
      section.appendChild(article);
      return;
    }

    if (item.type === "review") {
      const quickChoices = [
        [item.original.firstCandidate, item.original.firstSimilarity],
        [item.original.secondCandidate, item.original.secondSimilarity]
      ].filter(([name], index, all) =>
        name && all.findIndex(([otherName]) => otherName === name) === index
      );
      const quickArea = document.createElement("div");
      quickArea.className = "result-review-quick-choices";
      quickChoices.forEach(([name, similarity]) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "secondary-button compact-button";
        button.textContent = formatCandidateButtonLabel(name, similarity);
        button.addEventListener("click", () => applyManualChoice(card, name));
        quickArea.appendChild(button);
      });
      article.appendChild(quickArea);
    }

    const controls = document.createElement("div");
    controls.className = "result-review-controls";
    const select = document.createElement("select");
    select.setAttribute(
      "aria-label",
      `${item.memberLabel} 画像${item.imageIndex + 1} ${card.column}${card.row}の正式名称`
    );
    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = "その他から正式名称を選択";
    select.appendChild(placeholder);
    candidates.forEach(candidate => {
      const option = document.createElement("option");
      option.value = candidate;
      option.textContent = candidate;
      select.appendChild(option);
    });
    controls.appendChild(select);

    const confirmButton = document.createElement("button");
    confirmButton.type = "button";
    confirmButton.className = "primary-button compact-button";
    confirmButton.textContent = "この内容で確定";
    confirmButton.disabled = true;
    select.addEventListener("change", () => {
      confirmButton.disabled = !select.value;
    });
    confirmButton.addEventListener("click", () => {
      if (select.value) {
        applyManualChoice(card, select.value);
      }
    });
    controls.appendChild(confirmButton);

    const ignoreButton = document.createElement("button");
    ignoreButton.type = "button";
    ignoreButton.className = "secondary-button compact-button";
    ignoreButton.textContent = "無視";
    ignoreButton.addEventListener("click", () => {
      ignoreRecognition(card);
      renderOverallSkillSummary();
    });
    controls.appendChild(ignoreButton);
    article.appendChild(controls);
    article.dataset.reviewIndex = String(itemIndex);
    section.appendChild(article);
  });

  container.appendChild(section);
}

function formatReviewPosition(item) {
  const columnLabel = item.card.column === "left" ? "左列" : "右列";
  return `画像${item.imageIndex + 1}・${columnLabel}${item.card.row}行目`;
}

function createReviewArticle(item, candidates) {
  const card = item.card;
  const article = document.createElement("article");
  article.className = "result-review-item compact-review-item";
  if (card.manualCorrection) {
    article.classList.add("is-resolved");
  }

  const header = document.createElement("div");
  header.className = "result-review-item-header";
  const location = document.createElement("h4");
  location.textContent = formatReviewPosition(item);
  header.appendChild(location);
  const status = document.createElement("span");
  status.className = "result-review-status";
  status.textContent = item.type === "review" ? "要確認" : "未認識";
  header.appendChild(status);
  article.appendChild(header);

  if (card.reviewThumbnail) {
    const imageLink = document.createElement("a");
    imageLink.href = card.reviewThumbnail;
    imageLink.target = "_blank";
    imageLink.rel = "noopener";
    imageLink.title = "クリックしてカード画像を拡大";
    const image = document.createElement("img");
    image.className = "result-review-thumbnail";
    image.src = card.reviewThumbnail;
    image.alt = `${item.memberLabel} ${formatReviewPosition(item)}の因子カード`;
    imageLink.appendChild(image);
    article.appendChild(imageLink);
  } else {
    const unavailable = document.createElement("p");
    unavailable.className = "result-review-image-unavailable";
    unavailable.textContent = "カード画像を表示できません";
    article.appendChild(unavailable);
  }

  const recognition = document.createElement("div");
  recognition.className = "result-review-recognition";
  const ocr = document.createElement("p");
  ocr.innerHTML = `<strong>OCR:</strong> ${escapeHtml(
    item.original.ocrText || "認識できませんでした"
  )}`;
  const stars = document.createElement("p");
  stars.innerHTML = `<strong>星:</strong> ${formatStars(card.stars)}`;
  recognition.append(ocr, stars);
  article.appendChild(recognition);

  if (card.manualCorrection) {
    const resolved = document.createElement("p");
    resolved.className = "result-review-resolution";
    resolved.textContent = card.manualCorrection.ignored
      ? "対応: 無視"
      : `手動確定: ${card.manualCorrection.canonicalName}`;
    article.appendChild(resolved);
    const clearButton = document.createElement("button");
    clearButton.type = "button";
    clearButton.className = "secondary-button compact-button";
    clearButton.textContent = card.manualCorrection.ignored
      ? "無視を解除"
      : "訂正を解除";
    clearButton.addEventListener("click", () => {
      clearManualCorrection(card);
      renderOverallSkillSummary();
    });
    article.appendChild(clearButton);
    return article;
  }

  if (item.type === "review") {
    const candidateLabel = document.createElement("p");
    candidateLabel.className = "result-review-candidate-label";
    candidateLabel.textContent = "優先候補";
    article.appendChild(candidateLabel);
    const quickChoices = [
      [item.original.firstCandidate, item.original.firstSimilarity],
      [item.original.secondCandidate, item.original.secondSimilarity]
    ].filter(([name], index, all) =>
      name && all.findIndex(([otherName]) => otherName === name) === index
    );
    const quickArea = document.createElement("div");
    quickArea.className = "result-review-quick-choices";
    quickChoices.forEach(([name, similarity]) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "secondary-button compact-button";
      button.textContent = formatCandidateButtonLabel(name, similarity);
      button.addEventListener("click", () => applyManualChoice(card, name));
      quickArea.appendChild(button);
    });
    article.appendChild(quickArea);
  }

  const controls = document.createElement("div");
  controls.className = "result-review-controls";
  const select = document.createElement("select");
  select.setAttribute(
    "aria-label",
    `${item.memberLabel} ${formatReviewPosition(item)}の正式名称`
  );
  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = item.type === "review"
    ? "別のスキルを選択"
    : "正しいスキルを選択";
  select.appendChild(placeholder);
  candidates.forEach(candidate => {
    const option = document.createElement("option");
    option.value = candidate;
    option.textContent = candidate;
    select.appendChild(option);
  });
  controls.appendChild(select);

  const confirmButton = document.createElement("button");
  confirmButton.type = "button";
  confirmButton.className = "primary-button compact-button";
  confirmButton.textContent = "確定";
  confirmButton.disabled = true;
  select.addEventListener("change", () => {
    confirmButton.disabled = !select.value;
  });
  confirmButton.addEventListener("click", () => {
    if (select.value) {
      applyManualChoice(card, select.value);
    }
  });
  controls.appendChild(confirmButton);

  const ignoreWrap = document.createElement("span");
  ignoreWrap.className = "result-review-ignore-wrap";
  const ignoreButton = document.createElement("button");
  ignoreButton.type = "button";
  ignoreButton.className = "secondary-button compact-button";
  ignoreButton.textContent = "無視";
  ignoreButton.title = "該当するスキルがない場合や要件外因子はこちら";
  ignoreButton.addEventListener("click", () => {
    ignoreRecognition(card);
    renderOverallSkillSummary();
  });
  const ignoreHelp = document.createElement("small");
  ignoreHelp.textContent = "該当するスキルがない場合";
  ignoreWrap.append(ignoreButton, ignoreHelp);
  controls.appendChild(ignoreWrap);
  article.appendChild(controls);
  return article;
}

function createReviewMemberGroup(memberId, items, candidates) {
  const details = document.createElement("details");
  details.className = "review-member-group";
  applyReviewGroupOpenState(details, `member:${memberId}`);
  const summary = document.createElement("summary");
  const label = document.createElement("span");
  label.textContent = members[memberId].label;
  const count = document.createElement("span");
  count.className = "review-member-count";
  count.textContent = `${items.length}件`;
  summary.append(label, count);
  details.appendChild(summary);
  const content = document.createElement("div");
  content.className = "review-member-content";
  items.forEach(item => {
    content.appendChild(createReviewArticle(item, candidates));
  });
  details.appendChild(content);
  return details;
}

function renderReviewItems(container) {
  const items = getReviewItems();
  const unresolvedItems = items.filter(item => !item.card.manualCorrection);
  const resolvedItems = items.filter(item => item.card.manualCorrection);
  const section = document.createElement("section");
  section.className = "result-review-section";
  const heading = document.createElement("h3");
  heading.textContent = unresolvedItems.length > 0
    ? `要確認 ${unresolvedItems.length}件`
    : "✓ 要確認項目はありません";
  section.appendChild(heading);

  const guide = document.createElement("p");
  guide.className = "result-review-guide";
  guide.textContent =
    "OCR結果が不確かな項目です。カード画像を確認して正しいスキルを選択してください。候補に正解がない場合や、要件に関係のない因子・レース因子・シナリオ因子は「無視」を選択してください。";
  section.appendChild(guide);

  const candidates = getCanonicalSkillCandidates();
  MEMBER_ORDER.forEach(memberId => {
    const memberItems = unresolvedItems.filter(item => item.memberId === memberId);
    if (memberItems.length > 0) {
      section.appendChild(
        createReviewMemberGroup(memberId, memberItems, candidates)
      );
    }
  });

  if (resolvedItems.length > 0) {
    const resolvedGroup = document.createElement("details");
    resolvedGroup.className = "review-member-group review-resolved-group";
    applyReviewGroupOpenState(resolvedGroup, "resolved");
    const summary = document.createElement("summary");
    summary.textContent = `対応済み（${resolvedItems.length}件）`;
    resolvedGroup.appendChild(summary);
    const content = document.createElement("div");
    content.className = "review-member-content";
    resolvedItems.forEach(item => {
      content.appendChild(createReviewArticle(item, candidates));
    });
    resolvedGroup.appendChild(content);
    section.appendChild(resolvedGroup);
  }

  container.appendChild(section);
}

function renderManualResolutionDebug() {
  const debugContainer = document.getElementById("analysis-debug");
  if (!debugContainer) {
    return;
  }

  document.getElementById("manual-resolution-debug")?.remove();
  const items = getReviewItems();
  if (items.length === 0) {
    return;
  }

  const section = document.createElement("section");
  section.id = "manual-resolution-debug";
  section.className = "analysis-debug-section";
  const title = document.createElement("h3");
  title.textContent = "要確認・手動訂正状態";
  section.appendChild(title);
  const table = document.createElement("table");
  table.className = "debug-table";
  table.innerHTML = `
    <thead>
      <tr>
        <th>対象</th>
        <th>元OCR</th>
        <th>元status</th>
        <th>effective正式名称</th>
        <th>effective status</th>
        <th>resolutionSource</th>
        <th>要件</th>
      </tr>
    </thead>
  `;
  const tbody = document.createElement("tbody");
  items.forEach(item => {
    const row = document.createElement("tr");
    const values = [
      `${item.memberLabel} / 画像${item.imageIndex + 1} / ${item.card.column}${item.card.row}`,
      item.original.ocrText || "-",
      item.original.status,
      item.effective.canonicalName || "-",
      item.effective.status,
      item.effective.resolutionSource,
      item.effective.requirementRank || "-"
    ];
    values.forEach(value => {
      const cell = document.createElement("td");
      cell.textContent = value;
      row.appendChild(cell);
    });
    tbody.appendChild(row);
  });
  table.appendChild(tbody);
  section.appendChild(table);
  debugContainer.appendChild(section);
}

/* =========================================================
  S/A/B/C別集計結果表示処理
  ========================================================= */

function renderOverallSkillSummary() {
  const container =
    ensureResultSummaryContainer();

  const model = buildResultModel();
  const summary = model.ranks;

  container.innerHTML = "";

  const heading =
    document.createElement(
      "h2"
    );

  heading.textContent =
    "スキル要件 判定結果";

  container.appendChild(
    heading
  );

  const note =
    document.createElement(
      "p"
    );

  note.className =
    "factor-result-note";

  note.textContent =
    "OCR・fallback・手動訂正で確定した要件スキルを集計しています。同じ人物の複数画像に同じスキルが写っている場合は1件として扱い、最も高い★数を採用します。";

  container.appendChild(
    note
  );

  renderMemberSummary(container, model);
  renderReviewItems(container);
  renderManualResolutionDebug();

  const totalRequirements =
    Object.values(
      requirements
    ).reduce(
      (
        sum,
        skills
      ) =>
        sum + skills.length,
      0
    );

  if (
    totalRequirements === 0
  ) {
    const empty =
      document.createElement(
        "div"
      );

    empty.className =
      "factor-result-empty";

    empty.textContent =
      "スキル要件が登録されていません。スキル要件を設定してから再度解析してください。";

    container.appendChild(
      empty
    );

    return;
  }

  for (
    const rank
    of ["S", "A", "B", "C"]
  ) {
    if (
      summary[
        rank
      ].length === 0
    ) {
      continue;
    }

    const section =
      document.createElement(
        "section"
      );

    section.className =
      `factor-result-rank factor-result-rank-${rank.toLowerCase()}`;

    const rankTitle =
      document.createElement(
        "h3"
      );

    rankTitle.className =
      "factor-result-rank-title";

    rankTitle.textContent =
      getRequirementRankLabel(rank);

    section.appendChild(
      rankTitle
    );

    const tableWrap =
      document.createElement(
        "div"
      );

    tableWrap.className =
      "factor-result-table-wrap";

    const table =
      document.createElement(
        "table"
      );

    table.className =
      "factor-result-table";

    appendResultTableColumns(table);

    const thead =
      document.createElement(
        "thead"
      );

    const headerRow =
      document.createElement(
        "tr"
      );

    const headers = [
      "スキル",
      ...MEMBER_ORDER.map(
        memberId =>
          members[
            memberId
          ].label
      ),
      "面数",
      "★合計"
    ];

    headers.forEach(
      headerText => {
        const th =
          document.createElement(
            "th"
          );

        th.textContent =
          headerText;

        headerRow.appendChild(
          th
        );
      }
    );

    thead.appendChild(
      headerRow
    );

    table.appendChild(
      thead
    );

    const tbody =
      document.createElement(
        "tbody"
      );

    summary[
      rank
    ].forEach(
      skillResult => {
        const tr =
          document.createElement(
            "tr"
          );

        const skillCell =
          document.createElement(
            "td"
          );

        skillCell.className =
          "skill-name-cell";

        skillCell.textContent =
          skillResult.skillName;

        tr.appendChild(
          skillCell
        );

        MEMBER_ORDER.forEach(
          memberId => {
            const td =
              document.createElement(
                "td"
              );

            const found =
              skillResult
                .memberValues[
                  memberId
                ];

            if (found) {
              td.className =
                "factor-result-hit";

              td.textContent =
                formatStars(
                  found.stars
                );

              td.title =
                `${
                  found.resolutionSource === "manual"
                    ? "手動確定"
                    : found.matchStatus === "exact"
                      ? "完全一致"
                      : "類似一致"
                } / OCR: ${found.ocrText || "未認識"}`;
            } else {
              td.className =
                "factor-result-missing";

              td.textContent =
                "-";
            }

            tr.appendChild(
              td
            );
          }
        );

        const ownedCountCell =
          document.createElement(
            "td"
          );

        ownedCountCell.className =
          "factor-result-count";

        ownedCountCell.textContent =
          `${skillResult.ownedCount}/${model.registeredMemberCount}`;

        const countBadge = document.createElement("span");
        countBadge.className = "factor-result-count-badge";
        if (model.registeredMemberCount <= 2) {
          countBadge.classList.add("is-insufficient");
          countBadge.textContent = "判定対象不足";
        } else if (skillResult.ownedCount < 3) {
          countBadge.classList.add("is-warning");
          countBadge.textContent = "3面未満";
        }
        if (countBadge.textContent) {
          ownedCountCell.appendChild(countBadge);
        }

        tr.appendChild(
          ownedCountCell
        );

        const totalStarsCell =
          document.createElement(
            "td"
          );

        totalStarsCell.textContent =
          String(
            skillResult.totalStars
          );

        tr.appendChild(
          totalStarsCell
        );

        tbody.appendChild(
          tr
        );
      }
    );

    table.appendChild(
      tbody
    );

    tableWrap.appendChild(
      table
    );

    section.appendChild(
      tableWrap
    );

    container.appendChild(
      section
    );
  }
}

/* =========================================================
  集計結果をデバッグログへ追加する処理
  ========================================================= */

function appendSummaryToDebugLog() {
  const model = buildResultModel();
  const summary = model.ranks;

  debugLogLines.push(
    "===== 集計結果 ====="
  );

  debugLogLines.push(
    `BUILD：${APP_BUILD}`
  );

  debugLogLines.push("");

  for (
    const rank
    of ["S", "A", "B", "C"]
  ) {
    if (
      summary[
        rank
      ].length === 0
    ) {
      continue;
    }

    debugLogLines.push(
      `[${rank}]`
    );

    debugLogLines.push(
      [
        "スキル",
        ...MEMBER_ORDER.map(
          memberId =>
            members[
              memberId
            ].label
        ),
        "面数",
        "★合計"
      ].join("\t")
    );

    summary[
      rank
    ].forEach(
      result => {
        debugLogLines.push(
          [
            result.skillName,
            ...MEMBER_ORDER.map(
              memberId => {
                const found =
                  result
                    .memberValues[
                      memberId
                    ];

                return found
                  ? formatStars(
                      found.stars
                    )
                  : "";
              }
            ),
            `${result.ownedCount}/${model.registeredMemberCount}`,
            result.totalStars
          ].join("\t")
        );
      }
    );

    debugLogLines.push("");
  }
}

/* =========================================================
  デバッグログコピー処理
  ========================================================= */

async function copyDebugLog() {
  const status =
    document.getElementById(
      "copy-debug-status"
    );

  if (
    debugLogLines.length === 0
  ) {
    return;
  }

  const text =
    debugLogLines.join(
      "\n"
    );

  try {
    await navigator
      .clipboard
      .writeText(
        text
      );

    if (status) {
      status.textContent =
        "コピーしました";

      setTimeout(
        () => {
          status.textContent =
            "";
        },
        2000
      );
    }
  } catch (error) {
    console.error(
      "デバッグログのコピーに失敗しました",
      error
    );

    if (status) {
      status.textContent =
        "コピーに失敗しました";
    }
  }
}

const copyDebugButton =
  document.getElementById(
    "copy-debug-log"
  );

if (copyDebugButton) {
  copyDebugButton.addEventListener(
    "click",
    copyDebugLog
  );
}

const debugModeToggle =
  document.getElementById(
    "debug-mode-toggle"
  );

function updateDebugModeDisplay() {
  const enabled = Boolean(debugModeToggle?.checked);
  const debugActions = document.getElementById("debug-actions");
  const debugContainer = document.getElementById("analysis-debug");

  if (debugActions) {
    debugActions.hidden = !enabled;
  }
  if (debugContainer) {
    debugContainer.hidden = !enabled;
  }
}

if (debugModeToggle) {
  debugModeToggle.addEventListener(
    "change",
    updateDebugModeDisplay
  );
  updateDebugModeDisplay();
}

document.addEventListener(
  "requirements-applied",
  () => {
    const hasAnalysisResults = MEMBER_ORDER.some(
      memberId => members[memberId].analysisResults.length > 0
    );
    if (hasAnalysisResults) {
      renderOverallSkillSummary();
    }
  }
);

export {
  renderAnalysisDebug,
  renderAnalysisError,
  renderOverallSkillSummary,
  appendSummaryToDebugLog,
  resetReviewAccordionState
};
