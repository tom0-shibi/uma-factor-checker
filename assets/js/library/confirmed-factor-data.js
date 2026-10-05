import { members } from "../config.js";
import { getEffectiveRecognition } from "../result/result-model.js";
import { getFactorMasterEntry } from "../matching/candidate-provider.js";

function validStars(value) {
  return Number.isInteger(value) && value >= 1 && value <= 3;
}

function confirmedFactorFromMaster(entry, stars, resolutionSource = "ocr") {
  return { factorId: entry.factorId, nameSnapshot: entry.name, color: entry.color, type: entry.type, stars, resolutionSource };
}

function addConfirmed(map, factor) {
  const current = map.get(factor.factorId);
  if (!current || factor.stars > current.stars) map.set(factor.factorId, factor);
}

function collectConfirmedFactorData(memberId) {
  const member = members[memberId];
  if (!member) throw new Error(`Unknown memberId: ${memberId}`);
  const confirmed = new Map();
  const unresolvedFactors = [];

  member.analysisResults.forEach(imageResult => {
    const metadata = imageResult.analysis.factorMetadata ?? {};
    for (const color of ["blue", "red", "green"]) {
      const item = metadata[color];
      if (!item || !validStars(item.stars)) continue;
      if (item.status === "confirmed" && item.name) {
        const master = getFactorMasterEntry(item.name);
        if (master?.factorId) {
          addConfirmed(confirmed, confirmedFactorFromMaster(master, item.stars));
          continue;
        }
      }
      unresolvedFactors.push({
        ocrText: item.ocrText ?? item.rawOcrText ?? item.name ?? "",
        stars: item.stars,
        confidence: item.confidence ?? null,
        candidates: item.candidate ? [item.candidate] : [],
        reason: item.status === "confirmed" ? "master-unregistered" : "metadata-unresolved",
        imageIndex: imageResult.imageIndex,
        color
      });
    }

    const cards = [...(imageResult.analysis.leftCards ?? []), ...(imageResult.analysis.rightCards ?? [])];
    cards.forEach(card => {
      if (card.factorType !== "white" || !validStars(card.stars)) return;
      const effective = getEffectiveRecognition(card);
      if (effective.status === "ignored") return;
      if (effective.status === "confirmed" && effective.canonicalName) {
        const master = getFactorMasterEntry(effective.canonicalName);
        if (master?.factorId) {
          addConfirmed(confirmed, confirmedFactorFromMaster(master, effective.stars, effective.resolutionSource));
          return;
        }
      }
      unresolvedFactors.push({
        ocrText: effective.ocrText ?? card.ocrText ?? "",
        stars: card.stars,
        confidence: effective.confidence ?? card.ocrConfidence ?? null,
        candidates: [effective.firstCandidate, effective.secondCandidate, ...(effective.candidateScores ?? []).map(item => item.candidate)].filter(Boolean).filter((value, index, values) => values.indexOf(value) === index),
        reason: effective.status === "confirmed" ? "master-unregistered" : effective.reason ?? effective.status ?? "unresolved",
        imageIndex: imageResult.imageIndex,
        column: card.column ?? null,
        row: card.row ?? null,
        color: "white"
      });
    });
  });

  return { factors: [...confirmed.values()], unresolvedFactors };
}

export { collectConfirmedFactorData };
