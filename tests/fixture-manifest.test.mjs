import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const fixtureRoot = fileURLToPath(
  new URL("./fixtures/factor-images/", import.meta.url)
);
const manifest = JSON.parse(
  await readFile(
    path.join(fixtureRoot, "expected.json"),
    "utf8"
  )
);

assert.equal(manifest.version, 1);

const expectedNames = Object.keys(manifest.fixtures).sort();
const actualNames = (
  await Promise.all(
    ["supported", "unsupported"].map(async category =>
      (await readdir(path.join(fixtureRoot, category)))
        .filter(name => name.endsWith(".png"))
    )
  )
).flat().sort();

assert.deepEqual(actualNames, expectedNames);

let skipped = 0;
for (const [name, fixture] of Object.entries(manifest.fixtures)) {
  assert.ok(["supported", "unsupported"].includes(fixture.category));
  assert.equal(typeof fixture.description, "string");
  assert.equal(typeof fixture.expected.supported, "boolean");
  assert.equal(typeof fixture.expected.layout, "string");

  const filePath = path.join(
    fixtureRoot,
    fixture.category,
    name
  );
  const signature = await readFile(filePath);
  assert.deepEqual(
    [...signature.subarray(0, 8)],
    [137, 80, 78, 71, 13, 10, 26, 10],
    `${name} must be a PNG`
  );

  if (!fixture.ready) {
    skipped++;
    continue;
  }

  throw new Error(
    `${name} is ready, but pixel analysis is not connected to this manifest test yet.`
  );
}

assert.equal(skipped, expectedNames.length);
console.log(`fixture manifest tests: OK (${skipped} placeholders skipped)`);
