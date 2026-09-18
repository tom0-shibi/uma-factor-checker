import { requirements } from "../config.js";
import {
  FACTOR_MASTER,
  FACTOR_TYPES
} from "../data/factor-master.js?v=20260918-factor-master-data-01";

let cachedSignature = null;
let cachedCandidates = [];
let cachedEntriesByKey = new Map();

function normalizeCandidateKey(name) {
  return name
    .normalize("NFKC")
    .replace(/[〇ＯO]/g, "○")
    .replace(/[。．.]+$/g, "")
    .replace(/[\/\\|$]+$/g, "")
    .replace(/\s+/g, "")
    .trim();
}

const factorMasterEntriesByKey = new Map(
  FACTOR_MASTER.map(entry => [normalizeCandidateKey(entry.name), entry])
);

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
    const entriesByKey = new Map();
    FACTOR_MASTER.filter(entry => entry.color === "white").forEach(entry => {
      const key = normalizeCandidateKey(entry.name);
      if (!candidatesByKey.has(key)) {
        candidatesByKey.set(key, entry.name);
        entriesByKey.set(key, entry);
      }
    });
    requirementNames.forEach(name => {
      const key = normalizeCandidateKey(name);
      if (!candidatesByKey.has(key)) {
        candidatesByKey.set(key, name);
      }
      if (!entriesByKey.has(key)) {
        entriesByKey.set(key, {
          name,
          color: "white",
          type: FACTOR_TYPES.SKILL,
          source: "requirement"
        });
      }
    });
    cachedCandidates = [...candidatesByKey.values()];
    cachedEntriesByKey = entriesByKey;
    cachedSignature = signature;
  }

  return cachedCandidates;
}

function getFactorMasterEntry(name) {
  getCanonicalSkillCandidates();
  const key = normalizeCandidateKey(name);
  return factorMasterEntriesByKey.get(key) ?? cachedEntriesByKey.get(key) ?? null;
}

function getFactorMasterStats() {
  const byColor = {};
  const byType = Object.fromEntries(
    Object.values(FACTOR_TYPES).map(type => [type, 0])
  );
  FACTOR_MASTER.forEach(entry => {
    byColor[entry.color] = (byColor[entry.color] ?? 0) + 1;
    byType[entry.type]++;
  });
  return {
    total: FACTOR_MASTER.length,
    byColor,
    byType
  };
}

function getFactorMasterCandidateCount() {
  return FACTOR_MASTER.filter(entry => entry.color === "white").length;
}

export {
  getCanonicalSkillCandidates,
  getCurrentRequirementNames,
  getFactorMasterEntry,
  getFactorMasterStats,
  getFactorMasterCandidateCount
};
