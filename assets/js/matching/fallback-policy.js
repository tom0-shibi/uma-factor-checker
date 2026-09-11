const SHORT_SKILL_FALLBACK_POLICY = {
  maximumInitialConfidence: 40,
  maximumWeakMatchConfidence: 55,
  minimumCandidateLength: 2,
  maximumCandidateLength: 4,
  maximumConfirmedSimilarityBuffer: 0.05,
  maximumUnresolvedSimilarityGap: 0.25,
  minimumUnresolvedSimilarity: 0.35,
  minimumStrongFallbackConfidence: 40,
  minimumStrongSimilarityImprovement: 0.15
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

function evaluateStrongShortSkillFallbackResult({
  fallbackAssessment,
  fallbackMatchResult,
  fallbackConfidence,
  normalMatchResult
}) {
  if (fallbackAssessment.finalStatus !== "confirmed") {
    return {
      eligible: false,
      reason: "fallback-not-confirmed"
    };
  }

  if (fallbackMatchResult.similarity === 1) {
    return {
      eligible: true,
      reason: "fallback-exact-match"
    };
  }

  const checks = {
    sameCandidate:
      fallbackMatchResult.candidate === normalMatchResult.candidate,
    sufficientConfidence:
      fallbackConfidence >=
        SHORT_SKILL_FALLBACK_POLICY.minimumStrongFallbackConfidence,
    sufficientSimilarityImprovement:
      fallbackMatchResult.similarity - normalMatchResult.similarity >=
        SHORT_SKILL_FALLBACK_POLICY.minimumStrongSimilarityImprovement,
    marginNotWorse:
      fallbackMatchResult.similarityMargin >= normalMatchResult.similarityMargin
  };
  const failedChecks = Object.entries(checks)
    .filter(([, passed]) => !passed)
    .map(([name]) => name);

  return {
    eligible: failedChecks.length === 0,
    reason: failedChecks.length === 0
      ? "fallback-consistent-improvement"
      : `failed:${failedChecks.join(",")}`,
    checks
  };
}

function isStrongShortSkillFallbackResult(options) {
  return evaluateStrongShortSkillFallbackResult(options).eligible;
}

export {
  getShortSkillFallbackDecision,
  shouldRunShortSkillFallback,
  evaluateStrongShortSkillFallbackResult,
  isStrongShortSkillFallbackResult
};
