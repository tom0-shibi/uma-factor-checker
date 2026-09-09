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
   デバッグログ保持
   画面に表示した解析結果をテキスト化して保存し、
   「デバッグログをコピー」ボタンから一括コピーできるようにする。
   ========================================================= */

let debugLogLines = [];

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
   星数判定設定
   カード内の星が表示される領域を割合で定義する。

   PNG・JPGでカードサイズが違っても、
   card.width / card.height に対する割合で追従する。
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
   白因子カード内のスキル名領域だけを切り出し、
   拡大・二値化してTesseract.jsへ渡す。

   座標は固定pxではなくカードサイズに対する割合で指定する。
   ========================================================= */

const OCR_CONFIG = {
  textArea: {
    xRatio: 0.115,
    yRatio: 0.03,
    widthRatio: 0.82,
    heightRatio: 0.48
  },
  scale: 4,
  threshold: 195
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
   カード領域が十分に写っているか確認する処理

   スクロール途中でカードの一部だけが写っている場合、
   カード背景ではなく白い画面背景を多く含む。

   カード右側の背景部分を確認し、
   ・白因子の灰色背景
   ・青 / 赤 / 緑の色付き背景
   のいずれかが存在すれば完全カード候補とする。

   ほぼ真っ白な領域は部分カードまたは空白として除外する。
   ========================================================= */

function hasFullCardBody(ctx, card) {
  const samplePositions = [
    { x: 0.70, y: 0.25 },
    { x: 0.82, y: 0.25 },
    { x: 0.90, y: 0.25 }
  ];

  const patchSize = Math.max(
    3,
    Math.round(card.width * 0.025)
  );

  const colors = samplePositions.map(position => {
    return getAverageColor(
      ctx,
      card.x + card.width * position.x,
      card.y + card.height * position.y,
      patchSize,
      patchSize
    );
  });

  const average = {
    r: colors.reduce((sum, color) => sum + color.r, 0) / colors.length,
    g: colors.reduce((sum, color) => sum + color.g, 0) / colors.length,
    b: colors.reduce((sum, color) => sum + color.b, 0) / colors.length
  };

  const luminance = getLuminance(
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

  /*
    白背景そのものなら245～255程度になる。
    白因子背景は230前後。
    色因子は彩度があるためcolorSpreadも大きい。
  */
  return (
    luminance < 242 ||
    colorSpread > 18
  );
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

   スクロール途中画像への対応として、
   最初に「完全に写っているカード」の位置を探す。

   完全カードを1枚見つけた後は、
   そのY座標と算出済みの行間隔を基準にして
   全行を一定ピッチで生成する。

   行ごとのY補正は行わないため、
   補正成功・失敗によってカード位置がばらつくことを防ぐ。
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
    最初の「完全なカード」を基準行として探す。
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

    const leftValid =
      hasFactorIcon(ctx, leftCard) &&
      hasFullCardBody(ctx, leftCard);

    const rightValid =
      hasFactorIcon(ctx, rightCard) &&
      hasFullCardBody(ctx, rightCard);

    if (leftValid || rightValid) {
      firstY = candidateY;
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

    const hasLeft =
      hasFactorIcon(ctx, leftCard) &&
      hasFullCardBody(ctx, leftCard);

    const hasRight =
      hasFactorIcon(ctx, rightCard) &&
      hasFullCardBody(ctx, rightCard);

    /*
      完全なカードが左右どちらにも存在しなくなったら終了する。
    */
    if (!hasLeft && !hasRight) {
      break;
    }

    rows.push({
      row: rowIndex + 1,
      y: Math.round(y),
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
      const classifiedCard =
        classifyDetectedCard(
          ctx,
          row.leftCard
        );

      const starResult =
        detectStarCount(
          ctx,
          classifiedCard
        );

      leftCards.push({
        ...classifiedCard,
        ...starResult
      });
    }
    if (row.rightCard) {
      const classifiedCard =
        classifyDetectedCard(
          ctx,
          row.rightCard
        );

      const starResult =
        detectStarCount(
          ctx,
          classifiedCard
        );

      rightCards.push({
        ...classifiedCard,
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
   因子カード内の星表示領域を算出する処理

   星はカード下側中央付近にあるため、
   固定pxではなくカードサイズに対する割合で切り出す。
   ========================================================= */

function getStarArea(card) {
  return {
    x: Math.round(
      card.x +
      card.width * STAR_CONFIG.area.xRatio
    ),

    y: Math.round(
      card.y +
      card.height * STAR_CONFIG.area.yRatio
    ),

    width: Math.round(
      card.width *
      STAR_CONFIG.area.widthRatio
    ),

    height: Math.round(
      card.height *
      STAR_CONFIG.area.heightRatio
    )
  };
}

/* =========================================================
   ピクセルが「取得済みの黄色い星」に近い色か判定する処理

   未取得の灰色星や白背景を除外し、
   黄色～金色のピクセルだけを拾う。
   ========================================================= */

function isYellowStarPixel(r, g, b) {
  return (
    r >= STAR_CONFIG.yellow.minR &&
    g >= STAR_CONFIG.yellow.minG &&
    b <= STAR_CONFIG.yellow.maxB &&
    r - b >= STAR_CONFIG.yellow.minRGDiffFromB &&
    g - b >= STAR_CONFIG.yellow.minRGDiffFromB
  );
}

/* =========================================================
   星数を1～3で判定する処理

   星領域を横方向に3分割し、
   それぞれの領域に黄色ピクセルが一定割合存在するか確認する。

   ★★☆なら
   1個目 true
   2個目 true
   3個目 false
   となり、stars = 2 を返す。
   ========================================================= */

function detectStarCount(ctx, card) {
  const area = getStarArea(card);

  const segmentWidth =
    area.width / 3;

  const starStates = [];
  const yellowRatios = [];

  for (let starIndex = 0; starIndex < 3; starIndex++) {
    const x = Math.round(
      area.x +
      segmentWidth * starIndex
    );

    const width = Math.max(
      1,
      Math.round(segmentWidth)
    );

    const data = ctx.getImageData(
      x,
      area.y,
      width,
      area.height
    ).data;

    let yellowPixels = 0;
    let totalPixels = 0;

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];

      if (isYellowStarPixel(r, g, b)) {
        yellowPixels++;
      }

      totalPixels++;
    }

    const ratio =
      yellowPixels /
      totalPixels;

    yellowRatios.push(ratio);

    starStates.push(
      ratio >=
      STAR_CONFIG.minimumYellowRatio
    );
  }

  const stars =
    starStates.filter(Boolean).length;

  return {
    stars,
    starStates,
    yellowRatios,
    area
  };
}

/* =========================================================
   因子カード内のスキル名領域を算出する処理

   左側の丸アイコンと下側の★を避け、
   スキル名が表示されている上半分だけをOCR対象にする。
   ========================================================= */

function getTextArea(card) {
  return {
    x: Math.round(
      card.x +
      card.width * OCR_CONFIG.textArea.xRatio
    ),
    y: Math.round(
      card.y +
      card.height * OCR_CONFIG.textArea.yRatio
    ),
    width: Math.round(
      card.width *
      OCR_CONFIG.textArea.widthRatio
    ),
    height: Math.round(
      card.height *
      OCR_CONFIG.textArea.heightRatio
    )
  };
}

/* =========================================================
   OCR用画像を生成する処理

   スキル名部分だけを切り出して拡大し、
   明るい背景を白、暗い文字を黒へ二値化する。

   Tesseractへカード全体を渡さないことで、
   丸アイコンや★による誤認識を減らす。
   ========================================================= */

function createOcrCanvas(sourceCanvas, card) {
  const textArea = getTextArea(card);

  const canvas = document.createElement("canvas");

  canvas.width =
    textArea.width *
    OCR_CONFIG.scale;

  canvas.height =
    textArea.height *
    OCR_CONFIG.scale;

  const ctx = canvas.getContext("2d", {
    willReadFrequently: true
  });

  ctx.imageSmoothingEnabled = true;

  ctx.drawImage(
    sourceCanvas,
    textArea.x,
    textArea.y,
    textArea.width,
    textArea.height,
    0,
    0,
    canvas.width,
    canvas.height
  );

  const imageData = ctx.getImageData(
    0,
    0,
    canvas.width,
    canvas.height
  );

  const data = imageData.data;

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];

    const luminance =
      0.2126 * r +
      0.7152 * g +
      0.0722 * b;

    const value =
      luminance < OCR_CONFIG.threshold
        ? 0
        : 255;

    data[i] = value;
    data[i + 1] = value;
    data[i + 2] = value;
    data[i + 3] = 255;
  }

  ctx.putImageData(
    imageData,
    0,
    0
  );

  return canvas;
}

/* =========================================================
   OCR結果文字列を整形する処理

   改行・タブ・前後空白などを削除し、
   スキル名照合に使いやすい1行文字列へ変換する。
   ========================================================= */

function normalizeOcrText(text) {
  return text
    .replace(/\r?\n/g, "")
    .replace(/\t/g, "")
    .replace(/\s+/g, "")
    .trim();
}

/* =========================================================
   Tesseract.jsの日本語OCR workerを作成する処理

   workerは解析処理中に1回だけ生成し、
   すべての白因子カードで使い回す。
   ========================================================= */

async function createOcrWorker() {
  const status =
    document.getElementById(
      "ocr-status"
    );

  status.textContent =
    "日本語OCRを準備しています...";

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
                message.progress * 100
              );

            status.textContent =
              `OCR実行中... ${percent}%`;
          }
        }
      }
    );

  /*
    今回は1カードにつきスキル名1行なので、
    Tesseractのページ分割を1行認識向けに設定する。
  */
  await worker.setParameters({
    tessedit_pageseg_mode: "7"
  });

  return worker;
}

/* =========================================================
   1枚の白因子カードからスキル名をOCRする処理

   前処理済みCanvasをTesseractへ渡し、
   生OCR結果・整形済み文字列・信頼度を返す。
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

  const result =
    await worker.recognize(
      ocrCanvas
    );

  const rawText =
    result.data.text || "";

  const ocrText =
    normalizeOcrText(
      rawText
    );

  return {
    ocrText,
    ocrRawText: rawText,
    ocrConfidence:
      result.data.confidence ?? 0,
    ocrCanvas
  };
}

/* =========================================================
   解析済みカードのうち白因子だけOCRする処理

   青・赤・緑因子は今回のスキル要件判定対象ではないため
   OCRを実行しない。

   各カードへ
   ・ocrText
   ・ocrConfidence
   ・ocrPreview
   を追加する。
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

  const whiteCards = [
    ...analysis.leftCards,
    ...analysis.rightCards
  ].filter(card =>
    card.factorType === "white"
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
      result.ocrCanvas.toDataURL(
        "image/png"
      );
  }
}

/* =========================================================
   星領域のデバッグ用プレビューを生成する処理
   星数判定が正しいか目視確認できるようにする。
   ========================================================= */

function createStarThumbnail(canvas, starArea) {
  const cropCanvas = document.createElement("canvas");

  cropCanvas.width = starArea.width;
  cropCanvas.height = starArea.height;

  const cropCtx = cropCanvas.getContext("2d");

  cropCtx.drawImage(
    canvas,
    starArea.x,
    starArea.y,
    starArea.width,
    starArea.height,
    0,
    0,
    starArea.width,
    starArea.height
  );

  return cropCanvas.toDataURL("image/png");
}

/* =========================================================
   デバッグログコピー処理
   現在の解析結果をタブ区切りテキストとして
   クリップボードへ一括コピーする。
   ========================================================= */

async function copyDebugLog() {
  const button = document.getElementById("copy-debug-log");
  const status = document.getElementById("copy-debug-status");

  if (debugLogLines.length === 0) {
    return;
  }

  const text = debugLogLines.join("\n");

  try {
    await navigator.clipboard.writeText(text);

    status.textContent = "コピーしました";

    setTimeout(() => {
      status.textContent = "";
    }, 2000);
  } catch (error) {
    console.error("デバッグログのコピーに失敗しました", error);

    status.textContent = "コピーに失敗しました";
  }
}

document.getElementById("copy-debug-log").addEventListener("click", copyDebugLog);

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
        <th>OCR画像</th>
        <th>列</th>
        <th>No.</th>
        <th>種類</th>
        <th>星数</th>
        <th>OCR結果</th>
        <th>信頼度</th>
        <th>星判定率</th>
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

    const starPreview = createStarThumbnail(
      canvas,
      card.area
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
        ? card.ocrConfidence.toFixed(1)
        : "-";

    const ratioText = card.yellowRatios
      .map(ratio => ratio.toFixed(3))
      .join(" / ");

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
        ${confidenceText}
      </td>

      <td>${ratioText}</td>

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

  const logLines = [];

  logLines.push(`${memberLabel} / 画像${imageIndex + 1}`);
  logLines.push(`左列：${analysis.leftCards.length}件`);
  logLines.push(`右列：${analysis.rightCards.length}件`);
  logLines.push(`所持因子開始Y：${analysis.factorAreaTop}`);
  logLines.push(`行間隔：${analysis.pitch ?? "-"}`);
  logLines.push("");
  logLines.push(
    "画像\t列\tNo.\t種類\t星数\tOCR結果\t信頼度\t星判定率\tRGB\tY\t高さ"
  );

  allCards.forEach(card => {
    const ratioText = card.yellowRatios
      .map(ratio => ratio.toFixed(3))
      .join("/");

    logLines.push(
      [
        "因子カード",
        card.column,
        card.row,
        card.factorType,
        card.stars,
        card.ocrText || "",
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

  debugLogLines = [];

  const copyButton =
    document.getElementById(
      "copy-debug-log"
    );

  copyButton.disabled = true;

  document.getElementById(
    "copy-debug-status"
  ).textContent = "";

  const activeMembers = Object.entries(members).filter(([, member]) => {
    return member.images.length > 0;
  });

  let ocrWorker = null;

  try {
    ocrWorker =
      await createOcrWorker();
  } catch (error) {
    console.error(
      "OCRの初期化に失敗しました",
      error
    );

    document.getElementById(
      "ocr-status"
    ).textContent =
      "OCRの初期化に失敗しました。";

    return;
  }

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

  if (ocrWorker) {
    await ocrWorker.terminate();
  }

  document.getElementById(
    "ocr-status"
  ).textContent =
    "解析が完了しました。";

  document.getElementById(
    "copy-debug-log"
  ).disabled =
    debugLogLines.length === 0;

  document.querySelector('[data-tab="results"]').click();
});

/* =========================================================
   初期状態設定
   ========================================================= */

setPasteTarget("parentA");
updateImageSummary();