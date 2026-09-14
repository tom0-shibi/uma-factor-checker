import assert from "node:assert/strict";
import {
  buildSpreadsheetExportData,
  formatSpreadsheetTsv,
  formatStars,
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
  grandA1: "親A-祖1",
  grandA2: "親A-祖2",
  parentB: "親B",
  grandB1: "親B-祖1",
  grandB2: "親B-祖2"
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
  grandA1: { stars: 1 },
  grandA2: null,
  parentB: null,
  grandB1: null,
  grandB2: null
};

const model = {
  memberSummary,
  registeredMemberIds: Object.keys(memberLabels).filter(
    id => id !== "grandA2"
  ),
  registeredMemberCount: 5,
  factorInfo: {
    parentA: {
      blue: { name: "スピード", stars: 3 },
      red: { name: "マイル", stars: 2 },
      green: { name: "継承固有", stars: 2 }
    },
    grandA1: {
      blue: { name: "パワー", stars: 2 },
      red: null,
      green: null
    }
  },
  ranks: {
    S: [
      {
        rank: "S",
        skillName: "左回り○",
        memberValues,
        ownedCount: 2,
        totalStars: 3
      },
      {
        rank: "S",
        skillName: "シンパシー",
        memberValues: Object.fromEntries(
          Object.keys(memberLabels).map(id => [id, null])
        ),
        ownedCount: 0,
        totalStars: 0
      }
    ],
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
assert.match(discord, /\* \*\*合計\*\*｜S: `2` \/ A: `0` \/ B: `0` \/ C: `0`｜判定件数: `2`/);
assert.match(discord, /\* 親A｜S: `2` \/ A: `0` \/ B: `0` \/ C: `0`/);
assert.match(discord, /\* A祖1｜S: `0` \/ A: `0` \/ B: `0` \/ C: `0`/);
assert.match(discord, /\* 親B｜S: `0` \/ A: `0` \/ B: `0` \/ C: `0`/);
assert.doesNotMatch(discord, /\* A祖2｜/);
assert.doesNotMatch(discord, /A系|B系/);
assert.match(discord, /\* \*\*左回り○\*\* `2\/5`｜親A ★★☆ \/ A祖1 ★☆☆/);
assert.match(discord, /\* \*\*シンパシー\*\* `0\/5`/);
assert.ok(
  discord.indexOf("**左回り○**") <
  discord.indexOf("**シンパシー**")
);
assert.equal(
  discord.split("\n").filter(line => line.startsWith("* 親A｜S:")).length,
  1
);
assert.equal(
  discord.split("\n").filter(line => line.startsWith("* 親B｜S:")).length,
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
    .filter(line => /^\* (親[AB]|[AB]祖[12])｜S:/.test(line))
    .length,
  6
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
        grandA1: null
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
assert.match(parentAOnlyDiscord, /\* 親A｜S: `2` \/ A: `0` \/ B: `0` \/ C: `0`/);
assert.doesNotMatch(parentAOnlyDiscord, /\* 親B｜/);
assert.match(parentAOnlyDiscord, /\* \*\*左回り○\*\* `1\/1`｜親A ★★☆/);
assert.match(discord, /### ■ 因子情報/);
assert.match(discord, /\* 親A｜青: スピード ★★★ \/ 赤: マイル ★★☆ \/ 緑: 継承固有 ★★☆/);
assert.match(discord, /\* A祖1｜青: パワー ★★☆/);
assert.equal(formatStars(1), "★☆☆");
assert.equal(formatStars(2), "★★☆");
assert.equal(formatStars(3), "★★★");
assert.equal(formatStars(0), "");
assert.equal(getDiscordLengthWarning("a".repeat(2000)), "");
assert.equal(
  getDiscordLengthWarning("a".repeat(2001)),
  "Discordの1メッセージ上限（2000文字）を超えています。Sスキル数を減らすか、内容を分けて投稿してください。"
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
