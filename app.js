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
   因子カードの位置・サイズを固定せず、画像サイズに対する割合と
   カード間の明暗差を利用して動的に検出する。
   ========================================================= */

const ANALYSIS_CONFIG = {
  factorArea: {
    fallbackTopRatio: 0.18,
    bottomRatio: 0.93
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

  // カード右側の「文字や星が少ない位置」を見る
  scanXPositions: [0.72, 0.82, 0.92],

  // カードとカードの間は明るいため、明るさを使って区切る
  gapLuminanceThreshold: 239,

  // 最低何px分「明るい隙間」が続いたらカード境界とみなすか
  minimumGapRatio: 0.003,

  // 正常なカード高さの許容範囲
  minimumCardHeightRatio: 0.014,
  maximumCardHeightRatio: 0.045
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
   「所持因子」の緑色ヘッダーを検出する処理

   画面上には
   ・上部の「因子一覧」ヘッダー
   ・「所持因子」ヘッダー
   ・緑因子カード
   が存在する。

   緑因子カードは左右どちらか片方にしか存在しないため、
   画面中央付近まで横長に続く緑色だけを「所持因子」候補とする。
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

    /*
      所持因子ヘッダーは横幅の大半が緑。
      緑因子カードは片列だけなので、割合が大きくならない。
    */
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

  /*
    探索範囲を画面中央より下に限定しているので、
    通常はここに「所持因子」だけが残る。
  */
  const target = validGroups[0];

  return {
    top: target[0],
    bottom: target[target.length - 1]
  };
}


/* =========================================================
   指定Y座標におけるカード右側の平均明るさを取得する処理

   カード内部は灰色・青・赤・緑などで少し暗く、
   カードとカードの隙間は白に近く明るい。

   複数X座標を平均することで、文字・星・装飾の影響を減らす。
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

    total += getLuminance(
      color.r,
      color.g,
      color.b
    );
  });

  return total / ANALYSIS_CONFIG.scanXPositions.length;
}


/* =========================================================
   1列分の因子カードを動的検出する処理

   因子カードそのものではなく、
   「カード間の明るい隙間」を先に検出する。

   隙間と隙間の間を1枚のカードとして扱うため、
   行数が18・22・それ以上でも固定値なしで対応できる。
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

  const columnX =
    width * column.xRatio;

  const columnWidth =
    width * column.widthRatio;

  const minimumGapHeight =
    Math.max(
      2,
      height * ANALYSIS_CONFIG.minimumGapRatio
    );

  const samples = [];

  for (
    let y = factorAreaTop;
    y < factorAreaBottom;
    y += 2
  ) {
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

  /*
    明るい領域＝カード間の隙間を抽出する。
  */
  const gaps = [];
  let gapStart = null;

  samples.forEach(sample => {
    const isGap =
      sample.luminance >=
      ANALYSIS_CONFIG.gapLuminanceThreshold;

    if (isGap && gapStart === null) {
      gapStart = sample.y;
    }

    if (!isGap && gapStart !== null) {
      const gapHeight =
        sample.y - gapStart;

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
    const gapHeight =
      factorAreaBottom - gapStart;

    if (gapHeight >= minimumGapHeight) {
      gaps.push({
        top: gapStart,
        bottom: factorAreaBottom
      });
    }
  }

  /*
    因子領域の開始点・終了点も仮想的な境界として追加する。
  */
  const boundaries = [
    factorAreaTop,
    ...gaps.map(
      gap => (gap.top + gap.bottom) / 2
    ),
    factorAreaBottom
  ];

  const minimumCardHeight =
    height *
    ANALYSIS_CONFIG.minimumCardHeightRatio;

  const maximumCardHeight =
    height *
    ANALYSIS_CONFIG.maximumCardHeightRatio;

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
      cardHeight < minimumCardHeight ||
      cardHeight > maximumCardHeight
    ) {
      continue;
    }

    /*
      境界線そのものを含めないよう、
      上下を少しだけ内側へ寄せる。
    */
    const padding =
      Math.max(
        1,
        Math.round(height * 0.0015)
      );

    cards.push({
      column: columnName,
      row: cards.length + 1,

      x: Math.round(columnX),

      y: Math.round(
        top + padding
      ),

      width: Math.round(
        columnWidth
      ),

      height: Math.round(
        cardHeight -
        padding * 2
      )
    });
  }

  return cards;
}


/* =========================================================
   検出済み因子カードの色を判定する処理

   今回の目的は白因子の抽出なので、
   青・赤・緑だけを明確な場合に除外し、
   それ以外は白因子候補として扱う。

   文字や★を避けるため、カード右上側を複数点確認する。
   ========================================================= */

function classifyDetectedCard(ctx, card) {
  const patchSize =
    Math.max(
      2,
      Math.floor(card.width * 0.025)
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
    samplePositions.map(position => {
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
    });

  const color = {
    r: Math.round(
      colors.reduce(
        (sum, item) =>
          sum + item.r,
        0
      ) /
      colors.length
    ),

    g: Math.round(
      colors.reduce(
        (sum, item) =>
          sum + item.g,
        0
      ) /
      colors.length
    ),

    b: Math.round(
      colors.reduce(
        (sum, item) =>
          sum + item.b,
        0
      ) /
      colors.length
    )
  };

  let factorType = "white";

  // 青因子
  if (
    color.b > 170 &&
    color.b > color.r + 35 &&
    color.b > color.g + 10
  ) {
    factorType = "blue";
  }

  // 赤因子
  else if (
    color.r > 190 &&
    color.r > color.g + 30 &&
    color.b > 120
  ) {
    factorType = "red";
  }

  // 緑因子
  else if (
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

   1. 「所持因子」の緑ヘッダーを検出
   2. その直下から画像下部までを因子領域とする
   3. 左右列でカードを動的検出
   4. 各カードを青・赤・緑・白へ分類
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
          ANALYSIS_CONFIG.factorArea
            .fallbackTopRatio
        );

  const factorAreaBottom =
    Math.round(
      height *
      ANALYSIS_CONFIG.factorArea
        .bottomRatio
    );

  const leftCards =
    detectCardsInColumn(
      ctx,
      width,
      height,
      "left",
      factorAreaTop,
      factorAreaBottom
    ).map(card =>
      classifyDetectedCard(
        ctx,
        card
      )
    );

  const rightCards =
    detectCardsInColumn(
      ctx,
      width,
      height,
      "right",
      factorAreaTop,
      factorAreaBottom
    ).map(card =>
      classifyDetectedCard(
        ctx,
        card
      )
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
