import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const dialog=fs.readFileSync(new URL('../assets/js/library/factor-set-dialog.js', import.meta.url),'utf8');
const css=fs.readFileSync(new URL('../assets/css/style.css', import.meta.url),'utf8');
test('Factor Library chooser character search uses Character Master so hiragana aliases work',()=>{
  assert.match(dialog,/matchedCharacterIds=cq\?new Set\(searchCharacterVariants\(charSearch\.value\.trim\(\),300\)\.map\(v=>v\.characterId\)\)/);
  assert.match(dialog,/matchedCharacterIds\?\.has\(e\.characterId\)/);
});
test('Factor Library chooser header stays anchored while result count changes',()=>{
  assert.match(css,/\.factor-set-picker-backdrop\{place-items:start center;overflow:auto\}/);
  assert.match(css,/\.factor-set-picker-backdrop>\.factor-set-picker\{margin-top:clamp\(24px,8vh,72px\);height:min\(620px,calc\(100% - 48px\)\)/);
});
test('unrelated saved-composition trainee picker is restored to its prior behavior',()=>{
  assert.doesNotMatch(dialog,/function normalizeKanaSearch\(value\)/);
  assert.match(dialog,/function renderTraineePicker\(\)\{const q=traineeSearch\.value\.trim\(\);const items=searchCharacterVariants\(q,60\)/);
  assert.doesNotMatch(css,/FactorSet trainee picker: keep dialog header anchored/);
});
