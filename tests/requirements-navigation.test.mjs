import assert from "node:assert/strict";

let requirementsAppliedHandler = null;
let imageTabClicks = 0;

const tabButtons = {
  requirements: { dataset: { tab: "requirements" }, click() {} },
  images: { dataset: { tab: "images" }, click() { imageTabClicks += 1; } },
  results: { dataset: { tab: "results" }, click() {} }
};

globalThis.window = {
  scrollTo() {}
};
globalThis.requestAnimationFrame = callback => { callback(); return 1; };

globalThis.document = {
  addEventListener(type, callback) {
    if (type === "requirements-applied") requirementsAppliedHandler = callback;
  },
  querySelector(selector) {
    const match = selector.match(/^\[data-tab="(.+)"\]$/);
    return match ? (tabButtons[match[1]] ?? null) : null;
  },
  getElementById() { return null; }
};

const module = await import(
  new URL(`../assets/js/ui/requirements-navigation.js?test=${Date.now()}`, import.meta.url)
);
module.initializeRequirementsAppliedNavigation();

assert.equal(imageTabClicks, 0, "成功イベント前は継承設定へ遷移しない");
assert.equal(typeof requirementsAppliedHandler, "function");

requirementsAppliedHandler({ detail: { navigateToImages: false } });
assert.equal(imageTabClicks, 0, "内部更新や失敗時は継承設定へ遷移しない");

requirementsAppliedHandler({ detail: { navigateToImages: true } });
assert.equal(imageTabClicks, 1, "正常反映後は既存の継承設定タブをクリックする");

console.log("requirements applied navigation: OK");
