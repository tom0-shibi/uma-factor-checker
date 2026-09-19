import { members, MEMBER_ORDER } from '../config.js';
import { getOriginalRecognition, getReviewItems, buildMemberFactorInfo, aggregateMemberSkills } from '../result/result-model.js?v=20260919-factor-master-data-03';
import { normalizeSkillText } from '../matching/matching.js?v=20260917-factor-master-01';

// Read the completed production results; do not run OCR or apply review corrections.
export function collectFixtureActual() {
  const result = Object.fromEntries(MEMBER_ORDER.map(id => [id, []]));
  const source = (imageIndex, card) => ({ imageIndex, column: card.column, row: card.row });
  for (const id of MEMBER_ORDER) {
    const confirmed = new Map();
    const skills = aggregateMemberSkills(id);
    for (const image of members[id].analysisResults) {
      for (const card of [...image.analysis.leftCards, ...image.analysis.rightCards]) {
        if (card.factorType !== 'white') continue;
        const original = getOriginalRecognition(card);
        if (original.status !== 'confirmed' || !original.canonicalName) continue;
        const key = normalizeSkillText(original.canonicalName);
        const row = confirmed.get(key);
        const s = source(image.imageIndex, card);
        if (row) {
          row.sources.push(s);
          if (card.stars > row.stars) { row.stars = card.stars; row.rawOcr = original.ocrText; }
        } else confirmed.set(key, { name: original.canonicalName, color: 'white', stars: card.stars,
          status: 'confirmed', rawOcr: original.ocrText, sources: [s] });
      }
    }
    // The same normalized-name/max-stars semantics cover non-requirement white factors.
    for (const [key, row] of confirmed) {
      const skill = skills.get(key);
      if (skill && skill.resolutionSource !== 'manual') row.stars = skill.stars;
      result[id].push(row);
    }
  }
  for (const item of getReviewItems()) {
    result[item.memberId].push({ name: null, color: 'white', stars: item.card.stars,
      status: item.original.status, rawOcr: item.original.ocrText,
      sources: [source(item.imageIndex, item.card), ...item.duplicateLocations.map(s => ({ ...s }))] });
  }
  const metadata = buildMemberFactorInfo();
  for (const id of MEMBER_ORDER) {
    for (const color of ['blue', 'red', 'green']) {
      const factor = metadata[id][color];
      if (!factor) continue;
      const image = members[id].analysisResults.find(i => i.imageIndex === factor.imageIndex);
      const card = [...image.analysis.leftCards, ...image.analysis.rightCards].find(c => c.factorType === color);
      // Green names are deliberately not OCRed in production; never call its placeholder a correct name.
      result[id].push({ name: color === 'green' ? null : factor.name, color, stars: factor.stars,
        status: color === 'green' ? 'unresolved' : factor.status,
        rawOcr: factor.rawOcrText || factor.ocrText || '', sources: card ? [source(factor.imageIndex, card)] : [] });
    }
  }
  return result;
}
