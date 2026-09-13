import {
  findBestSkillMatch,
  normalizeSkillText
} from "../matching/matching.js";

const BLUE_FACTOR_NAMES = [
  "スピード",
  "スタミナ",
  "パワー",
  "根性",
  "賢さ"
];

const RED_FACTOR_NAMES = [
  "芝",
  "ダート",
  "短距離",
  "マイル",
  "中距離",
  "長距離",
  "逃げ",
  "先行",
  "差し",
  "追込"
];

const FACTOR_METADATA_MATCH_CONFIG = {
  minimumSimilarity: 0.75,
  minimumMargin: 0.20
};

function matchFactorMetadataName(ocrText, candidates) {
  const normalizedOcr = normalizeSkillText(ocrText);

  if (!normalizedOcr) {
    return {
      status: "unresolved",
      canonicalName: null,
      match: null
    };
  }

  const exact = candidates.find(
    candidate =>
      normalizeSkillText(candidate) ===
      normalizedOcr
  );

  if (exact) {
    return {
      status: "confirmed",
      canonicalName: exact,
      match: {
        candidate: exact,
        similarity: 1,
        secondCandidate: null,
        secondSimilarity: 0,
        similarityMargin: 1
      }
    };
  }

  const match = findBestSkillMatch(
    ocrText,
    candidates
  );

  const confirmed =
    match.similarity >=
      FACTOR_METADATA_MATCH_CONFIG.minimumSimilarity &&
    match.similarityMargin >=
      FACTOR_METADATA_MATCH_CONFIG.minimumMargin;

  return {
    status: confirmed
      ? "confirmed"
      : "unresolved",
    canonicalName: confirmed
      ? match.candidate
      : null,
    match
  };
}

function createFactorMetadata({
  blueCard = null,
  blueRecognition = null,
  redCard = null,
  redRecognition = null,
  greenCard = null
}) {
  const blueMatch = blueRecognition
    ? matchFactorMetadataName(
        blueRecognition.ocrText,
        BLUE_FACTOR_NAMES
      )
    : null;

  const redMatch = redRecognition
    ? matchFactorMetadataName(
        redRecognition.ocrText,
        RED_FACTOR_NAMES
      )
    : null;

  const hasValidStars = card =>
    Number.isInteger(card?.stars) &&
    card.stars >= 1 &&
    card.stars <= 3;

  return {
    blue:
      hasValidStars(blueCard) &&
      blueMatch?.canonicalName
      ? {
          name: blueMatch.canonicalName,
          stars: blueCard.stars,
          ocrText: blueRecognition.ocrText,
          confidence: blueRecognition.ocrConfidence,
          status: blueMatch.status
        }
      : null,
    red:
      hasValidStars(redCard) &&
      redMatch?.canonicalName
      ? {
          name: redMatch.canonicalName,
          stars: redCard.stars,
          ocrText: redRecognition.ocrText,
          confidence: redRecognition.ocrConfidence,
          status: redMatch.status
        }
      : null,
    green: hasValidStars(greenCard)
      ? {
          name: "継承固有",
          stars: greenCard.stars,
          status: "confirmed"
        }
      : null
  };
}

export {
  BLUE_FACTOR_NAMES,
  RED_FACTOR_NAMES,
  FACTOR_METADATA_MATCH_CONFIG,
  matchFactorMetadataName,
  createFactorMetadata
};
