import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { members, requirements } from "../assets/js/config.js";
import { aggregateMemberSkills, buildMemberFactorInfo, getRegisteredMemberIds } from "../assets/js/result/result-model.js";

for (const rank of ["S","A","B","C"]) requirements[rank] = [];
requirements.S = ["末脚"];
const member = members.parentA;
member.images = [];
member.analysisResults = [];
member.source = "library";
member.libraryEntry = { id:"entry_source_test", displayName:"保存個体", factors:[
  { factorId:"skill_0008", nameSnapshot:"末脚", color:"white", type:"skill", stars:3 },
  { factorId:"blue_speed", nameSnapshot:"スピード", color:"blue", type:"base", stars:2 }
] };
assert.ok(getRegisteredMemberIds().includes("parentA"), "Library由来の枠も設定済みとして扱う");
assert.equal(aggregateMemberSkills("parentA").get("末脚")?.stars, 3, "Library因子をOCRへ偽装せず要件集計へ使う");
assert.equal(buildMemberFactorInfo().parentA.blue?.stars, 2, "Libraryの色因子を因子情報へ使う");
const configSource = await fs.readFile(new URL("../assets/js/config.js", import.meta.url), "utf8");
const uiSource = await fs.readFile(new URL("../assets/js/library/inheritance-source-ui.js", import.meta.url), "utf8");
const appSource = await fs.readFile(new URL("../assets/js/app.js", import.meta.url), "utf8");
assert.match(configSource, /source: "unset"[\s\S]*libraryEntry: null/, "6枠は入力元とLibraryデータを独立保持する");
assert.match(uiSource, /因子ライブラリから選択/, "各枠にLibrary選択導線がある");
assert.match(uiSource, /保存済み編成から読み込む/, "保存済み編成の一括読込導線がある");
assert.match(appSource, /totalImages === 0[\s\S]*renderOverallSkillSummary/, "LibraryのみならOCRせず確認へ進む");
