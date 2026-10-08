import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const sourceUi = await readFile(new URL("../assets/js/library/inheritance-source-ui.js", import.meta.url), "utf8");
const ui = await readFile(new URL("../assets/js/ui/ui.js", import.meta.url), "utf8");
const css = await readFile(new URL("../assets/css/style.css", import.meta.url), "utf8");

assert.match(sourceUi, /inheritance-source-change/);
assert.match(sourceUi, /inheritance-source-delete/);
assert.match(sourceUi, /変更/);
assert.match(sourceUi, /削除/);
assert.match(sourceUi, /inheritance-image-source-selected/);
assert.match(ui, /openMemberImagePreview/);
assert.match(ui, /ArrowLeft/);
assert.match(ui, /ArrowRight/);
assert.match(ui, /inheritance-image-source-selected/);
assert.match(css, /member-image-preview-backdrop/);
assert.match(css, /grid-template-columns: repeat\(3, minmax\(0, 1fr\)\)/);
console.log("inheritance setup UI tests: OK");

// v9.1 browser-check regressions
assert.match(sourceUi, /inheritance-source-character-name/);
assert.match(sourceUi, /inheritance-source-tags/);
assert.match(sourceUi, /inheritance-source-memo/);
assert.match(sourceUi, /variant\?\.characterName/);
assert.match(ui, /event\.target\.closest\?\.\("\.image-file-input"\)/);
assert.match(css, /\.member-image-preview-stage img[\s\S]*width: 100%/);
assert.match(css, /\.inheritance-source-memo[\s\S]*white-space: nowrap/);


// v9.2 browser-check regressions
assert.match(sourceUi, /entry\.displayName \|\| entry\.nameSnapshot/);
assert.match(sourceUi, /inheritance-source-character-name[^>]*title=/);
assert.match(ui, /function normalizeImageFiles/);
assert.match(ui, /if \(!unique\.has\(key\)\) unique\.set\(key, file\)/);
assert.match(css, /\.member-image-preview-stage \{[\s\S]*grid-column: 2/);
assert.match(css, /\.inheritance-source-character-name \{[\s\S]*grid-column: 1 \/ -1/);


// v9.3 duplicate-handler root cause + ancestor name readability
const app = await readFile(new URL("../assets/js/app.js", import.meta.url), "utf8");
assert.match(app, /ui\/ui\.js\?v=20260921-duplicate-paste-01/);
assert.match(sourceUi, /ui\/ui\.js\?v=20260921-duplicate-paste-01/);
assert.doesNotMatch(sourceUi, /from ["']\.\.\/ui\/ui\.js["']/);
assert.match(css, /\.inheritance-source-character-name[\s\S]*?-webkit-line-clamp:\s*2/);
assert.match(css, /\.family-parent \.inheritance-source-character-name[\s\S]*?font-size:\s*\.88rem/);
assert.match(css, /\.family-ancestors \.inheritance-source-character-name[\s\S]*?font-size:\s*\.76rem/);
console.log("inheritance setup UI v9.3 tests: OK");
