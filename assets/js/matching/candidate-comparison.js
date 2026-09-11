const CANDIDATE_COMPARISON_CONFIG = {
  minimumSimilarity: 0.50,
  minimumCommonRatio: 0.65
};

let cachedSignature = null;
let cachedIndex = new Map();

function createEditAlignment(source, target) {
  const rows = source.length + 1;
  const columns = target.length + 1;
  const matrix = Array.from(
    { length: rows },
    () => Array(columns).fill(0)
  );

  for (let row = 0; row < rows; row++) {
    matrix[row][0] = row;
  }
  for (let column = 0; column < columns; column++) {
    matrix[0][column] = column;
  }

  for (let row = 1; row < rows; row++) {
    for (let column = 1; column < columns; column++) {
      const substitutionCost =
        source[row - 1] === target[column - 1] ? 0 : 1;
      matrix[row][column] = Math.min(
        matrix[row - 1][column] + 1,
        matrix[row][column - 1] + 1,
        matrix[row - 1][column - 1] + substitutionCost
      );
    }
  }

  const alignment = [];
  let row = source.length;
  let column = target.length;

  while (row > 0 || column > 0) {
    if (
      row > 0 &&
      column > 0 &&
      matrix[row][column] ===
        matrix[row - 1][column - 1] +
          (source[row - 1] === target[column - 1] ? 0 : 1)
    ) {
      alignment.push({
        sourceIndex: row - 1,
        sourceCharacter: source[row - 1],
        targetIndex: column - 1,
        targetCharacter: target[column - 1],
        type: source[row - 1] === target[column - 1]
          ? "equal"
          : "substitute"
      });
      row--;
      column--;
    } else if (
      row > 0 &&
      matrix[row][column] === matrix[row - 1][column] + 1
    ) {
      alignment.push({
        sourceIndex: row - 1,
        sourceCharacter: source[row - 1],
        targetIndex: null,
        targetCharacter: null,
        type: "delete"
      });
      row--;
    } else {
      alignment.push({
        sourceIndex: null,
        sourceCharacter: null,
        targetIndex: column - 1,
        targetCharacter: target[column - 1],
        type: "insert"
      });
      column--;
    }
  }

  return alignment.reverse();
}

function calculatePairInformation(candidate, peer) {
  const alignment = createEditAlignment(candidate, peer);
  const commonLength = alignment.filter(item => item.type === "equal").length;
  const maximumLength = Math.max(candidate.length, peer.length);
  const minimumLength = Math.min(candidate.length, peer.length);
  const editDistance = alignment.filter(item => item.type !== "equal").length;
  const similarity = maximumLength === 0
    ? 1
    : 1 - editDistance / maximumLength;
  const commonRatio = minimumLength === 0
    ? 0
    : commonLength / minimumLength;

  const distinctiveIndexes = alignment
    .filter(item =>
      item.sourceIndex !== null && item.type !== "equal"
    )
    .map(item => item.sourceIndex);

  return {
    similarity,
    commonRatio,
    distinctiveIndexes: [...new Set(distinctiveIndexes)],
    hasPeerOnlyDifference: alignment.some(item => item.type === "insert")
  };
}

function isSimilarCandidatePair(pairInformation) {
  return (
    pairInformation.similarity >=
      CANDIDATE_COMPARISON_CONFIG.minimumSimilarity &&
    pairInformation.commonRatio >=
      CANDIDATE_COMPARISON_CONFIG.minimumCommonRatio
  );
}

function createCandidateComparisonIndex(dictionary, normalize) {
  const candidates = [...new Set(dictionary)]
    .map(name => ({ name, normalized: normalize(name) }))
    .filter(item => item.normalized);
  const signature = candidates
    .map(item => `${item.name}\u0000${item.normalized}`)
    .sort()
    .join("\u0001");

  if (signature === cachedSignature) {
    return cachedIndex;
  }

  const index = new Map(
    candidates.map(item => [item.name, []])
  );

  for (let left = 0; left < candidates.length; left++) {
    for (let right = left + 1; right < candidates.length; right++) {
      const leftCandidate = candidates[left];
      const rightCandidate = candidates[right];
      const leftInformation = calculatePairInformation(
        leftCandidate.normalized,
        rightCandidate.normalized
      );

      if (!isSimilarCandidatePair(leftInformation)) {
        continue;
      }

      const rightInformation = calculatePairInformation(
        rightCandidate.normalized,
        leftCandidate.normalized
      );

      index.get(leftCandidate.name).push({
        candidate: rightCandidate.name,
        ...leftInformation
      });
      index.get(rightCandidate.name).push({
        candidate: leftCandidate.name,
        ...rightInformation
      });
    }
  }

  cachedSignature = signature;
  cachedIndex = index;
  return index;
}

function hasDistinctiveEvidence(
  normalizedOcr,
  normalizedCandidate,
  comparison
) {
  if (comparison.distinctiveIndexes.length === 0) {
    return false;
  }

  const ocrAlignment = createEditAlignment(
    normalizedCandidate,
    normalizedOcr
  );
  const exactCandidateIndexes = new Set(
    ocrAlignment
      .filter(item => item.type === "equal")
      .map(item => item.sourceIndex)
  );

  return comparison.distinctiveIndexes.every(
    index => exactCandidateIndexes.has(index)
  );
}

function evaluateCandidateAmbiguity(
  normalizedOcr,
  candidate,
  comparisonIndex,
  normalize
) {
  const comparisons = comparisonIndex.get(candidate) || [];
  const normalizedCandidate = normalize(candidate);
  const ambiguousComparisons = comparisons.filter(
    comparison => !hasDistinctiveEvidence(
      normalizedOcr,
      normalizedCandidate,
      comparison
    )
  );

  return {
    hasSimilarCandidateGroup: comparisons.length > 0,
    similarCandidates: comparisons.map(item => item.candidate),
    ambiguousCandidates: ambiguousComparisons.map(item => item.candidate),
    isAmbiguous: ambiguousComparisons.length > 0
  };
}

export {
  createEditAlignment,
  createCandidateComparisonIndex,
  evaluateCandidateAmbiguity
};
