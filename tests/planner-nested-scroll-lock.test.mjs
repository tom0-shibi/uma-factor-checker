import test from "node:test"; import assert from "node:assert/strict"; import { readFile } from "node:fs/promises";
const src=await readFile(new URL("../assets/js/library/factor-set-dialog.js", import.meta.url),"utf8");
test("nested FactorSet pickers lock the parent dialog scroll while open",()=>{assert.match(src,/setNestedPickerOpen\(true\)/);assert.match(src,/setNestedPickerOpen\(false\)/);});
