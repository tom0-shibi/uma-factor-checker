import {
  OCR_CONFIG,
  analysisProgress
} from "../config.js";
import { getLuminance } from "../analysis/image-analysis.js";
import { updateAnalysisProgressDisplay } from "../ui/ui.js?v=20260919-dev-pro-01";
import {
  getRequirementRank,
  normalizeOcrText,
  normalizeSkillText,
  findBestSkillMatch,
  getSkillMatchThreshold,
  createSkillMatchContext,
  assessSkillMatch
} from "../matching/matching.js?v=20260917-factor-master-01";
import {
  getCanonicalSkillCandidates,
  getFactorMasterEntry
} from "../matching/candidate-provider.js?v=20260918-factor-master-data-01";
import {
  getShortSkillFallbackDecision,
  evaluateStrongShortSkillFallbackResult
} from "../matching/fallback-policy.js";
import {
  BLUE_FACTOR_NAMES,
  RED_FACTOR_NAMES,
  createFactorMetadata
} from "../analysis/factor-metadata.js";
import {
  getSourceCardThumbnailCrop
} from "./review-preview-geometry.js?v=20260918-factor-master-data-02";

const SHORT_SKILL_FALLBACK_CONFIG = {
  maximumLength: 4,
  minimumLength: 2,
  binaryThresholds: [165, 195, 220]
};

const OCR_INPUT_NORMALIZATION = {
  whiteTextHeight: 64,
  coloredFactorHeight: 180
};

const ocrPerformanceMetrics = {
  normalOcrCalls: 0,
  normalOcrMs: 0,
  fallbackTargetCards: 0,
  fallbackOcrCalls: 0,
  fallbackOcrMs: 0,
  fallbackAdoptions: 0,
  fallbackAdoptionFailures: 0,
  fallbackCallsByCard: [],
  fallbackVariants: {}
};

function resetOcrPerformanceMetrics() {
  ocrPerformanceMetrics.normalOcrCalls = 0;
  ocrPerformanceMetrics.normalOcrMs = 0;
  ocrPerformanceMetrics.fallbackTargetCards = 0;
  ocrPerformanceMetrics.fallbackOcrCalls = 0;
  ocrPerformanceMetrics.fallbackOcrMs = 0;
  ocrPerformanceMetrics.fallbackAdoptions = 0;
  ocrPerformanceMetrics.fallbackAdoptionFailures = 0;
  ocrPerformanceMetrics.fallbackCallsByCard = [];
  ocrPerformanceMetrics.fallbackVariants = {};
}

function getOcrPerformanceMetrics() {
  const calls = ocrPerformanceMetrics.fallbackCallsByCard;
  return {
    ...ocrPerformanceMetrics,
    fallbackCallsByCard: [...calls],
    averageFallbackCallsPerCard: calls.length
      ? calls.reduce((total, count) => total + count, 0) / calls.length
      : 0,
    maximumFallbackCallsPerCard: calls.length ? Math.max(...calls) : 0,
    totalOcrCalls:
      ocrPerformanceMetrics.normalOcrCalls +
      ocrPerformanceMetrics.fallbackOcrCalls
  };
}

async function recognizeWithMetrics(worker, canvas, kind) {
  const startedAt = performance.now();
  const result = await worker.recognize(canvas);
  const elapsed = performance.now() - startedAt;
  if (kind === "fallback") {
    ocrPerformanceMetrics.fallbackOcrCalls++;
    ocrPerformanceMetrics.fallbackOcrMs += elapsed;
  } else {
    ocrPerformanceMetrics.normalOcrCalls++;
    ocrPerformanceMetrics.normalOcrMs += elapsed;
  }
  result.ocrElapsedMs = elapsed;
  return result;
}

function recordFallbackVariant(
  variant,
  elapsedMs,
  assessment
) {
  const stats = ocrPerformanceMetrics.fallbackVariants[variant] ?? {
    runs: 0,
    confirmed: 0,
    adopted: 0,
    totalMs: 0
  };
  stats.runs++;
  stats.totalMs += elapsedMs;
  stats.confirmed += Number(
    assessment.finalStatus === "confirmed"
  );
  ocrPerformanceMetrics.fallbackVariants[variant] = stats;
}

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

  const normalizedScale =
    OCR_INPUT_NORMALIZATION.whiteTextHeight /
    textBounds.height;

  canvas.width = Math.max(
    1,
    Math.round(textBounds.width * normalizedScale)
  );

  canvas.height = OCR_INPUT_NORMALIZATION.whiteTextHeight;

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

  canvas.ocrCrop = { ...textBounds };
  canvas.ocrNormalizedSize = {
    width: canvas.width,
    height: canvas.height
  };

  return canvas;
}

function createSourceCardThumbnail(
  sourceCanvas,
  card
) {
  const crop = getSourceCardThumbnailCrop(
    sourceCanvas.width,
    sourceCanvas.height,
    card
  );
  const canvas = document.createElement("canvas");
  canvas.width = crop.width;
  canvas.height = crop.height;
  canvas.getContext("2d").drawImage(
    sourceCanvas,
    crop.x,
    crop.y,
    crop.width,
    crop.height,
    0,
    0,
    crop.width,
    crop.height
  );
  return {
    dataUrl: canvas.toDataURL("image/jpeg", 0.88),
    crop
  };
}

/* =========================================================
  短いスキル名専用の限定OCR画像生成処理
  通常OCRが低信頼かつ未確定の場合にだけ使用する。
  ========================================================= */

function copyCanvasWithPixelTransform(
  sourceCanvas,
  transform
) {
  const canvas =
    document.createElement("canvas");

  canvas.width = sourceCanvas.width;
  canvas.height = sourceCanvas.height;

  const ctx =
    canvas.getContext(
      "2d",
      {
        willReadFrequently: true
      }
    );

  ctx.drawImage(
    sourceCanvas,
    0,
    0
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
    const transformed = transform(
      imageData.data[index],
      imageData.data[index + 1],
      imageData.data[index + 2]
    );

    imageData.data[index] = transformed;
    imageData.data[index + 1] = transformed;
    imageData.data[index + 2] = transformed;
  }

  ctx.putImageData(
    imageData,
    0,
    0
  );

  return canvas;
}

function createScaledFallbackCanvas(
  sourceCanvas,
  {
    scale,
    paddingRatio,
    smoothing
  }
) {
  const paddingX = Math.round(
    sourceCanvas.width * paddingRatio
  );
  const paddingY = Math.round(
    sourceCanvas.height * paddingRatio
  );
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(
    (sourceCanvas.width + paddingX * 2) * scale
  );
  canvas.height = Math.round(
    (sourceCanvas.height + paddingY * 2) * scale
  );

  const ctx = canvas.getContext(
    "2d",
    { willReadFrequently: true }
  );
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.imageSmoothingEnabled = smoothing;
  if (smoothing) {
    ctx.imageSmoothingQuality = "high";
  }
  ctx.drawImage(
    sourceCanvas,
    Math.round(paddingX * scale),
    Math.round(paddingY * scale),
    Math.round(sourceCanvas.width * scale),
    Math.round(sourceCanvas.height * scale)
  );

  return canvas;
}

function applyBinaryThreshold(canvas, threshold) {
  return copyCanvasWithPixelTransform(
    canvas,
    (r, g, b) =>
      getLuminance(r, g, b) < threshold ? 0 : 255
  );
}

function applyLocalThreshold(
  sourceCanvas,
  {
    radius = 5,
    offset = 10
  } = {}
) {
  const canvas = document.createElement("canvas");
  canvas.width = sourceCanvas.width;
  canvas.height = sourceCanvas.height;
  const ctx = canvas.getContext(
    "2d",
    { willReadFrequently: true }
  );
  const sourceCtx = sourceCanvas.getContext(
    "2d",
    { willReadFrequently: true }
  );
  const sourceImageData = sourceCtx.getImageData(
    0,
    0,
    sourceCanvas.width,
    sourceCanvas.height
  );
  const resultImageData = ctx.createImageData(
    canvas.width,
    canvas.height
  );
  const width = canvas.width;
  const height = canvas.height;
  const integral = new Float64Array((width + 1) * (height + 1));

  for (let y = 0; y < height; y++) {
    let rowTotal = 0;
    for (let x = 0; x < width; x++) {
      const index = (y * width + x) * 4;
      rowTotal += getLuminance(
        sourceImageData.data[index],
        sourceImageData.data[index + 1],
        sourceImageData.data[index + 2]
      );
      integral[(y + 1) * (width + 1) + x + 1] =
        integral[y * (width + 1) + x + 1] + rowTotal;
    }
  }

  for (let y = 0; y < height; y++) {
    const top = Math.max(0, y - radius);
    const bottom = Math.min(height - 1, y + radius);
    for (let x = 0; x < width; x++) {
      const left = Math.max(0, x - radius);
      const right = Math.min(width - 1, x + radius);
      const sum =
        integral[(bottom + 1) * (width + 1) + right + 1] -
        integral[top * (width + 1) + right + 1] -
        integral[(bottom + 1) * (width + 1) + left] +
        integral[top * (width + 1) + left];
      const area = (right - left + 1) * (bottom - top + 1);
      const index = (y * width + x) * 4;
      const luminance = getLuminance(
        sourceImageData.data[index],
        sourceImageData.data[index + 1],
        sourceImageData.data[index + 2]
      );
      const value = luminance < sum / area - offset ? 0 : 255;
      resultImageData.data[index] = value;
      resultImageData.data[index + 1] = value;
      resultImageData.data[index + 2] = value;
      resultImageData.data[index + 3] = 255;
    }
  }

  ctx.putImageData(resultImageData, 0, 0);
  return canvas;
}

function applyDarkMorphology(sourceCanvas, operation) {
  const canvas = document.createElement("canvas");
  canvas.width = sourceCanvas.width;
  canvas.height = sourceCanvas.height;
  const ctx = canvas.getContext(
    "2d",
    { willReadFrequently: true }
  );
  const sourceCtx = sourceCanvas.getContext(
    "2d",
    { willReadFrequently: true }
  );
  const sourceImageData = sourceCtx.getImageData(
    0,
    0,
    sourceCanvas.width,
    sourceCanvas.height
  );
  const resultImageData = ctx.createImageData(canvas.width, canvas.height);

  for (let y = 0; y < canvas.height; y++) {
    for (let x = 0; x < canvas.width; x++) {
      let value = operation === "dilate" ? 255 : 0;
      for (let offsetY = -1; offsetY <= 1; offsetY++) {
        for (let offsetX = -1; offsetX <= 1; offsetX++) {
          const sampleX = Math.max(0, Math.min(canvas.width - 1, x + offsetX));
          const sampleY = Math.max(0, Math.min(canvas.height - 1, y + offsetY));
          const sample = sourceImageData.data[(sampleY * canvas.width + sampleX) * 4];
          value = operation === "dilate"
            ? Math.min(value, sample)
            : Math.max(value, sample);
        }
      }
      const index = (y * canvas.width + x) * 4;
      resultImageData.data[index] = value;
      resultImageData.data[index + 1] = value;
      resultImageData.data[index + 2] = value;
      resultImageData.data[index + 3] = 255;
    }
  }

  ctx.putImageData(resultImageData, 0, 0);
  return canvas;
}

function applyDarkClosing(sourceCanvas) {
  return applyDarkMorphology(
    applyDarkMorphology(sourceCanvas, "dilate"),
    "erode"
  );
}

function calculateOtsuThreshold(canvas) {
  const ctx = canvas.getContext(
    "2d",
    { willReadFrequently: true }
  );
  const data = ctx.getImageData(
    0,
    0,
    canvas.width,
    canvas.height
  ).data;
  const histogram = Array(256).fill(0);

  for (let index = 0; index < data.length; index += 4) {
    histogram[Math.round(getLuminance(
      data[index],
      data[index + 1],
      data[index + 2]
    ))]++;
  }

  const pixelCount = data.length / 4;
  let weightedTotal = 0;
  for (let value = 0; value < histogram.length; value++) {
    weightedTotal += value * histogram[value];
  }

  let backgroundWeight = 0;
  let backgroundTotal = 0;
  let maximumVariance = -1;
  let selectedThreshold = 0;

  for (let value = 0; value < histogram.length; value++) {
    backgroundWeight += histogram[value];
    if (backgroundWeight === 0) {
      continue;
    }

    const foregroundWeight = pixelCount - backgroundWeight;
    if (foregroundWeight === 0) {
      break;
    }

    backgroundTotal += value * histogram[value];
    const backgroundMean = backgroundTotal / backgroundWeight;
    const foregroundMean =
      (weightedTotal - backgroundTotal) / foregroundWeight;
    const variance =
      backgroundWeight * foregroundWeight *
      (backgroundMean - foregroundMean) ** 2;

    if (variance > maximumVariance) {
      maximumVariance = variance;
      selectedThreshold = value;
    }
  }

  return selectedThreshold;
}

function getFallbackCanvasStats(canvas) {
  const ctx = canvas.getContext(
    "2d",
    { willReadFrequently: true }
  );
  const data = ctx.getImageData(
    0,
    0,
    canvas.width,
    canvas.height
  ).data;
  let minimumLuminance = 255;
  let maximumLuminance = 0;
  let darkPixels = 0;

  for (let index = 0; index < data.length; index += 4) {
    const luminance = getLuminance(
      data[index],
      data[index + 1],
      data[index + 2]
    );
    minimumLuminance = Math.min(minimumLuminance, luminance);
    maximumLuminance = Math.max(maximumLuminance, luminance);
    if (luminance < 200) {
      darkPixels++;
    }
  }

  return {
    width: canvas.width,
    height: canvas.height,
    minimumLuminance: Number(minimumLuminance.toFixed(1)),
    maximumLuminance: Number(maximumLuminance.toFixed(1)),
    darkPixelRatio: Number(
      (darkPixels / (data.length / 4)).toFixed(4)
    )
  };
}

function createShortSkillFallbackVariants(sourceCanvas) {
  const grayscale = copyCanvasWithPixelTransform(
    sourceCanvas,
    (r, g, b) => Math.round(getLuminance(r, g, b))
  );
  const contrast = copyCanvasWithPixelTransform(
    grayscale,
    value => Math.max(
      0,
      Math.min(255, Math.round((value - 128) * 1.8 + 128))
    )
  );
  return [
    {
      name: "grayscale-contrast-smooth-2x",
      preprocessing:
        "グレースケール → コントラスト強調 → 2倍拡大（smoothing ON）",
      psm: "7",
      canvas: createScaledFallbackCanvas(
        contrast,
        { scale: 2, paddingRatio: 0.10, smoothing: true }
      )
    },
    {
      name: "grayscale-contrast-nearest-3x",
      preprocessing:
        "グレースケール → コントラスト強調 → 3倍拡大（smoothing OFF）",
      psm: "7",
      canvas: createScaledFallbackCanvas(
        contrast,
        { scale: 3, paddingRatio: 0.10, smoothing: false }
      )
    }
  ];
}

function createEmptyTextPsmVariants(variants) {
  const psmVariants = [
    ["grayscale-contrast-smooth-2x", "8"],
    ["grayscale-contrast-nearest-3x", "13"]
  ];

  return psmVariants.map(([name, psm]) => {
    const source = variants.find(variant => variant.name === name);
    return {
      ...source,
      name: `${source.name}-psm${psm}`,
      preprocessing: `${source.preprocessing} → PSM ${psm}`,
      psm
    };
  });
}

async function recognizeShortSkillFallback(
  worker,
  ocrCanvas,
  matchContext,
  initialOcrText,
  fallbackReason,
  normalMatchResult
) {
  let bestResult = null;
  const attempts = [];

  function isBetterFallback(matchResult, confidence) {
    if (!bestResult) {
      return true;
    }

    if (
      matchResult.similarity !==
        bestResult.matchResult.similarity
    ) {
      return (
        matchResult.similarity >
        bestResult.matchResult.similarity
      );
    }

    if (
      matchResult.similarityMargin !==
        bestResult.matchResult.similarityMargin
    ) {
      return (
        matchResult.similarityMargin >
        bestResult.matchResult.similarityMargin
      );
    }

    return confidence > bestResult.ocrConfidence;
  }

  const baseVariants =
    createShortSkillFallbackVariants(
      ocrCanvas
    );

  const variants = initialOcrText
    ? baseVariants
    : [
        ...baseVariants,
        ...createEmptyTextPsmVariants(baseVariants)
      ];

  let activePsm = "7";

  try {
    for (const variant of variants) {
      const fallbackCanvas = variant.canvas;

      if (variant.psm !== activePsm) {
        await worker.setParameters({
          tessedit_pageseg_mode: variant.psm
        });
        activePsm = variant.psm;
      }

      const result = await recognizeWithMetrics(
        worker,
        fallbackCanvas,
        "fallback"
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
          matchContext.dictionary
        );

      const assessment = assessSkillMatch(
        matchResult,
        matchContext
      );

      recordFallbackVariant(
        variant.name,
        result.ocrElapsedMs ?? 0,
        assessment
      );

      const adoptionEvaluation =
        fallbackReason === "weak-short-canonical-match"
          ? evaluateStrongShortSkillFallbackResult({
          fallbackAssessment: assessment,
          fallbackMatchResult: matchResult,
          fallbackConfidence: result.data.confidence ?? 0,
          normalMatchResult
          })
          : {
              eligible: assessment.finalStatus === "confirmed",
              reason: "standard-fallback-policy"
            };
      const eligibleForAdoption = adoptionEvaluation.eligible;

      attempts.push({
        variant: variant.name,
        preprocessing: variant.preprocessing,
        psm: variant.psm,
        canvas: getFallbackCanvasStats(fallbackCanvas),
        ocrText,
        confidence: result.data.confidence ?? 0,
        canonicalName:
          assessment.finalStatus === "confirmed"
            ? matchResult.candidate
            : null,
        firstCandidate: matchResult.candidate,
        firstSimilarity: matchResult.similarity,
        secondCandidate: matchResult.secondCandidate,
        secondSimilarity: matchResult.secondSimilarity,
        similarityMargin: matchResult.similarityMargin,
        status: assessment.finalStatus,
        reason: assessment.reason,
        eligibleForAdoption,
        adoptionEvaluation
      });

      if (
        assessment.finalStatus === "confirmed" &&
        eligibleForAdoption &&
        isBetterFallback(
          matchResult,
          result.data.confidence ?? 0
        )
      ) {
        bestResult = {
          variant: variant.name,
          preprocessing: variant.preprocessing,
          psm: variant.psm,
          ocrText,
          ocrRawText: rawText,
          ocrConfidence:
            result.data.confidence ?? 0,
          ocrCanvas: fallbackCanvas,
          matchResult,
          assessment,
          confidence: result.data.confidence ?? 0
        };

        if (
          (
            assessment.matchStatus === "exact" &&
            (result.data.confidence ?? 0) >= 60
          ) ||
          (
            matchResult.similarity >= 0.8 &&
            matchResult.similarityMargin >= 0.3 &&
            (result.data.confidence ?? 0) >= 70
          )
        ) {
          break;
        }
      }
    }
  } finally {
    if (activePsm !== "7") {
      await worker.setParameters({
        tessedit_pageseg_mode: "7",
        preserve_interword_spaces: "1",
        user_defined_dpi: "300"
      });
    }
  }

  return { bestResult, attempts };
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

  const result = await recognizeWithMetrics(
    worker,
    ocrCanvas,
    "normal"
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
    ocrCanvas,
    ocrCrop: ocrCanvas.ocrCrop ?? null
  };
}

/* =========================================================
  青・赤因子名専用OCR
  色付きカードは白文字のため、白因子用の茶色文字検出を使わない。
  通常の白因子OCR設定・前処理には影響させない。
  ========================================================= */

function createColoredFactorNameCanvas(
  sourceCanvas,
  card,
  variant
) {
  const crop = {
    x: Math.round(card.x + card.width * 0.10),
    y: Math.round(card.y + card.height * 0.02),
    width: Math.round(card.width * 0.62),
    height: Math.round(card.height * 0.62)
  };
  const scale =
    OCR_INPUT_NORMALIZATION.coloredFactorHeight /
    crop.height;
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(crop.width * scale));
  canvas.height = OCR_INPUT_NORMALIZATION.coloredFactorHeight;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(
    sourceCanvas,
    crop.x,
    crop.y,
    crop.width,
    crop.height,
    0,
    0,
    canvas.width,
    canvas.height
  );

  canvas.ocrCrop = { ...crop };
  canvas.ocrNormalizedSize = {
    width: canvas.width,
    height: canvas.height
  };

  if (variant === "raw-color") {
    return canvas;
  }

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;
  for (let index = 0; index < data.length; index += 4) {
    const r = data[index];
    const g = data[index + 1];
    const b = data[index + 2];
    const maximum = Math.max(r, g, b);
    const minimum = Math.min(r, g, b);
    const isWhiteText =
      maximum >= 170 &&
      maximum - minimum <= 58;
    const value = isWhiteText ? 0 : 255;
    data[index] = value;
    data[index + 1] = value;
    data[index + 2] = value;
  }
  ctx.putImageData(imageData, 0, 0);
  return canvas;
}

async function recognizeColoredFactorName(
  worker,
  sourceCanvas,
  card,
  candidates
) {
  const variants = [
    "white-text-mask",
    "raw-color"
  ];
  let bestRecognition = null;

  for (const variant of variants) {
    const ocrCanvas = createColoredFactorNameCanvas(
      sourceCanvas,
      card,
      variant
    );
    const result = await recognizeWithMetrics(worker, ocrCanvas, "normal");
    const rawText = result.data.text || "";
    const recognition = {
      ocrText: normalizeOcrText(rawText),
      ocrRawText: rawText,
      ocrConfidence: result.data.confidence ?? 0,
      ocrCanvas,
      ocrVariant: variant,
      ocrCrop: ocrCanvas.ocrCrop,
      ocrNormalizedSize: ocrCanvas.ocrNormalizedSize
    };
    const match = findBestSkillMatch(recognition.ocrText, candidates);
    recognition.factorCandidate = match.candidate;
    recognition.factorSimilarity = match.similarity;

    if (
      !bestRecognition ||
      recognition.factorSimilarity > bestRecognition.factorSimilarity ||
      (
        recognition.factorSimilarity === bestRecognition.factorSimilarity &&
        recognition.ocrConfidence > bestRecognition.ocrConfidence
      )
    ) {
      bestRecognition = recognition;
    }

    if (recognition.factorSimilarity === 1) {
      break;
    }
  }

  return bestRecognition;
}

/* =========================================================
  青・赤・緑因子情報取得処理
  白因子の要件照合とは分離し、緑因子の名称OCRは行わない。
  ========================================================= */

async function runOcrForFactorMetadata(
  worker,
  sourceCanvas,
  analysis
) {
  const cards = [
    ...analysis.leftCards,
    ...analysis.rightCards
  ];

  const blueCard =
    cards.find(
      card => card.factorType === "blue"
    ) ?? null;

  const redCard =
    cards.find(
      card => card.factorType === "red"
    ) ?? null;

  const greenCard =
    cards.find(
      card => card.factorType === "green"
    ) ?? null;

  const blueRecognition = blueCard
    ? await recognizeColoredFactorName(
        worker,
        sourceCanvas,
        blueCard,
        BLUE_FACTOR_NAMES
      )
    : null;

  const redRecognition = redCard
    ? await recognizeColoredFactorName(
        worker,
        sourceCanvas,
        redCard,
        RED_FACTOR_NAMES
      )
    : null;

  analysis.factorMetadata =
    createFactorMetadata({
      blueCard,
      blueRecognition,
      redCard,
      redRecognition,
      greenCard
    });

  analysis.factorMetadataFound =
    Object.values(
      analysis.factorMetadata
    ).some(Boolean);

  return analysis.factorMetadata;
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
    getCanonicalSkillCandidates();

  const matchContext =
    createSkillMatchContext(
      dictionary
    );

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

    if (!card.sourceThumbnail) {
      const thumbnail = createSourceCardThumbnail(
        sourceCanvas,
        card
      );
      card.sourceThumbnail = thumbnail.dataUrl;
      card.sourceThumbnailCrop = thumbnail.crop;
      card.reviewThumbnail = thumbnail.dataUrl;
    }

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

    card.ocrCrop = result.ocrCrop;

    card.ocrNormalizedSize =
      result.ocrCanvas?.ocrNormalizedSize ?? null;

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

    card.matchCandidateScores =
      matchResult.candidateScores ?? [];

    card.matchThreshold =
      getSkillMatchThreshold(
        matchResult
          .normalizedOcr
      );

    const assessment =
      assessSkillMatch(
        matchResult,
        matchContext
      );

    card.matchStatus =
      assessment.matchStatus;

    card.matchClassification =
      assessment.matchClassification ||
      assessment.matchStatus;

    card.finalStatus =
      assessment.finalStatus;

    card.canonicalName =
      assessment.finalStatus === "confirmed"
        ? matchResult.candidate
        : null;

    card.reviewReason =
      assessment.reason;

    card.hasSimilarCandidateGroup =
      assessment.hasSimilarCandidateGroup;

    card.similarCandidates =
      assessment.similarCandidates;

    card.ambiguousCandidates =
      assessment.ambiguousCandidates;

    card.ocrFallbackAttempted = false;

    card.ocrFallbackUsed = false;

    card.ocrFallbackVariant = null;

    card.ocrFallbackPreprocessing = null;

    card.ocrFallbackPsm = null;

    card.ocrFallbackResults = [];

    card.normalOcrResult = {
      ocrText: card.ocrText,
      confidence: card.ocrConfidence,
      firstCandidate: card.matchCandidate,
      firstSimilarity: card.matchSimilarity,
      secondCandidate: card.secondMatchCandidate,
      secondSimilarity: card.secondMatchSimilarity,
      similarityMargin: card.matchSimilarityMargin,
      threshold: card.matchThreshold,
      matchStatus: card.matchStatus,
      finalStatus: card.finalStatus,
      canonicalName: card.canonicalName,
      reason: card.reviewReason
    };

    const fallbackDecision =
      getShortSkillFallbackDecision({
        finalStatus: card.finalStatus,
        matchStatus: card.matchStatus,
        ocrConfidence: card.ocrConfidence,
        shortSkillCount: shortSkillDictionary.length,
        hasOcrCanvas: Boolean(result.ocrCanvas),
        candidateLength: card.matchCandidate
          ? normalizeSkillText(card.matchCandidate).length
          : 0,
        firstSimilarity: card.matchSimilarity,
        threshold: card.matchThreshold
      });

    card.ocrFallbackReason = fallbackDecision.reason;

    if (fallbackDecision.shouldRun) {
      card.ocrFallbackAttempted = true;
      ocrPerformanceMetrics.fallbackTargetCards++;

      const fallbackAttempt =
        await recognizeShortSkillFallback(
          worker,
          result.ocrCanvas,
          matchContext,
          card.ocrText,
          fallbackDecision.reason,
          matchResult
        );

      card.ocrFallbackResults =
        fallbackAttempt.attempts;

      ocrPerformanceMetrics.fallbackCallsByCard.push(
        fallbackAttempt.attempts.length
      );

      const fallback =
        fallbackAttempt.bestResult;

      if (fallback) {
        ocrPerformanceMetrics.fallbackAdoptions++;
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
          fallback.assessment
            .matchStatus;

        card.matchClassification =
          fallback.assessment
            .matchClassification ||
          fallback.assessment
            .matchStatus;

        card.finalStatus =
          fallback.assessment
            .finalStatus;

        card.canonicalName =
          fallback.assessment.finalStatus === "confirmed"
            ? fallback.matchResult.candidate
            : null;

        card.reviewReason =
          fallback.assessment
            .reason;

        card.hasSimilarCandidateGroup =
          fallback.assessment
            .hasSimilarCandidateGroup;

        card.similarCandidates =
          fallback.assessment
            .similarCandidates;

        card.ambiguousCandidates =
          fallback.assessment
            .ambiguousCandidates;

        card.ocrFallbackUsed =
          true;

        card.ocrFallbackVariant =
          fallback.variant;

        card.ocrFallbackPreprocessing =
          fallback.preprocessing;

        card.ocrFallbackPsm =
          fallback.psm;

        const adoptedStats =
          ocrPerformanceMetrics.fallbackVariants[
            fallback.variant
          ];
        if (adoptedStats) {
          adoptedStats.adopted++;
        }
      } else {
        if (fallbackAttempt.attempts.some(attempt => attempt.ocrText)) {
          ocrPerformanceMetrics.fallbackAdoptionFailures++;
        }
        if (
          fallbackDecision.reason === "weak-short-canonical-match" &&
          card.finalStatus === "confirmed"
        ) {
          card.matchStatus = "review";
          card.matchClassification = "review";
          card.finalStatus = "review";
          card.canonicalName = null;
          card.reviewReason = "weak-short-canonical-match";
        } else if (!card.reviewReason) {
          card.reviewReason = fallbackDecision.reason;
        }
      }
    }

    card.skillMatchResult = {
      status: card.finalStatus,
      ocrText: card.ocrText,
      canonicalName: card.canonicalName,
      firstCandidate: card.matchCandidate,
      firstSimilarity: card.matchSimilarity,
      secondCandidate: card.secondMatchCandidate,
      secondSimilarity: card.secondMatchSimilarity,
      reason: card.reviewReason,
      hasSimilarCandidateGroup:
        card.hasSimilarCandidateGroup,
      similarCandidates: card.similarCandidates,
      ambiguousCandidates: card.ambiguousCandidates,
      fallbackAttempted: card.ocrFallbackAttempted,
      fallbackReason: card.ocrFallbackReason,
      fallbackUsed: card.ocrFallbackUsed,
      fallbackVariant: card.ocrFallbackVariant,
      fallbackPreprocessing:
        card.ocrFallbackPreprocessing,
      fallbackPsm: card.ocrFallbackPsm,
      fallbackResults: card.ocrFallbackResults,
      normalOcrResult: card.normalOcrResult
    };

    const factorMasterEntry = card.canonicalName
      ? getFactorMasterEntry(card.canonicalName)
      : null;

    card.requirementRank =
      card.finalStatus === "confirmed" &&
      card.canonicalName &&
      ["skill", "awakening"].includes(factorMasterEntry?.type)
        ? getRequirementRank(card.canonicalName)
        : null;

    card.canonicalFactorType =
      factorMasterEntry?.type ?? null;

    card.factorMasterMatch = card.canonicalName
      ? card.matchStatus === "exact"
        ? "exact"
        : "fuzzy"
      : null;

    card.factorFinalStatus =
      card.finalStatus === "confirmed"
        ? card.requirementRank
          ? "confirmed-requirement"
          : "recognized-non-requirement"
        : card.finalStatus;

    card.skillMatchResult.requirementRank =
      card.requirementRank;

    card.skillMatchResult.factorType =
      card.canonicalFactorType;

    card.skillMatchResult.factorMasterMatch =
      card.factorMasterMatch;

    card.skillMatchResult.finalStatus =
      card.factorFinalStatus;

    analysisProgress
      .tesseractProgress = 1;

    updateAnalysisProgressDisplay(
      `${memberLabel} / 画像${imageIndex + 1}`,
      `白因子OCR ${i + 1} / ${whiteCards.length}`
    );
  }
}


export {
  createOcrWorker,
  runOcrForFactorMetadata,
  runOcrForWhiteCards,
  createShortSkillFallbackVariants,
  resetOcrPerformanceMetrics,
  getOcrPerformanceMetrics
};
