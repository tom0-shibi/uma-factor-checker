import assert from "node:assert/strict";
import {
  findBestSkillMatch,
  createSkillMatchContext,
  assessSkillMatch
} from "../assets/js/matching/matching.js";
import {
  shouldRunShortSkillFallback
} from "../assets/js/matching/fallback-policy.js";
import {
  APP_BUILD,
  SKILL_MATCH_CONFIG
} from "../assets/js/config.js";

assert.equal(APP_BUILD, "20260911-matching-01");

assert.deepEqual(SKILL_MATCH_CONFIG, {
  thresholds: {
    1: 1.00,
    2: 0.50,
    3: 0.66,
    4: 0.60,
    5: 0.60
  },
  defaultThreshold: 0.60,
  minimumMargin: 0.15
});

const dictionary = [
  "負けん気",
  "向こう見ず",
  "風切り",
  "後先恐れず",
  "連綿",
  "レースの真髄・体",
  "レースの真髄・速",
  "アメリカンドリーム",
  "心弾んで",
  "マイルコーナー〇",
  "マイル直線〇",
  "春ウマ娘〇",
  "秋ウマ娘〇",
  "春の目覚め",
  "秋の目覚め",
  "右回り〇",
  "左回り〇",
  "溌剌"
];

const context = createSkillMatchContext(dictionary);

function assess(ocrText) {
  const matchResult = findBestSkillMatch(ocrText, dictionary);
  return {
    matchResult,
    assessment: assessSkillMatch(matchResult, context)
  };
}

for (const skill of [
  "負けん気",
  "向こう見ず",
  "風切り",
  "後先恐れず",
  "連綿",
  "レースの真髄・体",
  "レースの真髄・速",
  "アメリカンドリーム",
  "心弾んで",
  "マイルコーナー〇",
  "マイル直線〇",
  "秋ウマ娘〇"
]) {
  assert.equal(assess(skill).assessment.finalStatus, "confirmed", skill);
}

for (const [ocrText, expected] of [
  ["向こう見すず", "向こう見ず"],
  ["向こう見すずビ", "向こう見ず"],
  ["マイルコーナーの〇", "マイルコーナー〇"],
  ["秋ウマ娘〇ンー", "秋ウマ娘〇"]
]) {
  const result = assess(ocrText);
  assert.equal(result.matchResult.candidate, expected, ocrText);
  assert.equal(result.assessment.finalStatus, "confirmed", ocrText);
}

for (const ocrText of ["吾の目覚め。", "の目覚め。"]) {
  const result = assess(ocrText);
  assert.equal(result.assessment.finalStatus, "review", ocrText);
  assert.equal(
    result.assessment.reason,
    "ambiguous-similar-candidates",
    ocrText
  );
}

const genericAmbiguity = assess("吾回り〇");
assert.equal(genericAmbiguity.assessment.finalStatus, "review");
assert.equal(
  genericAmbiguity.assessment.reason,
  "ambiguous-similar-candidates"
);

const shortSkillMiss = assess("末且");
assert.equal(shortSkillMiss.assessment.finalStatus, "unresolved");
assert.equal(
  shouldRunShortSkillFallback({
    finalStatus: shortSkillMiss.assessment.finalStatus,
    ocrConfidence: 11,
    shortSkillCount: 1,
    hasOcrCanvas: true
  }),
  true
);
assert.equal(
  shouldRunShortSkillFallback({
    finalStatus: "confirmed",
    ocrConfidence: 11,
    shortSkillCount: 1,
    hasOcrCanvas: true
  }),
  false
);

console.log("matching regression tests: OK");
