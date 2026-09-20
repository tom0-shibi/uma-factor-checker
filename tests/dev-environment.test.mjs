import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

async function setup(hostname, protocol = "http:") {
  const elements = new Map();
  const makeElement = () => ({
    hidden: true, disabled: false, children: [], handlers: {}, dataset: {},
    classList: { add() {}, remove() {}, toggle() {} },
    addEventListener(type, callback) { this.handlers[type] = callback; },
    appendChild(child) { this.children.push(child); },
    set innerHTML(value) { this.children = []; }
  });
  const element = id => {
    if (!elements.has(id)) elements.set(id, makeElement());
    return elements.get(id);
  };
  const input = makeElement();
  input.dataset.member = "parentA";
  const documentHandlers = {};
  const revoked = [];
  let sequence = 0;
  class TestURL extends URL {
    static createObjectURL() {
      if (context.failAllocation && sequence >= context.failAllocation) {
        throw new Error("allocation failed");
      }
      return `blob:${++sequence}`;
    }
    static revokeObjectURL(url) { revoked.push(url); }
  }
  const context = vm.createContext({
    location: { hostname, protocol }, console, File, Blob, URL: TestURL,
    document: {
      getElementById: element,
      querySelectorAll: selector => selector === ".image-file-input" ? [input] : [],
      querySelector: () => null,
      createElement: makeElement,
      addEventListener(type, callback) { documentHandlers[type] = callback; }
    },
    fetch: async url => {
      if (String(url).includes(context.missing || "never-missing")) {
        return { ok: false, status: 404 };
      }
      const bytes = await readFile(url);
      return { ok: true, blob: async () => new Blob([bytes]) };
    },
    createImageBitmap: async blob => {
      if (context.corrupt) throw new Error("decode failed");
      const bytes = new Uint8Array(await blob.arrayBuffer());
      assert.ok(bytes[0] === 137 || (bytes[0] === 255 && bytes[1] === 216));
      return { close() {} };
    }
  });
  const modules = new Map();
  async function load(url) {
    url = new URL(url);
    url.search = "";
    const key = url.href;
    if (!modules.has(key)) {
      const module = new vm.SourceTextModule(await readFile(url, "utf8"), {
        context, identifier: key,
        initializeImportMeta(meta) { meta.url = key; }
      });
      modules.set(key, module);
    }
    return modules.get(key);
  }
  const fixtures = await load(new URL("../assets/js/dev/fixtures.js", import.meta.url));
  await fixtures.link((specifier, parent) => load(new URL(specifier, parent.identifier)));
  await fixtures.evaluate();
  const get = name => modules.get(new URL(`../assets/js/${name}`, import.meta.url).href).namespace;
  return { context, element, input, revoked, documentHandlers,
    resetBlobState() { sequence = 0; revoked.length = 0; },
    fixtures: fixtures.namespace, config: get("config.js"),
    ui: get("ui/ui.js"), environment: get("environment.js") };
}

for (const [host, protocol, expected] of [
  ["localhost", "http:", "dev"], ["127.0.0.1", "http:", "dev"],
  ["[::1]", "https:", "dev"], ["example.github.io", "https:", "pro"],
  ["custom.example", "https:", "pro"], ["localhost.evil.example", "http:", "pro"],
  ["localhost", "file:", "pro"]
]) {
  const app = await setup(host, protocol);
  assert.equal(app.environment.APP_ENV, expected);
  if (expected === "pro") {
    app.fixtures.initializeFixtureControls();
    assert.equal(app.element("dev-controls").hidden, true);
    await assert.rejects(app.fixtures.loadFixtureFiles(), /dev/);
    assert.throws(() => app.ui.replaceImagesForDevelopment({}), /dev/);
    app.config.debugLogLines.push("secret");
    assert.equal(app.config.debugLogLines.length, 0);
  }
}

const app = await setup("localhost");
const { members, MEMBER_ORDER, analysisProgress } = app.config;
app.element("skill-check-workspace").hidden = false;
const clipboardFile = new File(["paste"], "paste.png", { type: "image/png" });
const clipboardItem = file => ({
  kind: "file",
  type: file.type,
  getAsFile: () => file
});
const paste = files => app.documentHandlers.paste({
  clipboardData: { items: files.map(clipboardItem) },
  preventDefault() {}
});

paste([clipboardFile]);
assert.equal(members.parentA.images.length, 1);
paste([clipboardFile]);
assert.equal(members.parentA.images.length, 2);

members.parentA.images = [];
paste([
  new File(["first"], "first.png", { type: "image/png" }),
  new File(["second"], "second.png", { type: "image/png" })
]);
assert.equal(members.parentA.images.length, 2);
members.parentA.images = [];
app.resetBlobState();
// Exercise the normal file-selection listener before fixture replacement.
app.input.handlers.change({ target: { files: [new File(["old"], "old.png", { type: "image/png" })] } });
assert.equal(members.parentA.images.length, 1);
const previous = members.parentA.images;
app.fixtures.initializeFixtureControls();
const button = app.element("set-test-images");
app.context.missing = "grand-b2-02";
await button.handlers.click();
assert.equal(members.parentA.images, previous);
assert.match(app.element("test-images-status").textContent, /HTTP 404/);
app.context.missing = "";
app.context.corrupt = true;
await button.handlers.click();
assert.equal(members.parentA.images, previous);
app.context.corrupt = false;
app.context.failAllocation = 4;
await button.handlers.click();
assert.equal(members.parentA.images, previous);
assert.ok(app.revoked.includes("blob:2"));
assert.ok(app.revoked.includes("blob:4"));
app.context.failAllocation = false;
await button.handlers.click();
assert.match(app.element("test-images-status").textContent, /10枚を6枠/);
assert.deepEqual(Array.from(MEMBER_ORDER, id => members[id].images.length), [2, 1, 2, 2, 1, 2]);
assert.equal(app.element("total-image-count").textContent, 10);
assert.equal(app.element("skill-registered-face-count").textContent, "6面");
assert.equal(analysisProgress.active, false);
assert.equal(app.element("analyze-images").disabled, false);
assert.ok(app.revoked.includes(previous[0].url));
for (const id of MEMBER_ORDER) {
  for (const image of members[id].images) {
    const original = await readFile(new URL(`./fixtures/factor-images/regression-20260916/${image.file.name}`, import.meta.url));
    assert.deepEqual(Buffer.from(await image.file.arrayBuffer()), original);
    assert.equal(image.file.type, "image/jpeg");
  }
  const names = app.fixtures.FIXTURE_ASSIGNMENTS[id];
  assert.deepEqual(Array.from(members[id].images, image => image.file.name),
    Array.from(names, name => `skill-check-${name}.png`));
}
await button.handlers.click();
assert.equal(app.element("total-image-count").textContent, 10);
const replaced = members.parentA.images;
analysisProgress.active = true;
await button.handlers.click();
assert.equal(members.parentA.images, replaced);
assert.throws(() => app.ui.replaceImagesForDevelopment({}), /解析停止中/);
analysisProgress.active = false;
// Existing preview delete controls still work after replacement.
app.element("preview-parentA").children[0].children[2].handlers.click({ stopPropagation() {} });
assert.equal(members.parentA.images.length, 1);
console.log("dev/pro guards, 10-file assignment, failure preservation, normal selection/deletion: passed");
