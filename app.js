/* =========================================================
   アプリ内で使用するデータ
   - requirements : S/A/B/Cごとのスキル要件
   - members      : 最大6人分の画像
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
   因子カードの行数は固定せず、画像内から動的に検出する。
   ========================================================= */

const ANALYSIS_CONFIG = {
  factorArea: {
    fallbackTopRatio: 0.18,
    bottomRatio: 0.92
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

  scanXPositions: [0.68, 0.80, 0.91],

  cardScoreThreshold: 6,
  minimumCardHeightRatio: 0.010,
  maximumCardHeightRatio: 0.050,
  mergeGapRatio: 0.004
};


/* =========================================================
   タブ切り替え処理
   「スキル要件」「画像登録」「判定結果」の表示を切り替える。
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
   スキル入力文字列の整形処理
   1行1スキルとして配列化し、空行と同一ランク内の重複を除去する。
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
   入力されたスキルをランクごとのカードとして表示する。
   カード右側の×ボタンで個別削除できる。
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
   S/A/B/Cのテキスト欄を読み込み、内部データへ反映してカード化する。
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
   ファイル選択・ドロップ・クリップボードから渡された画像を
   指定人物のimages配列へ追加する。
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
   各人物に登録された画像をサムネイルとして表示する。
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
   指定画像を配列から削除し、ObjectURLも解放する。
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
   登録画像数と解析ボタン状態の更新処理
   6枠すべてを埋める必要はなく、画像が1枚以上あれば解析可能にする。
   ========================================================= */

function updateImageSummary() {
  const total = Object.values(members).reduce((sum, member) => sum + member.images.length, 0);

  document.getElementById("total-image-count").textContent = total;
  document.getElementById("analyze-images").disabled = total === 0;
}


/* =========================================================
   ファイル選択による画像追加処理
   multiple属性により複数画像を一括登録できる。
   ========================================================= */

fileInputs.forEach(input => {
  input.addEventListener("change", event => {
    addImages(input.dataset.member, event.target.files);
    input.value = "";
  });
});


/* =========================================================
   ドロップエリアクリック処理
   ドロップエリアをクリックすると貼り付け先を変更し、
   同時にファイル選択画面を開く。
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
   各人物枠へ画像ファイルを直接ドロップして登録できる。
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
   クリップボード貼り付け先の変更処理
   人物枠全体のどこをクリックしても、その人物を貼り付け先にできる。
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

  document.getElementById("paste-target-label").textContent =
    members[memberId].label;
}


/* =========================================================
   人物枠全体の選択処理
   ドロップエリア以外の余白やプレビュー部分をクリックしても
   「選択 → Ctrl+V / Cmd+V」で画像を貼り付けられる。
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
   選択中の人物枠へCtrl+V / Cmd+Vでスクリーンショットを追加する。
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
   FileオブジェクトをImage要素として読み込む処理
   解析時に画像の元サイズをそのまま取得するために使用する。
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
   元画像を解析Canvasへ描画する処理
   縦横比や解像度を変更せず、その画像本来のサイズで解析する。
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
   RGB値から明るさを計算する処理
   因子カードと背景を区別するためのスコア計算に使用する。
   ========================================================= */

function getLuminance(r, g, b) {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}


/* =========================================================
   RGB値から簡易的な彩度を計算する処理
   青・赤・緑など色付き因子をカードとして検出しやすくする。
   ========================================================= */

function getSaturation(r, g, b) {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);

  return (max - min) / 255;
}


/* =========================================================
   指定範囲の平均RGBを取得する処理
   1ピクセルではなく複数ピクセルを見ることでノイズを減らす。
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
   「所持因子」の緑色ヘッダーを探す処理
   画像サイズや縦方向のレイアウト差に対応するため、
   firstRowYの固定値ではなく緑色の横帯を画像内から検出する。

   画面上部にも緑色の「因子一覧」ヘッダーが存在するため、
   候補が複数ある場合は下側の緑帯を採用する。
   ========================================================= */

function detectFactorHeader(ctx, width, height) {
  const startY = Math.floor(height * 0.08);
  const endY = Math.floor(height * 0.45);

  const startX = Math.floor(width * 0.14);
  const endX = Math.floor(width * 0.86);
  const stepX = Math.max(2, Math.floor(width / 250));

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

    if (greenCount / total > 0.22) {
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

  const validGroups = groups.filter(group => group.length >= 2);

  if (validGroups.length === 0) {
    return null;
  }

  const target = validGroups[validGroups.length - 1];

  return {
    top: target[0],
    bottom: target[target.length - 1]
  };
}


/* =========================================================
   あるY座標が「因子カードらしいか」を数値化する処理
   カード右側の文字・星が少ない場所を複数点サンプリングする。

   白因子は背景より少し暗く、青赤緑因子は彩度が高いため、
   明るさと彩度の両方からcardScoreを作る。
   ========================================================= */

function getCardRowScore(ctx, columnX, columnWidth, y, width) {
  const patchSize = Math.max(2, Math.floor(width * 0.004));

  let totalScore = 0;

  ANALYSIS_CONFIG.scanXPositions.forEach(position => {
    const x = columnX + columnWidth * position;

    const color = getAverageColor(
      ctx,
      x,
      y,
      patchSize,
      patchSize
    );

    const luminance = getLuminance(color.r, color.g, color.b);
    const saturation = getSaturation(color.r, color.g, color.b);

    const darknessScore = Math.max(0, 248 - luminance);
    const saturationScore = saturation * 60;

    totalScore += darknessScore + saturationScore;
  });

  return totalScore / ANALYSIS_CONFIG.scanXPositions.length;
}


/* =========================================================
   カード判定スコアを平滑化する処理
   文字・影・アンチエイリアスなどによる1～2px程度のノイズを抑える。
   ========================================================= */

function smoothScores(scores, radius = 2) {
  return scores.map((item, index) => {
    let total = 0;
    let count = 0;

    for (
      let i = Math.max(0, index - radius);
      i <= Math.min(scores.length - 1, index + radius);
      i++
    ) {
      total += scores[i].score;
      count++;
    }

    return {
      y: item.y,
      score: total / count
    };
  });
}


/* =========================================================
   近接した検出領域をまとめる処理
   カード内部でスコアが一瞬閾値を下回って分断された場合に、
   同じ1枚のカードとして再結合する。
   ========================================================= */

function mergeNearbyRanges(ranges, maximumGap) {
  if (ranges.length === 0) {
    return [];
  }

  const merged = [{ ...ranges[0] }];

  for (let i = 1; i < ranges.length; i++) {
    const previous = merged[merged.length - 1];
    const current = ranges[i];

    if (current.top - previous.bottom <= maximumGap) {
      previous.bottom = current.bottom;
    } else {
      merged.push({ ...current });
    }
  }

  return merged;
}


/* =========================================================
   1列分の因子カードを動的検出する処理
   行数は18などに固定せず、因子領域の上端から下端まで走査して
   カードらしい連続領域をすべて取得する。
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

  const scores = [];

  for (
    let y = factorAreaTop;
    y < factorAreaBottom;
    y += 2
  ) {
    scores.push({
      y,
      score: getCardRowScore(
        ctx,
        columnX,
        columnWidth,
        y,
        width
      )
    });
  }

  const smoothed = smoothScores(scores);

  const rawRanges = [];
  let start = null;

  smoothed.forEach(item => {
    const isCard =
      item.score >= ANALYSIS_CONFIG.cardScoreThreshold;

    if (isCard && start === null) {
      start = item.y;
    }

    if (!isCard && start !== null) {
      rawRanges.push({
        top: start,
        bottom: item.y
      });

      start = null;
    }
  });

  if (start !== null) {
    rawRanges.push({
      top: start,
      bottom: factorAreaBottom
    });
  }

  const mergedRanges = mergeNearbyRanges(
    rawRanges,
    height * ANALYSIS_CONFIG.mergeGapRatio
  );

  const minimumHeight =
    height * ANALYSIS_CONFIG.minimumCardHeightRatio;

  const maximumHeight =
    height * ANALYSIS_CONFIG.maximumCardHeightRatio;

  return mergedRanges
    .filter(range => {
      const cardHeight = range.bottom - range.top;

      return (
        cardHeight >= minimumHeight &&
        cardHeight <= maximumHeight
      );
    })
    .map((range, index) => ({
      column: columnName,
      row: index + 1,
      x: Math.round(columnX),
      y: Math.round(range.top),
      width: Math.round(columnWidth),
      height: Math.round(range.bottom - range.top)
    }));
}


/* =========================================================
   因子カードの色を判定する処理
   カード右上寄りの背景部分を複数箇所サンプリングする。

   青・赤・緑だけを明確に判定し、
   それ以外の「カードとして検出済みの項目」は白因子として扱う。
   ========================================================= */

function classifyDetectedCard(ctx, card) {
  const sampleY =
    card.y + card.height * 0.28;

  const patchSize =
    Math.max(2, Math.floor(card.width * 0.025));

  const samplePositions = [
    0.68,
    0.78,
    0.88
  ];

  const colors = samplePositions.map(position => {
    return getAverageColor(
      ctx,
      card.x + card.width * position,
      sampleY,
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
    color.b > color.r + 30 &&
    color.b > color.g + 12
  ) {
    factorType = "blue";
  } else if (
    color.r > 190 &&
    color.r > color.g + 30 &&
    color.r > color.b + 20
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
   因子一覧画像全体を解析する処理
   1. 「所持因子」の緑ヘッダーを探す
   2. その下を因子カード領域とする
   3. 左右列を別々に動的検出する
   4. 各カードを青・赤・緑・白に分類する
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
        height *
        ANALYSIS_CONFIG.factorArea.fallbackTopRatio
      );

  const factorAreaBottom = Math.round(
    height *
    ANALYSIS_CONFIG.factorArea.bottomRatio
  );

  const leftCards = detectCardsInColumn(
    ctx,
    width,
    height,
    "left",
    factorAreaTop,
    factorAreaBottom
  ).map(card =>
    classifyDetectedCard(ctx, card)
  );

  const rightCards = detectCardsInColumn(
    ctx,
    width,
    height,
    "right",
    factorAreaTop,
    factorAreaBottom
  ).map(card =>
    classifyDetectedCard(ctx, card)
  );

  return {
    header,
    factorAreaTop,
    factorAreaBottom,
    leftCards,
    rightCards
  };
}


/* =========================================================
   因子カードのプレビュー画像を作る処理
   検出位置が正しいか確認するため、判定結果画面に切り出し画像を表示する。
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
   解析デバッグ結果の表示処理
   左右それぞれ何件カードを検出したかと、
   各カードの画像・色判定・RGB・Y座標を一覧表示する。
   ========================================================= */

function renderAnalysisDebug(
  memberLabel,
  imageIndex,
  canvas,
  analysis
) {
  const container =
    document.getElementById("analysis-debug");

  const section =
    document.createElement("section");

  section.className =
    "analysis-debug-section";

  const title =
    document.createElement("h3");

  title.textContent =
    `${memberLabel} / 画像${imageIndex + 1}`;

  section.appendChild(title);

  const summary =
    document.createElement("div");

  summary.className =
    "analysis-summary";

  summary.innerHTML = `
    <span>左列：${analysis.leftCards.length}件</span>
    <span>右列：${analysis.rightCards.length}件</span>
    <span>所持因子開始Y：${analysis.factorAreaTop}</span>
  `;

  section.appendChild(summary);

  const table =
    document.createElement("table");

  table.className =
    "debug-table";

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

  const tbody =
    table.querySelector("tbody");

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

    tr.innerHTML = `
      <td>
        <img
          class="debug-thumbnail"
          src="${preview}"
          alt="因子カード"
        >
      </td>
      <td>${card.column}</td>
      <td>${card.row}</td>
      <td>
        <span class="factor-type factor-${card.factorType}">
          ${card.factorType}
        </span>
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
}


/* =========================================================
   「画像を解析」ボタン処理
   画像が登録されている人物だけを対象にし、
   1人につき複数画像を個別解析する。

   現段階ではOCRや星数判定は行わず、
   因子カード検出と色分類のみ確認する。
   ========================================================= */

document.getElementById("analyze-images").addEventListener("click", async () => {
  const debugContainer =
    document.getElementById("analysis-debug");

  debugContainer.innerHTML = "";

  const activeMembers =
    Object.entries(members)
      .filter(([, member]) =>
        member.images.length > 0
      );

  for (const [, member] of activeMembers) {
    for (
      let i = 0;
      i < member.images.length;
      i++
    ) {
      const imageData =
        member.images[i];

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

      renderAnalysisDebug(
        member.label,
        i,
        canvas,
        analysis
      );
    }
  }

  document
    .querySelector('[data-tab="results"]')
    .click();
});


/* =========================================================
   初期状態設定
   最初のクリップボード貼り付け先を「親A」にし、
   画像数と解析ボタン状態も初期化する。
   ========================================================= */

setPasteTarget("parentA");
updateImageSummary();
