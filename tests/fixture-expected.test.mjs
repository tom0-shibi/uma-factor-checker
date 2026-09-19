import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
const code = await readFile(new URL('../assets/js/dev/fixture-expected.js', import.meta.url), 'utf8');
const { createCandidate, compareExpected, validateExpected, MEMBER_IDS } = await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`);
const s = row => ({ imageIndex: 0, column: 'left', row });
const a = (name, row, status = 'confirmed', stars = 2) => ({ name, color: 'white', stars, status, rawOcr: '<script>raw</script>', sources: [s(row)] });
const truth = rows => {
  const data = createCandidate({ parentA: rows });
  data.verification = 'verified';
  data.members.parentA.factors.forEach(f => f.verified = true);
  return data;
};
const expected = truth(['match', 'review', 'unresolved', 'wrong', 'stars', 'missing'].map((n, i) => a(n, i + 1)));
const actual = { parentA: [a('match', 1), a(null, 2, 'review'), a(null, 3, 'unresolved'), a('mistake', 4), a('stars', 5, 'confirmed', 3), a('extra', 7)] };
const report = compareExpected(expected, actual);
assert.equal(report.expectedTotal, 6); assert.equal(report.actualTotal, 6);
for (const key of ['matched', 'review', 'unresolved', 'wrongCanonical', 'starsMismatch', 'missing', 'extra']) assert.equal(report.counts[key], 1, key);
assert.equal(report.details[0].actual.rawOcr, '<script>raw</script>');
const draft = createCandidate(actual);
assert.equal(draft.verification, 'draft');
assert.equal(draft.members.parentA.factors[1].name, null);
assert.ok(draft.members.parentA.factors.every(f => !f.verified));
assert.doesNotMatch(JSON.stringify(draft), /rawOcr|status|confidence|fallback|strategy/);
assert.throws(() => validateExpected(draft), /未確認/);
for (const mutation of [
  d => d.members.parentA.factors[0].stars = 4,
  d => d.members.parentA.factors[0].confidence = 90,
  d => d.members.parentA.factors[0].verified = false,
  d => d.members.parentA.factors.push(d.members.parentA.factors[0]),
  d => delete d.members.grandB2
]) { const d = structuredClone(expected); mutation(d); assert.throws(() => validateExpected(d)); }
const unrelated = compareExpected(truth([a('truth', 1)]), { parentA: [a('other', 2)] });
assert.equal(unrelated.counts.missing, 1); assert.equal(unrelated.counts.extra, 1);
const otherMember = compareExpected(truth([a('truth', 1)]), { parentB: [a('truth', 1)] });
assert.equal(otherMember.counts.missing, 1);
const reordered = compareExpected(truth([a('one', 1), a('two', 2)]), { parentA: [a('two', 1), a('one', 2)] });
assert.equal(reordered.counts.matched, 2);

async function loadApp(hostname) {
  const elements = [];
  const element = () => ({ children: [], style: {}, handlers: {}, disabled: false,
    setAttribute() {}, addEventListener(k, fn) { this.handlers[k] = fn; },
    append(...items) { this.children.push(...items); }, appendChild(item) { this.children.push(item); }, click() {} });
  const container = element();
  const context = vm.createContext({ location: { hostname, protocol: 'https:' }, console, URL, Blob, setTimeout, fetch: async () => ({ ok: true, json: async () => createCandidate({}) }),
    document: { querySelectorAll() { return []; }, getElementById() { return null; }, addEventListener() {}, createElement() { throw new Error('pro DOM accessed'); } } });
  if (hostname === 'localhost') {
    context.document.createElement = () => { const e = element(); elements.push(e); return e; };
    // Existing UI module only needs absent controls during import.
  }
  const modules = new Map();
  async function load(url) {
    url = new URL(url); url.search = '';
    const source = await readFile(url, 'utf8');
    if (!modules.has(url.href)) modules.set(url.href, new vm.SourceTextModule(source, { context, identifier: url.href, initializeImportMeta(meta) { meta.url = url.href; } }));
    return modules.get(url.href);
  }
  const root = await load(new URL('../assets/js/dev/fixture-regression.js', import.meta.url));
  await root.link((s, p) => load(new URL(s, p.identifier))); await root.evaluate();
  const get = name => modules.get(new URL(`../assets/js/${name}`, import.meta.url).href).namespace;
  return { root: root.namespace, get, context, elements, container };
}
const pro = await loadApp('example.github.io');
pro.root.initializeRegressionControls(); await pro.root.completeFixtureRegression();
const appSource = await readFile(new URL('../assets/js/app.js', import.meta.url), 'utf8');
assert.match(appSource, /if \(IS_DEV\) \{\s*try \{\s*const \{ completeFixtureRegression \} = await import\("\.\/dev\/fixture-regression.js"\)/);
const dev = await loadApp('localhost');
const { members } = dev.get('config.js');
const card = (name, stars, row, status = 'confirmed') => ({ factorType: 'white', canonicalName: name, stars, row, column: 'left', finalStatus: status, ocrText: name || '不明' });
const review1 = card(null, 2, 3, 'review'), review2 = card(null, 2, 1, 'review');
members.parentA.analysisResults = [
  { imageIndex: 0, analysis: { leftCards: [card('テスト因子', 1, 1), review1], rightCards: [], factorMetadata: {} } },
  { imageIndex: 1, analysis: { leftCards: [card('テスト因子', 3, 2), review2], rightCards: [], factorMetadata: {} } }
];
const collected = dev.get('dev/fixture-actual.js').collectFixtureActual();
assert.equal(collected.parentA.length, 2);
assert.equal(collected.parentA[0].stars, 3);
assert.equal(collected.parentA[0].sources.length, 2);
assert.equal(collected.parentA[1].sources.length, 2);
review1.manualCorrection = { canonicalName: '手動修正' };
assert.equal(dev.get('dev/fixture-actual.js').collectFixtureActual().parentA[1].status, 'review');
assert.equal(MEMBER_IDS.length, 6);
console.log('PASS: seven categories, draft/schema validation, identity/position matching, member isolation, continuation deduplication, original OCR snapshot, pro guards');

// Dev UI integration uses synthetic completed results, with no image OCR or network.
for (const id of MEMBER_IDS) {
  members[id].images = dev.get('dev/fixtures.js').FIXTURE_ASSIGNMENTS[id].map(name => ({ file: { name: `skill-check-${name}.png` } }));
  members[id].analysisResults = members[id].images.map((_, imageIndex) => ({ imageIndex, analysis: { leftCards: [], rightCards: [], factorMetadata: {} } }));
}
dev.context.document.getElementById = () => dev.container;
await dev.root.completeFixtureRegression();
const output = dev.elements.find(e => e.style.whiteSpace === 'pre-wrap');
assert.match(output.textContent, /未確認/);
const save = dev.elements.find(e => e.textContent === 'expected候補JSONを保存');
assert.equal(save.disabled, false);
dev.context.fetch = async () => ({ ok: true, json: async () => truth([]) });
const compareButton = dev.elements.find(e => e.textContent === 'expected.jsonを再読込・比較');
await compareButton.handlers.click();
assert.match(output.textContent, /正解因子 0/);
members.parentA.images[0] = { file: { name: members.parentA.images[0].file.name } };
await compareButton.handlers.click();
assert.match(output.textContent, /通常解析を完了/);
dev.root.resetFixtureRegression();
assert.equal(save.disabled, true);
console.log('PASS: Dev UI draft rejection, reload comparison, stale-image rejection and reset');
