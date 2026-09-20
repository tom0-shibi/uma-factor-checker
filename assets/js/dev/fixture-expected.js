// Ground truth contains image annotations only, never recognition diagnostics.
export const FIXTURE_SET = 'regression-20260916';
export const MEMBER_IDS = ['parentA', 'grandA1', 'grandA2', 'parentB', 'grandB1', 'grandB2'];
const colors = ['white', 'blue', 'red', 'green'];
const locationKey = s => `${s.imageIndex}/${s.column}/${s.row}`;
const identity = f => `${f.color}/${f.name}`;

export function createCandidate(actual) {
  return {
    version: 1, fixtureSet: FIXTURE_SET, verification: 'draft',
    members: Object.fromEntries(MEMBER_IDS.map(id => [id, {
      factors: (actual[id] || []).map(a => ({
        name: a.status === 'confirmed' ? a.name : null,
        color: a.color, stars: a.stars, verified: false,
        sources: a.sources.map(s => ({ ...s }))
      }))
    }]))
  };
}

export function validateExpected(data) {
  const fail = message => { throw new Error(`expected.json: ${message}`); };
  const keys = (value, allowed) => {
    if (!value || typeof value !== 'object' || Array.isArray(value) ||
        Object.keys(value).some(k => !allowed.includes(k))) fail('未対応のフィールドです');
  };
  keys(data, ['version', 'fixtureSet', 'verification', 'members']);
  if (data.version !== 1 || data.fixtureSet !== FIXTURE_SET) fail('version / fixtureSet が違います');
  if (data.verification !== 'verified') fail('候補は未確認です。全件を人手確認してください');
  keys(data.members, MEMBER_IDS);
  for (const id of MEMBER_IDS) {
    keys(data.members[id], ['factors']);
    const factors = data.members[id].factors;
    if (!Array.isArray(factors)) fail(`${id}: factors が必要です`);
    const names = new Set(), locations = new Set();
    for (const f of factors) {
      keys(f, ['name', 'color', 'stars', 'verified', 'sources']);
      if (f.verified !== true || typeof f.name !== 'string' || !f.name.trim() ||
          !colors.includes(f.color) || !Number.isInteger(f.stars) || f.stars < 1 || f.stars > 3) {
        fail(`${id}: 名称・色・星数・人手確認を見直してください`);
      }
      if (names.has(identity(f))) fail(`${id}: 同じ因子は1件にまとめてください`);
      names.add(identity(f));
      if (!Array.isArray(f.sources)) fail(`${id}: sources 配列が必要です`);
      for (const s of f.sources) {
        keys(s, ['imageIndex', 'column', 'row']);
        if (!Number.isInteger(s.imageIndex) || s.imageIndex < 0 ||
            !['left', 'right'].includes(s.column) || !Number.isInteger(s.row) || s.row < 0) fail(`${id}: 画像位置が不正です`);
        const key = locationKey(s);
        if (locations.has(key)) fail(`${id}: 画像位置が重複しています`);
        locations.add(key);
      }
    }
  }
  return data;
}

export function compareExpected(data, actual) {
  validateExpected(data);
  const counts = Object.fromEntries(['matched', 'review', 'unresolved', 'wrongCanonical', 'starsMismatch', 'missing', 'extra', 'colorMismatch'].map(k => [k, 0]));
  const details = [];
  let expectedTotal = 0, actualTotal = 0;
  for (const member of MEMBER_IDS) {
    const expected = data.members[member].factors;
    const rows = actual[member] || [];
    expectedTotal += expected.length; actualTotal += rows.length;
    const used = new Set(), pairs = new Map();
    // Reserve exact identities first; never pair unmatched rows by array order or fuzzy text.
    expected.forEach((e, i) => {
      const j = rows.findIndex((a, j) => !used.has(j) && a.status === 'confirmed' && identity(e) === identity(a));
      if (j >= 0) { pairs.set(i, j); used.add(j); }
    });
    expected.forEach((e, i) => {
      if (pairs.has(i)) return;
      const candidates = rows.flatMap((a, j) => !used.has(j) && a.sources.some(s => e.sources.some(t => locationKey(s) === locationKey(t))) ? [j] : []);
      if (candidates.length === 1) { pairs.set(i, candidates[0]); used.add(candidates[0]); }
    });
    expected.forEach((e, i) => {
      const a = pairs.has(i) ? rows[pairs.get(i)] : null;
      const categories = [];
      if (!a) categories.push('missing');
      else {
        if (a.status === 'review') categories.push('review');
        else if (a.status !== 'confirmed') categories.push('unresolved');
        else if (a.name !== e.name) categories.push('wrongCanonical');
        if (a.stars !== e.stars) categories.push('starsMismatch');
        if (a.color !== e.color) categories.push('colorMismatch');
      }
      if (!categories.length) categories.push('matched');
      categories.forEach(k => counts[k]++);
      if (categories[0] !== 'matched') details.push({ member, categories, expected: e, actual: a });
    });
    rows.forEach((a, j) => {
      if (!used.has(j)) { counts.extra++; details.push({ member, categories: ['extra'], expected: null, actual: a }); }
    });
  }
  return { expectedTotal, actualTotal, counts, details };
}
