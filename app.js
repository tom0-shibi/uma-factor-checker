const requirements = {
  S: [],
  A: [],
  B: [],
  C: []
};

const members = {
  parentA: {
    label: "親A",
    images: []
  },

  grandA1: {
    label: "親A-祖1",
    images: []
  },

  grandA2: {
    label: "親A-祖2",
    images: []
  },

  parentB: {
    label: "親B",
    images: []
  },

  grandB1: {
    label: "親B-祖1",
    images: []
  },

  grandB2: {
    label: "親B-祖2",
    images: []
  }
};

let pasteTargetMember = "parentA";

const ANALYSIS_CONFIG = {

  width: 1029,
  height: 1611,

  // 因子欄の左右位置
  columns: {
    left: {
      x: 160,
      width: 330
    },

    right: {
      x: 502,
      width: 330
    }
  },

  // 一覧の最初の行付近
  firstRowY: 365,

  // 1行の縦間隔
  rowPitch: 61,

  // 因子1項目の高さ
  rowHeight: 48,

  // 最大検出行数
  maxRows: 18
};

// -----------------------------
// タブ切り替え
// -----------------------------

const tabButtons = document.querySelectorAll(".tab-button");
const tabContents = document.querySelectorAll(".tab-content");

tabButtons.forEach(button => {

  button.addEventListener("click", () => {

    const tabId = button.dataset.tab;

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


// -----------------------------
// 入力値を配列に変換
// -----------------------------

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


// -----------------------------
// カード表示
// -----------------------------

function renderSkillCards(rank) {

  const container = document.getElementById(
    `cards-${rank.toLowerCase()}`
  );

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

      requirements[rank] =
        requirements[rank].filter(
          item => item !== skill
        );

      renderSkillCards(rank);

    });


    card.appendChild(text);
    card.appendChild(deleteButton);

    container.appendChild(card);

  });

}


// -----------------------------
// スキル要件反映
// -----------------------------

document
  .getElementById("apply-requirements")
  .addEventListener("click", () => {

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


    console.log("現在のスキル要件:", requirements);

  });

// -----------------------------
// 画像登録
// -----------------------------

const fileInputs =
  document.querySelectorAll(".image-file-input");

const dropZones =
  document.querySelectorAll(".image-drop-zone");

const memberPanels =
  document.querySelectorAll(".member-panel");


// -----------------------------
// File → 内部画像データ
// -----------------------------

function addImages(memberId, files) {

  const imageFiles =
    Array.from(files)
      .filter(file =>
        file.type.startsWith("image/")
      );

  imageFiles.forEach(file => {

    const imageData = {
      id:
        `${Date.now()}-${Math.random()}`,

      file: file,

      url:
        URL.createObjectURL(file)
    };

    members[memberId].images.push(imageData);

  });


  renderImagePreviews(memberId);

  updateImageSummary();

}


// -----------------------------
// プレビュー表示
// -----------------------------

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

      image.src = imageData.url;

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

      deleteButton.type = "button";

      deleteButton.className =
        "image-delete-button";

      deleteButton.textContent = "×";


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


// -----------------------------
// 画像削除
// -----------------------------

function removeImage(
  memberId,
  imageId
) {

  const target =
    members[memberId].images.find(
      image => image.id === imageId
    );

  if (target) {
    URL.revokeObjectURL(target.url);
  }


  members[memberId].images =
    members[memberId].images.filter(
      image => image.id !== imageId
    );


  renderImagePreviews(memberId);

  updateImageSummary();

}


// -----------------------------
// 合計画像数・解析ボタン更新
// -----------------------------

function updateImageSummary() {

  const total =
    Object.values(members)
      .reduce(
        (sum, member) =>
          sum + member.images.length,
        0
      );


  document
    .getElementById("total-image-count")
    .textContent = total;


  const analyzeButton =
    document.getElementById(
      "analyze-images"
    );


  analyzeButton.disabled =
    total === 0;

}


// -----------------------------
// ファイル選択
// -----------------------------

fileInputs.forEach(input => {

  input.addEventListener(
    "change",
    event => {

      const memberId =
        input.dataset.member;

      addImages(
        memberId,
        event.target.files
      );


      // 同じファイルを再度選べるようにする
      input.value = "";

    }
  );

});


// -----------------------------
// ドロップゾーンクリック
// -----------------------------

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


// -----------------------------
// ドラッグ＆ドロップ
// -----------------------------

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


// -----------------------------
// 貼り付け先
// -----------------------------

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
    .getElementById(
      "paste-target-label"
    )
    .textContent =
      members[memberId].label;

}

// パネルクリックでも貼り付け先変更

memberPanels.forEach(panel => {

  panel.setAttribute("tabindex", "0");

  panel.addEventListener("click", event => {

    // 削除ボタン等を押したときでも
    // 貼り付け先変更が暴発しないようにする
    if (
      event.target.closest(".image-delete-button")
    ) {
      return;
    }

    setPasteTarget(
      panel.dataset.member
    );

  });

  // キーボード操作にも対応
  panel.addEventListener("keydown", event => {

    if (
      event.key === "Enter" ||
      event.key === " "
    ) {
      event.preventDefault();

      setPasteTarget(
        panel.dataset.member
      );
    }

  });

});


// -----------------------------
// クリップボード貼り付け
// -----------------------------

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


// -----------------------------
// 解析ボタン
// -----------------------------

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


      const activeMembers =
        Object.entries(members)
          .filter(
            ([, member]) =>
              member.images.length > 0
          );


      for (
        const [memberId, member]
        of activeMembers
      ) {

        for (
          let i = 0;
          i < member.images.length;
          i++
        ) {

          const imageData =
            member.images[i];


          const { ctx } =
            await drawNormalizedImage(
              imageData.file
            );


          const factors =
            detectFactorRows(ctx);


          renderAnalysisDebug(
            member.label,
            i,
            factors
          );

        }

      }


      // 判定結果タブへ移動

      document
        .querySelector(
          '[data-tab="results"]'
        )
        .click();

    }
  );


// 初期貼り付け先
setPasteTarget("parentA");

updateImageSummary();


// -----------------------------
// 画像読込み
// -----------------------------

async function loadImageElement(file) {

  return new Promise((resolve, reject) => {

    const image = new Image();

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

    image.src = url;

  });

}


// -----------------------------
// 画像描画
// -----------------------------

async function drawNormalizedImage(file) {

  const canvas =
    document.getElementById(
      "analysis-canvas"
    );

  const ctx =
    canvas.getContext("2d", {
      willReadFrequently: true
    });


  const image =
    await loadImageElement(file);


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
    image.width,
    image.height,
    0,
    0,
    ANALYSIS_CONFIG.width,
    ANALYSIS_CONFIG.height
  );


  return {
    canvas,
    ctx
  };

}


// -----------------------------
// 因子の色判定
// -----------------------------

function classifyFactorColor(
  r,
  g,
  b
) {

  // 青
  if (
    b > 180 &&
    b > r + 40 &&
    b > g
  ) {
    return "blue";
  }


  // 赤
  if (
    r > 200 &&
    b > 130 &&
    r > g + 50
  ) {
    return "red";
  }


  // 緑
  if (
    g > 150 &&
    g > r + 30 &&
    g > b + 40
  ) {
    return "green";
  }


  // 白因子
  if (
    Math.abs(r - g) < 25 &&
    Math.abs(g - b) < 25 &&
    r > 180
  ) {
    return "white";
  }


  return "unknown";

}

// -----------------------------
// 色の平均取得
// -----------------------------

function getAverageColor(
  ctx,
  x,
  y,
  width = 10,
  height = 10
) {

  const data =
    ctx.getImageData(
      x,
      y,
      width,
      height
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

// -----------------------------
// 因子一覧行読み取り
// -----------------------------

function detectFactorRows(ctx) {

  const factors = [];


  for (
    const [columnName, column]
    of Object.entries(
      ANALYSIS_CONFIG.columns
    )
  ) {

    for (
      let row = 0;
      row < ANALYSIS_CONFIG.maxRows;
      row++
    ) {

      const y =
        ANALYSIS_CONFIG.firstRowY +
        row *
        ANALYSIS_CONFIG.rowPitch;


      // 項目左寄りの背景色を見る
      const sampleX =
        column.x + 140;

      const sampleY =
        y + 20;


      const color =
        getAverageColor(
          ctx,
          sampleX,
          sampleY,
          10,
          10
        );


      const factorType =
        classifyFactorColor(
          color.r,
          color.g,
          color.b
        );


      factors.push({
        column: columnName,
        row,
        x: column.x,
        y,
        width: column.width,
        height:
          ANALYSIS_CONFIG.rowHeight,

        factorType,

        color
      });

    }

  }

  return factors;

}


// -----------------------------
// デバッグ一覧表示
// -----------------------------

function renderAnalysisDebug(
  memberLabel,
  imageIndex,
  factors
) {

  const container =
    document.getElementById(
      "analysis-debug"
    );


  const section =
    document.createElement("section");

  section.className =
    "analysis-debug-section";


  const title =
    document.createElement("h3");

  title.textContent =
    `${memberLabel} / 画像${imageIndex + 1}`;


  section.appendChild(title);


  const table =
    document.createElement("table");

  table.className =
    "debug-table";


  table.innerHTML = `
    <thead>
      <tr>
        <th>列</th>
        <th>行</th>
        <th>種類</th>
        <th>RGB</th>
      </tr>
    </thead>
    <tbody></tbody>
  `;


  const tbody =
    table.querySelector("tbody");


  factors.forEach(factor => {

    const tr =
      document.createElement("tr");


    tr.innerHTML = `
      <td>${factor.column}</td>
      <td>${factor.row + 1}</td>
      <td>${factor.factorType}</td>
      <td>
        ${factor.color.r},
        ${factor.color.g},
        ${factor.color.b}
      </td>
    `;


    tbody.appendChild(tr);

  });


  section.appendChild(table);

  container.appendChild(section);

}
