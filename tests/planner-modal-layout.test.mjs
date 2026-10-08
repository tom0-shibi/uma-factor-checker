import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const css=fs.readFileSync(new URL('../assets/css/style.css', import.meta.url),'utf8');
test('both FactorSet nested pickers share stable anchored modal geometry',()=>{
  assert.match(css,/\.factor-set-picker-backdrop,\s*\.factor-set-trainee-backdrop\s*\{\s*place-items:\s*start center;\s*overflow:\s*auto;/s);
  assert.match(css,/\.factor-set-picker-backdrop > \.factor-set-picker,\s*\.factor-set-trainee-backdrop > \.factor-set-picker\s*\{[^}]*height:\s*min\(620px, calc\(100% - 48px\)\)/s);
});
test('short picker result lists keep content-sized rows instead of stretching cards',()=>{
  assert.match(css,/grid-auto-rows:\s*max-content/);
  assert.match(css,/\.factor-set-picker-item\s*\{[^}]*align-self:\s*start;[^}]*height:\s*auto;/s);
});
