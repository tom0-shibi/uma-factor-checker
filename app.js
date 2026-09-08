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

  panel.addEventListener(
    "click",
    () => {

      setPasteTarget(
        panel.dataset.member
      );

    }
  );

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
  .getElementById(
    "analyze-images"
  )
  .addEventListener(
    "click",
    () => {

      const activeMembers =
        Object.entries(members)
          .filter(
            ([, member]) =>
              member.images.length > 0
          );


      console.log(
        "解析対象:",
        activeMembers
      );


      alert(
        `${activeMembers.length}人分の画像を解析対象として登録しました。\nOCR処理は次の工程で実装します。`
      );

    }
  );


// 初期貼り付け先
setPasteTarget("parentA");

updateImageSummary();
