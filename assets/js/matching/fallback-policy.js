const SHORT_SKILL_FALLBACK_POLICY = {
  maximumInitialConfidence: 40
};

function shouldRunShortSkillFallback({
  finalStatus,
  ocrConfidence,
  shortSkillCount,
  hasOcrCanvas
}) {
  return (
    finalStatus === "unresolved" &&
    ocrConfidence <
      SHORT_SKILL_FALLBACK_POLICY.maximumInitialConfidence &&
    shortSkillCount > 0 &&
    hasOcrCanvas
  );
}

export { shouldRunShortSkillFallback };
