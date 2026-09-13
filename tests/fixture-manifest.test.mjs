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
  const isPng = signature.subarray(0, 8).equals(
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
  );
  const isJpeg = signature.subarray(0, 3).equals(
    Buffer.from([255, 216, 255])
  );
  assert.ok(isPng || isJpeg, `${name} must be a PNG or JPEG image`);
  assert.equal(fixture.ready, true, `${name} must use a real fixture`);
}

assert.equal(expectedNames.length, 6);
console.log("fixture manifest tests: OK (6 real images)");
