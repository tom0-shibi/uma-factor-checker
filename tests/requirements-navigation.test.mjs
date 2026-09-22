import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(
  new URL("../assets/js/ui/requirements-navigation.js", import.meta.url),
  "utf8"
);
const module = await import(
  `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`
);

let requirementsAppliedHandler = null;
let imageTabClicks = 0;

globalThis.document = {
  addEventListener(type, callback) {
    if (type === "requirements-applied") {
      requirementsAppliedHandler = callback;
    }
  },
  querySelector(selector) {
    if (selector !== '[data-tab="images"]') {
      return null;
    }

    return {
      click() {
        imageTabClicks += 1;
      }
    };
  }
};

module.initializeRequirementsAppliedNavigation();

assert.equal(imageTabClicks, 0, "成功イベント前は画像登録へ遷移しない");
assert.equal(typeof requirementsAppliedHandler, "function");

requirementsAppliedHandler({ detail: { navigateToImages: false } });
assert.equal(imageTabClicks, 0, "内部更新や失敗時は画像登録へ遷移しない");

requirementsAppliedHandler({ detail: { navigateToImages: true } });
assert.equal(imageTabClicks, 1, "正常反映後は既存の画像登録タブをクリックする");

console.log("requirements applied navigation: OK");
