import assert from "node:assert/strict";
import {
  requirements,
  members,
  MEMBER_ORDER
} from "../assets/js/config.js";
import {
  getEffectiveRecognition,
  setManualCorrection,
  ignoreRecognition,
  clearManualCorrection,
  buildOverallSkillSummary,
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

members.grandA1.images = [{ id: "image-1" }, { id: "image-2" }];
members.grandA1.analysisResults = [
  {
    imageIndex: 0,
    analysis: {
      leftCards: [unrecognizedCard, duplicateLowerStars],
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
assert.equal(getReviewItems().length, 1, "空OCRかつfallback済みのみ表示する");

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

const unrelatedUnresolved = createCard({
  ocrText: "大阪杯",
  ocrFallbackAttempted: false
});
members.grandA1.analysisResults[0].analysis.rightCards.push(unrelatedUnresolved);
assert.equal(getReviewItems().length, 1, "要件外unresolved全件は表示しない");

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

console.log("result model tests: OK");
