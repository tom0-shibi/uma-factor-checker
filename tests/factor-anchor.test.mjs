import assert from "node:assert/strict";
import {
  classifyFactorLayout,
  detectFactorSectionAnchor,
  detectFactorSectionAnchorCandidates
} from "../assets/js/analysis/factor-anchor.js";
import {
  validateSupportedFactorList
} from "../assets/js/analysis/image-analysis.js";

function createContext(width, height, greenAreas) {
  return {
    getImageData(x, y, sampleWidth, sampleHeight) {
      const data = new Uint8ClampedArray(sampleWidth * sampleHeight * 4);
      for (let sampleY = 0; sampleY < sampleHeight; sampleY++) {
        for (let sampleX = 0; sampleX < sampleWidth; sampleX++) {
          const absoluteX = x + sampleX;
          const absoluteY = y + sampleY;
          const isGreen = greenAreas.some(area => (
            absoluteX >= area.left &&
            absoluteX < area.right &&
            absoluteY >= area.top &&
            absoluteY < area.bottom
          ));
          const index = (sampleY * sampleWidth + sampleX) * 4;
          data[index] = isGreen ? 100 : 230;
          data[index + 1] = isGreen ? 205 : 230;
          data[index + 2] = isGreen ? 20 : 230;
          data[index + 3] = 255;
        }
      }
      return { data };
    }
  };
}

const width = 1000;
const height = 1600;

const detailAnchor = detectFactorSectionAnchor(
  createContext(width, height, [{ left: 30, right: 970, top: 670, bottom: 700 }]),
  width,
  height
);
assert.ok(detailAnchor);
assert.equal(classifyFactorLayout(detailAnchor), "detail");
assert.ok(detailAnchor.continuousStartRatio < 0.04);
assert.ok(detailAnchor.continuousEndRatio > 0.96);

const listAnchor = detectFactorSectionAnchor(
  createContext(width, height, [{ left: 150, right: 860, top: 350, bottom: 380 }]),
  width,
  height
);
assert.ok(listAnchor);
assert.equal(classifyFactorLayout(listAnchor), "factor-list");
assert.ok(listAnchor.continuousStartRatio > 0.14);
assert.ok(listAnchor.continuousEndRatio < 0.87);

const rentalListAnchor = detectFactorSectionAnchor(
  createContext(width, height, [{ left: 150, right: 860, top: 730, bottom: 760 }]),
  width,
  height
);
assert.ok(rentalListAnchor);
assert.equal(classifyFactorLayout(rentalListAnchor), "factor-list");

const splitGreenCards = detectFactorSectionAnchor(
  createContext(width, height, [
    { left: 160, right: 490, top: 500, bottom: 550 },
    { left: 505, right: 835, top: 500, bottom: 550 }
  ]),
  width,
  height
);
assert.equal(splitGreenCards, null);
assert.equal(classifyFactorLayout(null), "continuation");

const multipleCandidates = detectFactorSectionAnchorCandidates(
  createContext(width, height, [
    { left: 150, right: 860, top: 300, bottom: 330 },
    { left: 20, right: 980, top: 670, bottom: 700 }
  ]),
  width,
  height
);
assert.equal(multipleCandidates.length, 2);
assert.equal(multipleCandidates[0].top, 300);
assert.equal(multipleCandidates[1].top, 670);

function createValidationInput(overrides = {}) {
  const rows = Array.from(
    { length: 10 },
    (_, index) => ({
      row: index + 1,
      leftCard: {},
      rightCard: {}
    })
  );

  return {
    factorAnchorFound: true,
    layoutType: "factor-list",
    rowResult: {
      pitch: 63,
      rows
    },
    columnGeometry: {
      leftX: 100,
      rightX: 500,
      leftWidth: 350,
      rightWidth: 350,
      cardHeight: 56
    },
    leftCount: 10,
    rightCount: 10,
    ...overrides
  };
}

assert.deepEqual(
  validateSupportedFactorList(
    createValidationInput({
      leftCount: 13,
      rightCount: 12
    })
  ),
  {
    supported: true,
    reason: "anchor-and-stable-factor-grid",
    classificationLayout: "factor-list-start"
  }
);

assert.deepEqual(
  validateSupportedFactorList(
    createValidationInput()
  ),
  {
    supported: true,
    reason: "anchor-and-stable-factor-grid",
    classificationLayout: "factor-list-start"
  }
);

assert.deepEqual(
  validateSupportedFactorList(
    createValidationInput({
      layoutType: "detail",
      leftCount: 2,
      rightCount: 2
    })
  ),
  {
    supported: false,
    reason: "unsupported-layout"
  }
);

assert.deepEqual(
  validateSupportedFactorList(
    createValidationInput({
      factorAnchorFound: false,
      layoutType: "continuation"
    })
  ),
  {
    supported: true,
    reason: "stable-factor-grid",
    classificationLayout: "factor-list-continuation"
  }
);

assert.deepEqual(
  validateSupportedFactorList(
    createValidationInput({
      factorAnchorFound: false,
      layoutType: "continuation",
      rowResult: {
        pitch: 63,
        rows: [
          { leftCard: {}, rightCard: {} },
          { leftCard: {}, rightCard: {} }
        ]
      },
      leftCount: 2,
      rightCount: 2
    })
  ),
  {
    supported: false,
    reason: "no-factor-anchor"
  }
);

assert.deepEqual(
  validateSupportedFactorList(
    createValidationInput({
      factorAnchorFound: false,
      rowResult: {
        pitch: null,
        rows: []
      },
      leftCount: 0,
      rightCount: 0
    })
  ),
  {
    supported: false,
    reason: "no-factor-anchor"
  }
);

assert.deepEqual(
  validateSupportedFactorList(
    createValidationInput({
      rowResult: {
        pitch: 63,
        rows: [
          { leftCard: {}, rightCard: {} },
          { leftCard: {}, rightCard: {} }
        ]
      },
      leftCount: 2,
      rightCount: 2
    })
  ),
  {
    supported: false,
    reason: "insufficient-factor-grid"
  }
);

console.log("factor anchor tests: OK");
