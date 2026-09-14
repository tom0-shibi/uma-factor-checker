const X_POST_CHARACTER_LIMIT = 280;

const X_MEMBER_LABELS = {
  parentA: "親A",
  grandA1: "A祖1",
  grandA2: "A祖2",
  parentB: "親B",
  grandB1: "B祖1",
  grandB2: "B祖2"
};

function formatXFactorName(name) {
  return name === "継承固有" ? "固有" : name;
}

function formatXFactorValue(value) {
  if (!value?.name) {
    return null;
  }
  const stars = Number(value.stars) || 0;
  return `${formatXFactorName(value.name)}${stars > 0 ? stars : ""}`;
}

function buildXFactorLines(model) {
  return model.registeredMemberIds
    .map(memberId => {
      const info = model.factorInfo?.[memberId];
      if (!info) {
        return null;
      }
      const values = [info.blue, info.red, info.green]
        .map(formatXFactorValue)
        .filter(Boolean);
      if (values.length === 0) {
        return null;
      }
      return `${X_MEMBER_LABELS[memberId] ?? memberId} ${values.join(" / ")}`;
    })
    .filter(Boolean);
}

function formatXShareText(model, presetName = "") {
  const lines = ["【因子チェック結果】"];
  const normalizedPresetName = String(presetName ?? "").trim();
  if (normalizedPresetName) {
    lines.push(normalizedPresetName);
  }

  lines.push("", "■ S");
  if (model.ranks.S.length === 0) {
    lines.push("Sスキルは登録されていません");
  } else {
    model.ranks.S.forEach(skill => {
      lines.push(
        `${skill.skillName} ${skill.ownedCount}/${model.registeredMemberCount}`
      );
    });
  }

  const factorLines = buildXFactorLines(model);
  if (factorLines.length > 0) {
    lines.push("", "■ 因子", ...factorLines);
  }

  return lines.join("\n");
}

function countXShareCharacters(text) {
  return Array.from(String(text ?? "")).length;
}

function getXShareLengthWarning(text) {
  return countXShareCharacters(text) > X_POST_CHARACTER_LIMIT
    ? "Xの投稿文字数を超える可能性があります。Sスキル数が多い場合は、今後追加予定のサマリー画像の利用を検討してください。"
    : "";
}

export {
  X_POST_CHARACTER_LIMIT,
  X_MEMBER_LABELS,
  buildXFactorLines,
  formatXShareText,
  countXShareCharacters,
  getXShareLengthWarning
};
