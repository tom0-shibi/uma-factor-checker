import {
  requirements,
  members,
  MEMBER_ORDER
} from "../config.js";
import {
  getRequirementRank,
  normalizeSkillText
} from "../matching/matching.js?v=20260917-factor-master-01";
import {
  getFactorMasterEntry
} from "../matching/candidate-provider.js?v=20260918-factor-master-data-01";

const RANKS = ["S", "A", "B", "C"];

function getRequirementRankForFactor(canonicalName, factorType) {
  return ["skill", "awakening"].includes(factorType)
    ? getRequirementRank(canonicalName)
    : null;
}

function getRegisteredMemberIds() {
  return MEMBER_ORDER.filter(
    memberId => members[memberId].images.length > 0
  );
}

function getOriginalRecognition(card) {
  return {
    ocrText: card.ocrText || "",
    confidence: card.ocrConfidence ?? null,
    status: card.finalStatus || "unresolved",
    factorStatus: card.factorFinalStatus || card.finalStatus || "unresolved",
    canonicalName: card.canonicalName || null,
    factorType: card.canonicalFactorType || null,
    factorMasterMatch: card.factorMasterMatch || null,
    requirementRank: card.requirementRank || null,
    firstCandidate: card.matchCandidate || null,
    firstSimilarity: card.matchSimilarity || 0,
    secondCandidate: card.secondMatchCandidate || null,
    secondSimilarity: card.secondMatchSimilarity || 0,
    candidateScores: card.matchCandidateScores ?? [],
    ambiguousCandidates: card.ambiguousCandidates ?? [],
    reason: card.reviewReason || null,
    fallbackAttempted: Boolean(card.ocrFallbackAttempted),
    fallbackUsed: Boolean(card.ocrFallbackUsed),
    fallbackResults: card.ocrFallbackResults ?? [],
    threshold: card.matchThreshold ?? 1
  };
}

function ensureOriginalRecognition(card) {
  if (!card.originalRecognition) {
    card.originalRecognition = getOriginalRecognition(card);
  }

  return card.originalRecognition;
}

function getEffectiveRecognition(card) {
  const original = ensureOriginalRecognition(card);
  const manual = card.manualCorrection || null;

  if (manual?.ignored) {
    return {
      ...original,
      status: "ignored",
      canonicalName: null,
      requirementRank: null,
      resolutionSource: "manual",
      manualCorrection: manual
    };
  }

  if (manual?.canonicalName) {
    const factorType = getFactorMasterEntry(manual.canonicalName)?.type ?? "skill";
    const requirementRank = getRequirementRankForFactor(
      manual.canonicalName,
      factorType
    );
    return {
      ...original,
      status: "confirmed",
      factorStatus: requirementRank
        ? "confirmed-requirement"
        : "recognized-non-requirement",
      canonicalName: manual.canonicalName,
      factorType,
      requirementRank,
      resolutionSource: "manual",
      manualCorrection: manual
    };
  }

  const factorType = original.factorType ?? (
    original.canonicalName
      ? getFactorMasterEntry(original.canonicalName)?.type ?? null
      : null
  );
  const requirementRank =
    original.status === "confirmed" && original.canonicalName
      ? getRequirementRankForFactor(original.canonicalName, factorType)
      : null;

  return {
    ...original,
    factorType,
    requirementRank,
    factorStatus:
      original.status === "confirmed"
        ? requirementRank
          ? "confirmed-requirement"
          : "recognized-non-requirement"
        : original.factorStatus,
    resolutionSource: original.fallbackUsed ? "fallback" : "ocr",
    manualCorrection: null
  };
}

function buildRecognitionSummary() {
  const summary = {
    whiteCardCount: 0,
    confirmedRequirementCount: 0,
    recognizedNonRequirementCount: 0,
    recognizedSkillNonRequirementCount: 0,
    recognizedRaceCount: 0,
    recognizedOtherCount: 0,
    reviewCount: 0,
    unresolvedCount: 0,
    manualCorrectionCount: 0
  };

  MEMBER_ORDER.forEach(memberId => {
    members[memberId].analysisResults.forEach(imageResult => {
      [
        ...imageResult.analysis.leftCards,
        ...imageResult.analysis.rightCards
      ].forEach(card => {
        if (card.factorType !== "white") {
          return;
        }
        summary.whiteCardCount++;
        const effective = getEffectiveRecognition(card);
        summary.manualCorrectionCount += Number(Boolean(card.manualCorrection));
        if (effective.status === "review") {
          summary.reviewCount++;
          return;
        }
        if (effective.status === "unresolved") {
          summary.unresolvedCount++;
          return;
        }
        if (effective.status !== "confirmed") {
          return;
        }
        if (effective.requirementRank) {
          summary.confirmedRequirementCount++;
          return;
        }
        summary.recognizedNonRequirementCount++;
        if (effective.factorType === "race") {
          summary.recognizedRaceCount++;
        } else if (effective.factorType === "other") {
          summary.recognizedOtherCount++;
        } else {
          summary.recognizedSkillNonRequirementCount++;
        }
      });
    });
  });

  return summary;
}

function setManualCorrection(card, canonicalName) {
  ensureOriginalRecognition(card);
  card.manualCorrection = {
    canonicalName,
    ignored: false
  };
}

function ignoreRecognition(card) {
  ensureOriginalRecognition(card);
  card.manualCorrection = {
    canonicalName: null,
    ignored: true
  };
}

function clearManualCorrection(card) {
  delete card.manualCorrection;
}

function setManualCorrections(cards, canonicalName) {
  [...new Set(cards)].forEach(card => {
    setManualCorrection(card, canonicalName);
  });
}

function ignoreRecognitions(cards) {
  [...new Set(cards)].forEach(card => {
    ignoreRecognition(card);
  });
}

function clearManualCorrections(cards) {
  [...new Set(cards)].forEach(card => {
    clearManualCorrection(card);
  });
}

function aggregateMemberSkills(memberId) {
  const skillMap = new Map();

  members[memberId].analysisResults.forEach(imageResult => {
    const cards = [
      ...imageResult.analysis.leftCards,
      ...imageResult.analysis.rightCards
    ];

    cards.forEach(card => {
      if (card.factorType !== "white") {
        return;
      }

      const effective = getEffectiveRecognition(card);
      if (
        effective.status !== "confirmed" ||
        !effective.canonicalName ||
        !effective.requirementRank
      ) {
        return;
      }

      const key = normalizeSkillText(effective.canonicalName);
      const existing = skillMap.get(key);
      if (!existing || card.stars > existing.stars) {
        skillMap.set(key, {
          skillName: effective.canonicalName,
          stars: card.stars,
          rank: effective.requirementRank,
          matchStatus: card.matchStatus,
          ocrText: effective.ocrText,
          resolutionSource: effective.resolutionSource,
          imageIndex: imageResult.imageIndex,
          column: card.column,
          row: card.row,
          sourceThumbnail:
            card.sourceThumbnail ?? card.reviewThumbnail ?? null
        });
      }
    });
  });

  return skillMap;
}

function buildMemberSummary(memberSkillMaps) {
  const registeredMemberIds = getRegisteredMemberIds();

  return MEMBER_ORDER.map(memberId => {
    const registered = registeredMemberIds.includes(memberId);
    const counts = { S: 0, A: 0, B: 0, C: 0 };

    if (registered) {
      memberSkillMaps[memberId].forEach(skill => {
        if (counts[skill.rank] !== undefined) {
          counts[skill.rank]++;
        }
      });
    }

    return {
      memberId,
      registered,
      counts,
      total: RANKS.reduce((sum, rank) => sum + counts[rank], 0)
    };
  });
}

function buildMemberFactorInfo() {
  return Object.fromEntries(
    MEMBER_ORDER.map(memberId => {
      const factorInfo = {
        blue: null,
        red: null,
        green: null
      };

      members[memberId].analysisResults.forEach(
        imageResult => {
          const metadata =
            imageResult.analysis.factorMetadata;

          if (!metadata) {
            return;
          }

          ["blue", "red", "green"].forEach(
            type => {
              if (
                !factorInfo[type] &&
                metadata[type]
              ) {
                factorInfo[type] = {
                  ...metadata[type],
                  imageIndex:
                    imageResult.imageIndex
                };
              }
            }
          );
        }
      );

      return [memberId, factorInfo];
    })
  );
}

function buildConfirmedCanonicalNamesByMember() {
  return Object.fromEntries(
    MEMBER_ORDER.map(memberId => {
      const names = new Set();
      members[memberId].analysisResults.forEach(imageResult => {
        [
          ...imageResult.analysis.leftCards,
          ...imageResult.analysis.rightCards
        ].forEach(card => {
          if (card.factorType !== "white") {
            return;
          }
          const effective = getEffectiveRecognition(card);
          if (
            effective.status === "confirmed" &&
            effective.canonicalName
          ) {
            names.add(effective.canonicalName);
          }
        });
      });
      return [memberId, names];
    })
  );
}

function buildOverallSkillSummary() {
  const memberSkillMaps = Object.fromEntries(
    MEMBER_ORDER.map(memberId => [
      memberId,
      aggregateMemberSkills(memberId)
    ])
  );
  const registeredMemberIds = getRegisteredMemberIds();
  const result = { S: [], A: [], B: [], C: [] };

  RANKS.forEach(rank => {
    requirements[rank].forEach(skillName => {
      const key = normalizeSkillText(skillName);
      const memberValues = {};
      let ownedCount = 0;
      let totalStars = 0;

      MEMBER_ORDER.forEach(memberId => {
        const found = memberSkillMaps[memberId].get(key) || null;
        memberValues[memberId] = found;
        if (found) {
          ownedCount++;
          totalStars += found.stars;
        }
      });

      result[rank].push({
        skillName,
        rank,
        memberValues,
        ownedCount,
        totalStars
      });
    });
  });

  return {
    ranks: result,
    memberSummary: buildMemberSummary(memberSkillMaps),
    factorInfo: buildMemberFactorInfo(),
    registeredMemberIds,
    registeredMemberCount: registeredMemberIds.length
  };
}

function getReviewItems({ deduplicate = true } = {}) {
  const items = [];
  const rankOrder = { S: 0, A: 1, B: 2, C: 3 };

  function getCandidateEvidence(card, original) {
    const evidence = new Map();
    const add = (name, similarity, source) => {
      const rank = name ? getRequirementRank(name) : null;
      if (!name) {
        return;
      }
      const current = evidence.get(name);
      if (!current || similarity > current.similarity) {
        evidence.set(name, {
          name,
          similarity: Number(similarity) || 0,
          rank,
          source
        });
      }
    };

    add(original.firstCandidate, original.firstSimilarity, "normal");
    add(original.secondCandidate, original.secondSimilarity, "normal");
    original.candidateScores.forEach(candidate => {
      add(candidate.candidate, candidate.similarity, "normal-top-candidates");
    });
    original.ambiguousCandidates.forEach(candidate => {
      add(
        typeof candidate === "string"
          ? candidate
          : candidate.candidate ?? candidate.name,
        typeof candidate === "string"
          ? Math.max(
              original.firstSimilarity,
              original.secondSimilarity
            )
          : candidate.similarity,
        "ambiguity"
      );
    });
    original.fallbackResults.forEach(result => {
      add(result.firstCandidate, result.firstSimilarity, "fallback");
      add(result.secondCandidate, result.secondSimilarity, "fallback");
    });

    return [...evidence.values()].sort((a, b) => {
      const aOrder = rankOrder[a.rank] ?? 9;
      const bOrder = rankOrder[b.rank] ?? 9;
      return b.similarity - a.similarity || aOrder - bOrder;
    });
  }

  MEMBER_ORDER.forEach(memberId => {
    members[memberId].analysisResults.forEach(imageResult => {
      const cards = [
        ...imageResult.analysis.leftCards,
        ...imageResult.analysis.rightCards
      ];

      cards.forEach(card => {
        if (card.factorType !== "white") {
          return;
        }

        const original = ensureOriginalRecognition(card);
        const isReview = original.status === "review";
        const isUnrecognized = original.status === "unresolved";

        if (!isReview && !isUnrecognized) {
          return;
        }

        const suggestedCandidates = getCandidateEvidence(card, original);
        const strongestCandidate = suggestedCandidates.find(
          candidate => candidate.rank
        ) ?? null;
        const highPriority =
          isReview ||
          Boolean(
            strongestCandidate &&
            strongestCandidate.similarity >= original.threshold
          );
        const priorityRank =
          strongestCandidate &&
          strongestCandidate.similarity >= original.threshold
            ? strongestCandidate.rank
            : null;

        items.push({
          memberId,
          memberLabel: members[memberId].label,
          imageIndex: imageResult.imageIndex,
          card,
          original,
          effective: getEffectiveRecognition(card),
          type: isReview ? "review" : "unrecognized",
          priority: highPriority ? "high" : "low",
          suggestedCandidates,
          priorityRank,
          cards: [card],
          duplicateLocations: []
        });
      });
    });
  });

  const sortedItems = items.sort((a, b) => {
    if (a.priority !== b.priority) {
      return a.priority === "high" ? -1 : 1;
    }
    return (
      (rankOrder[a.priorityRank] ?? 9) -
      (rankOrder[b.priorityRank] ?? 9)
    );
  });

  if (!deduplicate) {
    return sortedItems;
  }

  const uniqueItems = [];
  const itemsByRecognition = new Map();
  sortedItems.forEach(item => {
    const candidateSignature = item.suggestedCandidates
      .slice(0, 3)
      .map(candidate => candidate.name)
      .join("|");
    const key = [
      item.memberId,
      item.card.column,
      item.card.stars,
      item.original.ocrText,
      item.original.status,
      candidateSignature
    ].join("::");
    const existing = itemsByRecognition.get(key);
    if (!existing) {
      itemsByRecognition.set(key, item);
      uniqueItems.push(item);
      return;
    }

    existing.cards.push(item.card);
    existing.duplicateLocations.push({
      imageIndex: item.imageIndex,
      column: item.card.column,
      row: item.card.row
    });
  });

  return uniqueItems;
}

export {
  RANKS,
  getRegisteredMemberIds,
  getOriginalRecognition,
  getEffectiveRecognition,
  setManualCorrection,
  setManualCorrections,
  ignoreRecognition,
  ignoreRecognitions,
  clearManualCorrection,
  clearManualCorrections,
  aggregateMemberSkills,
  buildMemberFactorInfo,
  buildConfirmedCanonicalNamesByMember,
  buildRecognitionSummary,
  buildOverallSkillSummary,
  getReviewItems
};
