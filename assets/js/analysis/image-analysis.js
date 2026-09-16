import { ANALYSIS_CONFIG, STAR_CONFIG } from "../config.js";
import {
  classifyFactorLayout,
  detectFactorSectionAnchorCandidates
} from "./factor-anchor.js";

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

  canvas.width = image.naturalWidth;

  canvas.height = image.naturalHeight;

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
    0,
    canvas.width,
    canvas.height
  );

  return {
    canvas,
    ctx,
    width:
      canvas.width,
    height:
      canvas.height,
    originalWidth: image.naturalWidth,
    originalHeight: image.naturalHeight,
    analysisScale: 1
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
  factorAreaBottom,
  columns = ANALYSIS_CONFIG.columns
) {
  const column =
    columns[columnName];

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

function getFactorIconAlignmentScore(
  ctx,
  card
) {
  const scanWidth =
    Math.max(
      8,
      Math.round(
        card.width * 0.24
      )
    );

  const scanHeight =
    Math.max(
      8,
      Math.round(
        card.height * 0.65
      )
    );

  const data =
    ctx.getImageData(
      card.x,
      Math.round(
        card.y +
        card.height * 0.12
      ),
      scanWidth,
      scanHeight
    ).data;

  let weightedX = 0;
  let iconPixels = 0;

  for (
    let index = 0;
    index < data.length;
    index += 4
  ) {
    const r = data[index];
    const g = data[index + 1];
    const b = data[index + 2];

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
      const pixelIndex =
        index / 4;

      weightedX +=
        pixelIndex % scanWidth;

      iconPixels++;
    }
  }

  if (iconPixels === 0) {
    return 0;
  }

  const centerRatio =
    weightedX /
    iconPixels /
    card.width;

  return Math.max(
    0,
    1 -
    Math.abs(
      centerRatio - 0.055
    ) / 0.12
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
  const cardHeights = cards
    .map(card => card.height)
    .filter(height => Number.isFinite(height) && height > 0)
    .sort((a, b) => a - b);

  if (cardHeights.length === 0) {
    return null;
  }

  const medianCardHeight = cardHeights[
    Math.floor(cardHeights.length / 2)
  ];
  const minimumPitch = medianCardHeight * 0.55;
  const maximumPitch = medianCardHeight * 2;
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
      diff >= minimumPitch &&
      diff <= maximumPitch
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
  factorAreaBottom,
  columns = ANALYSIS_CONFIG.columns
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
          columns.left
            .xRatio
        ),
      y:
        Math.round(
          candidateY
        ),
      width:
        Math.round(
          width *
          columns.left
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
          columns.right
            .xRatio
        ),
      y:
        Math.round(
          candidateY
        ),
      width:
        Math.round(
          width *
          columns.right
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
          columns.left
            .xRatio
        ),
      y:
        Math.round(y),
      width:
        Math.round(
          width *
          columns.left
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
          columns.right
            .xRatio
        ),
      y:
        Math.round(y),
      width:
        Math.round(
          width *
          columns.right
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

function getFactorCardColumns(layoutType) {
  if (layoutType !== "detail") {
    return ANALYSIS_CONFIG.columns;
  }

  return {
    left: {
      xRatio: 0.16,
      widthRatio: 0.385
    },
    right: {
      xRatio: 0.56,
      widthRatio: 0.385
    }
  };
}

function evaluateDetailColumnGeometry(
  ctx,
  width,
  height,
  columnName,
  factorAreaTop,
  factorAreaBottom,
  geometry
) {
  const columns = {
    [columnName]: geometry
  };

  const cards =
    detectCardsInColumn(
      ctx,
      width,
      height,
      columnName,
      factorAreaTop,
      factorAreaBottom,
      columns
    );

  const validCards =
    cards.filter(
      card =>
        hasFactorIcon(
          ctx,
          card
        ) &&
        hasFullCardBody(
          ctx,
          card
        )
    );

  const pitch =
    calculateRowPitch(
      validCards
    );

  const iconAlignment =
    validCards
      .slice(0, 4)
      .reduce(
        (sum, card) =>
          sum +
          getFactorIconAlignmentScore(
            ctx,
            card
          ),
        0
      ) /
    Math.max(
      1,
      Math.min(
        validCards.length,
        4
      )
    );

  return {
    geometry,
    cards,
    validCardCount:
      validCards.length,
    iconAlignment,
    pitch,
    score:
      validCards.length * 10 +
      (pitch ? 5 : 0) +
      Math.min(cards.length, 20) * 0.1 +
      iconAlignment * 5
  };
}

function detectDetailCardColumns(
  ctx,
  width,
  height,
  factorAreaTop,
  factorAreaBottom
) {
  const xCandidates = {
    left: [
      0.16,
      0.14,
      0.12,
      0.10,
      0.18,
      0.20
    ],
    right: [
      0.505,
      0.52,
      0.54,
      0.56,
      0.58,
      0.48
    ]
  };

  const widthCandidates = [
    0.33,
    0.35,
    0.37,
    0.385,
    0.40
  ];

  const getColumnCandidates =
    columnName =>
      xCandidates[columnName]
        .flatMap(
          xRatio =>
            widthCandidates.map(
              widthRatio =>
                evaluateDetailColumnGeometry(
                  ctx,
                  width,
                  height,
                  columnName,
                  factorAreaTop,
                  factorAreaBottom,
                  {
                    xRatio,
                    widthRatio
                  }
                )
            )
        )
        .sort(
          (a, b) =>
            b.score - a.score
        )
        .slice(0, 8);

  const leftCandidates =
    getColumnCandidates("left");

  const rightCandidates =
    getColumnCandidates("right");

  const combinations =
    leftCandidates.flatMap(
      left =>
        rightCandidates.map(
          right => {
            const columns = {
              left: left.geometry,
              right: right.geometry
            };

            const rowResult =
              buildFactorRows(
                ctx,
                width,
                height,
                [
                  ...left.cards,
                  ...right.cards
                ],
                factorAreaBottom,
                columns
              );

            const rows =
              rowResult?.rows ?? [];

            const pairedRows =
              rows.filter(
                row =>
                  row.leftCard &&
                  row.rightCard
              ).length;

            return {
              left,
              right,
              columns,
              pairedRows,
              rowCount: rows.length,
              rowResult,
              score:
                pairedRows * 20 +
                rows.length * 2 +
                Math.min(
                  left.validCardCount,
                  right.validCardCount
                ) -
                Math.abs(
                  left.geometry.widthRatio -
                  right.geometry.widthRatio
                ) * 100 -
                (
                  Math.abs(
                    left.geometry.widthRatio -
                    (
                      right.geometry.xRatio -
                      left.geometry.xRatio -
                      0.015
                    )
                  ) +
                  Math.abs(
                    right.geometry.widthRatio -
                    (
                      right.geometry.xRatio -
                      left.geometry.xRatio -
                      0.015
                    )
                  )
                ) * 50
            };
          }
        )
    );

  const best =
    combinations.sort(
      (a, b) =>
        b.score - a.score
    )[0];

  return {
    columns: best.columns,
    diagnostics: {
      leftScore: best.left.score,
      leftValidCards:
        best.left.validCardCount,
      rightScore: best.right.score,
      rightValidCards:
        best.right.validCardCount,
      pairedRows:
        best.pairedRows,
      rowCount:
        best.rowCount
    }
  };
}

function evaluateFactorAnchorCandidate(
  ctx,
  width,
  height,
  anchor,
  layoutType,
  factorAreaBottom
) {
  const factorAreaTop =
    Math.round(
      anchor.bottom +
      height * 0.008
    );

  const detailGeometry =
    layoutType === "detail"
      ? detectDetailCardColumns(
          ctx,
          width,
          height,
          factorAreaTop,
          factorAreaBottom
        )
      : null;

  const columns =
    detailGeometry?.columns ??
    getFactorCardColumns(
      layoutType
    );

  const initialLeft =
    detectCardsInColumn(
      ctx,
      width,
      height,
      "left",
      factorAreaTop,
      factorAreaBottom,
      columns
    );

  const initialRight =
    detectCardsInColumn(
      ctx,
      width,
      height,
      "right",
      factorAreaTop,
      factorAreaBottom,
      columns
    );

  const rowResult =
    buildFactorRows(
      ctx,
      width,
      height,
      [
        ...initialLeft,
        ...initialRight
      ],
      factorAreaBottom,
      columns
    );

  const rows =
    rowResult?.rows ?? [];

  const pairedRows =
    rows.filter(
      row =>
        row.leftCard &&
        row.rightCard
    ).length;

  const leftRows =
    rows.filter(
      row => row.leftCard
    ).length;

  const rightRows =
    rows.filter(
      row => row.rightCard
    ).length;

  const accepted =
    rows.length >= 2 &&
    pairedRows >= 2 &&
    Boolean(rowResult.pitch);

  const score =
    pairedRows * 5 +
    rows.length * 2 +
    Math.min(
      initialLeft.length +
      initialRight.length,
      10
    ) * 0.1;

  return {
    anchor,
    layoutType,
    columns,
    factorAreaTop,
    initialLeft,
    initialRight,
    rowResult,
    pairedRows,
    leftRows,
    rightRows,
    score,
    accepted,
    rejectReason:
      accepted
        ? null
        : "no-factor-grid",
    geometryDiagnostics:
      detailGeometry?.diagnostics ??
      null
  };
}

function selectFactorAnchor(
  ctx,
  width,
  height,
  candidates,
  factorAreaBottom
) {
  const evaluations =
    candidates.flatMap(
      (anchor, index) => {
        const nextAnchor =
          candidates[index + 1];

        const candidateAreaBottom =
          nextAnchor
            ? Math.max(
                anchor.bottom,
                nextAnchor.top -
                Math.round(height * 0.004)
              )
            : factorAreaBottom;

        const layoutTypes =
          classifyFactorLayout(anchor) === "detail"
            ? [
                "factor-list",
                "detail"
              ]
            : [
                "factor-list"
              ];

        return layoutTypes.map(
          layoutType =>
            evaluateFactorAnchorCandidate(
              ctx,
              width,
              height,
              anchor,
              layoutType,
              candidateAreaBottom
            )
        );
      }
    );

  const bestByAnchor =
    candidates.map(
      anchor =>
        evaluations
          .filter(
            evaluation =>
              evaluation.anchor === anchor
          )
          .sort(
            (a, b) =>
              b.score - a.score
          )[0]
    );

  const selected =
    bestByAnchor
      .filter(
        evaluation =>
          evaluation.accepted
      )
      .sort(
        (a, b) =>
          b.score - a.score
      )[0] ?? null;

  return {
    selected,
    candidates:
      bestByAnchor.map(
        evaluation => ({
          y: evaluation.anchor.top,
          score: evaluation.score,
          layoutType: evaluation.layoutType,
          pairedRows: evaluation.pairedRows,
          leftRows: evaluation.leftRows,
          rightRows: evaluation.rightRows,
          accepted:
            evaluation === selected,
          rejectReason:
            evaluation === selected
              ? null
              : evaluation.rejectReason ?? "lower-score"
        })
      )
  };
}

function createColumnGeometry(
  width,
  columns,
  rowResult,
  selectedAnchor
) {
  return {
    leftX:
      Math.round(
        width *
        columns.left.xRatio
      ),
    rightX:
      Math.round(
        width *
        columns.right.xRatio
      ),
    leftWidth:
      Math.round(
        width *
        columns.left.widthRatio
      ),
    rightWidth:
      Math.round(
        width *
        columns.right.widthRatio
      ),
    cardHeight:
      rowResult?.cardHeight
        ? Math.round(
            rowResult.cardHeight
          )
        : null,
    rowInterval:
      rowResult?.pitch ?? null,
    detailDiagnostics:
      selectedAnchor
        ?.geometryDiagnostics ??
      null
  };
}

function createDetectedRows(
  rowResult
) {
  return (rowResult?.rows ?? []).map(
    row => ({
      row: row.row,
      left: Boolean(row.leftCard),
      right: Boolean(row.rightCard)
    })
  );
}

/* =========================================================
  対応する1人分因子一覧の構造検証
  ========================================================= */

function validateSupportedFactorList({
  factorAnchorFound,
  layoutType,
  rowResult,
  columnGeometry,
  leftCount,
  rightCount
}) {
  if (
    layoutType !== "factor-list" &&
    layoutType !== "continuation"
  ) {
    return {
      supported: false,
      reason: "unsupported-layout"
    };
  }

  const rows =
    rowResult?.rows ?? [];

  const pairedRows =
    rows.filter(
      row =>
        row.leftCard &&
        row.rightCard
    ).length;

  if (
    !factorAnchorFound &&
    rows.length === 0
  ) {
    return {
      supported: false,
      reason: "no-factor-anchor"
    };
  }

  if (
    !columnGeometry ||
    !Number.isFinite(columnGeometry.leftX) ||
    !Number.isFinite(columnGeometry.rightX) ||
    !Number.isFinite(columnGeometry.leftWidth) ||
    !Number.isFinite(columnGeometry.rightWidth) ||
    !Number.isFinite(columnGeometry.cardHeight) ||
    columnGeometry.leftWidth <= 0 ||
    columnGeometry.rightWidth <= 0 ||
    columnGeometry.cardHeight <= 0 ||
    columnGeometry.leftX >= columnGeometry.rightX
  ) {
    return {
      supported: false,
      reason: "invalid-factor-geometry"
    };
  }

  const pitchToHeightRatio =
    rowResult?.pitch /
    columnGeometry.cardHeight;

  if (
    !rowResult?.pitch ||
    !Number.isFinite(pitchToHeightRatio) ||
    pitchToHeightRatio < 0.85 ||
    pitchToHeightRatio > 1.55
  ) {
    return {
      supported: false,
      reason: "insufficient-factor-grid"
    };
  }

  if (factorAnchorFound) {
    if (
      layoutType !== "factor-list" ||
      rows.length < 5 ||
      pairedRows < 4 ||
      leftCount < 5 ||
      rightCount < 5
    ) {
      return {
        supported: false,
        reason: "insufficient-factor-grid"
      };
    }

    return {
      supported: true,
      reason: "anchor-and-stable-factor-grid",
      classificationLayout:
        "factor-list-start"
    };
  }

  if (
    layoutType !== "continuation" ||
    rows.length < 6 ||
    pairedRows < 5 ||
    leftCount < 6 ||
    rightCount < 6
  ) {
    return {
      supported: false,
      reason: "no-factor-anchor"
    };
  }

  return {
    supported: true,
    reason: "stable-factor-grid",
    classificationLayout:
      "factor-list-continuation"
  };
}

function analyzeFactorImage(
  ctx,
  width,
  height
) {
  const factorAreaBottom =
    Math.round(
      height *
      ANALYSIS_CONFIG
        .factorArea
        .bottomRatio
    );

  const anchorCandidates =
    detectFactorSectionAnchorCandidates(
      ctx,
      width,
      height
    );

  const anchorSelection =
    selectFactorAnchor(
      ctx,
      width,
      height,
      anchorCandidates,
      factorAreaBottom
    );

  const selectedAnchor =
    anchorSelection.selected;

  const header =
    selectedAnchor?.anchor ?? null;

  const layoutType =
    selectedAnchor?.layoutType ??
    "continuation";

  const detectionMode =
    header
      ? "anchor-based"
      : "legacy-continuation";

  const columns =
    selectedAnchor?.columns ??
    ANALYSIS_CONFIG.columns;

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

  if (
    layoutType === "detail"
  ) {
    return {
      header,
      layoutType,
      anchorCandidates:
        anchorSelection.candidates,
      columnGeometry:
        createColumnGeometry(
          width,
          columns,
          selectedAnchor.rowResult,
          selectedAnchor
        ),
      detectedRows:
        createDetectedRows(
          selectedAnchor.rowResult
        ),
      factorAnchorFound: true,
      factorAnchorY: header.top,
      detectionMode:
        "unsupported-detail-layout",
      factorSearchStartY:
        factorAreaTop,
      factorAreaTop,
      factorAreaBottom,
      pitch:
        selectedAnchor.rowResult
          ?.pitch ?? null,
      leftCards: [],
      rightCards: [],
      supported: false,
      classificationLayout:
        "unknown",
      unsupportedLayout: true,
      unsupportedReason:
        "unsupported-layout",
      unsupportedMessage:
        "この画像形式には現在対応していません。1人分のみ表示される因子一覧の画像を使用してください。"
    };
  }

  const initialLeft =
    selectedAnchor?.initialLeft ??
    detectCardsInColumn(
        ctx,
        width,
        height,
        "left",
        factorAreaTop,
        factorAreaBottom,
        columns
      );

  const initialRight =
    selectedAnchor?.initialRight ??
    detectCardsInColumn(
        ctx,
        width,
        height,
        "right",
        factorAreaTop,
        factorAreaBottom,
        columns
      );

  const initialCards = [
    ...initialLeft,
    ...initialRight
  ];

  const rowResult =
    selectedAnchor?.rowResult ??
    buildFactorRows(
        ctx,
        width,
        height,
        initialCards,
        factorAreaBottom,
        columns
      );

  const columnGeometry =
    createColumnGeometry(
      width,
      columns,
      rowResult,
      selectedAnchor
    );

  const detectedRows =
    createDetectedRows(
      rowResult
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
      layoutType,
      anchorCandidates:
        anchorSelection.candidates,
      columnGeometry,
      detectedRows,
      factorAnchorFound: Boolean(header),
      factorAnchorY: header?.top ?? null,
      detectionMode,
      factorSearchStartY: factorAreaTop,
      factorAreaTop,
      factorAreaBottom,
      pitch: null,
      leftCards: [],
      rightCards: [],
      supported: false,
      classificationLayout:
        "unknown",
      unsupportedLayout: true,
      unsupportedReason:
        header
          ? "insufficient-factor-grid"
          : "no-factor-anchor"
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

  const supportValidation =
    validateSupportedFactorList({
      factorAnchorFound:
        Boolean(header),
      layoutType,
      rowResult,
      columnGeometry,
      leftCount:
        leftCards.length,
      rightCount:
        rightCards.length
    });

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
    layoutType,
    anchorCandidates:
      anchorSelection.candidates,
    columnGeometry,
    detectedRows,
    factorAnchorFound: Boolean(header),
    factorAnchorY: header?.top ?? null,
    detectionMode,
    factorSearchStartY: factorAreaTop,
    factorAreaTop,
    factorAreaBottom,
    pitch:
      rowResult.pitch,
    leftCards,
    rightCards,
    supported:
      supportValidation.supported,
    classificationLayout:
      supportValidation
        .classificationLayout ??
      "unknown",
    supportReason:
      supportValidation.supported
        ? supportValidation.reason
        : null,
    unsupportedLayout:
      !supportValidation.supported,
    unsupportedReason:
      supportValidation.supported
        ? null
        : supportValidation.reason
  };
}


export {
  drawOriginalImage,
  getLuminance,
  analyzeFactorImage,
  validateSupportedFactorList
};
