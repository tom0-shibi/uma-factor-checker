import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
const src = await readFile(new URL("../assets/js/library/factor-set-dialog.js", import.meta.url), "utf8");
test("Factor Library chooser renders memo before assignment badge", () => {
  const memo = src.indexOf('${e.memo?`<small>${esc(e.memo)}</small>`:""}');
  const badge = src.indexOf('${assigned.length?`<span class="factor-set-assigned-badge">');
  assert.ok(memo >= 0, "memo rendering is present");
  assert.ok(badge >= 0, "assignment badge rendering is present");
  assert.ok(memo < badge, "memo must render before assignment badge");
});
