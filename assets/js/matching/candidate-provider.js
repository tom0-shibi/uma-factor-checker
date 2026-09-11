import { requirements } from "../config.js";
import {
  TEMPORARY_SKILL_NAME_MASTER
} from "../master/temporary-skill-name-master.js";

let cachedSignature = null;
let cachedCandidates = [];

function getCurrentRequirementNames() {
  return [
    ...new Set([
      ...requirements.S,
      ...requirements.A,
      ...requirements.B,
      ...requirements.C
    ])
  ];
}

function getCanonicalSkillCandidates() {
  const requirementNames = getCurrentRequirementNames();
  const signature = requirementNames
    .slice()
    .sort()
    .join("\u0000");

  if (signature !== cachedSignature) {
    const candidatesByKey = new Map();
    [
      ...TEMPORARY_SKILL_NAME_MASTER,
      ...requirementNames
    ].forEach(name => {
      const key = name
        .normalize("NFKC")
        .replace(/[〇ＯO]/g, "○")
        .replace(/\s+/g, "")
        .trim();
      if (!candidatesByKey.has(key)) {
        candidatesByKey.set(key, name);
      }
    });
    cachedCandidates = [...candidatesByKey.values()];
    cachedSignature = signature;
  }

  return cachedCandidates;
}

function getTemporaryCandidateCount() {
  return new Set(TEMPORARY_SKILL_NAME_MASTER).size;
}

export {
  getCanonicalSkillCandidates,
  getCurrentRequirementNames,
  getTemporaryCandidateCount
};
