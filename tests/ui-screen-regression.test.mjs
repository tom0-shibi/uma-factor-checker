import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

function createNode(id = "") {
  return {
    id,
    children: [],
    parentNode: null,
    classList: {
      add() {},
      remove() {},
      toggle() {}
    },
    appendChild(child) {
      child.parentNode = this;
      this.children.push(child);
      return child;
    },
    insertBefore(child, reference) {
      child.parentNode = this;
      const index = this.children.indexOf(reference);
      this.children.splice(index < 0 ? this.children.length : index, 0, child);
      return child;
    },
    addEventListener() {}
  };
}

async function loadUi(hostname, includeDebug) {
  const elements = new Map();
  const body = createNode("body");
  const head = createNode("head");
  const results = createNode("results");
  elements.set("results", results);

  if (includeDebug) {
    const debug = createNode("analysis-debug");
    elements.set("analysis-debug", debug);
    results.appendChild(debug);
  }

  const context = vm.createContext({
    console,
    location: {
      hostname,
      protocol: "https:"
    },
    document: {
      body,
      head,
      getElementById: id => elements.get(id) ?? null,
      createElement: () => createNode(),
      querySelectorAll: () => [],
      querySelector: () => null,
      addEventListener() {},
      dispatchEvent() {}
    }
  });

  const modules = new Map();
  async function load(url) {
    url = new URL(url);
    url.search = "";
    if (!modules.has(url.href)) {
      modules.set(
        url.href,
        new vm.SourceTextModule(
          await readFile(url, "utf8"),
          {
            context,
            identifier: url.href,
            initializeImportMeta(meta) {
              meta.url = url.href;
            }
          }
        )
      );
    }
    return modules.get(url.href);
  }

  const ui = await load(
    new URL("../assets/js/ui/ui.js", import.meta.url)
  );
  await ui.link(
    (specifier, parent) => load(
      new URL(specifier, parent.identifier)
    )
  );
  await ui.evaluate();

  return {
    body,
    results,
    ui: ui.namespace
  };
}

for (const setup of [
  {
    name: "dev",
    hostname: "localhost",
    includeDebug: true
  },
  {
    name: "pro",
    hostname: "example.github.io",
    includeDebug: false
  }
]) {
  const app = await loadUi(
    setup.hostname,
    setup.includeDebug
  );
  const summary =
    app.ui.ensureResultSummaryContainer();

  assert.equal(
    summary.parentNode,
    app.results,
    `${setup.name}: summary must stay inside results screen`
  );
  assert.equal(
    app.body.children.includes(summary),
    false,
    `${setup.name}: summary must not be appended to body`
  );
}

const html = await readFile(
  new URL("../index.html", import.meta.url),
  "utf8"
);
const css = await readFile(
  new URL("../assets/css/style.css", import.meta.url),
  "utf8"
);

assert.match(
  html,
  /<section id="requirements" class="tab-content active">/
);
assert.match(
  html,
  /<section id="images" class="tab-content">/
);
assert.match(
  html,
  /<section id="results" class="tab-content">/
);
assert.match(
  css,
  /\.tab-content\s*\{[^}]*display:\s*none;/s
);
assert.match(
  css,
  /\.tab-content\.active\s*\{[^}]*display:\s*block;/s
);
assert.match(
  css,
  /\.app-main\s*\{[^}]*max-width:\s*1200px;/s
);

console.log("dev/pro screen isolation and result width containment: OK");
