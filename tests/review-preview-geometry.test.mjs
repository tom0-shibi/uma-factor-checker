import assert from "node:assert/strict";
import {
  getSourceCardThumbnailCrop
} from "../assets/js/ocr/review-preview-geometry.js";

const source = { width: 2388, height: 3334 };
const previousCard = { x: 1204, y: 2040, width: 787, height: 136 };
const targetCard = { x: 1204, y: 2186, width: 787, height: 136 };
const targetTextCrop = { x: 1298, y: 2219, width: 347, height: 65 };
const targetStarArea = { x: 1472, y: 2249, width: 283, height: 68 };

const crop = getSourceCardThumbnailCrop(
  source.width,
  source.height,
  targetCard
);

assert.equal(crop.y, targetCard.y, "previewを対象カードの上へ拡張しない");
assert.equal(crop.height, targetCard.height, "previewを対象カードの下へ拡張しない");
assert.ok(crop.y >= previousCard.y + previousCard.height);
assert.ok(targetTextCrop.y >= crop.y);
assert.ok(targetTextCrop.y + targetTextCrop.height <= crop.y + crop.height);
assert.ok(targetStarArea.y >= crop.y);
assert.ok(targetStarArea.y + targetStarArea.height <= crop.y + crop.height);

console.log("review preview geometry tests: OK");
