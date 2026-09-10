import { requirements, SKILL_MATCH_CONFIG } from "../config.js";

/* =========================================================
  OCR照合用スキル辞書生成処理
  ========================================================= */

function getRequirementSkillDictionary() {
  return [
    ...new Set([
      ...requirements.S,
      ...requirements.A,
      ...requirements.B,
      ...requirements.C
    ])
  ];
}

/* =========================================================
  スキルの要件ランク取得処理
  ========================================================= */

function getRequirementRank(skillName) {
  for (
    const rank
    of ["S", "A", "B", "C"]
  ) {
    if (
      requirements[rank]
        .includes(skillName)
    ) {
      return rank;
    }
  }

  return null;
}

/* =========================================================
  OCR結果の基本整形処理
  ========================================================= */

function normalizeOcrText(
  text
) {
  return text
    .replace(
      /\r?\n/g,
      ""
    )
    .replace(
      /\t/g,
      ""
    )
    .replace(
      /\s+/g,
      ""
    )
    .trim();
}

/* =========================================================
  スキル照合用文字列正規化処理
  ========================================================= */

function normalizeSkillText(
  text
) {
  return text
    .normalize(
      "NFKC"
    )
    .replace(
      /[〇ＯO]/g,
      "○"
    )
    .replace(
      /[。．.]+$/g,
      ""
    )
    .replace(
      /[\/\\|$]+$/g,
      ""
    )
    .replace(
      /\s+/g,
      ""
    )
    .trim();
}

/* =========================================================
  Levenshtein距離計算処理
  ========================================================= */

function calculateLevenshteinDistance(
  source,
  target
) {
  const sourceLength =
    source.length;

  const targetLength =
    target.length;

  const matrix =
    Array.from(
      {
        length:
          sourceLength + 1
      },
      () =>
        Array(
          targetLength + 1
        ).fill(0)
    );

  for (
    let i = 0;
    i <= sourceLength;
    i++
  ) {
    matrix[i][0] =
      i;
  }

  for (
    let j = 0;
    j <= targetLength;
    j++
  ) {
    matrix[0][j] =
      j;
  }

  for (
    let i = 1;
    i <= sourceLength;
    i++
  ) {
    for (
      let j = 1;
      j <= targetLength;
      j++
    ) {
      const cost =
        source[i - 1] ===
        target[j - 1]
          ? 0
          : 1;

      matrix[i][j] =
        Math.min(
          matrix[
            i - 1
          ][j] + 1,
          matrix[i][
            j - 1
          ] + 1,
          matrix[
            i - 1
          ][
            j - 1
          ] + cost
        );
    }
  }

  return matrix[
    sourceLength
  ][targetLength];
}

/* =========================================================
  文字列類似度計算処理
  ========================================================= */

function calculateSimilarity(
  source,
  target
) {
  if (
    source === target
  ) {
    return 1;
  }

  const maxLength =
    Math.max(
      source.length,
      target.length
    );

  if (
    maxLength === 0
  ) {
    return 1;
  }

  const distance =
    calculateLevenshteinDistance(
      source,
      target
    );

  return (
    1 -
    distance /
    maxLength
  );
}

/* =========================================================
  OCR結果に近い第1・第2候補を取得する処理
  ========================================================= */

function findBestSkillMatch(
  ocrText,
  dictionary
) {
  const normalizedOcr =
    normalizeSkillText(
      ocrText
    );

  if (
    !normalizedOcr ||
    dictionary.length === 0
  ) {
    return {
      candidate: null,
      similarity: 0,
      secondCandidate: null,
      secondSimilarity: 0,
      similarityMargin: 0,
      normalizedOcr
    };
  }

  const matches =
    dictionary.map(
      skill => {
        const normalizedSkill =
          normalizeSkillText(
            skill
          );

        const similarity =
          calculateSimilarity(
            normalizedOcr,
            normalizedSkill
          );

        return {
          candidate:
            skill,
          normalizedSkill,
          similarity
        };
      }
    );

  matches.sort(
    (
      a,
      b
    ) =>
      b.similarity -
      a.similarity
  );

  const best =
    matches[0] || null;

  const second =
    matches[1] || null;

  const bestSimilarity =
    best
      ? best.similarity
      : 0;

  const secondSimilarity =
    second
      ? second.similarity
      : 0;

  return {
    candidate:
      best
        ? best.candidate
        : null,
    similarity:
      bestSimilarity,
    secondCandidate:
      second
        ? second.candidate
        : null,
    secondSimilarity,
    similarityMargin:
      best
        ? bestSimilarity -
          secondSimilarity
        : 0,
    normalizedOcr
  };
}

/* =========================================================
  OCR文字数別類似度閾値取得処理
  ========================================================= */

function getSkillMatchThreshold(
  normalizedOcr
) {
  const length =
    normalizedOcr.length;

  return (
    SKILL_MATCH_CONFIG
      .thresholds[length] ??
    SKILL_MATCH_CONFIG
      .defaultThreshold
  );
}

/* =========================================================
  OCR結果一致状態判定処理
  ========================================================= */

function determineMatchStatus(
  normalizedOcr,
  candidate,
  similarity,
  secondSimilarity,
  similarityMargin
) {
  if (
    !candidate
  ) {
    return "unmatched";
  }

  const normalizedCandidate =
    normalizeSkillText(
      candidate
    );

  if (
    normalizedOcr ===
    normalizedCandidate
  ) {
    return "exact";
  }

  const seasonalAwakeningMatch =
    normalizedCandidate.match(
      /^([春夏秋冬])の目覚め$/
    );

  if (seasonalAwakeningMatch) {
    const recognizedSeason =
      normalizedOcr.match(
        /^([春夏秋冬])の目覚め/
      )?.[1] || null;

    if (
      recognizedSeason !==
      seasonalAwakeningMatch[1]
    ) {
      return "unmatched";
    }
  }

  const threshold =
    getSkillMatchThreshold(
      normalizedOcr
    );

  if (
    similarity <
    threshold
  ) {
    return "unmatched";
  }

  const hasSecondCandidate =
    secondSimilarity > 0;

  if (
    hasSecondCandidate &&
    similarityMargin <
      SKILL_MATCH_CONFIG
        .minimumMargin
  ) {
    return "unmatched";
  }

  return "similar";
}


export {
  getRequirementSkillDictionary,
  getRequirementRank,
  normalizeOcrText,
  normalizeSkillText,
  findBestSkillMatch,
  getSkillMatchThreshold,
  determineMatchStatus
};
