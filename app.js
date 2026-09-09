const APP_BUILD = "20260910-skill-match-02";

console.info(
  `[Uma Factor Checker] build: ${APP_BUILD}`
);

/* =========================================================
  アプリ内データ
  スキル要件と最大6人分の画像を保持する。
  ========================================================= */

const requirements = {
  S: [],
  A: [],
  B: [],
  C: []
};

const members = {
  parentA: { label: "親A", images: [] },
  grandA1: { label: "親A-祖1", images: [] },
  grandA2: { label: "親A-祖2", images: [] },
  parentB: { label: "親B", images: [] },
  grandB1: { label: "親B-祖1", images: [] },
  grandB2: { label: "親B-祖2", images: [] }
};

let pasteTargetMember = "parentA";
let debugLogLines = [];

/* =========================================================
  画像解析設定
  固定pxではなく画像サイズに対する割合を使用する。
  PNG/JPG・画像サイズ違い・スクロール途中画像へ対応する。
  ========================================================= */

const ANALYSIS_CONFIG = {
  factorArea: {
    fallbackTopRatio: 0.18,
    bottomRatio: 0.97
  },
  columns: {
    left: {
      xRatio: 0.16,
      widthRatio: 0.33
    },
    right: {
      xRatio: 0.505,
      widthRatio: 0.33
    }
  },
  scanXPositions: [0.72, 0.82, 0.92],
  gapLuminanceThreshold: 239,
  minimumGapRatio: 0.003,
  minimumCardHeightRatio: 0.014,
  maximumCardHeightRatio: 0.055
};

/* =========================================================
  星数判定設定
  カード内の★1～3を黄色ピクセル量から判定する。
  ========================================================= */

const STAR_CONFIG = {
  area: {
    xRatio: 0.34,
    yRatio: 0.46,
    widthRatio: 0.36,
    heightRatio: 0.50
  },
  yellow: {
    minR: 180,
    minG: 120,
    maxB: 120,
    minRGDiffFromB: 45
  },
  minimumYellowRatio: 0.018
};

/* =========================================================
  OCR設定
  現在安定している設定を維持する。
  ========================================================= */

const OCR_CONFIG = {
  searchArea: {
    xRatio: 0.10,
    yRatio: 0.00,
    widthRatio: 0.86,
    heightRatio: 0.68
  },
  scale: 4,
  paddingRatio: 0.12
};

/* =========================================================
  スキル名照合設定

  OCR文字数に応じて必要な類似度を変更する。

  minimumMargin:
    第1候補と第2候補の類似度差。
    候補が拮抗している場合は自動確定しない。
  ========================================================= */

const SKILL_MATCH_CONFIG = {
  thresholds: {
    1: 1.00,
    2: 0.50,
    3: 0.66,
    4: 0.60,
    5: 0.60
  },
  defaultThreshold: 0.60,
  minimumMargin: 0.15
};

/* =========================================================
  タブ切り替え処理
  スキル要件・画像登録・判定結果を切り替える。
  ========================================================= */

const tabButtons =
  document.querySelectorAll(".tab-button");

const tabContents =
  document.querySelectorAll(".tab-content");

tabButtons.forEach(button => {
  button.addEventListener("click", () => {
    const tabId =
      button.dataset.tab;

    tabButtons.forEach(btn => {
      btn.classList.remove("active");
    });

    tabContents.forEach(content => {
      content.classList.remove("active");
    });

    button.classList.add("active");

    document
      .getElementById(tabId)
      .classList.add("active");
  });
});

/* =========================================================
  スキル入力整形処理
  1行1スキルとして配列化し、空行・重複を除去する。
  ========================================================= */

function parseSkillInput(value) {
  return [
    ...new Set(
      value
        .split(/\r?\n/)
        .map(skill => skill.trim())
        .filter(skill => skill !== "")
    )
  ];
}

/* =========================================================
  スキルカード表示処理
  入力されたスキルをS/A/B/Cごとのカードで表示する。
  ========================================================= */

function renderSkillCards(rank) {
  const container =
    document.getElementById(
      `cards-${rank.toLowerCase()}`
    );

  container.innerHTML = "";

  requirements[rank].forEach(skill => {
    const card =
      document.createElement("div");

    card.className =
      "skill-card";

    const text =
      document.createElement("span");

    text.textContent =
      skill;

    const deleteButton =
      document.createElement("button");

    deleteButton.type =
      "button";

    deleteButton.textContent =
      "×";

    deleteButton.addEventListener(
      "click",
      () => {
        requirements[rank] =
          requirements[rank].filter(
            item => item !== skill
          );

        renderSkillCards(rank);
      }
    );

    card.appendChild(text);
    card.appendChild(deleteButton);
    container.appendChild(card);
  });
}

/* =========================================================
  スキル要件反映処理
  S/A/B/Cの入力欄を内部データへ保存する。
  ========================================================= */

document
  .getElementById("apply-requirements")
  .addEventListener(
    "click",
    () => {
      requirements.S =
        parseSkillInput(
          document.getElementById("input-s").value
        );

      requirements.A =
        parseSkillInput(
          document.getElementById("input-a").value
        );

      requirements.B =
        parseSkillInput(
          document.getElementById("input-b").value
        );

      requirements.C =
        parseSkillInput(
          document.getElementById("input-c").value
        );

      renderSkillCards("S");
      renderSkillCards("A");
      renderSkillCards("B");
      renderSkillCards("C");

      console.log(
        "現在のスキル要件:",
        requirements
      );
    }
  );

/* =========================================================
  スキル要件からOCR照合用辞書を作る処理
  S/A/B/Cに入力されたスキルをまとめて重複除去する。
  ========================================================= */

function getRequirementSkillDictionary() {
  return [
    ...new Set([
      ...requirements.S,
      ...requirements.A,
      ...requirements.B,
      ...requirements.C
    ])
  ];
}

/* =========================================================
  画像登録画面で使用するDOMを取得する。
  ========================================================= */

const fileInputs =
  document.querySelectorAll(
    ".image-file-input"
  );

const dropZones =
  document.querySelectorAll(
    ".image-drop-zone"
  );

const memberPanels =
  document.querySelectorAll(
    ".member-panel"
  );

/* =========================================================
  画像追加処理
  ファイル選択・ドラッグ&ドロップ・貼り付け画像を登録する。
  ========================================================= */

function addImages(memberId, files) {
  const imageFiles =
    Array.from(files).filter(
      file =>
        file.type.startsWith("image/")
    );

  imageFiles.forEach(file => {
    members[memberId].images.push({
      id:
        `${Date.now()}-${Math.random()}`,
      file,
      url:
        URL.createObjectURL(file)
    });
  });

  renderImagePreviews(memberId);
  updateImageSummary();
}

/* =========================================================
  画像プレビュー表示処理
  登録された画像を人物枠ごとに表示する。
  ========================================================= */

function renderImagePreviews(memberId) {
  const container =
    document.getElementById(
      `preview-${memberId}`
    );

  container.innerHTML = "";

  members[memberId].images.forEach(
    (imageData, index) => {
      const item =
        document.createElement("div");

      item.className =
        "image-preview-item";

      const image =
        document.createElement("img");

      image.src =
        imageData.url;

      image.alt =
        `${members[memberId].label} 画像${index + 1}`;

      const number =
        document.createElement("span");

      number.className =
        "image-number";

      number.textContent =
        `画像 ${index + 1}`;

      const deleteButton =
        document.createElement("button");

      deleteButton.type =
        "button";

      deleteButton.className =
        "image-delete-button";

      deleteButton.textContent =
        "×";

      deleteButton.addEventListener(
        "click",
        event => {
          event.stopPropagation();

          removeImage(
            memberId,
            imageData.id
          );
        }
      );

      item.appendChild(image);
      item.appendChild(number);
      item.appendChild(deleteButton);

      container.appendChild(item);
    }
  );
}

/* =========================================================
  画像削除処理
  指定画像を削除し、ObjectURLも解放する。
  ========================================================= */

function removeImage(
  memberId,
  imageId
) {
  const target =
    members[memberId].images.find(
      image =>
        image.id === imageId
    );

  if (target) {
    URL.revokeObjectURL(
      target.url
    );
  }

  members[memberId].images =
    members[memberId].images.filter(
      image =>
        image.id !== imageId
    );

  renderImagePreviews(memberId);
  updateImageSummary();
}

/* =========================================================
  登録画像数・解析ボタン状態更新処理
  画像が1枚以上あれば解析を実行可能にする。
  ========================================================= */

function updateImageSummary() {
  const total =
    Object.values(members).reduce(
      (sum, member) =>
        sum + member.images.length,
      0
    );

  document
    .getElementById("total-image-count")
    .textContent =
      total;

  document
    .getElementById("analyze-images")
    .disabled =
      total === 0;
}

/* =========================================================
  ファイル選択による画像追加処理
  ========================================================= */

fileInputs.forEach(input => {
  input.addEventListener(
    "change",
    event => {
      addImages(
        input.dataset.member,
        event.target.files
      );

      input.value = "";
    }
  );
});

/* =========================================================
  ドロップエリアクリック処理
  貼り付け先を変更し、ファイル選択画面を開く。
  ========================================================= */

dropZones.forEach(zone => {
  zone.addEventListener(
    "click",
    () => {
      const memberId =
        zone.dataset.member;

      setPasteTarget(memberId);

      const input =
        document.querySelector(
          `.image-file-input[data-member="${memberId}"]`
        );

      input.click();
    }
  );
});

/* =========================================================
  ドラッグ&ドロップ処理
  ========================================================= */

dropZones.forEach(zone => {
  zone.addEventListener(
    "dragover",
    event => {
      event.preventDefault();

      zone.classList.add(
        "drag-over"
      );
    }
  );

  zone.addEventListener(
    "dragleave",
    () => {
      zone.classList.remove(
        "drag-over"
      );
    }
  );

  zone.addEventListener(
    "drop",
    event => {
      event.preventDefault();

      zone.classList.remove(
        "drag-over"
      );

      const memberId =
        zone.dataset.member;

      setPasteTarget(memberId);

      addImages(
        memberId,
        event.dataTransfer.files
      );
    }
  );
});

/* =========================================================
  クリップボード貼り付け先変更処理
  ========================================================= */

function setPasteTarget(memberId) {
  pasteTargetMember =
    memberId;

  memberPanels.forEach(panel => {
    panel.classList.remove(
      "active-paste-target"
    );
  });

  const targetPanel =
    document.querySelector(
      `.member-panel[data-member="${memberId}"]`
    );

  if (targetPanel) {
    targetPanel.classList.add(
      "active-paste-target"
    );
  }

  document
    .getElementById("paste-target-label")
    .textContent =
      members[memberId].label;
}

/* =========================================================
  人物枠全体の選択処理
  ========================================================= */

memberPanels.forEach(panel => {
  panel.setAttribute(
    "tabindex",
    "0"
  );

  panel.addEventListener(
    "click",
    event => {
      if (
        event.target.closest(
          ".image-delete-button"
        )
      ) {
        return;
      }

      setPasteTarget(
        panel.dataset.member
      );
    }
  );

  panel.addEventListener(
    "keydown",
    event => {
      if (
        event.key === "Enter" ||
        event.key === " "
      ) {
        event.preventDefault();

        setPasteTarget(
          panel.dataset.member
        );
      }
    }
  );
});

/* =========================================================
  クリップボード画像貼り付け処理
  Ctrl+V / Cmd+Vで選択中の人物へ画像を追加する。
  ========================================================= */

document.addEventListener(
  "paste",
  event => {
    const items =
      event.clipboardData?.items;

    if (!items) {
      return;
    }

    const files = [];

    for (const item of items) {
      if (
        item.kind === "file" &&
        item.type.startsWith("image/")
      ) {
        const file =
          item.getAsFile();

        if (file) {
          files.push(file);
        }
      }
    }

    if (files.length === 0) {
      return;
    }

    event.preventDefault();

    addImages(
      pasteTargetMember,
      files
    );
  }
);

/* =========================================================
  FileをImageへ読み込む処理
  ========================================================= */

function loadImageElement(file) {
  return new Promise(
    (resolve, reject) => {
      const image =
        new Image();

      const url =
        URL.createObjectURL(file);

      image.onload = () => {
        URL.revokeObjectURL(url);
        resolve(image);
      };

      image.onerror = error => {
        URL.revokeObjectURL(url);
        reject(error);
      };

      image.src =
        url;
    }
  );
}

/* =========================================================
  元画像を解析Canvasへ描画する処理
  ========================================================= */

async function drawOriginalImage(file) {
  const image =
    await loadImageElement(file);

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
    width: canvas.width,
    height: canvas.height
  };
}

/* =========================================================
  RGBから明るさを計算する処理
  ========================================================= */

function getLuminance(r, g, b) {
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
    r: Math.round(r / count),
    g: Math.round(g / count),
    b: Math.round(b / count)
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
      greenCount / total >
      0.55
    ) {
      matchingRows.push(y);
    }
  }

  if (
    matchingRows.length === 0
  ) {
    return null;
  }

  const groups = [];
  let current =
    [matchingRows[0]];

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
      groups.push(current);

      current =
        [matchingRows[i]];
    }
  }

  groups.push(current);

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
    .forEach(position => {
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
    });

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
    let y = factorAreaTop;
    y < factorAreaBottom;
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

  samples.forEach(sample => {
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
          top: gapStart,
          bottom: sample.y
        });
      }

      gapStart = null;
    }
  });

  if (gapStart !== null) {
    const gapHeight =
      factorAreaBottom -
      gapStart;

    if (
      gapHeight >=
      minimumGapHeight
    ) {
      gaps.push({
        top: gapStart,
        bottom: factorAreaBottom
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
    i < boundaries.length - 1;
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
      column: columnName,
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
  因子カード左端の丸アイコン検出処理
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
    const g = data[i + 1];
    const b = data[i + 2];

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

  const ratio =
    iconPixels /
    totalPixels;

  return ratio > 0.07;
}

/* =========================================================
  カード本体が十分写っているか確認する処理
  ========================================================= */

function hasFullCardBody(
  ctx,
  card
) {
  const samplePositions = [
    { x: 0.70, y: 0.25 },
    { x: 0.82, y: 0.25 },
    { x: 0.90, y: 0.25 }
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
      position => {
        return getAverageColor(
          ctx,
          card.x +
            card.width *
            position.x,
          card.y +
            card.height *
            position.y,
          patchSize,
          patchSize
        );
      }
    );

  const average = {
    r:
      colors.reduce(
        (sum, color) =>
          sum + color.r,
        0
      ) /
      colors.length,

    g:
      colors.reduce(
        (sum, color) =>
          sum + color.g,
        0
      ) /
      colors.length,

    b:
      colors.reduce(
        (sum, color) =>
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
  因子カードの共通行間隔を計算する処理
  ========================================================= */

function calculateRowPitch(cards) {
  const yValues = [
    ...new Set(
      cards
        .map(card => card.y)
        .sort((a, b) => a - b)
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
      differences.push(diff);
    }
  }

  if (
    differences.length === 0
  ) {
    return null;
  }

  differences.sort(
    (a, b) => a - b
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
      .map(card => card.height)
      .filter(cardHeight => {
        return (
          cardHeight >=
            pitch * 0.65 &&
          cardHeight <=
            pitch * 1.2
        );
      })
      .sort(
        (a, b) => a - b
      );

  const cardHeight =
    typicalHeights.length > 0
      ? typicalHeights[
          Math.floor(
            typicalHeights.length / 2
          )
        ]
      : pitch * 0.9;

  const candidateYs =
    initialCards
      .map(card => card.y)
      .sort(
        (a, b) => a - b
      );

  const mergedCandidateYs = [];

  candidateYs.forEach(y => {
    const last =
      mergedCandidateYs[
        mergedCandidateYs.length - 1
      ];

    if (
      last === undefined ||
      Math.abs(
        y - last
      ) >
        pitch * 0.25
    ) {
      mergedCandidateYs.push(y);
    }
  });

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
            .columns.left.xRatio
        ),
      y:
        Math.round(
          candidateY
        ),
      width:
        Math.round(
          width *
          ANALYSIS_CONFIG
            .columns.left.widthRatio
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
            .columns.right.xRatio
        ),
      y:
        Math.round(
          candidateY
        ),
      width:
        Math.round(
          width *
          ANALYSIS_CONFIG
            .columns.right.widthRatio
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

  if (firstY === null) {
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
      y + cardHeight >
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
            .columns.left.xRatio
        ),
      y:
        Math.round(y),
      width:
        Math.round(
          width *
          ANALYSIS_CONFIG
            .columns.left.widthRatio
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
            .columns.right.xRatio
        ),
      y:
        Math.round(y),
      width:
        Math.round(
          width *
          ANALYSIS_CONFIG
            .columns.right.widthRatio
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
    { x: 0.68, y: 0.25 },
    { x: 0.80, y: 0.25 },
    { x: 0.90, y: 0.25 }
  ];

  const colors =
    samplePositions.map(
      position => {
        return getAverageColor(
          ctx,
          card.x +
            card.width *
            position.x,
          card.y +
            card.height *
            position.y,
          patchSize,
          patchSize
        );
      }
    );

  const color = {
    r:
      Math.round(
        colors.reduce(
          (sum, item) =>
            sum + item.r,
          0
        ) /
        colors.length
      ),

    g:
      Math.round(
        colors.reduce(
          (sum, item) =>
            sum + item.g,
          0
        ) /
        colors.length
      ),

    b:
      Math.round(
        colors.reduce(
          (sum, item) =>
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

function getStarArea(card) {
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
    getStarArea(card);

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
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];

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
      starStates
        .filter(Boolean)
        .length,

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

  rowResult.rows.forEach(row => {
    if (row.leftCard) {
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

    if (row.rightCard) {
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
  });

  const allCards = [
    ...leftCards,
    ...rightCards
  ];

  allCards.forEach(card => {
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
  });

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

/* =========================================================
  OCR対象となるスキル文字色判定処理
  ========================================================= */

function isSkillTextPixel(
  r,
  g,
  b
) {
  const luminance =
    getLuminance(
      r,
      g,
      b
    );

  const isDark =
    luminance < 175;

  const isBrownish =
    r >= g &&
    g >= b &&
    r - b > 15;

  return (
    isDark &&
    isBrownish
  );
}

/* =========================================================
  カード内の実際の文字領域を自動検出する処理
  ========================================================= */

function detectSkillTextBounds(
  sourceCanvas,
  card
) {
  const searchX =
    Math.round(
      card.x +
      card.width *
      OCR_CONFIG
        .searchArea.xRatio
    );

  const searchY =
    Math.round(
      card.y +
      card.height *
      OCR_CONFIG
        .searchArea.yRatio
    );

  const searchWidth =
    Math.round(
      card.width *
      OCR_CONFIG
        .searchArea.widthRatio
    );

  const searchHeight =
    Math.round(
      card.height *
      OCR_CONFIG
        .searchArea.heightRatio
    );

  const ctx =
    sourceCanvas.getContext(
      "2d",
      {
        willReadFrequently: true
      }
    );

  const imageData =
    ctx.getImageData(
      searchX,
      searchY,
      searchWidth,
      searchHeight
    );

  const data =
    imageData.data;

  let minX =
    searchWidth;

  let minY =
    searchHeight;

  let maxX = -1;
  let maxY = -1;

  for (
    let y = 0;
    y < searchHeight;
    y++
  ) {
    for (
      let x = 0;
      x < searchWidth;
      x++
    ) {
      const index =
        (
          y *
          searchWidth +
          x
        ) * 4;

      const r =
        data[index];

      const g =
        data[index + 1];

      const b =
        data[index + 2];

      if (
        !isSkillTextPixel(
          r,
          g,
          b
        )
      ) {
        continue;
      }

      minX =
        Math.min(
          minX,
          x
        );

      minY =
        Math.min(
          minY,
          y
        );

      maxX =
        Math.max(
          maxX,
          x
        );

      maxY =
        Math.max(
          maxY,
          y
        );
    }
  }

  if (
    maxX < 0 ||
    maxY < 0
  ) {
    return null;
  }

  const detectedHeight =
    maxY -
    minY +
    1;

  const paddingX =
    Math.max(
      3,
      Math.round(
        detectedHeight *
        OCR_CONFIG
          .paddingRatio
      )
    );

  const paddingY =
    Math.max(
      3,
      Math.round(
        detectedHeight *
        OCR_CONFIG
          .paddingRatio
      )
    );

  const resultX =
    Math.max(
      card.x,
      searchX +
      minX -
      paddingX
    );

  const resultY =
    Math.max(
      card.y,
      searchY +
      minY -
      paddingY
    );

  const resultRight =
    Math.min(
      card.x +
      card.width,
      searchX +
      maxX +
      paddingX +
      1
    );

  const resultBottom =
    Math.min(
      card.y +
      card.height,
      searchY +
      maxY +
      paddingY +
      1
    );

  return {
    x:
      Math.round(
        resultX
      ),

    y:
      Math.round(
        resultY
      ),

    width:
      Math.max(
        1,
        Math.round(
          resultRight -
          resultX
        )
      ),

    height:
      Math.max(
        1,
        Math.round(
          resultBottom -
          resultY
        )
      )
  };
}

/* =========================================================
  OCR用画像生成処理
  ========================================================= */

function createOcrCanvas(
  sourceCanvas,
  card
) {
  const textBounds =
    detectSkillTextBounds(
      sourceCanvas,
      card
    );

  if (!textBounds) {
    return null;
  }

  const canvas =
    document.createElement(
      "canvas"
    );

  canvas.width =
    Math.round(
      textBounds.width *
      OCR_CONFIG.scale
    );

  canvas.height =
    Math.round(
      textBounds.height *
      OCR_CONFIG.scale
    );

  const ctx =
    canvas.getContext("2d");

  ctx.fillStyle =
    "#ffffff";

  ctx.fillRect(
    0,
    0,
    canvas.width,
    canvas.height
  );

  ctx.imageSmoothingEnabled =
    true;

  ctx.imageSmoothingQuality =
    "high";

  ctx.drawImage(
    sourceCanvas,
    textBounds.x,
    textBounds.y,
    textBounds.width,
    textBounds.height,
    0,
    0,
    canvas.width,
    canvas.height
  );

  return canvas;
}

/* =========================================================
  OCR結果の基本整形処理
  ========================================================= */

function normalizeOcrText(text) {
  return text
    .replace(
      /\r?\n/g,
      ""
    )
    .replace(
      /\t/g,
      ""
    )
    .replace(
      /\s+/g,
      ""
    )
    .trim();
}

/* =========================================================
  スキル照合用文字列正規化処理
  ========================================================= */

function normalizeSkillText(text) {
  return text
    .normalize("NFKC")
    .replace(
      /[〇ＯO]/g,
      "○"
    )
    .replace(
      /[。．.]+$/g,
      ""
    )
    .replace(
      /[\/\\|$]+$/g,
      ""
    )
    .replace(
      /\s+/g,
      ""
    )
    .trim();
}

/* =========================================================
  Levenshtein距離を計算する処理
  ========================================================= */

function calculateLevenshteinDistance(
  source,
  target
) {
  const sourceLength =
    source.length;

  const targetLength =
    target.length;

  const matrix =
    Array.from(
      {
        length:
          sourceLength + 1
      },
      () =>
        Array(
          targetLength + 1
        ).fill(0)
    );

  for (
    let i = 0;
    i <= sourceLength;
    i++
  ) {
    matrix[i][0] = i;
  }

  for (
    let j = 0;
    j <= targetLength;
    j++
  ) {
    matrix[0][j] = j;
  }

  for (
    let i = 1;
    i <= sourceLength;
    i++
  ) {
    for (
      let j = 1;
      j <= targetLength;
      j++
    ) {
      const cost =
        source[i - 1] ===
        target[j - 1]
          ? 0
          : 1;

      matrix[i][j] =
        Math.min(
          matrix[i - 1][j] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j - 1] +
            cost
        );
    }
  }

  return matrix[
    sourceLength
  ][targetLength];
}

/* =========================================================
  2つの文字列の類似度を0～1で計算する処理
  ========================================================= */

function calculateSimilarity(
  source,
  target
) {
  if (
    source === target
  ) {
    return 1;
  }

  const maxLength =
    Math.max(
      source.length,
      target.length
    );

  if (
    maxLength === 0
  ) {
    return 1;
  }

  const distance =
    calculateLevenshteinDistance(
      source,
      target
    );

  return (
    1 -
    distance /
    maxLength
  );
}

/* =========================================================
  OCR結果に近いスキル要件候補を探す処理

  第1候補だけでなく第2候補も取得する。
  ========================================================= */

function findBestSkillMatch(
  ocrText,
  dictionary
) {
  const normalizedOcr =
    normalizeSkillText(
      ocrText
    );

  if (
    !normalizedOcr ||
    dictionary.length === 0
  ) {
    return {
      candidate: null,
      similarity: 0,
      secondCandidate: null,
      secondSimilarity: 0,
      similarityMargin: 0,
      normalizedOcr
    };
  }

  const matches =
    dictionary.map(skill => {
      const normalizedSkill =
        normalizeSkillText(
          skill
        );

      const similarity =
        calculateSimilarity(
          normalizedOcr,
          normalizedSkill
        );

      return {
        candidate: skill,
        normalizedSkill,
        similarity
      };
    });

  matches.sort(
    (a, b) =>
      b.similarity -
      a.similarity
  );

  const best =
    matches[0] || null;

  const second =
    matches[1] || null;

  const bestSimilarity =
    best
      ? best.similarity
      : 0;

  const secondSimilarity =
    second
      ? second.similarity
      : 0;

  const similarityMargin =
    best
      ? bestSimilarity -
        secondSimilarity
      : 0;

  return {
    candidate:
      best
        ? best.candidate
        : null,

    similarity:
      bestSimilarity,

    secondCandidate:
      second
        ? second.candidate
        : null,

    secondSimilarity,
    similarityMargin,
    normalizedOcr
  };
}

/* =========================================================
  OCR文字数に応じた類似度閾値取得処理
  ========================================================= */

function getSkillMatchThreshold(
  normalizedOcr
) {
  const length =
    normalizedOcr.length;

  return (
    SKILL_MATCH_CONFIG
      .thresholds[length] ??
    SKILL_MATCH_CONFIG
      .defaultThreshold
  );
}

/* =========================================================
  OCR結果と候補の一致状態を判定する処理
  ========================================================= */

function determineMatchStatus(
  normalizedOcr,
  candidate,
  similarity,
  secondSimilarity,
  similarityMargin
) {
  if (!candidate) {
    return "unmatched";
  }

  const normalizedCandidate =
    normalizeSkillText(
      candidate
    );

  if (
    normalizedOcr ===
    normalizedCandidate
  ) {
    return "exact";
  }

  const threshold =
    getSkillMatchThreshold(
      normalizedOcr
    );

  if (
    similarity < threshold
  ) {
    return "unmatched";
  }

  const hasSecondCandidate =
    secondSimilarity > 0;

  if (
    hasSecondCandidate &&
    similarityMargin <
      SKILL_MATCH_CONFIG
        .minimumMargin
  ) {
    return "unmatched";
  }

  return "similar";
}

/* =========================================================
  Tesseract.js OCR worker生成処理
  ========================================================= */

async function createOcrWorker() {
  const status =
    document.getElementById(
      "ocr-status"
    );

  status.textContent =
    "OCRを準備しています...";

  const worker =
    await Tesseract.createWorker(
      "jpn",
      1,
      {
        logger: message => {
          if (
            message.status ===
            "recognizing text"
          ) {
            const percent =
              Math.round(
                message.progress *
                100
              );

            status.textContent =
              `OCR実行中... ${percent}%`;
          }
        }
      }
    );

  await worker.setParameters({
    tessedit_pageseg_mode: "7",
    preserve_interword_spaces: "1",
    user_defined_dpi: "300"
  });

  return worker;
}

/* =========================================================
  白因子カード1件をOCRする処理
  ========================================================= */

async function recognizeSkillName(
  worker,
  sourceCanvas,
  card
) {
  const ocrCanvas =
    createOcrCanvas(
      sourceCanvas,
      card
    );

  if (!ocrCanvas) {
    return {
      ocrText: "",
      ocrRawText: "",
      ocrConfidence: 0,
      ocrCanvas: null
    };
  }

  const result =
    await worker.recognize(
      ocrCanvas
    );

  const rawText =
    result.data.text || "";

  return {
    ocrText:
      normalizeOcrText(
        rawText
      ),

    ocrRawText:
      rawText,

    ocrConfidence:
      result.data
        .confidence ?? 0,

    ocrCanvas
  };
}

/* =========================================================
  白因子だけOCRし、スキル要件との類似照合も実行する処理
  ========================================================= */

async function runOcrForWhiteCards(
  worker,
  sourceCanvas,
  analysis,
  memberLabel,
  imageIndex
) {
  const status =
    document.getElementById(
      "ocr-status"
    );

  const dictionary =
    getRequirementSkillDictionary();

  const whiteCards = [
    ...analysis.leftCards,
    ...analysis.rightCards
  ].filter(
    card =>
      card.factorType ===
      "white"
  );

  for (
    let i = 0;
    i < whiteCards.length;
    i++
  ) {
    const card =
      whiteCards[i];

    status.textContent =
      `${memberLabel} / 画像${imageIndex + 1}：白因子OCR ${i + 1}/${whiteCards.length}`;

    const result =
      await recognizeSkillName(
        worker,
        sourceCanvas,
        card
      );

    card.ocrText =
      result.ocrText;

    card.ocrRawText =
      result.ocrRawText;

    card.ocrConfidence =
      result.ocrConfidence;

    card.ocrPreview =
      result.ocrCanvas
        ? result.ocrCanvas
            .toDataURL(
              "image/png"
            )
        : null;

    const matchResult =
      findBestSkillMatch(
        card.ocrText,
        dictionary
      );

    card.normalizedOcr =
      matchResult.normalizedOcr;

    card.matchCandidate =
      matchResult.candidate;

    card.matchSimilarity =
      matchResult.similarity;

    card.secondMatchCandidate =
      matchResult.secondCandidate;

    card.secondMatchSimilarity =
      matchResult.secondSimilarity;

    card.matchSimilarityMargin =
      matchResult.similarityMargin;

    card.matchThreshold =
      getSkillMatchThreshold(
        matchResult.normalizedOcr
      );

    card.matchStatus =
      determineMatchStatus(
        matchResult.normalizedOcr,
        matchResult.candidate,
        matchResult.similarity,
        matchResult.secondSimilarity,
        matchResult.similarityMargin
      );
  }
}

/* =========================================================
  因子カード切り抜きプレビュー生成処理
  ========================================================= */

function createCardThumbnail(
  canvas,
  card
) {
  const cropCanvas =
    document.createElement(
      "canvas"
    );

  cropCanvas.width =
    card.width;

  cropCanvas.height =
    card.height;

  const cropCtx =
    cropCanvas.getContext("2d");

  cropCtx.drawImage(
    canvas,
    card.x,
    card.y,
    card.width,
    card.height,
    0,
    0,
    card.width,
    card.height
  );

  return cropCanvas.toDataURL(
    "image/jpeg",
    0.85
  );
}

/* =========================================================
  解析デバッグ結果表示処理
  ========================================================= */

function renderAnalysisDebug(
  memberLabel,
  imageIndex,
  canvas,
  analysis
) {
  const container =
    document.getElementById(
      "analysis-debug"
    );

  const section =
    document.createElement(
      "section"
    );

  section.className =
    "analysis-debug-section";

  const title =
    document.createElement("h3");

  title.textContent =
    `${memberLabel} / 画像${imageIndex + 1}`;

  section.appendChild(title);

  const summary =
    document.createElement(
      "div"
    );

  summary.className =
    "analysis-summary";

  summary.innerHTML = `
    <span>左列：${analysis.leftCards.length}件</span>
    <span>右列：${analysis.rightCards.length}件</span>
    <span>所持因子開始Y：${analysis.factorAreaTop}</span>
    <span>行間隔：${analysis.pitch ?? "-"}</span>
  `;

  section.appendChild(summary);

  const table =
    document.createElement(
      "table"
    );

  table.className =
    "debug-table";

  table.innerHTML = `
    <thead>
      <tr>
        <th>画像</th>
        <th>OCR画像</th>
        <th>列</th>
        <th>No.</th>
        <th>種類</th>
        <th>星数</th>
        <th>OCR結果</th>
        <th>第1候補</th>
        <th>第1類似度</th>
        <th>第2候補</th>
        <th>第2類似度</th>
        <th>候補差</th>
        <th>閾値</th>
        <th>一致</th>
        <th>信頼度</th>
        <th>星判定率</th>
        <th>RGB</th>
        <th>Y</th>
        <th>高さ</th>
      </tr>
    </thead>
    <tbody></tbody>
  `;

  const tbody =
    table.querySelector(
      "tbody"
    );

  const allCards = [
    ...analysis.leftCards,
    ...analysis.rightCards
  ];

  allCards.forEach(card => {
    const tr =
      document.createElement("tr");

    const preview =
      createCardThumbnail(
        canvas,
        card
      );

    const ocrPreviewHtml =
      card.ocrPreview
        ? `
          <img
            class="debug-ocr-thumbnail"
            src="${card.ocrPreview}"
            alt="OCR画像"
          >
        `
        : "-";

    const confidenceText =
      card.ocrConfidence !== null
        ? card.ocrConfidence
            .toFixed(1)
        : "-";

    const ratioText =
      card.yellowRatios
        .map(
          ratio =>
            ratio.toFixed(3)
        )
        .join("/");

    const candidateText =
      card.matchCandidate ||
      "-";

    const similarityText =
      card.factorType ===
      "white"
        ? card.matchSimilarity
            .toFixed(3)
        : "-";

    const secondCandidateText =
      card.secondMatchCandidate ||
      "-";

    const secondSimilarityText =
      card.factorType ===
      "white"
        ? card.secondMatchSimilarity
            .toFixed(3)
        : "-";

    const marginText =
      card.factorType ===
      "white"
        ? card.matchSimilarityMargin
            .toFixed(3)
        : "-";

    const thresholdText =
      card.factorType ===
      "white"
        ? card.matchThreshold
            .toFixed(3)
        : "-";

    let matchStatusText = "-";

    if (
      card.matchStatus ===
      "exact"
    ) {
      matchStatusText =
        "完全一致";
    } else if (
      card.matchStatus ===
      "similar"
    ) {
      matchStatusText =
        "類似一致";
    } else if (
      card.matchStatus ===
      "unmatched"
    ) {
      matchStatusText =
        "未確定";
    }

    tr.innerHTML = `
      <td>
        <img
          class="debug-thumbnail"
          src="${preview}"
          alt="因子カード"
        >
      </td>

      <td>
        ${ocrPreviewHtml}
      </td>

      <td>${card.column}</td>
      <td>${card.row}</td>

      <td>
        <span class="factor-type factor-${card.factorType}">
          ${card.factorType}
        </span>
      </td>

      <td>${card.stars}</td>

      <td>
        ${card.ocrText || "-"}
      </td>

      <td>
        ${candidateText}
      </td>

      <td>
        ${similarityText}
      </td>

      <td>
        ${secondCandidateText}
      </td>

      <td>
        ${secondSimilarityText}
      </td>

      <td>
        ${marginText}
      </td>

      <td>
        ${thresholdText}
      </td>

      <td>
        ${matchStatusText}
      </td>

      <td>
        ${confidenceText}
      </td>

      <td>
        ${ratioText}
      </td>

      <td>
        ${card.color.r},
        ${card.color.g},
        ${card.color.b}
      </td>

      <td>${card.y}</td>
      <td>${card.height}</td>
    `;

    tbody.appendChild(tr);
  });

  section.appendChild(table);
  container.appendChild(section);

  const logLines = [];

  logLines.push(
    `${memberLabel} / 画像${imageIndex + 1}`
  );

  logLines.push(
    `BUILD：${APP_BUILD}`
  );

  logLines.push(
    `左列：${analysis.leftCards.length}件`
  );

  logLines.push(
    `右列：${analysis.rightCards.length}件`
  );

  logLines.push(
    `所持因子開始Y：${analysis.factorAreaTop}`
  );

  logLines.push(
    `行間隔：${analysis.pitch ?? "-"}`
  );

  logLines.push("");

  logLines.push(
    "画像\t列\tNo.\t種類\t星数\tOCR結果\t第1候補\t第1類似度\t第2候補\t第2類似度\t候補差\t閾値\t一致\t信頼度\t星判定率\tRGB\tY\t高さ"
  );

  allCards.forEach(card => {
    const ratioText =
      card.yellowRatios
        .map(
          ratio =>
            ratio.toFixed(3)
        )
        .join("/");

    let matchStatusText = "";

    if (
      card.matchStatus ===
      "exact"
    ) {
      matchStatusText =
        "完全一致";
    } else if (
      card.matchStatus ===
      "similar"
    ) {
      matchStatusText =
        "類似一致";
    } else if (
      card.matchStatus ===
      "unmatched"
    ) {
      matchStatusText =
        "未確定";
    }

    logLines.push(
      [
        "因子カード",
        card.column,
        card.row,
        card.factorType,
        card.stars,
        card.ocrText || "",

        card.matchCandidate || "",

        card.factorType === "white"
          ? card.matchSimilarity.toFixed(3)
          : "",

        card.secondMatchCandidate || "",

        card.factorType === "white"
          ? card.secondMatchSimilarity.toFixed(3)
          : "",

        card.factorType === "white"
          ? card.matchSimilarityMargin.toFixed(3)
          : "",

        card.factorType === "white"
          ? card.matchThreshold.toFixed(3)
          : "",

        matchStatusText,

        card.ocrConfidence !== null
          ? card.ocrConfidence.toFixed(1)
          : "",

        ratioText,

        `${card.color.r}, ${card.color.g}, ${card.color.b}`,

        card.y,
        card.height
      ].join("\t")
    );
  });

  debugLogLines.push(
    ...logLines,
    ""
  );
}

/* =========================================================
  画像単位の解析エラー表示処理
  ========================================================= */

function renderAnalysisError(
  memberLabel,
  imageIndex,
  error
) {
  const container =
    document.getElementById(
      "analysis-debug"
    );

  const section =
    document.createElement(
      "section"
    );

  section.className =
    "analysis-debug-section";

  const title =
    document.createElement("h3");

  title.textContent =
    `${memberLabel} / 画像${imageIndex + 1}`;

  const message =
    document.createElement("p");

  message.textContent =
    `この画像は解析できませんでした：${error.message}`;

  section.appendChild(title);
  section.appendChild(message);

  container.appendChild(section);

  debugLogLines.push(
    `${memberLabel} / 画像${imageIndex + 1}`
  );

  debugLogLines.push(
    `BUILD：${APP_BUILD}`
  );

  debugLogLines.push(
    `解析エラー：${error.message}`
  );

  debugLogLines.push("");
}

/* =========================================================
  デバッグログコピー処理
  ========================================================= */

async function copyDebugLog() {
  const status =
    document.getElementById(
      "copy-debug-status"
    );

  if (
    debugLogLines.length === 0
  ) {
    return;
  }

  const text =
    debugLogLines.join("\n");

  try {
    await navigator.clipboard
      .writeText(text);

    status.textContent =
      "コピーしました";

    setTimeout(
      () => {
        status.textContent = "";
      },
      2000
    );
  } catch (error) {
    console.error(
      "デバッグログのコピーに失敗しました",
      error
    );

    status.textContent =
      "コピーに失敗しました";
  }
}

document
  .getElementById("copy-debug-log")
  .addEventListener(
    "click",
    copyDebugLog
  );

/* =========================================================
  画像解析ボタン処理

  1. OCR worker生成
  2. カード検出
  3. 色・星判定
  4. 白因子OCR
  5. スキル要件との類似照合
  6. 第1・第2候補の比較
  7. デバッグ表示
  ========================================================= */

document
  .getElementById("analyze-images")
  .addEventListener(
    "click",
    async () => {
      const debugContainer =
        document.getElementById(
          "analysis-debug"
        );

      debugContainer.innerHTML = "";

      debugLogLines = [];

      const copyButton =
        document.getElementById(
          "copy-debug-log"
        );

      copyButton.disabled =
        true;

      document
        .getElementById(
          "copy-debug-status"
        )
        .textContent = "";

      document
        .getElementById(
          "ocr-status"
        )
        .textContent = "";

      const activeMembers =
        Object.entries(members)
          .filter(
            ([, member]) =>
              member.images.length > 0
          );

      let ocrWorker = null;

      try {
        ocrWorker =
          await createOcrWorker();
      } catch (error) {
        console.error(
          "OCRの初期化に失敗しました",
          error
        );

        document
          .getElementById(
            "ocr-status"
          )
          .textContent =
            "OCRの初期化に失敗しました。";

        return;
      }

      try {
        for (
          const [, member]
          of activeMembers
        ) {
          for (
            let i = 0;
            i < member.images.length;
            i++
          ) {
            const imageData =
              member.images[i];

            try {
              const {
                canvas,
                ctx,
                width,
                height
              } =
                await drawOriginalImage(
                  imageData.file
                );

              const analysis =
                analyzeFactorImage(
                  ctx,
                  width,
                  height
                );

              await runOcrForWhiteCards(
                ocrWorker,
                canvas,
                analysis,
                member.label,
                i
              );

              renderAnalysisDebug(
                member.label,
                i,
                canvas,
                analysis
              );
            } catch (error) {
              console.error(
                `${member.label} / 画像${i + 1} の解析に失敗しました`,
                error
              );

              renderAnalysisError(
                member.label,
                i,
                error
              );
            }
          }
        }
      } finally {
        if (ocrWorker) {
          await ocrWorker.terminate();
        }
      }

      document
        .getElementById(
          "ocr-status"
        )
        .textContent =
          "解析が完了しました。";

      copyButton.disabled =
        debugLogLines.length === 0;

      document
        .querySelector(
          '[data-tab="results"]'
        )
        .click();
    }
  );

/* =========================================================
  初期状態設定
  ========================================================= */

setPasteTarget("parentA");
updateImageSummary();