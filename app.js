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

/* =========================================================
   画像解析設定
   固定ピクセルではなく画像サイズに対する割合を使用する。
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

  /*
    JPGではカード高さが画像全体に対して約4.5%を少し超えるため、
    5.5%まで許容する。
  */
  maximumCardHeightRatio: 0.055
};

/* =========================================================
   タブ切り替え処理
   3つのメイン画面を切り替える。
   ========================================================= */

const tabButtons = document.querySelectorAll(".tab-button");
const tabContents = document.querySelectorAll(".tab-content");

tabButtons.forEach(button => {
  button.addEventListener("click", () => {
    const tabId = button.dataset.tab;

    tabButtons.forEach(btn => btn.classList.remove("active"));
    tabContents.forEach(content => content.classList.remove("active"));

    button.classList.add("active");
    document.getElementById(tabId).classList.add("active");
  });
});

/* =========================================================
   スキル入力整形処理
   1行1スキルとして配列化し、空行と重複を除去する。
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
   入力済みスキルをランクごとのカードとして表示する。
   ========================================================= */

function renderSkillCards(rank) {
  const container = document.getElementById(`cards-${rank.toLowerCase()}`);
  container.innerHTML = "";

  requirements[rank].forEach(skill => {
    const card = document.createElement("div");
    card.className = "skill-card";

    const text = document.createElement("span");
    text.textContent = skill;

    const deleteButton = document.createElement("button");
    deleteButton.type = "button";
    deleteButton.textContent = "×";

    deleteButton.addEventListener("click", () => {
      requirements[rank] = requirements[rank].filter(item => item !== skill);
      renderSkillCards(rank);
    });

    card.appendChild(text);
    card.appendChild(deleteButton);
    container.appendChild(card);
  });
}

/* =========================================================
   スキル要件反映処理
   S/A/B/Cの入力欄を内部データへ反映する。
   ========================================================= */

document.getElementById("apply-requirements").addEventListener("click", () => {
  requirements.S = parseSkillInput(document.getElementById("input-s").value);
  requirements.A = parseSkillInput(document.getElementById("input-a").value);
  requirements.B = parseSkillInput(document.getElementById("input-b").value);
  requirements.C = parseSkillInput(document.getElementById("input-c").value);

  renderSkillCards("S");
  renderSkillCards("A");
  renderSkillCards("B");
  renderSkillCards("C");

  console.log("現在のスキル要件:", requirements);
});

/* =========================================================
   画像登録画面で使用するDOMを取得する。
   ========================================================= */

const fileInputs = document.querySelectorAll(".image-file-input");
const dropZones = document.querySelectorAll(".image-drop-zone");
const memberPanels = document.querySelectorAll(".member-panel");

/* =========================================================
   画像追加処理
   ファイル選択・ドロップ・貼り付け画像を指定人物へ追加する。
   ========================================================= */

function addImages(memberId, files) {
  const imageFiles = Array.from(files).filter(file => file.type.startsWith("image/"));

  imageFiles.forEach(file => {
    members[memberId].images.push({
      id: `${Date.now()}-${Math.random()}`,
      file,
      url: URL.createObjectURL(file)
    });
  });

  renderImagePreviews(memberId);
  updateImageSummary();
}

/* =========================================================
   画像プレビュー表示処理
   登録画像をサムネイルとして表示する。
   ========================================================= */

function renderImagePreviews(memberId) {
  const container = document.getElementById(`preview-${memberId}`);
  container.innerHTML = "";

  members[memberId].images.forEach((imageData, index) => {
    const item = document.createElement("div");
    item.className = "image-preview-item";

    const image = document.createElement("img");
    image.src = imageData.url;
    image.alt = `${members[memberId].label} 画像${index + 1}`;

    const number = document.createElement("span");
    number.className = "image-number";
    number.textContent = `画像 ${index + 1}`;

    const deleteButton = document.createElement("button");
    deleteButton.type = "button";
    deleteButton.className = "image-delete-button";
    deleteButton.textContent = "×";

    deleteButton.addEventListener("click", event => {
      event.stopPropagation();
      removeImage(memberId, imageData.id);
    });

    item.appendChild(image);
    item.appendChild(number);
    item.appendChild(deleteButton);
    container.appendChild(item);
  });
}

/* =========================================================
   画像削除処理
   指定画像を削除し、ObjectURLも解放する。
   ========================================================= */

function removeImage(memberId, imageId) {
  const target = members[memberId].images.find(image => image.id === imageId);

  if (target) {
    URL.revokeObjectURL(target.url);
  }

  members[memberId].images = members[memberId].images.filter(image => image.id !== imageId);

  renderImagePreviews(memberId);
  updateImageSummary();
}

/* =========================================================
   登録画像数・解析ボタン更新処理
   画像が1枚以上あれば解析可能にする。
   ========================================================= */

function updateImageSummary() {
  const total = Object.values(members).reduce((sum, member) => {
    return sum + member.images.length;
  }, 0);

  document.getElementById("total-image-count").textContent = total;
  document.getElementById("analyze-images").disabled = total === 0;
}

/* =========================================================
   ファイル選択による画像追加処理
   ========================================================= */

fileInputs.forEach(input => {
  input.addEventListener("change", event => {
    addImages(input.dataset.member, event.target.files);
    input.value = "";
  });
});

/* =========================================================
   ドロップエリアクリック処理
   貼り付け先を選択し、ファイル選択画面を開く。
   ========================================================= */

dropZones.forEach(zone => {
  zone.addEventListener("click", () => {
    const memberId = zone.dataset.member;

    setPasteTarget(memberId);

    const input = document.querySelector(
      `.image-file-input[data-member="${memberId}"]`
    );

    input.click();
  });
});

/* =========================================================
   ドラッグ＆ドロップ処理
   ========================================================= */

dropZones.forEach(zone => {
  zone.addEventListener("dragover", event => {
    event.preventDefault();
    zone.classList.add("drag-over");
  });

  zone.addEventListener("dragleave", () => {
    zone.classList.remove("drag-over");
  });

  zone.addEventListener("drop", event => {
    event.preventDefault();
    zone.classList.remove("drag-over");

    const memberId = zone.dataset.member;

    setPasteTarget(memberId);
    addImages(memberId, event.dataTransfer.files);
  });
});

/* =========================================================
   クリップボード貼り付け先変更処理
   ========================================================= */

function setPasteTarget(memberId) {
  pasteTargetMember = memberId;

  memberPanels.forEach(panel => {
    panel.classList.remove("active-paste-target");
  });

  const targetPanel = document.querySelector(
    `.member-panel[data-member="${memberId}"]`
  );

  if (targetPanel) {
    targetPanel.classList.add("active-paste-target");
  }

  document.getElementById("paste-target-label").textContent = members[memberId].label;
}

/* =========================================================
   人物枠全体の選択処理
   枠のどこをクリックしても貼り付け先にできる。
   ========================================================= */

memberPanels.forEach(panel => {
  panel.setAttribute("tabindex", "0");

  panel.addEventListener("click", event => {
    if (event.target.closest(".image-delete-button")) {
      return;
    }

    setPasteTarget(panel.dataset.member);
  });

  panel.addEventListener("keydown", event => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      setPasteTarget(panel.dataset.member);
    }
  });
});

/* =========================================================
   クリップボード画像貼り付け処理
   Ctrl+V / Cmd+Vで選択中の人物へ画像を追加する。
   ========================================================= */

document.addEventListener("paste", event => {
  const items = event.clipboardData?.items;

  if (!items) {
    return;
  }

  const files = [];

  for (const item of items) {
    if (item.kind === "file" && item.type.startsWith("image/")) {
      const file = item.getAsFile();

      if (file) {
        files.push(file);
      }
    }
  }

  if (files.length === 0) {
    return;
  }

  event.preventDefault();
  addImages(pasteTargetMember, files);
});

/* =========================================================
   FileをImage要素へ読み込む処理
   PNG・JPEG・WebPなどブラウザ対応画像を読み込む。
   ========================================================= */

function loadImageElement(file) {
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

/* =========================================================
   元画像をCanvasへ描画する処理
   解像度や縦横比を変更せず解析する。
   ========================================================= */

async function drawOriginalImage(file) {
  const image = await loadImageElement(file);
  const canvas = document.getElementById("analysis-canvas");

  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;

  const ctx = canvas.getContext("2d", {
    willReadFrequently: true
  });

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(image, 0, 0);

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
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/* =========================================================
   指定範囲の平均RGBを取得する処理
   ========================================================= */

function getAverageColor(ctx, x, y, width, height) {
  const safeX = Math.max(0, Math.floor(x));
  const safeY = Math.max(0, Math.floor(y));
  const safeWidth = Math.max(1, Math.floor(width));
  const safeHeight = Math.max(1, Math.floor(height));

  const data = ctx.getImageData(
    safeX,
    safeY,
    safeWidth,
    safeHeight
  ).data;

  let r = 0;
  let g = 0;
  let b = 0;
  let count = 0;

  for (let i = 0; i < data.length; i += 4) {
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
   「所持因子」の緑色ヘッダー検出処理
   横幅の広い緑帯だけを対象とする。
   ========================================================= */

function detectFactorHeader(ctx, width, height) {
  const startY = Math.floor(height * 0.12);
  const endY = Math.floor(height * 0.35);
  const startX = Math.floor(width * 0.14);
  const endX = Math.floor(width * 0.86);
  const stepX = Math.max(2, Math.floor(width / 300));

  const matchingRows = [];

  for (let y = startY; y < endY; y += 2) {
    let greenCount = 0;
    let total = 0;

    for (let x = startX; x < endX; x += stepX) {
      const pixel = ctx.getImageData(x, y, 1, 1).data;

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

    if (greenCount / total > 0.55) {
      matchingRows.push(y);
    }
  }

  if (matchingRows.length === 0) {
    return null;
  }

  const groups = [];
  let current = [matchingRows[0]];

  for (let i = 1; i < matchingRows.length; i++) {
    if (matchingRows[i] - matchingRows[i - 1] <= 4) {
      current.push(matchingRows[i]);
    } else {
      groups.push(current);
      current = [matchingRows[i]];
    }
  }

  groups.push(current);

  const validGroups = groups.filter(group => group.length >= 3);

  if (validGroups.length === 0) {
    return null;
  }

  const target = validGroups[0];

  return {
    top: target[0],
    bottom: target[target.length - 1]
  };
}

/* =========================================================
   指定Y座標のカード右側平均明るさ取得処理
   カード間の明るい隙間を探すために使用する。
   ========================================================= */

function getRowLuminance(ctx, columnX, columnWidth, y, imageWidth) {
  const patchSize = Math.max(2, Math.floor(imageWidth * 0.003));
  let total = 0;

  ANALYSIS_CONFIG.scanXPositions.forEach(position => {
    const color = getAverageColor(
      ctx,
      columnX + columnWidth * position,
      y,
      patchSize,
      patchSize
    );

    total += getLuminance(color.r, color.g, color.b);
  });

  return total / ANALYSIS_CONFIG.scanXPositions.length;
}

/* =========================================================
   1列分の因子カード候補検出処理
   カード間の明るい隙間を基準にカード領域を分割する。
   ========================================================= */

function detectCardsInColumn(
  ctx,
  width,
  height,
  columnName,
  factorAreaTop,
  factorAreaBottom
) {
  const column = ANALYSIS_CONFIG.columns[columnName];

  const columnX = width * column.xRatio;
  const columnWidth = width * column.widthRatio;

  const minimumGapHeight = Math.max(
    2,
    height * ANALYSIS_CONFIG.minimumGapRatio
  );

  const samples = [];

  for (let y = factorAreaTop; y < factorAreaBottom; y += 2) {
    samples.push({
      y,
      luminance: getRowLuminance(
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
      sample.luminance >= ANALYSIS_CONFIG.gapLuminanceThreshold;

    if (isGap && gapStart === null) {
      gapStart = sample.y;
    }

    if (!isGap && gapStart !== null) {
      const gapHeight = sample.y - gapStart;

      if (gapHeight >= minimumGapHeight) {
        gaps.push({
          top: gapStart,
          bottom: sample.y
        });
      }

      gapStart = null;
    }
  });

  if (gapStart !== null) {
    const gapHeight = factorAreaBottom - gapStart;

    if (gapHeight >= minimumGapHeight) {
      gaps.push({
        top: gapStart,
        bottom: factorAreaBottom
      });
    }
  }

  const boundaries = [
    factorAreaTop,
    ...gaps.map(gap => (gap.top + gap.bottom) / 2),
    factorAreaBottom
  ];

  const minimumCardHeight =
    height * ANALYSIS_CONFIG.minimumCardHeightRatio;

  const maximumCardHeight =
    height * ANALYSIS_CONFIG.maximumCardHeightRatio;

  const cards = [];

  for (let i = 0; i < boundaries.length - 1; i++) {
    const top = boundaries[i];
    const bottom = boundaries[i + 1];
    const cardHeight = bottom - top;

    if (
      cardHeight < minimumCardHeight ||
      cardHeight > maximumCardHeight
    ) {
      continue;
    }

    const padding = Math.max(
      1,
      Math.round(height * 0.0015)
    );

    cards.push({
      column: columnName,
      row: cards.length + 1,
      x: Math.round(columnX),
      y: Math.round(top + padding),
      width: Math.round(columnWidth),
      height: Math.round(cardHeight - padding * 2)
    });
  }

  return cards;
}

/* =========================================================
   因子カード左端の丸アイコン検出処理

   通常因子の青～水色アイコンと、
   緑因子の黄～金色アイコンを検出する。

   白背景や「閉じる」ボタンを誤認識しないよう、
   青系ではRGB間に最低限の色差を要求する。

   JPEG圧縮は考慮するが、条件を緩めすぎない。
   ========================================================= */

function hasFactorIcon(ctx, card) {
  const x = Math.round(
    card.x + card.width * 0.015
  );

  const y = Math.round(
    card.y + card.height * 0.12
  );

  const width = Math.max(
    8,
    Math.round(card.width * 0.10)
  );

  const height = Math.max(
    8,
    Math.round(card.height * 0.65)
  );

  const data = ctx.getImageData(
    x,
    y,
    width,
    height
  ).data;

  let iconPixels = 0;
  let totalPixels = 0;

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];

    /*
      青～水色系。
      白や灰色ではRGB差がほぼないため除外される。
    */
    const isBlueIcon =
      b - r >= 3 &&
      b - g >= 2 &&
      b > 135 &&
      r < 245;

    /*
      緑因子用の黄色～金色系。
    */
    const isGoldIcon =
      r > 165 &&
      g > 105 &&
      r - b > 25 &&
      g - b > 15;

    if (isBlueIcon || isGoldIcon) {
      iconPixels++;
    }

    totalPixels++;
  }

  const ratio = iconPixels / totalPixels;

  return ratio > 0.07;
}

/* =========================================================
   因子カード候補から共通行間隔を計算する処理
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

  for (let i = 1; i < yValues.length; i++) {
    const diff = yValues[i] - yValues[i - 1];

    if (diff >= 40 && diff <= 120) {
      differences.push(diff);
    }
  }

  if (differences.length === 0) {
    return null;
  }

  differences.sort((a, b) => a - b);

  return differences[
    Math.floor(differences.length / 2)
  ];
}

/* =========================================================
   左右共通の因子行を生成する処理

   1. 初期カード候補から行間隔を計算する
   2. 候補Yを上から確認する
   3. 左右どちらかに因子アイコンがある最初の候補を
      「本当の1行目」とする
   4. 以降は一定ピッチで行を生成する
   5. 左右どちらにもカードがない行で終了する

   スクロール途中画像の上端に、
   切れたカードや空白が存在しても解析を開始できる。
   ========================================================= */

function buildFactorRows(
  ctx,
  width,
  height,
  initialCards,
  factorAreaBottom
) {
  if (initialCards.length === 0) {
    return {
      pitch: null,
      cardHeight: null,
      rows: []
    };
  }

  const pitch = calculateRowPitch(initialCards);

  if (!pitch) {
    return {
      pitch: null,
      cardHeight: null,
      rows: []
    };
  }

  const typicalHeights = initialCards
    .map(card => card.height)
    .filter(cardHeight => {
      return (
        cardHeight >= pitch * 0.65 &&
        cardHeight <= pitch * 1.2
      );
    })
    .sort((a, b) => a - b);

  const cardHeight = typicalHeights.length > 0
    ? typicalHeights[
        Math.floor(typicalHeights.length / 2)
      ]
    : pitch * 0.9;

  /*
    候補Yを昇順で取得し、
    近い値は1つにまとめる。
  */
  const candidateYs = initialCards
    .map(card => card.y)
    .sort((a, b) => a - b);

  const mergedCandidateYs = [];

  candidateYs.forEach(y => {
    const last =
      mergedCandidateYs[
        mergedCandidateYs.length - 1
      ];

    if (
      last === undefined ||
      Math.abs(y - last) > pitch * 0.25
    ) {
      mergedCandidateYs.push(y);
    }
  });

  /*
    左右どちらかに本物の因子アイコンが存在する
    最初の候補Yを探す。
  */
  let firstY = null;

  for (const candidateY of mergedCandidateYs) {
    const leftCard = {
      column: "left",
      row: 1,
      x: Math.round(
        width *
        ANALYSIS_CONFIG.columns.left.xRatio
      ),
      y: Math.round(candidateY),
      width: Math.round(
        width *
        ANALYSIS_CONFIG.columns.left.widthRatio
      ),
      height: Math.round(cardHeight)
    };

    const rightCard = {
      column: "right",
      row: 1,
      x: Math.round(
        width *
        ANALYSIS_CONFIG.columns.right.xRatio
      ),
      y: Math.round(candidateY),
      width: Math.round(
        width *
        ANALYSIS_CONFIG.columns.right.widthRatio
      ),
      height: Math.round(cardHeight)
    };

    const hasLeft = hasFactorIcon(
      ctx,
      leftCard
    );

    const hasRight = hasFactorIcon(
      ctx,
      rightCard
    );

    if (hasLeft || hasRight) {
      firstY = candidateY;
      break;
    }
  }

  /*
    本物の開始行を見つけられなかった場合。
  */
  if (firstY === null) {
    return {
      pitch,
      cardHeight,
      rows: []
    };
  }

  const rows = [];

  for (let rowIndex = 0; ; rowIndex++) {
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
      row: rowIndex + 1,
      x: Math.round(
        width *
        ANALYSIS_CONFIG.columns.left.xRatio
      ),
      y: Math.round(y),
      width: Math.round(
        width *
        ANALYSIS_CONFIG.columns.left.widthRatio
      ),
      height: Math.round(cardHeight)
    };

    const rightCard = {
      column: "right",
      row: rowIndex + 1,
      x: Math.round(
        width *
        ANALYSIS_CONFIG.columns.right.xRatio
      ),
      y: Math.round(y),
      width: Math.round(
        width *
        ANALYSIS_CONFIG.columns.right.widthRatio
      ),
      height: Math.round(cardHeight)
    };

    const hasLeft = hasFactorIcon(
      ctx,
      leftCard
    );

    const hasRight = hasFactorIcon(
      ctx,
      rightCard
    );

    /*
      左右とも因子カードが存在しない行に到達したら
      因子一覧終了と判断する。
    */
    if (!hasLeft && !hasRight) {
      break;
    }

    rows.push({
      row: rowIndex + 1,
      y: Math.round(y),
      leftCard: hasLeft ? leftCard : null,
      rightCard: hasRight ? rightCard : null
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
   青・赤・緑を明確に判定し、それ以外は白因子候補とする。
   ========================================================= */

function classifyDetectedCard(ctx, card) {
  const patchSize = Math.max(
    2,
    Math.floor(card.width * 0.025)
  );

  const samplePositions = [
    { x: 0.68, y: 0.25 },
    { x: 0.80, y: 0.25 },
    { x: 0.90, y: 0.25 }
  ];

  const colors = samplePositions.map(position => {
    return getAverageColor(
      ctx,
      card.x + card.width * position.x,
      card.y + card.height * position.y,
      patchSize,
      patchSize
    );
  });

  const color = {
    r: Math.round(
      colors.reduce((sum, item) => sum + item.r, 0) /
      colors.length
    ),
    g: Math.round(
      colors.reduce((sum, item) => sum + item.g, 0) /
      colors.length
    ),
    b: Math.round(
      colors.reduce((sum, item) => sum + item.b, 0) /
      colors.length
    )
  };

  let factorType = "white";

  if (
    color.b > 170 &&
    color.b > color.r + 35 &&
    color.b > color.g + 10
  ) {
    factorType = "blue";
  } else if (
    color.r > 190 &&
    color.r > color.g + 30 &&
    color.b > 120
  ) {
    factorType = "red";
  } else if (
    color.g > 140 &&
    color.g > color.r + 25 &&
    color.g > color.b + 25
  ) {
    factorType = "green";
  }

  return {
    ...card,
    factorType,
    color
  };
}

/* =========================================================
   因子一覧画像全体解析処理
   行間隔取得にはアイコン判定前のカード候補を使い、
   JPEGでも初期候補を失いにくくする。
   ========================================================= */

function analyzeFactorImage(ctx, width, height) {
  const header = detectFactorHeader(
    ctx,
    width,
    height
  );

  const factorAreaTop = header
    ? Math.round(
        header.bottom + height * 0.008
      )
    : Math.round(
        height * ANALYSIS_CONFIG.factorArea.fallbackTopRatio
      );

  const factorAreaBottom = Math.round(
    height * ANALYSIS_CONFIG.factorArea.bottomRatio
  );

  const initialLeft = detectCardsInColumn(
    ctx,
    width,
    height,
    "left",
    factorAreaTop,
    factorAreaBottom
  );

  const initialRight = detectCardsInColumn(
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

  const rowResult = buildFactorRows(
    ctx,
    width,
    height,
    initialCards,
    factorAreaBottom
  );

  if (
    !rowResult ||
    !Array.isArray(rowResult.rows) ||
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
      leftCards.push(
        classifyDetectedCard(
          ctx,
          row.leftCard
        )
      );
    }

    if (row.rightCard) {
      rightCards.push(
        classifyDetectedCard(
          ctx,
          row.rightCard
        )
      );
    }
  });

  return {
    header,
    factorAreaTop,
    factorAreaBottom,
    pitch: rowResult.pitch,
    leftCards,
    rightCards
  };
}

/* =========================================================
   因子カード切り抜きプレビュー生成処理
   ========================================================= */

function createCardThumbnail(canvas, card) {
  const cropCanvas = document.createElement("canvas");

  cropCanvas.width = card.width;
  cropCanvas.height = card.height;

  const cropCtx = cropCanvas.getContext("2d");

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

  return cropCanvas.toDataURL("image/jpeg", 0.85);
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
  const container = document.getElementById("analysis-debug");

  const section = document.createElement("section");
  section.className = "analysis-debug-section";

  const title = document.createElement("h3");
  title.textContent = `${memberLabel} / 画像${imageIndex + 1}`;

  section.appendChild(title);

  const summary = document.createElement("div");
  summary.className = "analysis-summary";

  summary.innerHTML = `
    <span>左列：${analysis.leftCards.length}件</span>
    <span>右列：${analysis.rightCards.length}件</span>
    <span>所持因子開始Y：${analysis.factorAreaTop}</span>
    <span>行間隔：${analysis.pitch ?? "-"}</span>
  `;

  section.appendChild(summary);

  const table = document.createElement("table");
  table.className = "debug-table";

  table.innerHTML = `
    <thead>
      <tr>
        <th>画像</th>
        <th>列</th>
        <th>No.</th>
        <th>種類</th>
        <th>RGB</th>
        <th>Y</th>
        <th>高さ</th>
      </tr>
    </thead>
    <tbody></tbody>
  `;

  const tbody = table.querySelector("tbody");

  const allCards = [
    ...analysis.leftCards,
    ...analysis.rightCards
  ];

  allCards.forEach(card => {
    const tr = document.createElement("tr");

    const preview = createCardThumbnail(
      canvas,
      card
    );

    tr.innerHTML = `
      <td>
        <img class="debug-thumbnail" src="${preview}" alt="因子カード">
      </td>
      <td>${card.column}</td>
      <td>${card.row}</td>
      <td>
        <span class="factor-type factor-${card.factorType}">
          ${card.factorType}
        </span>
      </td>
      <td>${card.color.r}, ${card.color.g}, ${card.color.b}</td>
      <td>${card.y}</td>
      <td>${card.height}</td>
    `;

    tbody.appendChild(tr);
  });

  section.appendChild(table);
  container.appendChild(section);
}

/* =========================================================
   画像単位の解析エラー表示処理
   1枚失敗しても他の画像解析を継続する。
   ========================================================= */

function renderAnalysisError(
  memberLabel,
  imageIndex,
  error
) {
  const container = document.getElementById("analysis-debug");

  const section = document.createElement("section");
  section.className = "analysis-debug-section";

  const title = document.createElement("h3");
  title.textContent = `${memberLabel} / 画像${imageIndex + 1}`;

  const message = document.createElement("p");
  message.textContent = `この画像は解析できませんでした：${error.message}`;

  section.appendChild(title);
  section.appendChild(message);
  container.appendChild(section);
}

/* =========================================================
   「画像を解析」ボタン処理
   登録済み画像を人物単位・画像単位で順番に解析する。
   ========================================================= */

document.getElementById("analyze-images").addEventListener("click", async () => {
  const debugContainer = document.getElementById("analysis-debug");
  debugContainer.innerHTML = "";

  const activeMembers = Object.entries(members).filter(([, member]) => {
    return member.images.length > 0;
  });

  for (const [, member] of activeMembers) {
    for (let i = 0; i < member.images.length; i++) {
      const imageData = member.images[i];

      try {
        const {
          canvas,
          ctx,
          width,
          height
        } = await drawOriginalImage(
          imageData.file
        );

        const analysis = analyzeFactorImage(
          ctx,
          width,
          height
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

  document.querySelector('[data-tab="results"]').click();
});

/* =========================================================
   初期状態設定
   ========================================================= */

setPasteTarget("parentA");
updateImageSummary();