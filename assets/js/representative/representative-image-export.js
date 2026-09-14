import { debugLogLines } from "../config.js";
import { stitchMemberImages } from "../export/image-stitcher.js";
import {
  showFactorGroupPreview
} from "../export/factor-image-export.js";

function getSupportedMemberData(member) {
  const supportedResults = member.analysisResults.filter(
    result => result.analysis?.supported === true
  );
  const supportedImageIds = new Set(
    supportedResults.map(result => result.imageId)
  );
  return {
    supportedResults,
    supportedImages: member.images.filter(image => supportedImageIds.has(image.id))
  };
}

async function createRepresentativeImage(members, memberOrder) {
  const columns = [];
  for (const memberId of memberOrder) {
    const member = members[memberId];
    const { supportedImages, supportedResults } = getSupportedMemberData(member);
    if (supportedImages.length === 0) {
      continue;
    }
    const stitched = await stitchMemberImages(supportedImages, supportedResults);
    if (stitched) {
      columns.push({ memberId, label: member.label, stitched });
    }
  }
  if (columns.length === 0) {
    return null;
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
  columns.forEach(column => {
    const columnWidth = column.stitched.canvas.width;
    context.fillStyle = "#ffffff";
    context.fillRect(x, 0, columnWidth, headerHeight);
    context.fillStyle = "#4f7f13";
    context.fillRect(x, headerHeight - 5, columnWidth, 5);
    context.fillStyle = "#222222";
    context.fillText(column.label, x + columnWidth / 2, headerHeight / 2 - 2);
    context.drawImage(column.stitched.canvas, x, headerHeight);
    x += columnWidth + gap;
  });

  debugLogLines.push(
    "representative image:",
    `members=${columns.map(column => column.memberId).join(",")}`,
    `width=${canvas.width}`,
    `height=${canvas.height}`,
    ""
  );

  return {
    canvas,
    columns,
    group: { label: "代表ウマ娘" },
    filename: `uma-factor-representative-${new Date().toISOString().slice(0, 10).replaceAll("-", "")}.png`,
    warning: columns.map(column => column.stitched.warning).filter(Boolean).join(" ")
  };
}

async function showRepresentativeImagePreview(result) {
  return showFactorGroupPreview(result);
}

export {
  getSupportedMemberData,
  createRepresentativeImage,
  showRepresentativeImagePreview
};
