import assert from "node:assert/strict";
import { getAnalysisCanvasSize } from "../assets/js/analysis/image-analysis.js";

assert.deepEqual(
  getAnalysisCanvasSize(2384, 3180),
  { width: 1192, height: 1590, scale: 0.5 }
);
assert.deepEqual(
  getAnalysisCanvasSize(1242, 2688),
  { width: 1242, height: 2688, scale: 1 }
);

console.log("high-DPI analysis normalization tests: OK");
