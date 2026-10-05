import { FACTOR_MASTER_VERSION } from "../data/factor-master.js";

const FACTOR_ENTRY_SCHEMA_VERSION = 1;

function createFactorEntry({ id, displayName, characterId = null, variantId = null, characterNameSnapshot = "", variantNameSnapshot = "", factors = [], unresolvedFactors = [], imageRefs = [], tags = [], favorite = false, memo = "", now = new Date().toISOString() }) {
  const entry = {
    id,
    displayName: displayName.trim(),
    characterId,
    variantId,
    characterNameSnapshot,
    variantNameSnapshot,
    factors: factors.map(item => ({ ...item })),
    unresolvedFactors: unresolvedFactors.map(item => ({ ...item })),
    imageRefs: imageRefs.map(item => ({ ...item })),
    tags: [...tags],
    favorite: Boolean(favorite),
    memo: String(memo ?? ""),
    dataStatus: unresolvedFactors.length > 0 ? "needs-review" : "confirmed",
    schemaVersion: FACTOR_ENTRY_SCHEMA_VERSION,
    masterVersion: FACTOR_MASTER_VERSION,
    createdAt: now,
    updatedAt: now
  };
  validateFactorEntry(entry);
  return entry;
}

function buildFactorFingerprint(entry) {
  const factors = [...(entry?.factors ?? [])]
    .map(item => `${item.factorId}:${item.stars}`)
    .sort()
    .join("|");
  return `${entry?.characterId ?? ""}::${entry?.variantId ?? ""}::${factors}`;
}

function validateFactorEntry(entry) {
  const errors = [];
  if (!entry?.id || typeof entry.id !== "string") errors.push("idが必要です");
  if (!entry?.displayName?.trim()) errors.push("displayNameが必要です");
  if (!Array.isArray(entry?.factors)) errors.push("factorsは配列である必要があります");
  if (!Array.isArray(entry?.unresolvedFactors)) errors.push("unresolvedFactorsは配列である必要があります");
  (entry?.factors ?? []).forEach((factor, index) => {
    if (!factor.factorId) errors.push(`factors[${index}].factorIdが必要です`);
    if (!Number.isInteger(factor.stars) || factor.stars < 1 || factor.stars > 3) errors.push(`factors[${index}].starsが不正です`);
  });
  if (errors.length) throw new Error(`FactorEntry validation error: ${errors.join(" / ")}`);
  return true;
}

export { FACTOR_ENTRY_SCHEMA_VERSION, createFactorEntry, validateFactorEntry, buildFactorFingerprint };
