import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";

const root = new URL(
  "./fixtures/factor-images/layout-20260921/",
  import.meta.url
);

const manifest = JSON.parse(
  await readFile(new URL("expected.json", root), "utf8")
);

assert.equal(Object.keys(manifest.fixtures).length, 4);

for (const [filename, expected] of Object.entries(manifest.fixtures)) {
  const fixture = await stat(new URL(filename, root));
  assert.ok(fixture.size > 0, `${filename} must not be empty`);
  assert.equal(expected.supported, true);
  assert.match(expected.layout, /^factor-list-(start|continuation)$/);
  assert.ok(expected.leftCount >= 5);
  assert.ok(expected.rightCount >= 5);
  assert.ok(expected.whiteCardCount > 0);
}

console.log("adaptive layout fixture tests: OK (4 real images)");
