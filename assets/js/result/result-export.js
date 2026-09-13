const RANKS = ["S", "A", "B", "C"];

function sanitizeCell(value) {
  return String(value ?? "")
    .replace(/[\t\r\n]+/g, " ")
    .trim();
}

function getSkillJudgment(registeredMemberCount, ownedCount) {
  if (registeredMemberCount < 3) {
    return {
      remaining: "-",
      judgment: "判定対象不足"
    };
  }

  return {
    remaining: Math.max(0, 3 - ownedCount),
    judgment: ownedCount >= 3 ? "OK" : "3面未満"
  };
}

function buildSpreadsheetExportData(model, memberLabels) {
  const summaryRows = model.memberSummary.map(item => ({
    member: memberLabels[item.memberId],
    values: item.registered
      ? [...RANKS.map(rank => item.counts[rank]), item.total]
      : ["-", "-", "-", "-", "-"]
  }));

  const skillRows = RANKS.flatMap(rank =>
    model.ranks[rank].map(skill => {
      const evaluation = getSkillJudgment(
        model.registeredMemberCount,
        skill.ownedCount
      );

      return {
        rank,
        skillName: skill.skillName,
        memberValues: Object.fromEntries(
          Object.keys(memberLabels).map(memberId => [
            memberId,
            model.registeredMemberIds.includes(memberId)
              ? skill.memberValues[memberId]?.stars ?? 0
              : "-"
          ])
        ),
        ownedCount: skill.ownedCount,
        remaining: evaluation.remaining,
        judgment: evaluation.judgment,
        totalStars: skill.totalStars
      };
    })
  );

  return {
    memberIds: Object.keys(memberLabels),
    memberLabels,
    registeredMemberCount: model.registeredMemberCount,
    summaryRows,
    skillRows,
    shortageRows: model.registeredMemberCount >= 3
      ? skillRows.filter(row => row.ownedCount < 3)
      : []
  };
}

function formatSpreadsheetTsv(data) {
  const lines = [
    "【判定結果サマリー】",
    ["対象ウマ娘", ...RANKS, "判定件数"].join("\t"),
    ...data.summaryRows.map(row =>
      [row.member, ...row.values].map(sanitizeCell).join("\t")
    ),
    "",
    "【スキル一覧】",
    [
      "優先度",
      "スキル名",
      ...data.memberIds.map(id => data.memberLabels[id]),
      "面数",
      "3面まであと",
      "判定",
      "★合計"
    ].join("\t"),
    ...data.skillRows.map(row => [
      row.rank,
      row.skillName,
      ...data.memberIds.map(id => row.memberValues[id]),
      row.ownedCount,
      row.remaining,
      row.judgment,
      row.totalStars
    ].map(sanitizeCell).join("\t")),
    "",
    "【3面未満スキル】"
  ];

  if (data.registeredMemberCount < 3) {
    lines.push("判定対象不足");
  } else if (data.shortageRows.length === 0) {
    lines.push("3面未満のスキルはありません");
  } else {
    lines.push([
      "優先度",
      "スキル名",
      "現在",
      "3面まであと",
      ...data.memberIds.map(id => data.memberLabels[id])
    ].join("\t"));

    data.shortageRows.forEach(row => {
      lines.push([
        row.rank,
        row.skillName,
        row.ownedCount,
        row.remaining,
        ...data.memberIds.map(id => row.memberValues[id])
      ].map(sanitizeCell).join("\t"));
    });
  }

  return lines.join("\n");
}

function formatStars(stars) {
  return "★".repeat(Math.max(0, Number(stars) || 0));
}

function formatDiscordSummary(model, memberLabels, presetName) {
  const familyDefinitions = [
    {
      label: "親A",
      members: [
        ["parentA", null],
        ["grandA1", "祖1"],
        ["grandA2", "祖2"]
      ]
    },
    {
      label: "親B",
      members: [
        ["parentB", null],
        ["grandB1", "祖1"],
        ["grandB2", "祖2"]
      ]
    }
  ];

  const ownerLabels = {
    parentA: "親A",
    grandA1: "A祖1",
    grandA2: "A祖2",
    parentB: "親B",
    grandB1: "B祖1",
    grandB2: "B祖2"
  };

  const summaryByMember =
    new Map(
      model.memberSummary.map(
        item => [item.memberId, item]
      )
    );

  const lines = [
    "## 【因子チェック結果】",
    `* プリセット：${presetName || "カスタム設定"}`,
    "",
    "### ■ 判定サマリー"
  ];

  familyDefinitions.forEach(family => {
    const registered = family.members
      .map(([memberId, shortLabel]) => ({
        item: summaryByMember.get(memberId),
        shortLabel
      }))
      .filter(entry => entry.item?.registered);

    if (registered.length > 0) {
      lines.push(
        `* ${registered.map(entry => {
          const prefix = entry.shortLabel
            ? entry.shortLabel
            : family.label;
          return `${prefix} \`${RANKS.map(rank => `${rank}: ${entry.item.counts[rank]}`).join(" / ")}\``;
        }).join("｜")}`
      );
    }
  });

  lines.push(
    "",
    "### ■ Sスキル（面数｜所持先）"
  );

  if (model.ranks.S.length === 0) {
    lines.push("* Sスキルは登録されていません");
  } else {
    model.ranks.S.forEach(skill => {
      const owners = model.registeredMemberIds
        .filter(memberId => skill.memberValues[memberId])
        .map(memberId =>
          `${ownerLabels[memberId] || memberLabels[memberId]} ${formatStars(skill.memberValues[memberId].stars)}`
        );

      const ownerText = owners.length > 0
        ? `｜${owners.join(" / ")}`
        : "";

      lines.push(
        `* **${skill.skillName}** \`${skill.ownedCount}/${model.registeredMemberCount}\`${ownerText}`
      );
    });
  }

  const metadataLines =
    model.registeredMemberIds
      .map(memberId => {
        const info = model.factorInfo?.[memberId];
        if (
          !info ||
          !Object.values(info).some(Boolean)
        ) {
          return null;
        }

        const values = [
          ["青", info.blue],
          ["赤", info.red],
          ["緑", info.green]
        ]
          .filter(([, value]) => value)
          .map(([label, value]) => {
            const factorName = value.name ?? "名称未確定";
            return `${label}: ${factorName}${formatStars(value.stars)}`;
          });

        return `* ${ownerLabels[memberId] || memberLabels[memberId]}｜${values.join(" / ")}`;
      })
      .filter(Boolean);

  if (metadataLines.length > 0) {
    lines.push(
      "",
      "### ■ 因子情報",
      ...metadataLines
    );
  }

  return lines.join("\n");
}

function getDiscordLengthWarning(text) {
  return text.length > 2000
    ? "Discordの1メッセージ上限（2000文字）を超えています。Sスキル数を減らすか、内容を分けて投稿してください。"
    : "";
}

export {
  buildSpreadsheetExportData,
  formatSpreadsheetTsv,
  formatDiscordSummary,
  getDiscordLengthWarning,
  getSkillJudgment
};
