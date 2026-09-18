import assert from "node:assert/strict";
import {
  requirements,
  members,
  MEMBER_ORDER
} from "../assets/js/config.js";
import {
  getEffectiveRecognition,
  aggregateMemberSkills
} from "../assets/js/result/result-model.js";

function createConfirmedCard(canonicalName, factorType, stars, row) {
  return {
    factorType: "white",
    stars,
    column: "left",
    row,
    ocrText: canonicalName,
    finalStatus: "confirmed",
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

const awakeningCard = createConfirmedCard("秋の目覚め", "awakening", 2, 1);
const normalSkillCard = createConfirmedCard("秋ウマ娘○", "skill", 1, 2);

members.parentA.images = [{ id: "image-1" }];
members.parentA.analysisResults = [{
  imageIndex: 0,
  analysis: {
    leftCards: [awakeningCard],
    rightCards: []
  }
}];

requirements.S = ["秋の目覚め"];
requirements.A = [];
requirements.B = [];
requirements.C = [];

let effective = getEffectiveRecognition(awakeningCard);
let aggregated = aggregateMemberSkills("parentA");
assert.equal(effective.canonicalName, "秋の目覚め");
assert.equal(effective.requirementRank, "S");
assert.equal(aggregated.size, 1);
assert.equal(aggregated.get("秋の目覚め").stars, 2);

requirements.S = ["秋ウマ娘○"];
effective = getEffectiveRecognition(awakeningCard);
aggregated = aggregateMemberSkills("parentA");
assert.equal(effective.requirementRank, null);
assert.equal(aggregated.has("秋ウマ娘○"), false);

requirements.S = ["秋ウマ娘○", "秋の目覚め"];
members.parentA.analysisResults[0].analysis.rightCards.push(normalSkillCard);
aggregated = aggregateMemberSkills("parentA");
assert.equal(aggregated.size, 2);
assert.equal(aggregated.get("秋ウマ娘○").stars, 1);
assert.equal(aggregated.get("秋の目覚め").stars, 2);

console.log("awakening requirement tests: OK");
