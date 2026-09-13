import assert from "node:assert/strict";
import {
  buildFactorRows
} from "../assets/js/export/image-stitcher.js";

const rows = buildFactorRows({
  leftCards: [
    { row: 1, column: "left", y: 100, height: 40, factorType: "blue", stars: 3 },
    { row: 2, column: "left", y: 150, height: 40, factorType: "white", stars: 2 }
  ],
  rightCards: [
    { row: 1, column: "right", y: 102, height: 38, factorType: "red", stars: 2 },
    { row: 2, column: "right", y: 152, height: 38, factorType: "white", stars: 1 }
  ]
});

assert.deepEqual(
  rows.map(row => row.signature),
  ["blue:3|red:2", "white:2|white:1"]
);
assert.deepEqual(
  rows.map(row => [row.top, row.bottom]),
  [[100, 140], [150, 190]]
);
assert.deepEqual(buildFactorRows(null), []);

console.log("image stitcher tests: OK");
