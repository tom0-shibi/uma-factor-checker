import { ANALYSIS_CONFIG, STAR_CONFIG } from "../config.js";

/* =========================================================
  FileをImageへ読み込む処理
  ========================================================= */

function loadImageElement(file) {
  return new Promise(
    (
      resolve,
      reject
    ) => {
      const image =
        new Image();

      const url =
        URL.createObjectURL(
          file
        );

      image.onload = () => {
        URL.revokeObjectURL(
          url
        );

        resolve(image);
      };

      image.onerror =
        error => {
          URL.revokeObjectURL(
            url
          );

          reject(error);
        };

      image.src = url;
    }
  );
}

/* =========================================================
  元画像を解析Canvasへ描画する処理
  ========================================================= */

async function drawOriginalImage(
  file
) {
  const image =
    await loadImageElement(
      file
    );

  const canvas =
    document.getElementById(
      "analysis-canvas"
    );

  canvas.width =
    image.naturalWidth;

  canvas.height =
    image.naturalHeight;

  const ctx =
    canvas.getContext(
      "2d",
      {
        willReadFrequently: true
      }
    );

  ctx.clearRect(
    0,
    0,
    canvas.width,
    canvas.height
  );

  ctx.drawImage(
    image,
    0,
    0
  );

  return {
    canvas,
    ctx,
    width:
      canvas.width,
    height:
      canvas.height
  };
}

/* =========================================================
  RGBから明るさを計算する処理
  ========================================================= */

function getLuminance(
  r,
  g,
  b
) {
  return (
    0.2126 * r +
    0.7152 * g +
    0.0722 * b
  );
}

/* =========================================================
  指定範囲の平均RGB取得処理
  ========================================================= */

function getAverageColor(
  ctx,
  x,
  y,
  width,
  height
) {
  const safeX =
    Math.max(
      0,
      Math.floor(x)
    );

  const safeY =
    Math.max(
      0,
      Math.floor(y)
    );

  const safeWidth =
    Math.max(
      1,
      Math.floor(width)
    );

  const safeHeight =
    Math.max(
      1,
      Math.floor(height)
    );

  const data =
    ctx.getImageData(
      safeX,
      safeY,
      safeWidth,
      safeHeight
    ).data;

  let r = 0;
  let g = 0;
  let b = 0;
  let count = 0;

  for (
    let i = 0;
    i < data.length;
    i += 4
  ) {
    r += data[i];
    g += data[i + 1];
    b += data[i + 2];
    count++;
  }

  return {
    r:
      Math.round(
        r / count
      ),
    g:
      Math.round(
        g / count
      ),
    b:
      Math.round(
        b / count
      )
  };
}

/* =========================================================
  「所持因子」緑ヘッダー検出処理
  ========================================================= */

function detectFactorHeader(
  ctx,
  width,
  height
) {
  const startY =
    Math.floor(
      height * 0.12
    );

  const endY =
    Math.floor(
      height * 0.35
    );

  const startX =
    Math.floor(
      width * 0.14
    );

  const endX =
    Math.floor(
      width * 0.86
    );

  const stepX =
    Math.max(
      2,
      Math.floor(
        width / 300
      )
    );

  const matchingRows = [];

  for (
    let y = startY;
    y < endY;
    y += 2
  ) {
    let greenCount = 0;
    let total = 0;

    for (
      let x = startX;
      x < endX;
      x += stepX
    ) {
      const pixel =
        ctx.getImageData(
          x,
          y,
          1,
          1
        ).data;

      const r = pixel[0];
      const g = pixel[1];
      const b = pixel[2];

      const isGreen =
        g > 120 &&
        g > r + 25 &&
        g > b + 35;

      if (isGreen) {
        greenCount++;
      }

      total++;
    }

    if (
      greenCount /
      total >
      0.55
    ) {
      matchingRows.push(
        y
      );
    }
  }

  if (
    matchingRows.length === 0
  ) {
    return null;
  }

  const groups = [];
  let current = [
    matchingRows[0]
  ];

  for (
    let i = 1;
    i < matchingRows.length;
    i++
  ) {
    if (
      matchingRows[i] -
      matchingRows[i - 1] <= 4
    ) {
      current.push(
        matchingRows[i]
      );
    } else {
      groups.push(
        current
      );

      current = [
        matchingRows[i]
      ];
    }
  }

  groups.push(
    current
  );

  const validGroups =
    groups.filter(
      group =>
        group.length >= 3
    );

  if (
    validGroups.length === 0
  ) {
    return null;
  }

  const target =
    validGroups[0];

  return {
    top:
      target[0],
    bottom:
      target[
        target.length - 1
      ]
  };
}

/* =========================================================
  指定Y座標の平均明るさ取得処理
  ========================================================= */

function getRowLuminance(
  ctx,
  columnX,
  columnWidth,
  y,
  imageWidth
) {
  const patchSize =
    Math.max(
      2,
      Math.floor(
        imageWidth * 0.003
      )
    );

  let total = 0;

  ANALYSIS_CONFIG
    .scanXPositions
    .forEach(
      position => {
        const color =
          getAverageColor(
            ctx,
            columnX +
              columnWidth *
              position,
            y,
            patchSize,
            patchSize
          );

        total +=
          getLuminance(
            color.r,
            color.g,
            color.b
          );
      }
    );

  return (
    total /
    ANALYSIS_CONFIG
      .scanXPositions.length
  );
}

/* =========================================================
  1列分の因子カード候補検出処理
  ========================================================= */

function detectCardsInColumn(
  ctx,
  width,
  height,
  columnName,
  factorAreaTop,
  factorAreaBottom
) {
  const column =
    ANALYSIS_CONFIG
      .columns[columnName];

  const columnX =
    width *
    column.xRatio;

  const columnWidth =
    width *
    column.widthRatio;

  const minimumGapHeight =
    Math.max(
      2,
      height *
        ANALYSIS_CONFIG
          .minimumGapRatio
    );

  const samples = [];

  for (
    let y =
      factorAreaTop;
    y <
      factorAreaBottom;
    y += 2
  ) {
    samples.push({
      y,
      luminance:
        getRowLuminance(
          ctx,
          columnX,
          columnWidth,
          y,
          width
        )
    });
  }

  const gaps = [];
  let gapStart = null;

  samples.forEach(
    sample => {
      const isGap =
        sample.luminance >=
        ANALYSIS_CONFIG
          .gapLuminanceThreshold;

      if (
        isGap &&
        gapStart === null
      ) {
        gapStart =
          sample.y;
      }

      if (
        !isGap &&
        gapStart !== null
      ) {
        const gapHeight =
          sample.y -
          gapStart;

        if (
          gapHeight >=
          minimumGapHeight
        ) {
          gaps.push({
            top:
              gapStart,
            bottom:
              sample.y
          });
        }

        gapStart = null;
      }
    }
  );

  if (
    gapStart !== null
  ) {
    const gapHeight =
      factorAreaBottom -
      gapStart;

    if (
      gapHeight >=
      minimumGapHeight
    ) {
      gaps.push({
        top:
          gapStart,
        bottom:
          factorAreaBottom
      });
    }
  }

  const boundaries = [
    factorAreaTop,
    ...gaps.map(
      gap =>
        (
          gap.top +
          gap.bottom
        ) / 2
    ),
    factorAreaBottom
  ];

  const minimumCardHeight =
    height *
    ANALYSIS_CONFIG
      .minimumCardHeightRatio;

  const maximumCardHeight =
    height *
    ANALYSIS_CONFIG
      .maximumCardHeightRatio;

  const cards = [];

  for (
    let i = 0;
    i <
      boundaries.length - 1;
    i++
  ) {
    const top =
      boundaries[i];

    const bottom =
      boundaries[i + 1];

    const cardHeight =
      bottom - top;

    if (
      cardHeight <
        minimumCardHeight ||
      cardHeight >
        maximumCardHeight
    ) {
      continue;
    }

    const padding =
      Math.max(
        1,
        Math.round(
          height * 0.0015
        )
      );

    cards.push({
      column:
        columnName,
      row:
        cards.length + 1,
      x:
        Math.round(
          columnX
        ),
      y:
        Math.round(
          top + padding
        ),
      width:
        Math.round(
          columnWidth
        ),
      height:
        Math.round(
          cardHeight -
          padding * 2
        )
    });
  }

  return cards;
}

/* =========================================================
  因子カード左端のアイコン検出処理
  ========================================================= */

function hasFactorIcon(
  ctx,
  card
) {
  const x =
    Math.round(
      card.x +
      card.width * 0.015
    );

  const y =
    Math.round(
      card.y +
      card.height * 0.12
    );

  const width =
    Math.max(
      8,
      Math.round(
        card.width * 0.10
      )
    );

  const height =
    Math.max(
      8,
      Math.round(
        card.height * 0.65
      )
    );

  const data =
    ctx.getImageData(
      x,
      y,
      width,
      height
    ).data;

  let iconPixels = 0;
  let totalPixels = 0;

  for (
    let i = 0;
    i < data.length;
    i += 4
  ) {
    const r = data[i];
    const g =
      data[i + 1];
    const b =
      data[i + 2];

    const isBlueIcon =
      b - r >= 3 &&
      b - g >= 2 &&
      b > 135 &&
      r < 245;

    const isGoldIcon =
      r > 165 &&
      g > 105 &&
      r - b > 25 &&
      g - b > 15;

    if (
      isBlueIcon ||
      isGoldIcon
    ) {
      iconPixels++;
    }

    totalPixels++;
  }

  return (
    iconPixels /
    totalPixels >
    0.07
  );
}

/* =========================================================
  カード本体が十分写っているか確認する処理
  ========================================================= */

function hasFullCardBody(
  ctx,
  card
) {
  const samplePositions = [
    {
      x: 0.70,
      y: 0.25
    },
    {
      x: 0.82,
      y: 0.25
    },
    {
      x: 0.90,
      y: 0.25
    }
  ];

  const patchSize =
    Math.max(
      3,
      Math.round(
        card.width * 0.025
      )
    );

  const colors =
    samplePositions.map(
      position =>
        getAverageColor(
          ctx,
          card.x +
            card.width *
            position.x,
          card.y +
            card.height *
            position.y,
          patchSize,
          patchSize
        )
    );

  const average = {
    r:
      colors.reduce(
        (
          sum,
          color
        ) =>
          sum + color.r,
        0
      ) /
      colors.length,
    g:
      colors.reduce(
        (
          sum,
          color
        ) =>
          sum + color.g,
        0
      ) /
      colors.length,
    b:
      colors.reduce(
        (
          sum,
          color
        ) =>
          sum + color.b,
        0
      ) /
      colors.length
  };

  const luminance =
    getLuminance(
      average.r,
      average.g,
      average.b
    );

  const colorSpread =
    Math.max(
      average.r,
      average.g,
      average.b
    ) -
    Math.min(
      average.r,
      average.g,
      average.b
    );

  return (
    luminance < 242 ||
    colorSpread > 18
  );
}

/* =========================================================
  因子カードの共通行間隔計算処理
  ========================================================= */

function calculateRowPitch(
  cards
) {
  const yValues = [
    ...new Set(
      cards
        .map(
          card =>
            card.y
        )
        .sort(
          (
            a,
            b
          ) =>
            a - b
        )
    )
  ];

  const differences = [];

  for (
    let i = 1;
    i < yValues.length;
    i++
  ) {
    const diff =
      yValues[i] -
      yValues[i - 1];

    if (
      diff >= 40 &&
      diff <= 120
    ) {
      differences.push(
        diff
      );
    }
  }

  if (
    differences.length === 0
  ) {
    return null;
  }

  differences.sort(
    (
      a,
      b
    ) =>
      a - b
  );

  return differences[
    Math.floor(
      differences.length / 2
    )
  ];
}

/* =========================================================
  左右共通の因子行生成処理
  ========================================================= */

function buildFactorRows(
  ctx,
  width,
  height,
  initialCards,
  factorAreaBottom
) {
  if (
    initialCards.length === 0
  ) {
    return {
      pitch: null,
      cardHeight: null,
      rows: []
    };
  }

  const pitch =
    calculateRowPitch(
      initialCards
    );

  if (!pitch) {
    return {
      pitch: null,
      cardHeight: null,
      rows: []
    };
  }

  const typicalHeights =
    initialCards
      .map(
        card =>
          card.height
      )
      .filter(
        cardHeight =>
          cardHeight >=
            pitch * 0.65 &&
          cardHeight <=
            pitch * 1.2
      )
      .sort(
        (
          a,
          b
        ) =>
          a - b
      );

  const cardHeight =
    typicalHeights.length > 0
      ? typicalHeights[
          Math.floor(
            typicalHeights.length /
            2
          )
        ]
      : pitch * 0.9;

  const candidateYs =
    initialCards
      .map(
        card =>
          card.y
      )
      .sort(
        (
          a,
          b
        ) =>
          a - b
      );

  const mergedCandidateYs = [];

  candidateYs.forEach(
    y => {
      const last =
        mergedCandidateYs[
          mergedCandidateYs.length -
          1
        ];

      if (
        last === undefined ||
        Math.abs(
          y - last
        ) >
          pitch * 0.25
      ) {
        mergedCandidateYs.push(
          y
        );
      }
    }
  );

  let firstY = null;

  for (
    const candidateY
    of mergedCandidateYs
  ) {
    const leftCard = {
      column: "left",
      row: 1,
      x:
        Math.round(
          width *
          ANALYSIS_CONFIG
            .columns.left
            .xRatio
        ),
      y:
        Math.round(
          candidateY
        ),
      width:
        Math.round(
          width *
          ANALYSIS_CONFIG
            .columns.left
            .widthRatio
        ),
      height:
        Math.round(
          cardHeight
        )
    };

    const rightCard = {
      column: "right",
      row: 1,
      x:
        Math.round(
          width *
          ANALYSIS_CONFIG
            .columns.right
            .xRatio
        ),
      y:
        Math.round(
          candidateY
        ),
      width:
        Math.round(
          width *
          ANALYSIS_CONFIG
            .columns.right
            .widthRatio
        ),
      height:
        Math.round(
          cardHeight
        )
    };

    const leftValid =
      hasFactorIcon(
        ctx,
        leftCard
      ) &&
      hasFullCardBody(
        ctx,
        leftCard
      );

    const rightValid =
      hasFactorIcon(
        ctx,
        rightCard
      ) &&
      hasFullCardBody(
        ctx,
        rightCard
      );

    if (
      leftValid ||
      rightValid
    ) {
      firstY =
        candidateY;

      break;
    }
  }

  if (
    firstY === null
  ) {
    return {
      pitch,
      cardHeight,
      rows: []
    };
  }

  const rows = [];

  for (
    let rowIndex = 0;
    ;
    rowIndex++
  ) {
    const y =
      firstY +
      pitch * rowIndex;

    if (
      y +
      cardHeight >
      factorAreaBottom
    ) {
      break;
    }

    const leftCard = {
      column: "left",
      row:
        rowIndex + 1,
      x:
        Math.round(
          width *
          ANALYSIS_CONFIG
            .columns.left
            .xRatio
        ),
      y:
        Math.round(y),
      width:
        Math.round(
          width *
          ANALYSIS_CONFIG
            .columns.left
            .widthRatio
        ),
      height:
        Math.round(
          cardHeight
        )
    };

    const rightCard = {
      column: "right",
      row:
        rowIndex + 1,
      x:
        Math.round(
          width *
          ANALYSIS_CONFIG
            .columns.right
            .xRatio
        ),
      y:
        Math.round(y),
      width:
        Math.round(
          width *
          ANALYSIS_CONFIG
            .columns.right
            .widthRatio
        ),
      height:
        Math.round(
          cardHeight
        )
    };

    const hasLeft =
      hasFactorIcon(
        ctx,
        leftCard
      ) &&
      hasFullCardBody(
        ctx,
        leftCard
      );

    const hasRight =
      hasFactorIcon(
        ctx,
        rightCard
      ) &&
      hasFullCardBody(
        ctx,
        rightCard
      );

    if (
      !hasLeft &&
      !hasRight
    ) {
      break;
    }

    rows.push({
      row:
        rowIndex + 1,
      y:
        Math.round(y),
      leftCard:
        hasLeft
          ? leftCard
          : null,
      rightCard:
        hasRight
          ? rightCard
          : null
    });
  }

  return {
    pitch,
    cardHeight,
    rows
  };
}

/* =========================================================
  因子カード色判定処理
  ========================================================= */

function classifyDetectedCard(
  ctx,
  card
) {
  const patchSize =
    Math.max(
      2,
      Math.floor(
        card.width * 0.025
      )
    );

  const samplePositions = [
    {
      x: 0.68,
      y: 0.25
    },
    {
      x: 0.80,
      y: 0.25
    },
    {
      x: 0.90,
      y: 0.25
    }
  ];

  const colors =
    samplePositions.map(
      position =>
        getAverageColor(
          ctx,
          card.x +
            card.width *
            position.x,
          card.y +
            card.height *
            position.y,
          patchSize,
          patchSize
        )
    );

  const color = {
    r:
      Math.round(
        colors.reduce(
          (
            sum,
            item
          ) =>
            sum + item.r,
          0
        ) /
        colors.length
      ),
    g:
      Math.round(
        colors.reduce(
          (
            sum,
            item
          ) =>
            sum + item.g,
          0
        ) /
        colors.length
      ),
    b:
      Math.round(
        colors.reduce(
          (
            sum,
            item
          ) =>
            sum + item.b,
          0
        ) /
        colors.length
      )
  };

  let factorType =
    "white";

  if (
    color.b > 170 &&
    color.b >
      color.r + 35 &&
    color.b >
      color.g + 10
  ) {
    factorType =
      "blue";
  } else if (
    color.r > 190 &&
    color.r >
      color.g + 30 &&
    color.b > 120
  ) {
    factorType =
      "red";
  } else if (
    color.g > 140 &&
    color.g >
      color.r + 25 &&
    color.g >
      color.b + 25
  ) {
    factorType =
      "green";
  }

  return {
    ...card,
    factorType,
    color
  };
}

/* =========================================================
  星領域算出処理
  ========================================================= */

function getStarArea(
  card
) {
  return {
    x:
      Math.round(
        card.x +
        card.width *
        STAR_CONFIG
          .area.xRatio
      ),
    y:
      Math.round(
        card.y +
        card.height *
        STAR_CONFIG
          .area.yRatio
      ),
    width:
      Math.round(
        card.width *
        STAR_CONFIG
          .area.widthRatio
      ),
    height:
      Math.round(
        card.height *
        STAR_CONFIG
          .area.heightRatio
      )
  };
}

/* =========================================================
  黄色い取得済み星ピクセル判定処理
  ========================================================= */

function isYellowStarPixel(
  r,
  g,
  b
) {
  return (
    r >=
      STAR_CONFIG
        .yellow.minR &&
    g >=
      STAR_CONFIG
        .yellow.minG &&
    b <=
      STAR_CONFIG
        .yellow.maxB &&
    r - b >=
      STAR_CONFIG
        .yellow
        .minRGDiffFromB &&
    g - b >=
      STAR_CONFIG
        .yellow
        .minRGDiffFromB
  );
}

/* =========================================================
  ★1～3判定処理
  ========================================================= */

function detectStarCount(
  ctx,
  card
) {
  const area =
    getStarArea(
      card
    );

  const segmentWidth =
    area.width / 3;

  const starStates = [];
  const yellowRatios = [];

  for (
    let starIndex = 0;
    starIndex < 3;
    starIndex++
  ) {
    const x =
      Math.round(
        area.x +
        segmentWidth *
        starIndex
      );

    const width =
      Math.max(
        1,
        Math.round(
          segmentWidth
        )
      );

    const data =
      ctx.getImageData(
        x,
        area.y,
        width,
        area.height
      ).data;

    let yellowPixels = 0;
    let totalPixels = 0;

    for (
      let i = 0;
      i < data.length;
      i += 4
    ) {
      const r =
        data[i];

      const g =
        data[i + 1];

      const b =
        data[i + 2];

      if (
        isYellowStarPixel(
          r,
          g,
          b
        )
      ) {
        yellowPixels++;
      }

      totalPixels++;
    }

    const ratio =
      yellowPixels /
      totalPixels;

    yellowRatios.push(
      ratio
    );

    starStates.push(
      ratio >=
      STAR_CONFIG
        .minimumYellowRatio
    );
  }

  return {
    stars:
      starStates.filter(
        Boolean
      ).length,
    starStates,
    yellowRatios,
    area
  };
}

/* =========================================================
  因子一覧画像全体解析処理
  ========================================================= */

function analyzeFactorImage(
  ctx,
  width,
  height
) {
  const header =
    detectFactorHeader(
      ctx,
      width,
      height
    );

  const factorAreaTop =
    header
      ? Math.round(
          header.bottom +
          height * 0.008
        )
      : Math.round(
          height *
          ANALYSIS_CONFIG
            .factorArea
            .fallbackTopRatio
        );

  const factorAreaBottom =
    Math.round(
      height *
      ANALYSIS_CONFIG
        .factorArea
        .bottomRatio
    );

  const initialLeft =
    detectCardsInColumn(
      ctx,
      width,
      height,
      "left",
      factorAreaTop,
      factorAreaBottom
    );

  const initialRight =
    detectCardsInColumn(
      ctx,
      width,
      height,
      "right",
      factorAreaTop,
      factorAreaBottom
    );

  const initialCards = [
    ...initialLeft,
    ...initialRight
  ];

  const rowResult =
    buildFactorRows(
      ctx,
      width,
      height,
      initialCards,
      factorAreaBottom
    );

  if (
    !rowResult ||
    !Array.isArray(
      rowResult.rows
    ) ||
    rowResult.rows.length === 0
  ) {
    return {
      header,
      factorAreaTop,
      factorAreaBottom,
      pitch: null,
      leftCards: [],
      rightCards: []
    };
  }

  const leftCards = [];
  const rightCards = [];

  rowResult.rows.forEach(
    row => {
      if (
        row.leftCard
      ) {
        const card =
          classifyDetectedCard(
            ctx,
            row.leftCard
          );

        const starResult =
          detectStarCount(
            ctx,
            card
          );

        leftCards.push({
          ...card,
          ...starResult
        });
      }

      if (
        row.rightCard
      ) {
        const card =
          classifyDetectedCard(
            ctx,
            row.rightCard
          );

        const starResult =
          detectStarCount(
            ctx,
            card
          );

        rightCards.push({
          ...card,
          ...starResult
        });
      }
    }
  );

  const allCards = [
    ...leftCards,
    ...rightCards
  ];

  allCards.forEach(
    card => {
      card.ocrText = "";
      card.ocrRawText = "";
      card.ocrConfidence = null;
      card.ocrPreview = null;

      card.normalizedOcr = "";

      card.matchCandidate = null;
      card.matchSimilarity = 0;

      card.secondMatchCandidate = null;
      card.secondMatchSimilarity = 0;

      card.matchSimilarityMargin = 0;
      card.matchThreshold = 0;

      card.matchStatus = null;
      card.requirementRank = null;
    }
  );

  return {
    header,
    factorAreaTop,
    factorAreaBottom,
    pitch:
      rowResult.pitch,
    leftCards,
    rightCards
  };
}


export {
  drawOriginalImage,
  getLuminance,
  analyzeFactorImage
};
