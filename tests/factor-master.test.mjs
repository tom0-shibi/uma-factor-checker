import assert from "node:assert/strict";
import {
  FACTOR_MASTER,
  FACTOR_TYPES
} from "../assets/js/data/factor-master.js";
import {
  getCanonicalSkillCandidates,
  getFactorMasterEntry,
  getFactorMasterStats
} from "../assets/js/matching/candidate-provider.js";
import {
  requirements,
  SKILL_MATCH_CONFIG
} from "../assets/js/config.js";
import {
  findBestSkillMatch,
  createSkillMatchContext,
  assessSkillMatch
} from "../assets/js/matching/matching.js";

const names = FACTOR_MASTER.map(entry => entry.name);
assert.equal(new Set(names).size, names.length, "Factor Master名称は重複しない");
FACTOR_MASTER.forEach(entry => {
  assert.ok(entry.name);
  assert.ok(Object.values(FACTOR_TYPES).includes(entry.type));
});

const stats = getFactorMasterStats();
assert.equal(stats.total, FACTOR_MASTER.length);
assert.equal(
  Object.values(stats.byType).reduce((sum, count) => sum + count, 0),
  stats.total
);

for (const [name, type] of [
  ["安田記念", "race"],
  ["チャンピオンズC", "race"],
  ["ホープフルS", "race"],
  ["ヴィクトリアマイル", "race"],
  ["天皇賞（秋）", "race"],
  ["東京大賞典", "race"],
  ["BC・サンタアニタパーク", "race"],
  ["追込の遺伝子", "other"],
  ["恩返し、召し上がれ", "other"],
  ["末脚", "skill"]
]) {
  assert.equal(getFactorMasterEntry(name)?.type, type, name);
}

requirements.S = [];
requirements.A = [];
requirements.B = [];
requirements.C = ["Factor Master未登録の要件"];
const candidates = getCanonicalSkillCandidates();
assert.ok(candidates.includes("Factor Master未登録の要件"));
assert.equal(
  getFactorMasterEntry("Factor Master未登録の要件")?.type,
  "skill"
);

const context = createSkillMatchContext(candidates);
for (const name of ["安田記念", "追込の遺伝子", "末脚"]) {
  const match = findBestSkillMatch(name, candidates);
  const assessment = assessSkillMatch(match, context);
  assert.equal(match.candidate, name);
  assert.equal(assessment.finalStatus, "confirmed");
  assert.equal(match.similarity, 1);
}

assert.deepEqual(SKILL_MATCH_CONFIG, {
  thresholds: { 1: 1, 2: 0.5, 3: 0.66, 4: 0.6, 5: 0.6 },
  defaultThreshold: 0.6,
  minimumMargin: 0.15
});

console.log(
  `factor master tests: OK (${stats.total} entries: ` +
  `${stats.byType.skill} skill / ${stats.byType.race} race / ${stats.byType.other} other)`
);
