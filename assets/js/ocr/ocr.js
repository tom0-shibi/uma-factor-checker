import { OCR_CONFIG, analysisProgress } from "../config.js";
import { getLuminance } from "../analysis/image-analysis.js";
import { updateAnalysisProgressDisplay } from "../ui/ui.js";
import {
  getRequirementSkillDictionary,
  getRequirementRank,
  normalizeOcrText,
  normalizeSkillText,
  findBestSkillMatch,
  getSkillMatchThreshold,
  determineMatchStatus
} from "../matching/matching.js";

const SHORT_SKILL_FALLBACK_CONFIG = {
  maximumLength: 3,
  minimumLength: 2,
  maximumInitialConfidence: 40,
  thresholds: [165, 195, 220],
  scale: 1.5
};

/* =========================================================
  OCR対象となるスキル文字色判定処理
  ========================================================= */

function isSkillTextPixel(
  r,
  g,
  b
) {
  const luminance =
    getLuminance(
      r,
      g,
      b
    );

  const isDark =
    luminance < 175;

  const isBrownish =
    r >= g &&
    g >= b &&
    r - b > 15;

  return (
    isDark &&
    isBrownish
  );
}

/* =========================================================
  カード内の実際の文字領域を自動検出する処理
  ========================================================= */

function detectSkillTextBounds(
  sourceCanvas,
  card
) {
  const searchX =
    Math.round(
      card.x +
      card.width *
      OCR_CONFIG
        .searchArea.xRatio
    );

  const searchY =
    Math.round(
      card.y +
      card.height *
      OCR_CONFIG
        .searchArea.yRatio
    );

  const searchWidth =
    Math.round(
      card.width *
      OCR_CONFIG
        .searchArea.widthRatio
    );

  const searchHeight =
    Math.round(
      card.height *
      OCR_CONFIG
        .searchArea.heightRatio
    );

  const ctx =
    sourceCanvas.getContext(
      "2d",
      {
        willReadFrequently: true
      }
    );

  const imageData =
    ctx.getImageData(
      searchX,
      searchY,
      searchWidth,
      searchHeight
    );

  const data =
    imageData.data;

  let minX =
    searchWidth;

  let minY =
    searchHeight;

  let maxX = -1;
  let maxY = -1;

  for (
    let y = 0;
    y < searchHeight;
    y++
  ) {
    for (
      let x = 0;
      x < searchWidth;
      x++
    ) {
      const index =
        (
          y *
          searchWidth +
          x
        ) * 4;

      const r =
        data[index];

      const g =
        data[
          index + 1
        ];

      const b =
        data[
          index + 2
        ];

      if (
        !isSkillTextPixel(
          r,
          g,
          b
        )
      ) {
        continue;
      }

      minX =
        Math.min(
          minX,
          x
        );

      minY =
        Math.min(
          minY,
          y
        );

      maxX =
        Math.max(
          maxX,
          x
        );

      maxY =
        Math.max(
          maxY,
          y
        );
    }
  }

  if (
    maxX < 0 ||
    maxY < 0
  ) {
    return null;
  }

  const detectedHeight =
    maxY -
    minY +
    1;

  const paddingX =
    Math.max(
      3,
      Math.round(
        detectedHeight *
        OCR_CONFIG
          .paddingRatio
      )
    );

  const paddingY =
    Math.max(
      3,
      Math.round(
        detectedHeight *
        OCR_CONFIG
          .paddingRatio
      )
    );

  const resultX =
    Math.max(
      card.x,
      searchX +
      minX -
      paddingX
    );

  const resultY =
    Math.max(
      card.y,
      searchY +
      minY -
      paddingY
    );

  const resultRight =
    Math.min(
      card.x +
      card.width,
      searchX +
      maxX +
      paddingX +
      1
    );

  const resultBottom =
    Math.min(
      card.y +
      card.height,
      searchY +
      maxY +
      paddingY +
      1
    );

  return {
    x:
      Math.round(
        resultX
      ),
    y:
      Math.round(
        resultY
      ),
    width:
      Math.max(
        1,
        Math.round(
          resultRight -
          resultX
        )
      ),
    height:
      Math.max(
        1,
        Math.round(
          resultBottom -
          resultY
        )
      )
  };
}

/* =========================================================
  OCR用画像生成処理
  ========================================================= */

function createOcrCanvas(
  sourceCanvas,
  card
) {
  const textBounds =
    detectSkillTextBounds(
      sourceCanvas,
      card
    );

  if (
    !textBounds
  ) {
    return null;
  }

  const canvas =
    document.createElement(
      "canvas"
    );

  canvas.width =
    Math.round(
      textBounds.width *
      OCR_CONFIG.scale
    );

  canvas.height =
    Math.round(
      textBounds.height *
      OCR_CONFIG.scale
    );

  const ctx =
    canvas.getContext(
      "2d"
    );

  ctx.fillStyle =
    "#ffffff";

  ctx.fillRect(
    0,
    0,
    canvas.width,
    canvas.height
  );

  ctx.imageSmoothingEnabled =
    true;

  ctx.imageSmoothingQuality =
    "high";

  ctx.drawImage(
    sourceCanvas,
    textBounds.x,
    textBounds.y,
    textBounds.width,
    textBounds.height,
    0,
    0,
    canvas.width,
    canvas.height
  );

  return canvas;
}

/* =========================================================
  短いスキル名専用の限定OCR画像生成処理
  通常OCRが低信頼かつ未確定の場合にだけ使用する。
  ========================================================= */

function createShortSkillFallbackCanvas(
  sourceCanvas,
  threshold
) {
  const canvas =
    document.createElement("canvas");

  canvas.width =
    Math.round(
      sourceCanvas.width *
      SHORT_SKILL_FALLBACK_CONFIG.scale
    );

  canvas.height =
    Math.round(
      sourceCanvas.height *
      SHORT_SKILL_FALLBACK_CONFIG.scale
    );

  const ctx =
    canvas.getContext(
      "2d",
      {
        willReadFrequently: true
      }
    );

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(
    0,
    0,
    canvas.width,
    canvas.height
  );
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(
    sourceCanvas,
    0,
    0,
    canvas.width,
    canvas.height
  );

  const imageData =
    ctx.getImageData(
      0,
      0,
      canvas.width,
      canvas.height
    );

  for (
    let index = 0;
    index < imageData.data.length;
    index += 4
  ) {
    const luminance =
      getLuminance(
        imageData.data[index],
        imageData.data[index + 1],
        imageData.data[index + 2]
      );

    const value =
      luminance < threshold
        ? 0
        : 255;

    imageData.data[index] = value;
    imageData.data[index + 1] = value;
    imageData.data[index + 2] = value;
  }

  ctx.putImageData(
    imageData,
    0,
    0
  );

  return canvas;
}

async function recognizeShortSkillFallback(
  worker,
  ocrCanvas,
  dictionary
) {
  let bestResult = null;

  for (
    const threshold
    of SHORT_SKILL_FALLBACK_CONFIG.thresholds
  ) {
    const fallbackCanvas =
      createShortSkillFallbackCanvas(
        ocrCanvas,
        threshold
      );

    const result =
      await worker.recognize(
        fallbackCanvas
      );

    const rawText =
      result.data.text || "";

    const ocrText =
      normalizeOcrText(
        rawText
      );

    const matchResult =
      findBestSkillMatch(
        ocrText,
        dictionary
      );

    const matchStatus =
      determineMatchStatus(
        matchResult.normalizedOcr,
        matchResult.candidate,
        matchResult.similarity,
        matchResult.secondSimilarity,
        matchResult.similarityMargin
      );

    if (
      matchStatus === "exact" ||
      matchStatus === "similar"
    ) {
      if (
        !bestResult ||
        matchResult.similarity >
          bestResult.matchResult.similarity
      ) {
        bestResult = {
          ocrText,
          ocrRawText: rawText,
          ocrConfidence:
            result.data.confidence ?? 0,
          ocrCanvas: fallbackCanvas,
          matchResult,
          matchStatus
        };
      }
    }
  }

  return bestResult;
}

/* =========================================================
  Tesseract.js OCR worker生成処理
  ========================================================= */

async function createOcrWorker() {
  const status =
    document.getElementById(
      "ocr-status"
    );

  if (status) {
    status.textContent =
      "OCRを準備しています...";
  }

  updateAnalysisProgressDisplay(
    "OCRを準備しています...",
    `全体 0 / ${analysisProgress.totalImages}画像`
  );

  const worker =
    await Tesseract.createWorker(
      "jpn",
      1,
      {
        logger:
          message => {
            if (
              message.status ===
              "recognizing text"
            ) {
              analysisProgress
                .tesseractProgress =
                  message.progress;

              const percent =
                Math.round(
                  message.progress *
                  100
                );

              if (status) {
                status.textContent =
                  `OCR実行中... ${percent}%`;
              }

              if (
                analysisProgress.active
              ) {
                updateAnalysisProgressDisplay(
                  `${analysisProgress.currentMemberLabel} / 画像${analysisProgress.currentImageIndex + 1}`,
                  `白因子OCR ${analysisProgress.currentWhiteCard} / ${analysisProgress.totalWhiteCards} ・ OCR処理 ${percent}%`
                );
              }
            }
          }
      }
    );

  await worker.setParameters({
    tessedit_pageseg_mode:
      "7",
    preserve_interword_spaces:
      "1",
    user_defined_dpi:
      "300"
  });

  return worker;
}

/* =========================================================
  白因子カード1件OCR処理
  ========================================================= */

async function recognizeSkillName(
  worker,
  sourceCanvas,
  card
) {
  const ocrCanvas =
    createOcrCanvas(
      sourceCanvas,
      card
    );

  if (
    !ocrCanvas
  ) {
    return {
      ocrText: "",
      ocrRawText: "",
      ocrConfidence: 0,
      ocrCanvas: null
    };
  }

  const result =
    await worker.recognize(
      ocrCanvas
    );

  const rawText =
    result.data.text ||
    "";

  return {
    ocrText:
      normalizeOcrText(
        rawText
      ),
    ocrRawText:
      rawText,
    ocrConfidence:
      result.data
        .confidence ?? 0,
    ocrCanvas
  };
}

/* =========================================================
  白因子OCR＋スキル要件照合処理
  ========================================================= */

async function runOcrForWhiteCards(
  worker,
  sourceCanvas,
  analysis,
  memberLabel,
  imageIndex
) {
  const status =
    document.getElementById(
      "ocr-status"
    );

  const dictionary =
    getRequirementSkillDictionary();

  const shortSkillDictionary =
    dictionary.filter(skill => {
      const length =
        normalizeSkillText(
          skill
        ).length;

      return (
        length >=
          SHORT_SKILL_FALLBACK_CONFIG
            .minimumLength &&
        length <=
          SHORT_SKILL_FALLBACK_CONFIG
            .maximumLength
      );
    });

  const whiteCards = [
    ...analysis.leftCards,
    ...analysis.rightCards
  ].filter(
    card =>
      card.factorType ===
      "white"
  );

  analysisProgress
    .currentMemberLabel =
      memberLabel;

  analysisProgress
    .currentImageIndex =
      imageIndex;

  analysisProgress
    .totalWhiteCards =
      whiteCards.length;

  analysisProgress
    .currentWhiteCard = 0;

  analysisProgress
    .tesseractProgress = 0;

  if (
    whiteCards.length === 0
  ) {
    updateAnalysisProgressDisplay(
      `${memberLabel} / 画像${imageIndex + 1}`,
      "白因子は検出されませんでした"
    );

    return;
  }

  for (
    let i = 0;
    i < whiteCards.length;
    i++
  ) {
    const card =
      whiteCards[i];

    analysisProgress
      .currentWhiteCard =
        i + 1;

    analysisProgress
      .tesseractProgress = 0;

    const message =
      `${memberLabel} / 画像${imageIndex + 1}：白因子OCR ${i + 1}/${whiteCards.length}`;

    if (status) {
      status.textContent =
        message;
    }

    updateAnalysisProgressDisplay(
      `${memberLabel} / 画像${imageIndex + 1}`,
      `白因子OCR ${i + 1} / ${whiteCards.length}`
    );

    const result =
      await recognizeSkillName(
        worker,
        sourceCanvas,
        card
      );

    card.ocrText =
      result.ocrText;

    card.ocrRawText =
      result.ocrRawText;

    card.ocrConfidence =
      result.ocrConfidence;

    card.ocrPreview =
      result.ocrCanvas
        ? result.ocrCanvas
            .toDataURL(
              "image/png"
            )
        : null;

    const matchResult =
      findBestSkillMatch(
        card.ocrText,
        dictionary
      );

    card.normalizedOcr =
      matchResult
        .normalizedOcr;

    card.matchCandidate =
      matchResult
        .candidate;

    card.matchSimilarity =
      matchResult
        .similarity;

    card.secondMatchCandidate =
      matchResult
        .secondCandidate;

    card.secondMatchSimilarity =
      matchResult
        .secondSimilarity;

    card.matchSimilarityMargin =
      matchResult
        .similarityMargin;

    card.matchThreshold =
      getSkillMatchThreshold(
        matchResult
          .normalizedOcr
      );

    card.matchStatus =
      determineMatchStatus(
        matchResult
          .normalizedOcr,
        matchResult
          .candidate,
        matchResult
          .similarity,
        matchResult
          .secondSimilarity,
        matchResult
          .similarityMargin
      );

    if (
      card.matchStatus ===
        "unmatched" &&
      card.ocrConfidence <
        SHORT_SKILL_FALLBACK_CONFIG
          .maximumInitialConfidence &&
      shortSkillDictionary.length > 0 &&
      result.ocrCanvas
    ) {
      const fallback =
        await recognizeShortSkillFallback(
          worker,
          result.ocrCanvas,
          shortSkillDictionary
        );

      if (fallback) {
        card.ocrText =
          fallback.ocrText;

        card.ocrRawText =
          fallback.ocrRawText;

        card.ocrConfidence =
          fallback.ocrConfidence;

        card.ocrPreview =
          fallback.ocrCanvas
            .toDataURL(
              "image/png"
            );

        card.normalizedOcr =
          fallback.matchResult
            .normalizedOcr;

        card.matchCandidate =
          fallback.matchResult
            .candidate;

        card.matchSimilarity =
          fallback.matchResult
            .similarity;

        card.secondMatchCandidate =
          fallback.matchResult
            .secondCandidate;

        card.secondMatchSimilarity =
          fallback.matchResult
            .secondSimilarity;

        card.matchSimilarityMargin =
          fallback.matchResult
            .similarityMargin;

        card.matchThreshold =
          getSkillMatchThreshold(
            fallback.matchResult
              .normalizedOcr
          );

        card.matchStatus =
          fallback.matchStatus;

        card.ocrFallbackUsed =
          true;
      }
    }

    card.requirementRank =
      (
        card.matchStatus ===
          "exact" ||
        card.matchStatus ===
          "similar"
      )
        ? getRequirementRank(
            card.matchCandidate
          )
        : null;

    analysisProgress
      .tesseractProgress = 1;

    updateAnalysisProgressDisplay(
      `${memberLabel} / 画像${imageIndex + 1}`,
      `白因子OCR ${i + 1} / ${whiteCards.length}`
    );
  }
}


export { createOcrWorker, runOcrForWhiteCards };
