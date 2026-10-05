import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  FACTOR_MASTER,
  FACTOR_MASTER_VERSION,
  FACTOR_TYPES
} from "../assets/js/data/factor-master.js";
import {
  getCanonicalSkillCandidates,
  getFactorMasterEntry,
  getFactorMasterEntryById,
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
import {
  readAndValidateFactorMaster,
  renderFactorMasterModule
} from "../scripts/build-factor-master.mjs";

assert.ok(FACTOR_MASTER_VERSION);
const names = FACTOR_MASTER.map(entry => entry.name);
const ids = FACTOR_MASTER.map(entry => entry.factorId);
assert.equal(new Set(ids).size, ids.length, "Factor Master IDは重複しない");
assert.equal(new Set(names).size, names.length, "Factor Master名称は重複しない");
FACTOR_MASTER.forEach(entry => {
  assert.match(entry.factorId, /^factor_[0-9]{6}$/);
  assert.ok(entry.name);
  assert.ok(entry.color);
  assert.ok(Object.values(FACTOR_TYPES).includes(entry.type));
});

const csvEntries = readAndValidateFactorMaster();
assert.equal(csvEntries.length, FACTOR_MASTER.length);
assert.deepEqual(csvEntries, [...FACTOR_MASTER]);
const generated = renderFactorMasterModule(csvEntries);
assert.equal(
  generated,
  fs.readFileSync("assets/js/data/factor-master.js", "utf8"),
  "再生成で差分を発生させない"
);
assert.equal(renderFactorMasterModule(csvEntries), generated, "生成はdeterministic");

const temporaryDirectory = fs.mkdtempSync(
  path.join(os.tmpdir(), "factor-master-test-")
);
function assertCsvValidationError(row, expectedMessage) {
  const csvPath = path.join(temporaryDirectory, "invalid.csv");
  fs.writeFileSync(
    csvPath,
    `No.,factorId,因子名,因子色,分類,備考,skillId\n${row}\n`,
    "utf8"
  );
  assert.throws(
    () => readAndValidateFactorMaster(csvPath),
    error => error.message.includes("行2") && error.message.includes(expectedMessage)
  );
}
assertCsvValidationError("1,factor_000001,,white,skill,,", "因子名が空");
assertCsvValidationError("1,factor_000001,末脚,purple,skill,,", "不正な因子色");
assertCsvValidationError("1,factor_000001,末脚,white,unknown,,", "不正な分類");
assertCsvValidationError("1,bad-id,末脚,white,skill,,", "factorId");
const duplicateCsvPath = path.join(temporaryDirectory, "duplicate.csv");
fs.writeFileSync(
  duplicateCsvPath,
  "No.,factorId,因子名,因子色,分類,備考,skillId\n1,factor_000001,末脚,white,skill,,\n2,factor_000002,末脚,white,skill,,\n",
  "utf8"
);
assert.throws(
  () => readAndValidateFactorMaster(duplicateCsvPath),
  error => error.message.includes("行3") && error.message.includes("重複")
);
fs.rmSync(temporaryDirectory, { recursive: true });

assert.equal(getFactorMasterEntryById(FACTOR_MASTER[0].factorId)?.name, FACTOR_MASTER[0].name);
assert.ok(FACTOR_MASTER.findIndex(entry => entry.name === "怯むことなく") < FACTOR_MASTER.findIndex(entry => entry.type === "awakening"), "新しい通常スキル因子は目覚め因子より前に並ぶ");
assert.ok(FACTOR_MASTER.findIndex(entry => entry.name === "遊び心") < FACTOR_MASTER.findIndex(entry => entry.type === "awakening"), "新しい通常スキル因子は目覚め因子より前に並ぶ");


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
  ["差しの遺伝子", "gene"],
  ["追込の遺伝子", "gene"],
  ["スピードの目覚め", "awakening"],
  ["連戦連勝", "hidden"],
  ["URAシナリオ", "scenario"],
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
for (const name of [
  "安田記念",
  "差しの遺伝子",
  "追込の遺伝子",
  "スピードの目覚め",
  "連戦連勝",
  "URAシナリオ",
  "末脚"
]) {
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
  `${stats.byColor.white} white candidates)`
);
