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
  minimumMargin: 0.20,
  containedCandidate: {
    minimumCandidateLength: 2,
    maximumExtraCharacters: 1,
    minimumSimilarity: 2 / 3,
    minimumConfidence: 40
  }
};

function matchFactorMetadataName(
  ocrText,
  candidates,
  options = {}
) {
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

  const normalizedCandidate = normalizeSkillText(
    match.candidate ?? ""
  );
  const extraCharacterCount =
    normalizedOcr.length - normalizedCandidate.length;
  const containedConfig =
    FACTOR_METADATA_MATCH_CONFIG.containedCandidate;
  const isContainedCandidate =
    normalizedCandidate.length >=
      containedConfig.minimumCandidateLength &&
    normalizedOcr.includes(normalizedCandidate) &&
    extraCharacterCount >= 0 &&
    extraCharacterCount <=
      containedConfig.maximumExtraCharacters &&
    match.similarity >=
      containedConfig.minimumSimilarity &&
    match.similarityMargin >=
      FACTOR_METADATA_MATCH_CONFIG.minimumMargin &&
    (options.confidence ?? 0) >=
      containedConfig.minimumConfidence;

  const confirmed =
    (
      match.similarity >=
        FACTOR_METADATA_MATCH_CONFIG.minimumSimilarity &&
      match.similarityMargin >=
        FACTOR_METADATA_MATCH_CONFIG.minimumMargin
    ) ||
    isContainedCandidate;

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
        BLUE_FACTOR_NAMES,
        {
          confidence:
            blueRecognition.ocrConfidence
        }
      )
    : null;

  const redMatch = redRecognition
      ? matchFactorMetadataName(
        redRecognition.ocrText,
        RED_FACTOR_NAMES,
        {
          confidence:
            redRecognition.ocrConfidence
        }
      )
    : null;

  const hasValidStars = card =>
    Number.isInteger(card?.stars) &&
    card.stars >= 1 &&
    card.stars <= 3;

  return {
    blue:
      hasValidStars(blueCard)
      ? {
          name: blueMatch?.canonicalName ?? null,
          stars: blueCard.stars,
          rawOcrText: blueRecognition?.ocrRawText ?? "",
          ocrText: blueRecognition?.ocrText ?? "",
          normalizedOcrText: normalizeSkillText(
            blueRecognition?.ocrText ?? ""
          ),
          confidence: blueRecognition?.ocrConfidence ?? 0,
          candidate: blueMatch?.match?.candidate ?? null,
          similarity: blueMatch?.match?.similarity ?? 0,
          status: blueMatch?.status ?? "unresolved"
        }
      : null,
    red:
      hasValidStars(redCard)
      ? {
          name: redMatch?.canonicalName ?? null,
          stars: redCard.stars,
          rawOcrText: redRecognition?.ocrRawText ?? "",
          ocrText: redRecognition?.ocrText ?? "",
          normalizedOcrText: normalizeSkillText(
            redRecognition?.ocrText ?? ""
          ),
          confidence: redRecognition?.ocrConfidence ?? 0,
          candidate: redMatch?.match?.candidate ?? null,
          similarity: redMatch?.match?.similarity ?? 0,
          status: redMatch?.status ?? "unresolved"
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
