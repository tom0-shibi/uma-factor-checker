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
