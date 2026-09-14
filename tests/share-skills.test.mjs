import assert from "node:assert/strict";
import {
  MAX_SHARE_SKILLS,
  createShareSkill,
  initializeShareSkills,
  replaceShareSkillsFromS,
  getShareSkills,
  addShareSkill,
  removeShareSkill,
  clearShareSkills,
  getRequirementSkillCandidates,
  buildShareSkillSummaries,
  getShareSkillLimitWarning
} from "../assets/js/export/share-skills.js";

const sSkills = ["右回り○", "シンパシー", "品行方正", "連綿"];
assert.deepEqual(initializeShareSkills(), [], "初期表示は空にする");
clearShareSkills();
replaceShareSkillsFromS(sSkills);
assert.equal(getShareSkills().length, 4);

const removed = getShareSkills()[1];
assert.equal(removeShareSkill(removed.id), true);
assert.equal(getShareSkills().length, 3);
assert.deepEqual(sSkills, ["右回り○", "シンパシー", "品行方正", "連綿"]);

clearShareSkills();
assert.equal(getShareSkills().length, 0);
replaceShareSkillsFromS(sSkills);
assert.equal(getShareSkills().length, 4);

const candidates = getRequirementSkillCandidates({
  S: ["右回り○"],
  A: ["風切り"],
  B: ["連綿"],
  C: ["右回りの目覚め"]
});
assert.deepEqual(
  candidates.map(item => item.canonicalName),
  ["右回り○", "風切り", "連綿"]
);
assert.equal(addShareSkill("風切り").added, true);
assert.equal(addShareSkill("風切り").reason, "duplicate-skill");

clearShareSkills();
for (let index = 1; index <= MAX_SHARE_SKILLS; index++) {
  assert.equal(addShareSkill(`スキル${index}`).added, true);
}
assert.equal(addShareSkill("11件目").reason, "maximum-share-skills");
assert.equal(getShareSkills().length, 10);

const overLimitS = Array.from(
  { length: 11 },
  (_, index) => `Sスキル${index + 1}`
);
replaceShareSkillsFromS(overLimitS);
assert.equal(getShareSkills().length, 11, "S読み込みでは勝手に切り捨てない");
assert.match(getShareSkillLimitWarning(), /10件を超えています/);

const registeredMemberIds = ["parentA", "grandA1", "parentB"];
const emptyMemberValues = () => ({
  parentA: null,
  grandA1: null,
  parentB: null
});
const model = {
  registeredMemberIds,
  registeredMemberCount: 3,
  ranks: {
    S: [{
      skillName: "右回り○",
      memberValues: {
        ...emptyMemberValues(),
        parentA: { stars: 2 },
        parentB: { stars: 1 }
      }
    }],
    A: [{
      skillName: "右回りの目覚め",
      memberValues: {
        ...emptyMemberValues(),
        grandA1: { stars: 2 },
        parentB: { stars: 3 }
      }
    }],
    B: [{
      skillName: "シンパシー",
      memberValues: emptyMemberValues()
    }],
    C: []
  }
};
const summaries = buildShareSkillSummaries(model, [
  createShareSkill("右回り○"),
  createShareSkill("シンパシー")
]);
assert.equal(summaries[0].canonicalName, "右回り○");
assert.equal(summaries[0].ownedCount, 3);
assert.equal(summaries[0].memberValues.parentB, true, "同一member内をdedupeする");
assert.equal(summaries[1].ownedCount, 0);

const canonicalSummaries = buildShareSkillSummaries(
  model,
  [createShareSkill("右回り○")],
  {
    parentA: new Set(["右回り○", "右回りの目覚め"]),
    grandA1: new Set(["右回りの目覚め"]),
    parentB: new Set()
  }
);
assert.equal(
  canonicalSummaries[0].ownedCount,
  2,
  "共有グループは正式名称集合をmember単位でdedupeする"
);

replaceShareSkillsFromS(["初期S"]);
initializeShareSkills();
assert.deepEqual(
  getShareSkills().map(item => item.canonicalName),
  ["初期S"],
  "自動初期化はプリセット変更で置き換えない"
);

console.log("share skill tests: OK");
