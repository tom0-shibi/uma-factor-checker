import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  getRepresentativeImageExportPattern
} from "../assets/js/representative/representative-state.js";

assert.equal(
  getRepresentativeImageExportPattern(["target"]),
  "target-only"
);
assert.equal(
  getRepresentativeImageExportPattern(["target", "parentA", "parentB"]),
  "full-family"
);

[
  [],
  ["parentA"],
  ["parentB"],
  ["target", "parentA"],
  ["target", "parentB"],
  ["parentA", "parentB"]
].forEach(memberIds => {
  assert.equal(
    getRepresentativeImageExportPattern(memberIds),
    null,
    `unexpected export pattern for ${memberIds.join(",")}`
  );
});

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const fixtureRoot = path.join(testDirectory, "fixtures");
const fixture = JSON.parse(
  fs.readFileSync(path.join(fixtureRoot, "representative-cases.json"), "utf8")
);

fixture.cases.forEach(testCase => {
  const registeredIds = Object.keys(testCase.members);
  Object.values(testCase.members).flat().forEach(relativePath => {
    assert.equal(
      fs.existsSync(path.join(fixtureRoot, relativePath)),
      true,
      `missing representative fixture: ${relativePath}`
    );
  });
  if (Object.hasOwn(testCase, "expectedExportPattern")) {
    assert.equal(
      getRepresentativeImageExportPattern(registeredIds),
      testCase.expectedExportPattern,
      testCase.id
    );
  }
});

console.log("representative state tests: OK");
