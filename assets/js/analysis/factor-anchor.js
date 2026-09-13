const FACTOR_ANCHOR_CONFIG = {
  searchStartRatio: 0.10,
  searchEndRatio: 0.82,
  scanStepY: 2,
  minimumGreenCoverage: 0.48,
  minimumContinuousWidthRatio: 0.44,
  detailAnchorWidthRatio: 0.75,
  minimumHeightRatio: 0.004,
  maximumHeightRatio: 0.035
};

function isFactorHeaderGreen(r, g, b) {
  return (
    g > 110 &&
    g > r + 30 &&
    g > b + 45
  );
}

function inspectAnchorRow(ctx, width, y) {
  const startX = Math.floor(width * 0.02);
  const endX = Math.ceil(width * 0.98);
  const scanWidth = Math.max(1, endX - startX);
  const data = ctx.getImageData(startX, y, scanWidth, 1).data;
  let greenPixels = 0;
  let currentRun = 0;
  let longestRun = 0;

  for (let index = 0; index < data.length; index += 4) {
    if (isFactorHeaderGreen(data[index], data[index + 1], data[index + 2])) {
      greenPixels++;
      currentRun++;
      longestRun = Math.max(longestRun, currentRun);
    } else {
      currentRun = 0;
    }
  }

  return {
    greenCoverage: greenPixels / scanWidth,
    continuousWidthRatio: longestRun / width
  };
}

function groupMatchingRows(rows) {
  if (rows.length === 0) {
    return [];
  }
  const groups = [];
  let current = [rows[0]];
  for (let index = 1; index < rows.length; index++) {
    if (rows[index].y - rows[index - 1].y <= 4) {
      current.push(rows[index]);
    } else {
      groups.push(current);
      current = [rows[index]];
    }
  }
  groups.push(current);
  return groups;
}

function detectFactorSectionAnchorCandidates(ctx, width, height) {
  const matchingRows = [];
  const startY = Math.floor(height * FACTOR_ANCHOR_CONFIG.searchStartRatio);
  const endY = Math.floor(height * FACTOR_ANCHOR_CONFIG.searchEndRatio);

  for (let y = startY; y < endY; y += FACTOR_ANCHOR_CONFIG.scanStepY) {
    const metrics = inspectAnchorRow(ctx, width, y);
    if (
      metrics.greenCoverage >= FACTOR_ANCHOR_CONFIG.minimumGreenCoverage &&
      metrics.continuousWidthRatio >= FACTOR_ANCHOR_CONFIG.minimumContinuousWidthRatio
    ) {
      matchingRows.push({ y, ...metrics });
    }
  }

  const minimumHeight = Math.max(
    6,
    height * FACTOR_ANCHOR_CONFIG.minimumHeightRatio
  );
  const maximumHeight = height * FACTOR_ANCHOR_CONFIG.maximumHeightRatio;
  const groups = groupMatchingRows(matchingRows).filter(group => {
    const groupHeight = group[group.length - 1].y - group[0].y + 2;
    return groupHeight >= minimumHeight && groupHeight <= maximumHeight;
  });

  return groups.map(group => {
    const averageCoverage = group.reduce(
      (sum, row) => sum + row.greenCoverage,
      0
    ) / group.length;
    const averageContinuousWidth = group.reduce(
      (sum, row) => sum + row.continuousWidthRatio,
      0
    ) / group.length;

    return {
      top: group[0].y,
      bottom: group[group.length - 1].y,
      centerY: Math.round((group[0].y + group[group.length - 1].y) / 2),
      greenCoverage: averageCoverage,
      continuousWidthRatio: averageContinuousWidth
    };
  });
}

function detectFactorSectionAnchor(ctx, width, height) {
  return detectFactorSectionAnchorCandidates(ctx, width, height)[0] ?? null;
}

function classifyFactorLayout(anchor) {
  if (!anchor) {
    return "continuation";
  }
  return anchor.continuousWidthRatio >= FACTOR_ANCHOR_CONFIG.detailAnchorWidthRatio
    ? "detail"
    : "factor-list";
}

export {
  FACTOR_ANCHOR_CONFIG,
  classifyFactorLayout,
  detectFactorSectionAnchor,
  detectFactorSectionAnchorCandidates,
  isFactorHeaderGreen
};
