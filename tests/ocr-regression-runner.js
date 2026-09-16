import {
  analyzeFactorImage
} from "../assets/js/analysis/image-analysis.js?v=20260916-ocr-regression-02";
import {
  createOcrWorker,
  runOcrForFactorMetadata,
  runOcrForWhiteCards,
  resetOcrPerformanceMetrics,
  getOcrPerformanceMetrics
} from "../assets/js/ocr/ocr.js?v=20260916-ocr-regression-02";
import { requirements } from "../assets/js/config.js";
import { normalizeSkillText } from "../assets/js/matching/matching.js";
import { SKILL_EXAM_HIGH_EFFICIENCY_PRESET } from "../assets/js/preset/skill-exam-high-efficiency.js";
import { getCanonicalSkillCandidates } from "../assets/js/matching/candidate-provider.js";

const root = "./fixtures/factor-images/regression-20260916";

async function drawImage(filename) {
  const image = new Image();
  image.src = `${root}/${filename}?v=20260916-01`;
  await image.decode();
  const canvas = document.getElementById("analysis-canvas");
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  return {
    canvas,
    context,
    originalWidth: image.naturalWidth,
    originalHeight: image.naturalHeight
  };
}

function getWhiteCard(analysis, expected) {
  const cards = expected.column === "left"
    ? analysis.leftCards
    : analysis.rightCards;
  return cards.filter(card => card.factorType === "white")[expected.row - 1] ?? null;
}

async function run() {
  const output = document.getElementById("output");
  const manifest = await fetch(`${root}/expected.json?v=20260916-02`).then(r => r.json());
  Object.assign(requirements, structuredClone(SKILL_EXAM_HIGH_EFFICIENCY_PRESET.skills));
  resetOcrPerformanceMetrics();
  const canonicalCandidateKeys = new Set(
    getCanonicalSkillCandidates().map(normalizeSkillText)
  );
  const startedAt = performance.now();
  const worker = await createOcrWorker();
  const details = [];
  const analyses = [];
  const requirementActual = {};
  let rawTotal = 0;
  let rawCorrect = 0;
  let canonicalTotal = 0;
  let canonicalCorrect = 0;
  let starCorrect = 0;
  let cropMissing = 0;
  let raceTotal = 0;
  let raceRawCorrect = 0;
  let blueTotal = 0;
  let blueNameCorrect = 0;
  let blueStarsCorrect = 0;
  let redTotal = 0;
  let redNameCorrect = 0;
  let redStarsCorrect = 0;
  let greenTotal = 0;
  let greenStarsCorrect = 0;
  const metadataDetails = [];

  try {
    const entries = Object.entries(manifest.fixtures);
    for (let index = 0; index < entries.length; index++) {
      const [filename, fixture] = entries[index];
      output.textContent = `${index + 1}/${entries.length} ${filename}`;
      const {
        canvas,
        context,
        originalWidth,
        originalHeight
      } = await drawImage(filename);
      const analysis = analyzeFactorImage(context, canvas.width, canvas.height);
      analyses.push({
        filename,
        supported: analysis.supported,
        layout: analysis.classificationLayout,
        reason: analysis.supportReason ?? analysis.unsupportedReason,
        leftCount: analysis.leftCards.length,
        rightCount: analysis.rightCards.length,
        anchorFound: analysis.factorAnchorFound,
        anchorY: analysis.factorAnchorY,
        anchorCandidates: analysis.anchorCandidates,
        originalWidth,
        originalHeight,
        cardGeometry: analysis.columnGeometry,
        rowPitch: analysis.pitch
      });
      const factorMetadata = await runOcrForFactorMetadata(
        worker,
        canvas,
        analysis
      );
      if (fixture.factorInfo) {
        blueTotal++;
        redTotal++;
        greenTotal++;
        blueNameCorrect += Number(
          factorMetadata.blue?.name === fixture.factorInfo.blue.name
        );
        blueStarsCorrect += Number(
          factorMetadata.blue?.stars === fixture.factorInfo.blue.stars
        );
        redNameCorrect += Number(
          factorMetadata.red?.name === fixture.factorInfo.red.name
        );
        redStarsCorrect += Number(
          factorMetadata.red?.stars === fixture.factorInfo.red.stars
        );
        greenStarsCorrect += Number(
          factorMetadata.green?.stars === fixture.factorInfo.green.stars
        );
      }
      metadataDetails.push({
        filename,
        expected: fixture.factorInfo ?? null,
        actual: factorMetadata,
        metadataFound: analysis.factorMetadataFound
      });
      await runOcrForWhiteCards(worker, canvas, analysis, fixture.member, fixture.imageIndex);
      for (const expected of fixture.whiteFactors) {
        const card = getWhiteCard(analysis, expected);
        const normalizedExpected = normalizeSkillText(expected.name);
        const rawMatches = normalizeSkillText(card?.ocrText ?? "") === normalizedExpected;
        const canonicalMatches = normalizeSkillText(card?.canonicalName ?? "") === normalizedExpected;
        rawTotal++;
        rawCorrect += Number(rawMatches);
        starCorrect += Number(card?.stars === expected.stars);
        cropMissing += Number(!card?.ocrCrop);
        if (expected.type === "race") {
          raceTotal++;
          raceRawCorrect += Number(rawMatches);
        } else {
        if (canonicalCandidateKeys.has(normalizedExpected)) {
          canonicalTotal++;
          canonicalCorrect += Number(canonicalMatches);
        }
        }
        if (card?.requirementRank && card.canonicalName) {
          requirementActual[card.requirementRank] ??= {};
          requirementActual[card.requirementRank][card.canonicalName] ??= new Set();
          requirementActual[card.requirementRank][card.canonicalName].add(fixture.member);
        }
        details.push({
          filename,
          member: fixture.member,
          column: expected.column,
          row: expected.row,
          expected: expected.name,
          expectedStars: expected.stars,
          type: expected.type,
          ocrText: card?.ocrText ?? null,
          confidence: card?.ocrConfidence ?? null,
          canonicalName: card?.canonicalName ?? null,
          requirementRank: card?.requirementRank ?? null,
          stars: card?.stars ?? null,
          rawMatches,
          canonicalMatches,
          crop: card?.ocrCrop ?? null,
          normalizedOcrSize: card?.ocrNormalizedSize ?? null
        });
      }
    }
  } finally {
    await worker.terminate();
  }

  const expectedA = manifest.requirementsExpected.A;
  const requirementChecks = Object.entries(expectedA).map(([name, members]) => ({
    name,
    expected: [...members].sort(),
    actual: [...(requirementActual.A?.[name] ?? [])].sort()
  }));
  const requirementCorrect = requirementChecks.filter(item =>
    JSON.stringify(item.actual) === JSON.stringify(item.expected)
  ).length;
  const summary = {
    build: "20260916-ocr-regression-02",
    fixtures: Object.keys(manifest.fixtures).length,
    raw: { correct: rawCorrect, total: rawTotal, accuracy: rawCorrect / rawTotal },
    canonical: { correct: canonicalCorrect, total: canonicalTotal, accuracy: canonicalCorrect / canonicalTotal },
    stars: { correct: starCorrect, total: rawTotal, accuracy: starCorrect / rawTotal },
    raceRaw: { correct: raceRawCorrect, total: raceTotal, accuracy: raceRawCorrect / raceTotal },
    factorMetadata: {
      blueName: { correct: blueNameCorrect, total: blueTotal, accuracy: blueNameCorrect / blueTotal },
      blueStars: { correct: blueStarsCorrect, total: blueTotal, accuracy: blueStarsCorrect / blueTotal },
      redName: { correct: redNameCorrect, total: redTotal, accuracy: redNameCorrect / redTotal },
      redStars: { correct: redStarsCorrect, total: redTotal, accuracy: redStarsCorrect / redTotal },
      greenStars: { correct: greenStarsCorrect, total: greenTotal, accuracy: greenStarsCorrect / greenTotal },
      details: metadataDetails
    },
    requirements: {
      correct: requirementCorrect,
      total: requirementChecks.length,
      accuracy: requirementCorrect / requirementChecks.length,
      checks: requirementChecks
    },
    cropMissing,
    analyses,
    metrics: getOcrPerformanceMetrics(),
    totalAnalysisMs: performance.now() - startedAt,
    details
  };
  window.ocrRegressionResult = summary;
  output.textContent = JSON.stringify(summary, null, 2);
}

run().catch(error => {
  document.getElementById("output").textContent = `${error.stack || error}`;
  window.ocrRegressionError = `${error.stack || error}`;
});
