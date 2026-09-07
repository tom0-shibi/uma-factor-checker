const requirements = {
  S: [],
  A: [],
  B: [],
  C: []
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
