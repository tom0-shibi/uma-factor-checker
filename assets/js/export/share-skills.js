import {
  SHARE_SKILL_GROUPS
} from "./share-skill-groups.js?v=20260915-representative-check-03";

const MAX_SHARE_SKILLS = 10;
const RANKS = ["S", "A", "B", "C"];

let shareSkills = [];

function normalizeName(name) {
  return String(name ?? "").trim();
}

function findShareGroup(name) {
  const normalizedName = normalizeName(name);
  return SHARE_SKILL_GROUPS.find(
    group => group.members.includes(normalizedName)
  ) ?? null;
}

function createShareSkill(name) {
  const canonicalName = normalizeName(name);
  if (!canonicalName) {
    return null;
  }
  const group = findShareGroup(canonicalName);
  return group
    ? {
        id: `group:${group.id}`,
        canonicalName: group.displayName,
        memberCanonicalNames: [...group.members]
      }
    : {
        id: `skill:${canonicalName}`,
        canonicalName,
        memberCanonicalNames: [canonicalName]
      };
}

function createUniqueShareSkills(names) {
  const unique = new Map();
  names.forEach(name => {
    const item = createShareSkill(name);
    if (item && !unique.has(item.id)) {
      unique.set(item.id, item);
    }
  });
  return [...unique.values()];
}

function initializeShareSkills() {
  return getShareSkills();
}

function replaceShareSkillsFromS(skillNames) {
  shareSkills = createUniqueShareSkills(skillNames);
  return getShareSkills();
}

function getShareSkills() {
  return shareSkills.map(item => ({
    ...item,
    memberCanonicalNames: [...item.memberCanonicalNames]
  }));
}

function addShareSkill(name) {
  const item = createShareSkill(name);
  if (!item) {
    return { added: false, reason: "invalid-skill" };
  }
  if (shareSkills.some(existing => existing.id === item.id)) {
    return { added: false, reason: "duplicate-skill" };
  }
  if (shareSkills.length >= MAX_SHARE_SKILLS) {
    return { added: false, reason: "maximum-share-skills" };
  }
  shareSkills.push(item);
  return { added: true, reason: null };
}

function removeShareSkill(id) {
  const previousLength = shareSkills.length;
  shareSkills = shareSkills.filter(item => item.id !== id);
  return shareSkills.length !== previousLength;
}

function clearShareSkills() {
  shareSkills = [];
}

function getRequirementSkillCandidates(requirementMap) {
  return createUniqueShareSkills(
    RANKS.flatMap(rank => requirementMap[rank] ?? [])
  );
}

function buildShareSkillSummaries(
  model,
  selectedSkills = shareSkills,
  canonicalNamesByMember = null
) {
  const allRequirementSkills = RANKS.flatMap(
    rank => model.ranks?.[rank] ?? []
  );
  return selectedSkills.map(selected => {
    const memberValues = {};
    model.registeredMemberIds.forEach(memberId => {
      const recognizedNames = canonicalNamesByMember?.[memberId];
      const found = recognizedNames
        ? selected.memberCanonicalNames.some(
            name => recognizedNames.has(name)
          )
        : allRequirementSkills.some(skill =>
            selected.memberCanonicalNames.includes(skill.skillName) &&
            Boolean(skill.memberValues?.[memberId])
          );
      memberValues[memberId] = found;
    });
    return {
      id: selected.id,
      canonicalName: selected.canonicalName,
      memberCanonicalNames: [...selected.memberCanonicalNames],
      memberValues,
      ownedCount: Object.values(memberValues).filter(Boolean).length
    };
  });
}

function getShareSkillLimitWarning(selectedSkills = shareSkills) {
  return selectedSkills.length > MAX_SHARE_SKILLS
    ? "Sスキルが10件を超えています。共有するスキルを10件以内に調整してください。"
    : "";
}

export {
  MAX_SHARE_SKILLS,
  createShareSkill,
  initializeShareSkills,
  replaceShareSkillsFromS,
  getShareSkills,
  addShareSkill,
  removeShareSkill,
  clearShareSkills,
  getRequirementSkillCandidates,
  buildShareSkillSummaries,
  getShareSkillLimitWarning
};
