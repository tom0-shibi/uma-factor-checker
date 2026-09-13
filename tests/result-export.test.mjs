import assert from "node:assert/strict";
import {
  buildSpreadsheetExportData,
  formatSpreadsheetTsv,
  formatDiscordSummary,
  getDiscordLengthWarning,
  getSkillJudgment
} from "../assets/js/result/result-export.js";
import {
  createPresetExportData,
  parsePresetImport
} from "../assets/js/preset/preset-import-export.js";

const memberLabels = {
  parentA: "親A",
  parentAGrand1: "親A-祖1",
  parentAGrand2: "親A-祖2",
  parentB: "親B",
  parentBGrand1: "親B-祖1",
  parentBGrand2: "親B-祖2"
};

const memberSummary = Object.keys(memberLabels).map(
  (memberId, index) => ({
    memberId,
    registered: index !== 2,
    counts: {
      S: index === 0 ? 2 : 0,
      A: 0,
      B: 0,
      C: 0
    },
    total: index === 0 ? 2 : 0
  })
);

const memberValues = {
  parentA: { stars: 2 },
  parentAGrand1: { stars: 1 },
  parentAGrand2: null,
  parentB: null,
  parentBGrand1: null,
  parentBGrand2: null
};

const model = {
  memberSummary,
  registeredMemberIds: Object.keys(memberLabels).filter(
    id => id !== "parentAGrand2"
  ),
  registeredMemberCount: 5,
  ranks: {
    S: [{
      rank: "S",
      skillName: "左回り○",
      memberValues,
      ownedCount: 2,
      totalStars: 3
    }],
    A: [{
      rank: "A",
      skillName: "風切り",
      memberValues: Object.fromEntries(
        Object.keys(memberLabels).map(id => [id, null])
      ),
      ownedCount: 0,
      totalStars: 0
    }],
    B: [],
    C: []
  }
};

const data = buildSpreadsheetExportData(model, memberLabels);
const tsv = formatSpreadsheetTsv(data);

assert.match(tsv, /対象ウマ娘\tS\tA\tB\tC\t判定件数/);
assert.match(tsv, /親A-祖2\t-\t-\t-\t-\t-/);
assert.match(
  tsv,
  /S\t左回り○\t2\t1\t-\t0\t0\t0\t2\t1\t3面未満\t3/
);
assert.ok(tsv.indexOf("S\t左回り○") < tsv.indexOf("A\t風切り"));
assert.deepEqual(getSkillJudgment(6, 1), {
  remaining: 2,
  judgment: "3面未満"
});
assert.deepEqual(getSkillJudgment(6, 3), {
  remaining: 0,
  judgment: "OK"
});
assert.deepEqual(getSkillJudgment(2, 1), {
  remaining: "-",
  judgment: "判定対象不足"
});

const discord = formatDiscordSummary(
  model,
  memberLabels,
  "検証用"
);
assert.match(discord, /\* プリセット：検証用/);
assert.doesNotMatch(discord, /親A-祖2：S/);
assert.match(discord, /\* \*\*左回り○：2\/5面\*\*/);
assert.match(discord, /親A ★★ \/ 親A-祖1 ★/);
assert.equal(getDiscordLengthWarning("a".repeat(2000)), "");
assert.equal(
  getDiscordLengthWarning("a".repeat(2001)),
  "Discordの1メッセージ上限を超えています。"
);

const presetA = {
  name: "A",
  skills: { S: ["左回り○"], A: [], B: [], C: [] }
};
const presetB = {
  name: "B",
  skills: { S: [], A: ["風切り"], B: [], C: [] }
};
const exported = createPresetExportData([presetA]);
assert.equal(exported.presets.length, 1);
assert.equal(exported.presets[0].name, "A");
assert.doesNotMatch(JSON.stringify(exported), /"name":"B"/);
assert.deepEqual(
  parsePresetImport(JSON.stringify(exported)),
  [presetA]
);
assert.equal(createPresetExportData([presetB]).presets[0].name, "B");

console.log("result export tests: OK");
