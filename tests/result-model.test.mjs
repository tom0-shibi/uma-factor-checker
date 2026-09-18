import assert from "node:assert/strict";
import {
  requirements,
  members,
  MEMBER_ORDER
} from "../assets/js/config.js";
import {
  getEffectiveRecognition,
  setManualCorrection,
  setManualCorrections,
  ignoreRecognition,
  clearManualCorrection,
  clearManualCorrections,
  buildOverallSkillSummary,
  buildRecognitionSummary,
  buildConfirmedCanonicalNamesByMember,
  getReviewItems
} from "../assets/js/result/result-model.js";
import {
  formatXShareText
} from "../assets/js/export/x-share.js";
import {
  createShareSkill,
  buildShareSkillSummaries
} from "../assets/js/export/share-skills.js";

function createCard(overrides = {}) {
  return {
    factorType: "white",
    stars: 2,
    column: "left",
    row: 8,
    ocrText: "",
    ocrConfidence: 0,
    finalStatus: "unresolved",
    canonicalName: null,
    requirementRank: null,
    matchCandidate: null,
    matchSimilarity: 0,
    secondMatchCandidate: null,
    secondMatchSimilarity: 0,
    reviewReason: "low-confidence-short-skill",
    ocrFallbackAttempted: true,
    ocrFallbackUsed: false,
    ...overrides
  };
}

MEMBER_ORDER.forEach(memberId => {
  members[memberId].images = [];
  members[memberId].analysisResults = [];
});

requirements.S = ["連綿"];
requirements.A = ["溌剌"];
requirements.B = [];
requirements.C = [];

const unrecognizedCard = createCard();
const duplicateLowerStars = createCard({
  row: 2,
  ocrText: "連綿",
  finalStatus: "confirmed",
  canonicalName: "連綿",
  requirementRank: "S",
  stars: 1,
  ocrFallbackAttempted: false
});
const duplicateHigherStars = createCard({
  row: 3,
  ocrText: "連綿",
  finalStatus: "confirmed",
  canonicalName: "連綿",
  requirementRank: "S",
  stars: 3,
  ocrFallbackAttempted: false
});
const recognizedRaceCard = createCard({
  row: 4,
  ocrText: "安田記念",
  finalStatus: "confirmed",
  factorFinalStatus: "recognized-non-requirement",
  canonicalName: "安田記念",
  canonicalFactorType: "race",
  requirementRank: null,
  ocrFallbackAttempted: false
});

members.grandA1.images = [{ id: "image-1" }, { id: "image-2" }];
members.grandA1.analysisResults = [
  {
    imageIndex: 0,
    analysis: {
      leftCards: [unrecognizedCard, duplicateLowerStars, recognizedRaceCard],
      rightCards: [],
      factorMetadata: {
        blue: { name: "スピード", stars: 3 },
        red: { name: "マイル", stars: 2 },
        green: { name: "継承固有", stars: 1 }
      }
    }
  },
  {
    imageIndex: 1,
    analysis: {
      leftCards: [duplicateHigherStars],
      rightCards: []
    }
  }
];

let model = buildOverallSkillSummary();
assert.equal(model.registeredMemberCount, 1);
assert.equal(model.memberSummary.find(item => item.memberId === "parentA").registered, false);
assert.equal(model.memberSummary.find(item => item.memberId === "grandA1").counts.S, 1);
assert.equal(model.ranks.S[0].ownedCount, 1);
assert.equal(model.ranks.S[0].totalStars, 3, "dedupe後は最大星数を使う");
assert.equal(model.factorInfo.grandA1.blue.name, "スピード");
assert.equal(model.factorInfo.grandA1.blue.stars, 3);
assert.equal(model.factorInfo.grandA1.red.name, "マイル");
assert.equal(model.factorInfo.parentA.blue, null);
assert.equal(getReviewItems().length, 1, "未確定因子を保持する");

const recognitionSummary = buildRecognitionSummary();
assert.equal(recognitionSummary.whiteCardCount, 4);
assert.equal(recognitionSummary.confirmedRequirementCount, 2);
assert.equal(recognitionSummary.recognizedNonRequirementCount, 1);
assert.equal(recognitionSummary.recognizedRaceCount, 1);
assert.equal(recognitionSummary.unresolvedCount, 1);

requirements.A.push("スピードの目覚め");
const awakeningCard = createCard({
  ocrText: "スピードの目覚め",
  finalStatus: "confirmed",
  canonicalName: "スピードの目覚め",
  canonicalFactorType: "awakening",
  requirementRank: null
});
assert.equal(
  getEffectiveRecognition(awakeningCard).requirementRank,
  "A",
  "awakeningはcanonicalName自身が要件にあればS/A/B/C集計対象にする"
);
requirements.A = requirements.A.filter(name => name !== "スピードの目覚め");

const originalSnapshot = {
  ocrText: unrecognizedCard.ocrText,
  finalStatus: unrecognizedCard.finalStatus,
  canonicalName: unrecognizedCard.canonicalName
};
setManualCorrection(unrecognizedCard, "溌剌");
let effective = getEffectiveRecognition(unrecognizedCard);
assert.equal(effective.status, "confirmed");
assert.equal(effective.canonicalName, "溌剌");
assert.equal(effective.requirementRank, "A");
assert.equal(effective.resolutionSource, "manual");
assert.deepEqual(
  {
    ocrText: unrecognizedCard.ocrText,
    finalStatus: unrecognizedCard.finalStatus,
    canonicalName: unrecognizedCard.canonicalName
  },
  originalSnapshot,
  "manual correctionで元OCRフィールドを破壊しない"
);

model = buildOverallSkillSummary();
assert.equal(model.ranks.A[0].ownedCount, 1);
assert.equal(model.ranks.A[0].totalStars, 2);
requirements.S = ["連綿", "溌剌"];
model = buildOverallSkillSummary();
assert.match(
  formatXShareText(
    model,
    "",
    buildShareSkillSummaries(
      model,
      [createShareSkill("溌剌")]
    )
  ),
  /溌剌 1\/1/,
  "手動訂正後のeffective recognitionをX共有へ反映する"
);
requirements.S = ["連綿"];

requirements.A = [];
effective = getEffectiveRecognition(unrecognizedCard);
assert.equal(effective.canonicalName, "溌剌");
assert.equal(effective.requirementRank, null, "要件再適用時はrankだけ再評価する");
model = buildOverallSkillSummary();
assert.equal(
  buildShareSkillSummaries(
    model,
    [createShareSkill("溌剌")],
    buildConfirmedCanonicalNamesByMember()
  )[0].ownedCount,
  1,
  "要件rankが外れても手動訂正後の正式名称を共有集計へ反映する"
);

requirements.A = ["溌剌"];
ignoreRecognition(unrecognizedCard);
assert.equal(getEffectiveRecognition(unrecognizedCard).status, "ignored");
assert.equal(buildOverallSkillSummary().ranks.A[0].ownedCount, 0);

clearManualCorrection(unrecognizedCard);
effective = getEffectiveRecognition(unrecognizedCard);
assert.equal(effective.status, "unresolved");
assert.equal(effective.canonicalName, null);
model = buildOverallSkillSummary();
assert.equal(model.ranks.A[0].ownedCount, 0, "補正取消で面数を戻す");
assert.equal(model.ranks.A[0].totalStars, 0, "補正取消で星合計を戻す");

requirements.B = ["風切り"];
setManualCorrection(unrecognizedCard, "溌剌");
model = buildOverallSkillSummary();
assert.equal(model.ranks.A[0].ownedCount, 1, "最初の補正を反映する");
setManualCorrection(unrecognizedCard, "風切り");
model = buildOverallSkillSummary();
assert.equal(model.ranks.A[0].ownedCount, 0, "補正変更で旧スキルを除外する");
assert.equal(model.ranks.B[0].ownedCount, 1, "補正変更で新スキルを反映する");
assert.equal(model.ranks.B[0].totalStars, 2, "補正変更後の星を反映する");
clearManualCorrection(unrecognizedCard);
model = buildOverallSkillSummary();
assert.equal(model.ranks.B[0].ownedCount, 0, "再取消で新スキルを除外する");
setManualCorrection(unrecognizedCard, "溌剌");
clearManualCorrection(unrecognizedCard);
setManualCorrection(unrecognizedCard, "風切り");
model = buildOverallSkillSummary();
assert.equal(model.ranks.A[0].ownedCount, 0, "取消後の旧補正を残さない");
assert.equal(model.ranks.B[0].ownedCount, 1, "取消後の再補正だけを反映する");
clearManualCorrection(unrecognizedCard);

const unrelatedUnresolved = createCard({
  ocrText: "大阪杯",
  ocrFallbackAttempted: false
});
members.grandA1.analysisResults[0].analysis.rightCards.push(unrelatedUnresolved);
assert.equal(getReviewItems().length, 2, "要件外unresolvedも低優先度で保持する");
assert.equal(
  getReviewItems().find(item => item.card === unrelatedUnresolved).priority,
  "low",
  "要件候補の証拠がない因子は低優先度に分類する"
);

const overlapDuplicate = createCard({
  ocrText: "大阪杯",
  ocrFallbackAttempted: false
});
members.grandA1.analysisResults[1].analysis.rightCards.push(overlapDuplicate);
const dedupedReviewItems = getReviewItems();
assert.equal(
  dedupedReviewItems.length,
  2,
  "連結画像の同一候補は確認UI上で重複表示しない"
);
assert.equal(
  dedupedReviewItems.find(item => item.card === unrelatedUnresolved).cards.length,
  2,
  "重複元カードを補正・取り消し用に保持する"
);
const overlapCards = dedupedReviewItems.find(
  item => item.card === unrelatedUnresolved
).cards;
setManualCorrections(overlapCards, "風切り");
assert.ok(
  overlapCards.every(card => card.manualCorrection?.canonicalName === "風切り"),
  "重複カード群へ同じ補正を一括反映する"
);
clearManualCorrections(overlapCards);
assert.ok(
  overlapCards.every(card => !card.manualCorrection),
  "重複カード群の補正を一括取消する"
);

for (const canonicalName of [
  "春の目覚め",
  "冬の目覚め",
  "追込コーナー○"
]) {
  const reviewCard = createCard({
    ocrText: "曖昧OCR",
    finalStatus: "review",
    matchCandidate: "春の目覚め",
    secondMatchCandidate: "秋の目覚め",
    ocrFallbackAttempted: false
  });
  setManualCorrection(reviewCard, canonicalName);
  const reviewEffective = getEffectiveRecognition(reviewCard);
  assert.equal(reviewEffective.status, "confirmed", canonicalName);
  assert.equal(reviewEffective.canonicalName, canonicalName, canonicalName);
  assert.equal(reviewEffective.requirementRank, null, canonicalName);
  assert.equal(reviewCard.finalStatus, "review", "元review状態を保持する");
}

const ambiguousReview = createCard({
  ocrText: "レースの真髄・カ",
  finalStatus: "review",
  matchCandidate: "レースの真髄・体",
  matchSimilarity: 0.875,
  secondMatchCandidate: "レースの真髄・力",
  secondMatchSimilarity: 0.875,
  reviewReason: "ambiguous-similar-candidates"
});
members.grandA1.analysisResults[0].analysis.rightCards.push(ambiguousReview);
const ambiguousReviewItem = getReviewItems().find(
  item => item.card === ambiguousReview
);
assert.equal(
  ambiguousReviewItem.priority,
  "high",
  "曖昧候補reviewは要件ランク外でも高優先度にする"
);
assert.equal(
  ambiguousReviewItem.priorityRank,
  null,
  "閾値未満の要件候補を優先度ランク表示へ使わない"
);

console.log("result model tests: OK");
