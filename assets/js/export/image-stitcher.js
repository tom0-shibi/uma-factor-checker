const STITCH_CONFIG = {
  minimumOverlapRows: 3,
  maximumOverlapRows: 12,
  minimumPixelSimilarity: 0.86,
  sampleWidth: 128,
  sampleHeight: 24,
  contentHorizontalStartRatio: 0.15,
  contentHorizontalWidthRatio: 0.70
};

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    const url = URL.createObjectURL(file);
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = error => {
      URL.revokeObjectURL(url);
      reject(error);
    };
    image.src = url;
  });
}

function drawImageToCanvas(image) {
  const canvas = document.createElement("canvas");
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  canvas.getContext("2d").drawImage(image, 0, 0);
  return canvas;
}

async function createSourceCanvas(file) {
  return drawImageToCanvas(await loadImage(file));
}

function buildFactorRows(analysis) {
  const rows = new Map();
  for (const card of [
    ...(analysis?.leftCards ?? []),
    ...(analysis?.rightCards ?? [])
  ]) {
    if (!rows.has(card.row)) {
      rows.set(card.row, {
        row: card.row,
        left: null,
        right: null,
        top: card.y,
        bottom: card.y + card.height
      });
    }
    const row = rows.get(card.row);
    row[card.column] = card;
    row.top = Math.min(row.top, card.y);
    row.bottom = Math.max(row.bottom, card.y + card.height);
  }

  return [...rows.values()]
    .sort((left, right) => left.top - right.top)
    .map(row => ({
      ...row,
      signature: ["left", "right"]
        .map(column => {
          const card = row[column];
          return card
            ? `${card.factorType}:${card.stars}`
            : "none";
        })
        .join("|")
    }));
}

function getRowSignatureScore(previousRows, nextRows, overlapRows) {
  const previousStart = previousRows.length - overlapRows;
  let matches = 0;
  for (let index = 0; index < overlapRows; index++) {
    if (
      previousRows[previousStart + index].signature ===
      nextRows[index].signature
    ) {
      matches++;
    }
  }
  return matches / overlapRows;
}

function createRowSample(canvas, row) {
  const sample = document.createElement("canvas");
  sample.width = STITCH_CONFIG.sampleWidth;
  sample.height = STITCH_CONFIG.sampleHeight;
  const context = sample.getContext("2d", { willReadFrequently: true });
  context.drawImage(
    canvas,
    Math.round(canvas.width * STITCH_CONFIG.contentHorizontalStartRatio),
    Math.max(0, Math.round(row.top)),
    Math.round(canvas.width * STITCH_CONFIG.contentHorizontalWidthRatio),
    Math.max(1, Math.round(row.bottom - row.top)),
    0,
    0,
    sample.width,
    sample.height
  );
  return context.getImageData(0, 0, sample.width, sample.height).data;
}

function compareRowPixels(previousCanvas, previousRow, nextCanvas, nextRow) {
  const previous = createRowSample(previousCanvas, previousRow);
  const next = createRowSample(nextCanvas, nextRow);
  let difference = 0;
  let samples = 0;
  for (let index = 0; index < previous.length; index += 4) {
    const previousLuminance =
      previous[index] * 0.2126 +
      previous[index + 1] * 0.7152 +
      previous[index + 2] * 0.0722;
    const nextLuminance =
      next[index] * 0.2126 +
      next[index + 1] * 0.7152 +
      next[index + 2] * 0.0722;
    difference += Math.abs(previousLuminance - nextLuminance);
    samples++;
  }
  return 1 - difference / (samples * 255);
}

function getPixelSimilarity(
  previousCanvas,
  previousRows,
  nextCanvas,
  nextRows,
  overlapRows
) {
  const previousStart = previousRows.length - overlapRows;
  let similarity = 0;
  for (let index = 0; index < overlapRows; index++) {
    similarity += compareRowPixels(
      previousCanvas,
      previousRows[previousStart + index],
      nextCanvas,
      nextRows[index]
    );
  }
  return similarity / overlapRows;
}

function getCropY(rows, overlapRows, imageHeight) {
  if (overlapRows <= 0) {
    return 0;
  }
  if (overlapRows >= rows.length) {
    return imageHeight;
  }
  return Math.round(
    (rows[overlapRows - 1].bottom + rows[overlapRows].top) / 2
  );
}

function getContentEndY(rows, imageHeight) {
  if (rows.length === 0) {
    return imageHeight;
  }
  const last = rows.at(-1);
  const previous = rows.at(-2);
  const pitch = previous
    ? last.top - previous.top
    : last.bottom - last.top;
  return Math.min(
    imageHeight,
    Math.round(last.bottom + Math.max(2, pitch * 0.18))
  );
}

function findImageOverlap(
  previousCanvas,
  previousAnalysis,
  nextCanvas,
  nextAnalysis
) {
  const previousRows = buildFactorRows(previousAnalysis);
  const nextRows = buildFactorRows(nextAnalysis);
  const maximum = Math.min(
    STITCH_CONFIG.maximumOverlapRows,
    previousRows.length,
    nextRows.length
  );

  for (
    let overlapRows = maximum;
    overlapRows >= STITCH_CONFIG.minimumOverlapRows;
    overlapRows--
  ) {
    const rowSignatureScore = getRowSignatureScore(
      previousRows,
      nextRows,
      overlapRows
    );
    if (rowSignatureScore !== 1) {
      continue;
    }
    const pixelSimilarity = getPixelSimilarity(
      previousCanvas,
      previousRows,
      nextCanvas,
      nextRows,
      overlapRows
    );
    if (pixelSimilarity < STITCH_CONFIG.minimumPixelSimilarity) {
      continue;
    }
    return {
      status: "confirmed",
      overlapRows,
      cropY: getCropY(nextRows, overlapRows, nextCanvas.height),
      rowSignatureScore,
      pixelSimilarity
    };
  }

  return {
    status: "unresolved",
    overlapRows: 0,
    cropY: 0,
    rowSignatureScore: 0,
    pixelSimilarity: 0
  };
}

async function stitchMemberImages(imageItems, analysisResults) {
  const sources = await Promise.all(
    imageItems.map(async imageItem => {
      const analysisResult = analysisResults.find(
        item => item.imageId === imageItem.id
      );
      return {
        imageItem,
        canvas: await createSourceCanvas(imageItem.file),
        analysis: analysisResult?.analysis ?? null
      };
    })
  );

  if (sources.length === 0) {
    return null;
  }

  const boundaries = [];
  for (let index = 1; index < sources.length; index++) {
    const previous = sources[index - 1];
    const next = sources[index];
    const overlap =
      previous.analysis?.supported && next.analysis?.supported
        ? findImageOverlap(
            previous.canvas,
            previous.analysis,
            next.canvas,
            next.analysis
          )
        : {
            status: "unresolved",
            overlapRows: 0,
            cropY: 0,
            rowSignatureScore: 0,
            pixelSimilarity: 0
          };
    boundaries.push({
      fromImage: index,
      toImage: index + 1,
      ...overlap
    });
  }

  const targetWidth = Math.max(...sources.map(source => source.canvas.width));
  const segments = sources.map((source, index) => {
    const previousBoundary = boundaries[index - 1];
    const nextBoundary = boundaries[index];
    const startY = previousBoundary?.status === "confirmed"
      ? previousBoundary.cropY
      : 0;
    const rows = buildFactorRows(source.analysis);
    const endY = nextBoundary?.status === "confirmed"
      ? getContentEndY(rows, source.canvas.height)
      : source.canvas.height;
    return {
      source,
      startY,
      endY,
      height: Math.max(0, endY - startY)
    };
  });

  const canvas = document.createElement("canvas");
  canvas.width = targetWidth;
  canvas.height = Math.max(
    1,
    Math.round(
      segments.reduce(
        (total, segment) =>
          total + segment.height * targetWidth / segment.source.canvas.width,
        0
      )
    )
  );
  const context = canvas.getContext("2d");
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";

  let destinationY = 0;
  for (const segment of segments) {
    if (segment.height <= 0) {
      continue;
    }
    const destinationHeight =
      segment.height * targetWidth / segment.source.canvas.width;
    context.drawImage(
      segment.source.canvas,
      0,
      segment.startY,
      segment.source.canvas.width,
      segment.height,
      0,
      destinationY,
      targetWidth,
      destinationHeight
    );
    destinationY += destinationHeight;
  }

  return {
    canvas,
    boundaries,
    sourceImageCount: sources.length,
    warning: boundaries.some(boundary => boundary.status !== "confirmed")
      ? "一部の画像で重複範囲を自動判定できませんでした。"
      : ""
  };
}

export {
  STITCH_CONFIG,
  buildFactorRows,
  compareRowPixels,
  findImageOverlap,
  stitchMemberImages
};
