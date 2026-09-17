const TRAINER_ID_STORAGE_KEY = "uma-factor-checker:representative-trainer-id:v1";
const TRAINER_ID_VISIBLE_STORAGE_KEY = "uma-factor-checker:representative-trainer-id-visible:v1";

function sanitizeTrainerId(value) {
  return String(value ?? "")
    .normalize("NFKC")
    .replace(/[^0-9]/g, "")
    .slice(0, 12);
}

function buildRepresentativeSkillSummaries(
  memberIds,
  selectedSkills,
  canonicalNamesByMember
) {
  return selectedSkills.map(skill => {
    const memberValues = Object.fromEntries(
      memberIds.map(memberId => [
        memberId,
        skill.memberCanonicalNames.some(
          name => canonicalNamesByMember[memberId]?.has(name)
        )
      ])
    );
    return {
      ...skill,
      memberValues,
      ownedCount: Object.values(memberValues).filter(Boolean).length
    };
  });
}

function formatRepresentativeXText({
  title = "",
  trainerId = "",
  showTrainerId = false,
  skillSummaries = []
}) {
  const lines = [];
  const normalizedTitle = String(title).trim();
  const normalizedId = sanitizeTrainerId(trainerId);
  if (normalizedTitle) {
    lines.push(normalizedTitle);
  }
  if (showTrainerId && normalizedId) {
    lines.push(`トレーナーID: ${normalizedId}`);
  }
  if (skillSummaries.length > 0) {
    if (lines.length > 0) {
      lines.push("");
    }
    lines.push("■ 主な因子");
    skillSummaries.forEach(skill => {
      lines.push(`${skill.canonicalName} ${skill.ownedCount}面`);
    });
  }
  return lines.join("\n");
}

export {
  TRAINER_ID_STORAGE_KEY,
  TRAINER_ID_VISIBLE_STORAGE_KEY,
  sanitizeTrainerId,
  buildRepresentativeSkillSummaries,
  formatRepresentativeXText
};
