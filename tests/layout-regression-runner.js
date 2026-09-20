import {
  analyzeFactorImage
} from "../assets/js/analysis/image-analysis.js?v=layout-20260921-05";
import {
  detectFactorSectionAnchorCandidates
} from "../assets/js/analysis/factor-anchor.js?v=layout-20260921-02";
import {
  createOcrWorker,
  runOcrForWhiteCards
} from "../assets/js/ocr/ocr.js?v=20260920-ocr-fallback-01";
import {
  requirements
} from "../assets/js/config.js";
import {
  SKILL_EXAM_HIGH_EFFICIENCY_PRESET
} from "../assets/js/preset/skill-exam-high-efficiency.js";

const root = "./fixtures/factor-images/layout-20260921";

async function drawImage(filename) {
  const image = new Image();
  image.src = `${root}/${filename}?v=layout-20260921-01`;
  await image.decode();

  const canvas = document.getElementById("analysis-canvas");
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;

  const context = canvas.getContext("2d", {
    willReadFrequently: true
  });

  context.drawImage(image, 0, 0);

  return {
    context,
    width: canvas.width,
    height: canvas.height
  };
}

async function run() {
  const manifest = await fetch(
    `${root}/expected.json?v=layout-20260921-01`
  ).then(response => response.json());
  const fixtures = Object.keys(manifest.fixtures);
  const results = [];
  const analyses = new Map();

  for (const filename of fixtures) {
    const image = await drawImage(filename);
    const analysis = analyzeFactorImage(
      image.context,
      image.width,
      image.height
    );
    const rawAnchors = detectFactorSectionAnchorCandidates(
      image.context,
      image.width,
      image.height
    );

    const result = {
      filename,
      originalSize: `${image.width}x${image.height}`,
      analysisSize: `${image.width}x${image.height}`,
      analysisScale: 1,
      detectionMode: analysis.detectionMode,
      supported: analysis.supported,
      layout: analysis.classificationLayout,
      reason: analysis.supportReason ?? analysis.unsupportedReason,
      anchorFound: analysis.factorAnchorFound,
      anchorY: analysis.factorAnchorY,
      anchorCandidates: analysis.anchorCandidates,
      rawAnchors,
      columnGeometry: analysis.columnGeometry,
      leftCount: analysis.leftCards.length,
      rightCount: analysis.rightCards.length,
      whiteCardCount: [
        ...analysis.leftCards,
        ...analysis.rightCards
      ].filter(card => card.factorType === "white").length,
      ocrReached: false
    };
    const expected = manifest.fixtures[filename];
    const failures = Object.entries(expected)
      .filter(([key, value]) => result[key] !== value)
      .map(([key, value]) => (
        `${key}: expected=${value}, actual=${result[key]}`
      ));

    if (failures.length > 0) {
      throw new Error(`${filename}: ${failures.join(", ")}`);
    }

    results.push(result);
    analyses.set(filename, analysis);
  }

  if (new URLSearchParams(location.search).has("ocr")) {
    Object.assign(
      requirements,
      structuredClone(SKILL_EXAM_HIGH_EFFICIENCY_PRESET.skills)
    );
    const worker = await createOcrWorker();

    try {
      for (let index = 0; index < fixtures.length; index++) {
        const filename = fixtures[index];
        const result = results[index];
        const analysis = analyses.get(filename);

        if (!analysis.supported) {
          continue;
        }

        const image = await drawImage(filename);
        await runOcrForWhiteCards(
          worker,
          image.context.canvas,
          analysis,
          `layout-${index + 1}`,
          0
        );
        result.ocrReached = true;
      }
    } finally {
      await worker.terminate();
    }
  }

  window.layoutRegressionResult = results;
  document.getElementById("output").textContent = JSON.stringify(
    results,
    null,
    2
  );
}

run().catch(error => {
  window.layoutRegressionError = String(error?.stack ?? error);
  document.getElementById("output").textContent = window.layoutRegressionError;
});
