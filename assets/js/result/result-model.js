import {
  requirements,
  members,
  MEMBER_ORDER
} from "../config.js";
import {
  getRequirementRank,
  normalizeSkillText
} from "../matching/matching.js";

const RANKS = ["S", "A", "B", "C"];

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
    canonicalName: card.canonicalName || null,
    requirementRank: card.requirementRank || null,
    firstCandidate: card.matchCandidate || null,
    firstSimilarity: card.matchSimilarity || 0,
    secondCandidate: card.secondMatchCandidate || null,
    secondSimilarity: card.secondMatchSimilarity || 0,
    reason: card.reviewReason || null,
    fallbackAttempted: Boolean(card.ocrFallbackAttempted),
    fallbackUsed: Boolean(card.ocrFallbackUsed)
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
    return {
      ...original,
      status: "confirmed",
      canonicalName: manual.canonicalName,
      requirementRank: getRequirementRank(manual.canonicalName),
      resolutionSource: "manual",
      manualCorrection: manual
    };
  }

  return {
    ...original,
    requirementRank:
      original.status === "confirmed" && original.canonicalName
        ? getRequirementRank(original.canonicalName)
        : null,
    resolutionSource: original.fallbackUsed ? "fallback" : "ocr",
    manualCorrection: null
  };
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
  card.manualCorrection = null;
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
          row: card.row
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
    registeredMemberIds,
    registeredMemberCount: registeredMemberIds.length
  };
}

function getReviewItems() {
  const items = [];

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
        const isUnrecognized =
          original.status === "unresolved" &&
          !original.ocrText &&
          original.fallbackAttempted &&
          !original.canonicalName;

        if (!isReview && !isUnrecognized) {
          return;
        }

        items.push({
          memberId,
          memberLabel: members[memberId].label,
          imageIndex: imageResult.imageIndex,
          card,
          original,
          effective: getEffectiveRecognition(card),
          type: isReview ? "review" : "unrecognized"
        });
      });
    });
  });

  return items;
}

export {
  RANKS,
  getRegisteredMemberIds,
  getOriginalRecognition,
  getEffectiveRecognition,
  setManualCorrection,
  ignoreRecognition,
  clearManualCorrection,
  aggregateMemberSkills,
  buildOverallSkillSummary,
  getReviewItems
};
