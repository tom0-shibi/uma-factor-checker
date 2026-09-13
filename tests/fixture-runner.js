import {
  analyzeFactorImage
} from "../assets/js/analysis/image-analysis.js";
import {
  createOcrWorker,
  runOcrForFactorMetadata,
  runOcrForWhiteCards
} from "../assets/js/ocr/ocr.js?v=metadata-fixture-02";
import {
  requirements,
  members
} from "../assets/js/config.js";
import {
  TEMPORARY_SKILL_NAME_MASTER
} from "../assets/js/master/temporary-skill-name-master.js";
import {
  aggregateMemberSkills,
  buildMemberFactorInfo
} from "../assets/js/result/result-model.js";

async function drawFixture(category, name) {
  const image = document.createElement("img");
  image.src = `./fixtures/factor-images/${category}/${name}?v=real-fixtures-01`;
  await image.decode();
  const canvas = document.getElementById("analysis-canvas");
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(image, 0, 0);
  return { canvas, ctx, width: canvas.width, height: canvas.height };
}

function summarizeAnalysis(name, analysis) {
  return {
    name,
    supported: analysis.supported,
    layout: analysis.classificationLayout,
    leftCount: analysis.leftCards.length,
    rightCount: analysis.rightCards.length,
    anchorFound: analysis.factorAnchorFound,
    reason: analysis.supportReason ?? analysis.unsupportedReason,
    coloredCards: [
      ...analysis.leftCards,
      ...analysis.rightCards
    ]
      .filter(card => card.factorType !== "white")
      .map(card => ({
        column: card.column,
        row: card.row,
        factorType: card.factorType,
        stars: card.stars
      }))
  };
}

function validateResult(result, fixture) {
  const expected = fixture.expected;
  const failures = [];
  const compare = (label, actual, wanted) => {
    if (actual !== wanted) {
      failures.push(`${label}: expected=${wanted}, actual=${actual}`);
    }
  };

  compare("supported", result.supported, expected.supported);
  if ("layout" in expected) {
    compare("layout", result.layout, expected.layout);
  }
  if (expected.cards) {
    compare("leftCount", result.leftCount, expected.cards.leftCount);
    compare("rightCount", result.rightCount, expected.cards.rightCount);
  }
  if (expected.factorInfo) {
    for (const [type, factorInfo] of Object.entries(expected.factorInfo)) {
      compare(
        `${type}.name`,
        result.factorMetadata?.[type]?.name ?? null,
        factorInfo.name
      );
      compare(
        `${type}.stars`,
        result.factorMetadata?.[type]?.stars ?? null,
        factorInfo.stars
      );
    }
  }
  return failures;
}

async function run() {
  const manifest = await fetch(
    "./fixtures/factor-images/expected.json?v=real-fixtures-01"
  ).then(response => response.json());
  const results = [];
  const metadataTargets = [];
  const analyses = new Map();

  for (const [name, fixture] of Object.entries(manifest.fixtures)) {
    let image;
    try {
      image = await drawFixture(fixture.category, name);
    } catch (error) {
      throw new Error(`fixture decode failed: ${name}: ${error}`);
    }
    const analysis = analyzeFactorImage(
      image.ctx,
      image.width,
      image.height
    );
    results.push(summarizeAnalysis(name, analysis));
    analyses.set(name, analysis);

    if (
      analysis.supported &&
      [
        ...analysis.leftCards,
        ...analysis.rightCards
      ].some(card => card.factorType !== "white")
    ) {
      metadataTargets.push({ name, category: fixture.category, analysis });
    }
  }

  document.getElementById("fixture-output").textContent =
    `classification-complete\n${JSON.stringify(results, null, 2)}`;

  let worker;
  try {
    worker = await createOcrWorker();
  } catch (error) {
    throw new Error(`OCR worker setup failed: ${error}`);
  }
  try {
    for (const target of metadataTargets) {
      const image = await drawFixture(target.category, target.name);
      await runOcrForFactorMetadata(
        worker,
        image.canvas,
        target.analysis
      );
      const result = results.find(item => item.name === target.name);
      result.factorMetadata = target.analysis.factorMetadata;
      result.metadataFound = target.analysis.factorMetadataFound;
    }

    if (new URLSearchParams(location.search).has("full")) {
      const sequence = [
        "factor-list-start-01.jpg",
        "factor-list-continuation-01.jpg",
        "factor-list-end-01.jpg"
      ];
      requirements.S = [...TEMPORARY_SKILL_NAME_MASTER];
      members.parentA.images = sequence.map((name, index) => ({
        id: `fixture-${index + 1}`,
        name
      }));
      members.parentA.analysisResults = [];

      for (let index = 0; index < sequence.length; index++) {
        const name = sequence[index];
        document.getElementById("fixture-output").textContent =
          `full-ocr:${index + 1}/${sequence.length}:${name}`;
        const image = await drawFixture("supported", name);
        const analysis = analyses.get(name);
        await runOcrForWhiteCards(
          worker,
          image.canvas,
          analysis,
          "親A",
          index
        );
        members.parentA.analysisResults.push({
          imageIndex: index,
          analysis
        });
      }

      const confirmedCards = members.parentA.analysisResults
        .flatMap(item => [
          ...item.analysis.leftCards,
          ...item.analysis.rightCards
        ])
        .filter(card =>
          card.factorType === "white" &&
          card.finalStatus === "confirmed" &&
          card.requirementRank
        );
      window.fullSequenceResult = {
        supportedImages: sequence.filter(
          name => analyses.get(name)?.supported
        ).length,
        imageCount: sequence.length,
        whiteCardsProcessed: members.parentA.analysisResults
          .reduce((total, item) => total + [
            ...item.analysis.leftCards,
            ...item.analysis.rightCards
          ].filter(card => card.factorType === "white").length, 0),
        confirmedBeforeDedupe: confirmedCards.length,
        confirmedAfterDedupe: aggregateMemberSkills("parentA").size,
        factorInfo: buildMemberFactorInfo().parentA
      };
    }
  } finally {
    await worker.terminate();
  }

  for (const result of results) {
    result.validationFailures = validateResult(
      result,
      manifest.fixtures[result.name]
    );
  }

  window.fixtureResults = results;
  window.fixturePassed = results.every(
    result => result.validationFailures.length === 0
  );
  document.getElementById("fixture-output").textContent =
    JSON.stringify({
      passed: window.fixturePassed,
      fullSequence: window.fullSequenceResult ?? null,
      results
    }, null, 2);
}

run().catch(error => {
  window.fixtureError = String(error?.stack ?? error);
  document.getElementById("fixture-output").textContent =
    window.fixtureError;
});
