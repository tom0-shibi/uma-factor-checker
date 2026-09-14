import assert from "node:assert/strict";
import {
  X_POST_CHARACTER_LIMIT,
  formatXShareText,
  countXShareCharacters,
  getXShareLengthWarning
} from "../assets/js/export/x-share.js";

const MEMBER_IDS = [
  "parentA",
  "grandA1",
  "grandA2",
  "parentB",
  "grandB1",
  "grandB2"
];

function createModel(registeredMemberIds) {
  return {
    registeredMemberIds,
    registeredMemberCount: registeredMemberIds.length,
    ranks: {
      S: [
        { skillName: "秋ウマ娘○", ownedCount: Math.min(2, registeredMemberIds.length) },
        { skillName: "シンパシー", ownedCount: 0 }
      ],
      A: [{ skillName: "出力しないA", ownedCount: 1 }],
      B: [],
      C: []
    },
    factorInfo: {
      parentA: {
        blue: { name: "根性", stars: 3 },
        red: { name: "マイル", stars: 2 },
        green: { name: "継承固有", stars: 2 }
      },
      grandA1: {
        blue: { name: "スピード", stars: 2 },
        red: null,
        green: { name: "継承固有", stars: 1 }
      },
      grandA2: { blue: null, red: null, green: null },
      parentB: {
        blue: null,
        red: { name: "追込", stars: 3 },
        green: null
      }
    }
  };
}

const oneMemberText = formatXShareText(
  createModel(["parentA"]),
  "202610_エリ女追込用"
);
assert.match(oneMemberText, /^【因子チェック結果】\n202610_エリ女追込用/);
assert.match(oneMemberText, /秋ウマ娘○ 1\/1/);
assert.match(oneMemberText, /シンパシー 0\/1/);
assert.match(oneMemberText, /親A 根性3 \/ マイル2 \/ 固有2/);
assert.doesNotMatch(oneMemberText, /出力しないA/);

const threeMemberText = formatXShareText(
  createModel(["parentA", "grandA1", "grandA2"]),
  ""
);
assert.doesNotMatch(threeMemberText, /202610_/);
assert.match(threeMemberText, /秋ウマ娘○ 2\/3/);
assert.match(threeMemberText, /シンパシー 0\/3/);
assert.match(threeMemberText, /A祖1 スピード2 \/ 固有1/);
assert.doesNotMatch(threeMemberText, /A祖2 /);

const sixMemberText = formatXShareText(
  createModel(MEMBER_IDS),
  "全員検証"
);
assert.match(sixMemberText, /秋ウマ娘○ 2\/6/);
assert.match(sixMemberText, /シンパシー 0\/6/);
assert.match(sixMemberText, /親B 追込3/);

assert.equal(countXShareCharacters("A😀馬"), 3);
assert.equal(
  getXShareLengthWarning("あ".repeat(X_POST_CHARACTER_LIMIT)),
  ""
);
assert.match(
  getXShareLengthWarning("あ".repeat(X_POST_CHARACTER_LIMIT + 1)),
  /Xの投稿文字数を超える可能性/
);

const manySkillsModel = createModel(["parentA"]);
manySkillsModel.ranks.S = Array.from({ length: 50 }, (_, index) => ({
  skillName: `検証スキル${index + 1}`,
  ownedCount: 0
}));
const manySkillsText = formatXShareText(manySkillsModel);
assert.equal(
  manySkillsText.split("\n").filter(line => line.startsWith("検証スキル")).length,
  50
);
assert.ok(getXShareLengthWarning(manySkillsText));

console.log("X share tests: OK");
