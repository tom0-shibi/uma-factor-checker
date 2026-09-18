import assert from "node:assert/strict";
import {
  requirements,
  members,
  MEMBER_ORDER
} from "../assets/js/config.js";
import {
  AWAKENING_REQUIREMENT_SUBSTITUTIONS
} from "../assets/js/matching/awakening-substitution.js";
import {
  getEffectiveRecognition,
  aggregateMemberSkills
} from "../assets/js/result/result-model.js";

function createConfirmedCard(canonicalName, factorType, stars) {
  return {
    factorType: "white",
    stars,
    column: "left",
    row: 1,
    ocrText: canonicalName,
    finalStatus: "confirmed",
    factorFinalStatus: "recognized-non-requirement",
    canonicalName,
    canonicalFactorType: factorType,
    requirementRank: null,
    ocrFallbackAttempted: false,
    ocrFallbackUsed: false
  };
}

MEMBER_ORDER.forEach(memberId => {
  members[memberId].images = [];
  members[memberId].analysisResults = [];
});

requirements.S = ["秋ウマ娘○"];
requirements.A = [];
requirements.B = [];
requirements.C = [];

assert.deepEqual(AWAKENING_REQUIREMENT_SUBSTITUTIONS, {
  "右回りの目覚め": "右回り○",
  "左回りの目覚め": "左回り○",
  "春の目覚め": "春ウマ娘○",
  "夏の目覚め": "夏ウマ娘○",
  "秋の目覚め": "秋ウマ娘○",
  "冬の目覚め": "冬ウマ娘○"
});

const awakeningCard = createConfirmedCard("秋の目覚め", "awakening", 2);
let effective = getEffectiveRecognition(awakeningCard);
assert.equal(effective.canonicalName, "秋の目覚め");
assert.equal(effective.requirementLookupName, "秋ウマ娘○");
assert.equal(effective.requirementRank, "S");
assert.equal(effective.substitution, "awakening");

members.parentA.images = [{ id: "image-1" }];
members.parentA.analysisResults = [{
  imageIndex: 0,
  analysis: {
    leftCards: [awakeningCard],
    rightCards: []
  }
}];

let aggregated = aggregateMemberSkills("parentA");
assert.equal(aggregated.size, 1);
assert.equal(aggregated.get("秋ウマ娘○").skillName, "秋ウマ娘○");
assert.equal(aggregated.get("秋ウマ娘○").canonicalName, "秋の目覚め");
assert.equal(aggregated.get("秋ウマ娘○").stars, 2);

const normalCard = createConfirmedCard("秋ウマ娘○", "skill", 3);
members.parentA.analysisResults[0].analysis.rightCards.push(normalCard);
aggregated = aggregateMemberSkills("parentA");
assert.equal(aggregated.size, 1, "通常因子と目覚め因子を同一memberで重複集計しない");
assert.equal(aggregated.get("秋ウマ娘○").stars, 3, "既存仕様どおり最大星数を採用する");

requirements.S = [];
effective = getEffectiveRecognition(awakeningCard);
assert.equal(effective.status, "confirmed");
assert.equal(effective.requirementLookupName, "秋ウマ娘○");
assert.equal(effective.requirementRank, null);
assert.equal(aggregateMemberSkills("parentA").size, 0);

console.log("awakening substitution tests: OK");
