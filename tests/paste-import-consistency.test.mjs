import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const UI_VERSION = "20260921-duplicate-paste-01";
const filesImportingUi = [
  "../assets/js/app.js",
  "../assets/js/result/results.js",
  "../assets/js/preset/preset-manager.js",
  "../assets/js/dev/fixtures.js",
  "../assets/js/ocr/ocr.js"
];

for (const filename of filesImportingUi) {
  const source = await readFile(
    new URL(filename, import.meta.url),
    "utf8"
  );
  const uiImports = [
    ...source.matchAll(
      /["']([^"']*ui\/ui\.js\?v=([^"']+))["']/g
    )
  ];

  assert.ok(
    uiImports.length > 0,
    `${filename} must import ui.js with a cache version`
  );
  uiImports.forEach(match => {
    assert.equal(
      match[2],
      UI_VERSION,
      `${filename} must share one ui.js module URL`
    );
  });
}

const appSource = await readFile(
  new URL("../assets/js/app.js", import.meta.url),
  "utf8"
);

for (const dependency of [
  "ocr/ocr.js",
  "result/results.js",
  "preset/preset-manager.js",
  "dev/fixtures.js"
]) {
  assert.match(
    appSource,
    new RegExp(
      `${dependency.replaceAll("/", "\\/")}\\?v=${UI_VERSION}`
    ),
    `${dependency} must be cache-busted with the unified dependency graph`
  );
}

console.log("paste dependency graph uses one ui.js module URL: OK");
