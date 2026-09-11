const SHORT_SKILL_FALLBACK_POLICY = {
  maximumInitialConfidence: 40,
  maximumWeakMatchConfidence: 55,
  minimumCandidateLength: 2,
  maximumCandidateLength: 4,
  maximumConfirmedSimilarityBuffer: 0.05,
  maximumUnresolvedSimilarityGap: 0.25,
  minimumUnresolvedSimilarity: 0.35,
  minimumStrongFallbackConfidence: 60
};

function getShortSkillFallbackDecision({
  finalStatus,
  matchStatus,
  ocrConfidence,
  shortSkillCount,
  hasOcrCanvas,
  candidateLength = 0,
  firstSimilarity = 0,
  threshold = 1
}) {
  if (
    !hasOcrCanvas ||
    shortSkillCount <= 0 ||
    finalStatus === "review" ||
    matchStatus === "exact"
  ) {
    return { shouldRun: false, reason: null };
  }

  if (
    finalStatus === "unresolved" &&
    ocrConfidence <
      SHORT_SKILL_FALLBACK_POLICY.maximumInitialConfidence
  ) {
    return {
      shouldRun: true,
      reason: "low-confidence-short-skill"
    };
  }

  const isShortCandidate =
    candidateLength >= SHORT_SKILL_FALLBACK_POLICY.minimumCandidateLength &&
    candidateLength <= SHORT_SKILL_FALLBACK_POLICY.maximumCandidateLength;
  const hasWeakConfidence =
    ocrConfidence <= SHORT_SKILL_FALLBACK_POLICY.maximumWeakMatchConfidence;
  const isWeakConfirmedMatch =
    finalStatus === "confirmed" &&
    firstSimilarity < 1 &&
    firstSimilarity <=
      threshold + SHORT_SKILL_FALLBACK_POLICY.maximumConfirmedSimilarityBuffer;
  const isPlausibleUnresolvedMatch =
    finalStatus === "unresolved" &&
    firstSimilarity >= Math.max(
      SHORT_SKILL_FALLBACK_POLICY.minimumUnresolvedSimilarity,
      threshold - SHORT_SKILL_FALLBACK_POLICY.maximumUnresolvedSimilarityGap
    );

  if (
    isShortCandidate &&
    hasWeakConfidence &&
    (isWeakConfirmedMatch || isPlausibleUnresolvedMatch)
  ) {
    return {
      shouldRun: true,
      reason: "weak-short-canonical-match"
    };
  }

  return { shouldRun: false, reason: null };
}

function shouldRunShortSkillFallback(options) {
  return getShortSkillFallbackDecision(options).shouldRun;
}

function isStrongShortSkillFallbackResult({
  fallbackAssessment,
  fallbackMatchResult,
  fallbackConfidence,
  normalMatchResult
}) {
  if (fallbackAssessment.finalStatus !== "confirmed") {
    return false;
  }

  if (fallbackMatchResult.similarity === 1) {
    return true;
  }

  return (
    fallbackMatchResult.candidate === normalMatchResult.candidate &&
    fallbackConfidence >=
      SHORT_SKILL_FALLBACK_POLICY.minimumStrongFallbackConfidence &&
    fallbackMatchResult.similarity > normalMatchResult.similarity &&
    fallbackMatchResult.similarityMargin > normalMatchResult.similarityMargin
  );
}

export {
  getShortSkillFallbackDecision,
  shouldRunShortSkillFallback,
  isStrongShortSkillFallbackResult
};
