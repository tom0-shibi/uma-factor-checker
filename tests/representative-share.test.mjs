import assert from "node:assert/strict";
import {
  sanitizeTrainerId,
  buildRepresentativeSkillSummaries,
  formatRepresentativeXText
} from "../assets/js/representative/representative-share.js";

assert.equal(sanitizeTrainerId("１２３ ４５６-７８９ ０１２"), "123456789012");
assert.equal(sanitizeTrainerId("123456789012999"), "123456789012");

const selectedSkills = [
  {
    id: "skill:秋ウマ娘○",
    canonicalName: "秋ウマ娘○",
    memberCanonicalNames: ["秋ウマ娘○"]
  },
  {
    id: "skill:シンパシー",
    canonicalName: "シンパシー",
    memberCanonicalNames: ["シンパシー"]
  }
];
const summaries = buildRepresentativeSkillSummaries(
  ["target", "parentA", "parentB"],
  selectedSkills,
  {
    target: new Set(["秋ウマ娘○"]),
    parentA: new Set(),
    parentB: new Set(["秋ウマ娘○"])
  }
);
assert.equal(summaries[0].ownedCount, 2);
assert.equal(summaries[1].ownedCount, 0);

const withId = formatRepresentativeXText({
  title: "202609チャンミ因子",
  trainerId: "123 456 789 012",
  showTrainerId: true,
  skillSummaries: summaries
});
assert.equal(
  withId,
  [
    "202609チャンミ因子",
    "トレーナーID: 123456789012",
    "",
    "■ 主な因子",
    "秋ウマ娘○ 2面",
    "シンパシー 0面"
  ].join("\n")
);
assert.doesNotMatch(withId, /【因子チェック結果】|\d\/3|■ 因子|根性|マイル/);

const withoutId = formatRepresentativeXText({
  title: "検証用",
  trainerId: "123456789012",
  showTrainerId: false,
  skillSummaries: summaries
});
assert.doesNotMatch(withoutId, /トレーナーID/);

console.log("representative share tests: OK");
