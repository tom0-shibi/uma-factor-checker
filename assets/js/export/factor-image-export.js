import {
  members,
  debugLogLines
} from "../config.js";
import {
  stitchMemberImages
} from "./image-stitcher.js";

const GROUPS = {
  parentA: {
    label: "親Aグループ",
    filenamePart: "parent-a",
    members: [
      ["parentA", "親A"],
      ["grandA1", "祖1"],
      ["grandA2", "祖2"]
    ]
  },
  parentB: {
    label: "親Bグループ",
    filenamePart: "parent-b",
    members: [
      ["parentB", "親B"],
      ["grandB1", "祖1"],
      ["grandB2", "祖2"]
    ]
  }
};

function hasExportableMember(memberId) {
  const member = members[memberId];
  return (
    member.images.length > 0 &&
    member.analysisResults.some(
      result => result.analysis?.supported === true
    )
  );
}

function getExportableGroupMembers(groupId) {
  return GROUPS[groupId].members.filter(
    ([memberId]) => hasExportableMember(memberId)
  );
}

function getDateStamp() {
  const date = new Date();
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0")
  ].join("");
}

async function createFactorGroupImage(groupId) {
  const group = GROUPS[groupId];
  const targets = getExportableGroupMembers(groupId);
  if (targets.length === 0) {
    return null;
  }

  const columns = [];
  for (const [memberId, label] of targets) {
    const member = members[memberId];
    const supportedResults = member.analysisResults.filter(
      result => result.analysis?.supported === true
    );
    const supportedImageIds = new Set(
      supportedResults.map(result => result.imageId)
    );
    const supportedImages = member.images.filter(
      image => supportedImageIds.has(image.id)
    );
    const stitched = await stitchMemberImages(
      supportedImages,
      supportedResults
    );
    if (!stitched) {
      continue;
    }
    columns.push({ memberId, label, stitched });
    stitched.boundaries.forEach(boundary => {
      debugLogLines.push(
        "stitch:",
        `member=${memberId}`,
        `fromImage=${boundary.fromImage}`,
        `toImage=${boundary.toImage}`,
        `overlapRows=${boundary.overlapRows}`,
        `cropY=${boundary.cropY}`,
        `rowSignatureScore=${boundary.rowSignatureScore.toFixed(3)}`,
        `pixelSimilarity=${boundary.pixelSimilarity.toFixed(3)}`,
        `status=${boundary.status}`,
        ""
      );
    });
    debugLogLines.push(
      "stitch output:",
      `member=${memberId}`,
      `sourceImages=${stitched.sourceImageCount}`,
      `width=${stitched.canvas.width}`,
      `height=${stitched.canvas.height}`,
      `warning=${stitched.warning || "-"}`,
      ""
    );
  }

  const headerHeight = 52;
  const gap = 12;
  const width = columns.reduce(
    (total, column) => total + column.stitched.canvas.width,
    gap * Math.max(0, columns.length - 1)
  );
  const height = headerHeight + Math.max(
    ...columns.map(column => column.stitched.canvas.height)
  );
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  context.fillStyle = "#f4f5f7";
  context.fillRect(0, 0, width, height);
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.font = "700 24px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";

  let x = 0;
  for (const column of columns) {
    const columnWidth = column.stitched.canvas.width;
    context.fillStyle = "#ffffff";
    context.fillRect(x, 0, columnWidth, headerHeight);
    context.fillStyle = "#4f7f13";
    context.fillRect(x, headerHeight - 5, columnWidth, 5);
    context.fillStyle = "#222222";
    context.fillText(column.label, x + columnWidth / 2, headerHeight / 2 - 2);
    context.drawImage(column.stitched.canvas, x, headerHeight);
    x += columnWidth + gap;
  }

  debugLogLines.push(
    "factor group image:",
    `group=${groupId}`,
    `members=${columns.map(column => column.memberId).join(",")}`,
    `width=${canvas.width}`,
    `height=${canvas.height}`,
    ""
  );

  return {
    canvas,
    group,
    columns,
    filename: `uma-factor-${group.filenamePart}-${getDateStamp()}.png`,
    warning: columns
      .map(column => column.stitched.warning)
      .filter(Boolean)
      .join(" ")
  };
}

function canvasToBlob(canvas) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(blob => {
      if (blob) {
        resolve(blob);
      } else {
        reject(new Error("PNG画像を生成できませんでした。"));
      }
    }, "image/png");
  });
}

async function downloadFactorGroupImage(result) {
  const blob = await canvasToBlob(result.canvas);
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = result.filename;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function showFactorGroupPreview(result) {
  document.getElementById("factor-image-preview-overlay")?.remove();
  const overlay = document.createElement("div");
  overlay.id = "factor-image-preview-overlay";
  overlay.className = "factor-image-preview-overlay";
  overlay.innerHTML = `
    <div class="factor-image-preview-dialog" role="dialog" aria-modal="true" aria-labelledby="factor-image-preview-title">
      <div class="factor-image-preview-header">
        <h3 id="factor-image-preview-title"></h3>
        <button type="button" class="factor-image-preview-close" aria-label="閉じる">×</button>
      </div>
      <p class="factor-image-preview-meta"></p>
      <div class="factor-image-preview-scroll"><img alt="生成した因子一覧画像"></div>
      <div class="factor-image-preview-actions">
        <button type="button" class="primary-button factor-image-preview-save">PNGを保存</button>
        <button type="button" class="secondary-button factor-image-preview-cancel">閉じる</button>
      </div>
    </div>
  `;
  const close = () => overlay.remove();
  overlay.querySelector("h3").textContent = `${result.group.label}画像`;
  overlay.querySelector(".factor-image-preview-meta").textContent = [
    `${result.canvas.width} × ${result.canvas.height}px`,
    result.warning
  ].filter(Boolean).join("　");
  overlay.querySelector("img").src = result.canvas.toDataURL("image/png");
  overlay.querySelector(".factor-image-preview-close").addEventListener("click", close);
  overlay.querySelector(".factor-image-preview-cancel").addEventListener("click", close);
  overlay.querySelector(".factor-image-preview-save").addEventListener(
    "click",
    () => downloadFactorGroupImage(result)
  );
  overlay.addEventListener("click", event => {
    if (event.target === overlay) {
      close();
    }
  });
  document.body.appendChild(overlay);
}

function appendFactorImageExportButtons(actions, status) {
  for (const groupId of ["parentA", "parentB"]) {
    const group = GROUPS[groupId];
    const button = document.createElement("button");
    button.type = "button";
    button.className = "secondary-button";
    button.textContent = `${group.label}画像を作成`;
    button.disabled = getExportableGroupMembers(groupId).length === 0;
    button.addEventListener("click", async () => {
      button.disabled = true;
      status.classList.remove("is-error");
      status.textContent = `${group.label}画像を生成しています…`;
      try {
        const result = await createFactorGroupImage(groupId);
        if (!result) {
          throw new Error("出力できる解析済み画像がありません。");
        }
        await showFactorGroupPreview(result);
        status.textContent = result.warning || `${group.label}画像を生成しました。`;
      } catch (error) {
        console.error("因子一覧画像を生成できませんでした", error);
        status.classList.add("is-error");
        status.textContent = error.message || "因子一覧画像を生成できませんでした。";
      } finally {
        button.disabled = getExportableGroupMembers(groupId).length === 0;
      }
    });
    actions.appendChild(button);
  }
}

export {
  GROUPS,
  hasExportableMember,
  getExportableGroupMembers,
  createFactorGroupImage,
  appendFactorImageExportButtons,
  downloadFactorGroupImage,
  showFactorGroupPreview
};
