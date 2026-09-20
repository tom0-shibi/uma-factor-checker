import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const fixtureDirectory = path.join(
  testDirectory,
  "fixtures/factor-images/regression-20260916"
);
const manifest = JSON.parse(
  fs.readFileSync(path.join(fixtureDirectory, "legacy-expected.json"), "utf8")
);

assert.equal(Object.keys(manifest.fixtures).length, 10);

let verifiedFactors = 0;
let verifiedRaceFactors = 0;
for (const [filename, fixture] of Object.entries(manifest.fixtures)) {
  const imagePath = path.join(fixtureDirectory, filename);
  assert.equal(fs.existsSync(imagePath), true, `missing fixture: ${filename}`);
  assert.match(fixture.member, /^(parentA|grandA1|grandA2|parentB|grandB1|grandB2)$/);
  assert.match(fixture.layout, /^factor-list-(start|continuation)$/);
  assert.ok(fixture.whiteFactors.length > 0, `${filename} has no ground truth`);
  fixture.whiteFactors.forEach(factor => {
    assert.match(factor.column, /^(left|right)$/);
    assert.ok(Number.isInteger(factor.row) && factor.row > 0);
    assert.ok(factor.name.length > 0);
    assert.ok([1, 2, 3].includes(factor.stars));
    assert.ok(["skill", "race", "other"].includes(factor.type));
    verifiedFactors++;
    if (factor.type === "race") {
      verifiedRaceFactors++;
    }
  });
}

assert.ok(verifiedFactors >= 75);
assert.ok(verifiedRaceFactors >= 15);
assert.ok(Object.keys(manifest.requirementsExpected.A).length > 0);

console.log(
  `OCR regression fixture tests: OK (${verifiedFactors} factors, ${verifiedRaceFactors} races)`
);
