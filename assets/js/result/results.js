import { APP_BUILD, requirements, members, MEMBER_ORDER, debugLogLines } from "../config.js";
import { ensureResultSummaryContainer } from "../ui/ui.js";
import { getRequirementRankLabel } from "../preset/preset-manager.js";

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
  人物単位の解析結果集約処理
  同一人物・同一スキルが複数画像に存在した場合は最大★を採用する。
  ========================================================= */

function aggregateMemberSkills(
  memberId
) {
  const member =
    members[memberId];

  const skillMap =
    new Map();

  member.analysisResults.forEach(
    imageResult => {
      const cards = [
        ...imageResult.analysis
          .leftCards,
        ...imageResult.analysis
          .rightCards
      ];

      cards.forEach(
        card => {
          if (
            card.factorType !==
            "white"
          ) {
            return;
          }

          if (card.finalStatus !== "confirmed") {
            return;
          }

          if (
            !card.canonicalName ||
            !card.requirementRank
          ) {
            return;
          }

          const skillName =
            card.canonicalName;

          const existing =
            skillMap.get(
              skillName
            );

          if (
            !existing ||
            card.stars >
            existing.stars
          ) {
            skillMap.set(
              skillName,
              {
                skillName,
                stars:
                  card.stars,
                rank:
                  card.requirementRank,
                matchStatus:
                  card.matchStatus,
                ocrText:
                  card.ocrText,
                similarity:
                  card.matchSimilarity,
                imageIndex:
                  imageResult.imageIndex,
                column:
                  card.column,
                row:
                  card.row
              }
            );
          }
        }
      );
    }
  );

  return skillMap;
}

/* =========================================================
  6人分のスキル集計処理
  ========================================================= */

function buildOverallSkillSummary() {
  const memberSkillMaps = {};

  MEMBER_ORDER.forEach(
    memberId => {
      memberSkillMaps[
        memberId
      ] =
        aggregateMemberSkills(
          memberId
        );
    }
  );

  const result = {
    S: [],
    A: [],
    B: [],
    C: []
  };

  for (
    const rank
    of ["S", "A", "B", "C"]
  ) {
    requirements[
      rank
    ].forEach(
      skillName => {
        const memberValues = {};
        let ownedCount = 0;
        let totalStars = 0;

        MEMBER_ORDER.forEach(
          memberId => {
            const found =
              memberSkillMaps[
                memberId
              ].get(
                skillName
              ) ||
              null;

            memberValues[
              memberId
            ] =
              found;

            if (found) {
              ownedCount++;
              totalStars +=
                found.stars;
            }
          }
        );

        result[
          rank
        ].push({
          skillName,
          rank,
          memberValues,
          ownedCount,
          totalStars
        });
      }
    );
  }

  return result;
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

/* =========================================================
  S/A/B/C別集計結果表示処理
  ========================================================= */

function renderOverallSkillSummary() {
  const container =
    ensureResultSummaryContainer();

  const summary =
    buildOverallSkillSummary();

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
    "完全一致・類似一致した要件スキルを集計しています。同じ人物の複数画像に同じスキルが写っている場合は1件として扱い、最も高い★数を採用します。";

  container.appendChild(
    note
  );

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
      "所持数",
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
                `${found.matchStatus === "exact" ? "完全一致" : "類似一致"} / OCR: ${found.ocrText}`;
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
          `${skillResult.ownedCount}/6`;

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
  const summary =
    buildOverallSkillSummary();

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
        "所持数",
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
            `${result.ownedCount}/6`,
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

export { renderAnalysisDebug, renderAnalysisError, renderOverallSkillSummary, appendSummaryToDebugLog };
