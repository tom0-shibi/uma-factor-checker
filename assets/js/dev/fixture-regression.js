import { IS_DEV } from '../environment.js';
import { members, MEMBER_ORDER, analysisProgress } from '../config.js';
import { FIXTURE_ASSIGNMENTS } from './fixtures.js';
import { collectFixtureActual } from './fixture-actual.js';
import { createCandidate, compareExpected } from './fixture-expected.js';

let panel, output, candidateButton, compareButton, snapshot, imageRefs;
const labels = { matched: '一致', review: 'Review', unresolved: 'Unresolved', wrongCanonical: '誤確定',
  starsMismatch: '星数不一致', missing: '欠落', extra: '余分な検出', colorMismatch: '色不一致' };

function isFixtureSet() {
  return MEMBER_ORDER.every(id => members[id].images.length === FIXTURE_ASSIGNMENTS[id].length &&
    members[id].images.every((image, i) => image.file.name === `skill-check-${FIXTURE_ASSIGNMENTS[id][i]}.png`));
}
function validSnapshot() {
  return snapshot && !analysisProgress.active && isFixtureSet() && MEMBER_ORDER.every(id =>
    members[id].images.every((image, i) => image === imageRefs[id][i]));
}

export function initializeRegressionControls() {
  if (!IS_DEV || panel) return;
  panel = document.createElement('section');
  panel.id = 'fixture-regression';
  const heading = document.createElement('h3');
  heading.textContent = 'Fixture正解データ比較（dev）';
  const help = document.createElement('p');
  help.textContent = '10枚の通常解析完了後に利用できます。候補は全件未確認です。緑因子の名称は現行OCR対象外のため要人手確認。';
  output = document.createElement('pre');
  output.style.whiteSpace = 'pre-wrap';
  output.setAttribute('aria-live', 'polite');
  const button = (text, action) => {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'secondary-button';
    b.textContent = text; b.disabled = true;
    b.addEventListener('click', async () => {
      if (!validSnapshot()) { output.textContent = 'fixture 10枚をセットして通常解析を完了してください。'; return; }
      try { await action(); } catch (error) { output.textContent = error.message; }
    });
    return b;
  };
  candidateButton = button('expected候補JSONを保存', () => {
    const url = URL.createObjectURL(new Blob([JSON.stringify(createCandidate(snapshot), null, 2) + '\n'], { type: 'application/json' }));
    const a = document.createElement('a'); a.href = url; a.download = 'expected.candidate.json'; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
  compareButton = button('expected.jsonを再読込・比較', compare);
  panel.append(heading, help, candidateButton, compareButton, output);
  document.getElementById('results').appendChild(panel);
}

async function compare() {
  if (!IS_DEV || !snapshot) return;
  const current = snapshot;
  const response = await fetch(new URL('../../../tests/fixtures/factor-images/regression-20260916/expected.json', import.meta.url), { cache: 'no-store' });
  if (current !== snapshot) return;
  if (response.status === 404) { output.textContent = 'expected.json は未作成です。候補を保存し、人手確認後に配置してください。'; return; }
  if (!response.ok) throw new Error(`expected.json: HTTP ${response.status}`);
  const expected = await response.json();
  if (current !== snapshot) return;
  const report = compareExpected(expected, current);
  const lines = [`正解因子 ${report.expectedTotal} / actual ${report.actualTotal}`,
    ...Object.entries(report.counts).map(([key, count]) => `${labels[key]}: ${count}`),
    '※Review等と星数・色の不一致は重複計上します。対応位置がない誤読は欠落＋余分になります。', ''];
  for (const d of report.details) {
    lines.push(`${members[d.member].label} (${d.member}) / ${d.categories.map(c => labels[c]).join('・')}`,
      `expected: ${d.expected?.name ?? '—'} / ${d.expected?.color ?? '—'} / ★${d.expected?.stars ?? '—'}`,
      `actual: ${d.actual?.status ?? 'missing'} / ${d.actual?.name ?? '—'} / ${d.actual?.color ?? '—'} / ★${d.actual?.stars ?? '—'}`,
      `OCR: ${d.actual?.rawOcr ?? '—'}`,
      `位置: ${JSON.stringify(d.expected?.sources ?? d.actual?.sources ?? [])}`, '');
  }
  output.textContent = lines.join('\n');
}

export function resetFixtureRegression() {
  if (!IS_DEV) return;
  snapshot = null;
  if (panel) {
    candidateButton.disabled = compareButton.disabled = true;
    output.textContent = '解析結果を更新中です。';
  }
}

export async function completeFixtureRegression() {
  if (!IS_DEV) return;
  initializeRegressionControls();
  snapshot = null;
  candidateButton.disabled = compareButton.disabled = true;
  if (!isFixtureSet() || MEMBER_ORDER.some(id => members[id].analysisResults.length !== members[id].images.length)) {
    output.textContent = 'fixture 10枚すべての通常解析が完了した場合のみ利用できます。'; return;
  }
  snapshot = collectFixtureActual();
  imageRefs = Object.fromEntries(MEMBER_ORDER.map(id => [id, [...members[id].images]]));
  candidateButton.disabled = compareButton.disabled = false;
  try { await compare(); } catch (error) { output.textContent = error.message; }
}
