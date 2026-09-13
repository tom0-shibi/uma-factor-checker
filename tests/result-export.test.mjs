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
assert.match(discord, /\* A系｜親 `S2 A0 B0 C0` \/ 祖1 `S0 A0 B0 C0`/);
assert.match(discord, /\* B系｜親 `S0 A0 B0 C0`/);
assert.doesNotMatch(discord, /A系[^\n]*祖2/);
assert.match(discord, /\* \*\*左回り○\*\* `2\/5`｜親A ★★ \/ A祖1 ★/);
assert.doesNotMatch(discord, /\* \*\*風切り\*\*/);
assert.equal(
  discord.split("\n").filter(line => line.startsWith("* A系｜")).length,
  1
);
assert.equal(
  discord.split("\n").filter(line => line.startsWith("* B系｜")).length,
  1
);

const sixMemberDiscord = formatDiscordSummary(
  {
    ...model,
    memberSummary: model.memberSummary.map(item => ({
      ...item,
      registered: true
    })),
    registeredMemberIds: Object.keys(memberLabels),
    registeredMemberCount: 6
  },
  memberLabels,
  "検証用"
);
assert.equal(
  sixMemberDiscord
    .split("\n")
    .filter(line => /\* [AB]系｜/.test(line))
    .length,
  2
);

const parentAOnlyModel = {
  ...model,
  memberSummary: model.memberSummary.map(item => ({
    ...item,
    registered: item.memberId === "parentA"
  })),
  registeredMemberIds: ["parentA"],
  registeredMemberCount: 1,
  ranks: {
    ...model.ranks,
    S: [{
      ...model.ranks.S[0],
      memberValues: {
        ...model.ranks.S[0].memberValues,
        parentAGrand1: null
      },
      ownedCount: 1,
      totalStars: 2
    }]
  }
};
const parentAOnlyDiscord = formatDiscordSummary(
  parentAOnlyModel,
  memberLabels,
  "検証用"
);
assert.match(parentAOnlyDiscord, /\* A系｜親 `S2 A0 B0 C0`/);
assert.doesNotMatch(parentAOnlyDiscord, /\* B系｜/);
assert.match(parentAOnlyDiscord, /\* \*\*左回り○\*\* `1\/1`｜親A ★★/);
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
