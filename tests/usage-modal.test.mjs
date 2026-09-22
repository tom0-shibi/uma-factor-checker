import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";

const source = await readFile(
  new URL("../assets/js/ui/usage-modal.js", import.meta.url),
  "utf8"
);
const module = await import(
  `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`
);

function createElement(id = "") {
  return {
    id,
    hidden: true,
    handlers: {},
    attributes: {},
    focused: false,
    addEventListener(type, callback) {
      this.handlers[type] = callback;
    },
    setAttribute(name, value) {
      this.attributes[name] = value;
    },
    focus() {
      this.focused = true;
    }
  };
}

const openButton = createElement("usage-open");
const backdrop = createElement("usage-modal");
const dialog = createElement();
const closeButton = createElement("usage-close");
const keyHandlers = {};
const bodyClasses = new Set();

backdrop.querySelector = selector => (
  selector === ".usage-modal" ? dialog : null
);

globalThis.document = {
  activeElement: openButton,
  body: {
    classList: {
      add: value => bodyClasses.add(value),
      remove: value => bodyClasses.delete(value)
    }
  },
  getElementById(id) {
    return {
      "usage-open": openButton,
      "usage-modal": backdrop,
      "usage-close": closeButton
    }[id] ?? null;
  },
  addEventListener(type, callback) {
    keyHandlers[type] = callback;
  }
};

module.initializeUsageModal();

openButton.handlers.click();
assert.equal(backdrop.hidden, false);
assert.equal(openButton.attributes["aria-expanded"], "true");
assert.equal(bodyClasses.has("usage-modal-open"), true);
assert.equal(closeButton.focused, true);

backdrop.handlers.click({ target: backdrop });
assert.equal(backdrop.hidden, true);
assert.equal(openButton.attributes["aria-expanded"], "false");
assert.equal(openButton.focused, true);

openButton.handlers.click();
keyHandlers.keydown({ key: "Escape" });
assert.equal(backdrop.hidden, true);

openButton.handlers.click();
closeButton.handlers.click();
assert.equal(backdrop.hidden, true);

const html = await readFile(
  new URL("../index.html", import.meta.url),
  "utf8"
);

assert.equal((html.match(/id="usage-open"/g) ?? []).length, 1);
assert.equal((html.match(/id="usage-modal"/g) ?? []).length, 1);
assert.doesNotMatch(html, /<summary>？ 使い方<\/summary>/);

for (const id of [
  "requirements",
  "images",
  "results",
  "preset-select",
  "apply-requirements",
  "member-grid",
  "analyze-images",
  "theme-select"
]) {
  assert.match(html, new RegExp(`id="${id}"`));
}

const asset = await stat(
  new URL("../assets/images/uma-factor-header-silhouette.png", import.meta.url)
);
assert.ok(asset.size > 0);

console.log("usage modal behavior, unique entry, main controls and header asset: OK");
