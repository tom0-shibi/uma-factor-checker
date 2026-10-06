import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const source = fs.readFileSync(new URL("../assets/js/ui/requirements-navigation.js", import.meta.url), "utf8");
const css = fs.readFileSync(new URL("../assets/css/style.css", import.meta.url), "utf8");

test("Planner workflow guards later steps and guides the owner back to prerequisites", () => {
  assert.match(source, /hasAppliedRequirements/);
  assert.match(source, /tabId === "results" && !hasInheritanceData\(\)/);
  assert.match(source, /openTab\("requirements"\)/);
  assert.match(source, /openTab\("images"\)/);
  assert.match(source, /スキル要件を設定して「スキル要件を反映」/);
  assert.match(source, /先に継承ウマ娘を設定してください/);
  assert.match(source, /addEventListener\("click", guardWorkflowTabClick, true\)/);
  assert.match(css, /\.workflow-navigation-notice/);
});
