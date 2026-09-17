import assert from "node:assert/strict";
import {
  BLUE_FACTOR_NAMES,
  RED_FACTOR_NAMES,
  matchFactorMetadataName,
  createFactorMetadata
} from "../assets/js/analysis/factor-metadata.js";

for (const name of BLUE_FACTOR_NAMES) {
  const result = matchFactorMetadataName(
    name,
    BLUE_FACTOR_NAMES
  );
  assert.equal(result.status, "confirmed");
  assert.equal(result.canonicalName, name);
}

for (const name of RED_FACTOR_NAMES) {
  const result = matchFactorMetadataName(
    name,
    RED_FACTOR_NAMES
  );
  assert.equal(result.status, "confirmed");
  assert.equal(result.canonicalName, name);
}

assert.equal(
  matchFactorMetadataName("不明", BLUE_FACTOR_NAMES).canonicalName,
  null
);

for (const [ocrText, candidates, expectedCandidate] of [
  ["買さ", BLUE_FACTOR_NAMES, "賢さ"],
  ["條込", RED_FACTOR_NAMES, "追込"]
]) {
  const result = matchFactorMetadataName(
    ocrText,
    candidates,
    { confidence: 90 }
  );
  assert.equal(result.match.candidate, expectedCandidate, ocrText);
  assert.equal(result.match.similarity, 0.5, ocrText);
  assert.equal(
    result.canonicalName,
    expectedCandidate,
    "専用候補内で一意かつ高confidenceならmetadataとして確定する"
  );
  assert.equal(result.matchStrategy, "unique-fuzzy-candidate", ocrText);
}

assert.equal(
  matchFactorMetadataName(
    "ババワー",
    BLUE_FACTOR_NAMES,
    { confidence: 90 }
  ).canonicalName,
  "パワー"
);

for (const [ocrText, candidates] of [
  ["買さ", BLUE_FACTOR_NAMES],
  ["條込", RED_FACTOR_NAMES],
  ["ババワー", BLUE_FACTOR_NAMES]
]) {
  assert.equal(
    matchFactorMetadataName(
      ocrText,
      candidates,
      { confidence: 39 }
    ).canonicalName,
    null,
    "低confidenceの曖昧文字列は確定しない"
  );
}

for (const [ocrText, candidates] of [
  ["根さ", BLUE_FACTOR_NAMES],
  ["逃し", RED_FACTOR_NAMES]
]) {
  assert.equal(
    matchFactorMetadataName(
      ocrText,
      candidates,
      { confidence: 90 }
    ).canonicalName,
    null,
    "第1・第2候補を区別できないmetadataは未確定にする"
  );
}

for (const ocrText of ["人追込", "追込人"]) {
  const result = matchFactorMetadataName(
    ocrText,
    RED_FACTOR_NAMES,
    { confidence: 45 }
  );
  assert.equal(result.status, "confirmed", ocrText);
  assert.equal(result.canonicalName, "追込", ocrText);
}

assert.equal(
  matchFactorMetadataName(
    "人追込",
    RED_FACTOR_NAMES,
    { confidence: 39 }
  ).canonicalName,
  null,
  "低confidenceでは包含一致を採用しない"
);

assert.equal(
  matchFactorMetadataName(
    "人人追込",
    RED_FACTOR_NAMES,
    { confidence: 90 }
  ).canonicalName,
  null,
  "余分な文字が2文字以上なら採用しない"
);

assert.equal(
  matchFactorMetadataName(
    "人芝",
    RED_FACTOR_NAMES,
    { confidence: 90 }
  ).canonicalName,
  null,
  "1文字候補へ包含一致を適用しない"
);

const metadata = createFactorMetadata({
  blueCard: { stars: 3 },
  blueRecognition: {
    ocrText: "スピード",
    ocrConfidence: 90
  },
  redCard: { stars: 2 },
  redRecognition: {
    ocrText: "マイル",
    ocrConfidence: 88
  },
  greenCard: { stars: 1 }
});

assert.equal(metadata.blue.name, "スピード");
assert.equal(metadata.blue.stars, 3);
assert.equal(metadata.red.name, "マイル");
assert.equal(metadata.red.stars, 2);
assert.deepEqual(metadata.green, {
  name: "継承固有",
  stars: 1,
  status: "confirmed"
});

const unresolvedNames = createFactorMetadata({
  blueCard: { stars: 3 },
  blueRecognition: {
    ocrText: "不明",
    ocrRawText: "不明\n",
    ocrConfidence: 12
  },
  redCard: { stars: 2 },
  redRecognition: {
    ocrText: "",
    ocrRawText: "",
    ocrConfidence: 0
  }
});

assert.equal(unresolvedNames.blue.name, null);
assert.equal(unresolvedNames.blue.stars, 3);
assert.equal(unresolvedNames.blue.status, "unresolved");
assert.equal(unresolvedNames.red.name, null);
assert.equal(unresolvedNames.red.stars, 2);

for (const stars of [1, 2, 3]) {
  assert.equal(
    createFactorMetadata({
      greenCard: { stars }
    }).green.stars,
    stars
  );
}

assert.equal(
  createFactorMetadata({
    greenCard: { stars: 0 }
  }).green,
  null
);

console.log("factor metadata tests: OK");
