import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const read = path => readFile(new URL(path, root), "utf8");

test("Planner navigation names the three-step workflow and exposes common saved-data tools", async () => {
  const [html, libraryUi, setUi, setDialog] = await Promise.all([
    read("index.html"),
    read("assets/js/library/factor-library-ui.js"),
    read("assets/js/library/factor-set-ui.js"),
    read("assets/js/library/factor-set-dialog.js")
  ]);
  assert.match(html, /Uma Factor<\/span> <strong>Planner<\/strong>/);
  assert.match(html, /data-tab="requirements">スキル要件/);
  assert.match(html, /data-tab="images">継承設定/);
  assert.match(html, /data-tab="results">継承プラン確認/);
  assert.match(html, /id="common-data-actions"/);
  assert.match(libraryUi, /common-data-actions/);
  assert.match(libraryUi, /因子ライブラリ/);
  assert.doesNotMatch(libraryUi, /results\.insertBefore/);
  assert.match(setUi, /common-data-actions/);
  assert.match(setUi, /保存済み編成/);
  assert.match(setDialog, /factor-set-title">保存済み編成/);
});
