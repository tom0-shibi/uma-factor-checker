const APP_BUILD = "20260911-matching-01";

/* =========================================================
  アプリ内データ
  スキル要件・画像・解析結果を最大6人分保持する。
  ========================================================= */

const requirements = {
  S: [],
  A: [],
  B: [],
  C: []
};

const members = {
  parentA: {
    label: "親A",
    images: [],
    analysisResults: []
  },
  grandA1: {
    label: "親A-祖1",
    images: [],
    analysisResults: []
  },
  grandA2: {
    label: "親A-祖2",
    images: [],
    analysisResults: []
  },
  parentB: {
    label: "親B",
    images: [],
    analysisResults: []
  },
  grandB1: {
    label: "親B-祖1",
    images: [],
    analysisResults: []
  },
  grandB2: {
    label: "親B-祖2",
    images: [],
    analysisResults: []
  }
};

const MEMBER_ORDER = [
  "parentA",
  "grandA1",
  "grandA2",
  "parentB",
  "grandB1",
  "grandB2"
];

let debugLogLines = [];

/* =========================================================
  解析進捗状態
  解析中オーバーレイへ現在の処理状況を渡す。
  ========================================================= */

const analysisProgress = {
  active: false,
  totalImages: 0,
  currentImageNumber: 0,
  currentMemberLabel: "",
  currentImageIndex: 0,
  currentWhiteCard: 0,
  totalWhiteCards: 0,
  tesseractProgress: 0
};

/* =========================================================
  画像解析設定
  現在安定しているカード検出設定を維持する。
  ========================================================= */

const ANALYSIS_CONFIG = {
  factorArea: {
    fallbackTopRatio: 0.18,
    bottomRatio: 0.97
  },
  columns: {
    left: {
      xRatio: 0.16,
      widthRatio: 0.33
    },
    right: {
      xRatio: 0.505,
      widthRatio: 0.33
    }
  },
  scanXPositions: [
    0.72,
    0.82,
    0.92
  ],
  gapLuminanceThreshold: 239,
  minimumGapRatio: 0.003,
  minimumCardHeightRatio: 0.014,
  maximumCardHeightRatio: 0.055
};

/* =========================================================
  星数判定設定
  現在安定している★1～3判定設定を維持する。
  ========================================================= */

const STAR_CONFIG = {
  area: {
    xRatio: 0.34,
    yRatio: 0.46,
    widthRatio: 0.36,
    heightRatio: 0.50
  },
  yellow: {
    minR: 180,
    minG: 120,
    maxB: 120,
    minRGDiffFromB: 45
  },
  minimumYellowRatio: 0.018
};

/* =========================================================
  OCR設定
  現在安定している文字切り出し設定を維持する。
  ========================================================= */

const OCR_CONFIG = {
  searchArea: {
    xRatio: 0.10,
    yRatio: 0.00,
    widthRatio: 0.86,
    heightRatio: 0.68
  },
  scale: 4,
  paddingRatio: 0.12
};

/* =========================================================
  スキル名照合設定
  OCR文字数に応じて類似一致の閾値を切り替える。
  ========================================================= */

const SKILL_MATCH_CONFIG = {
  thresholds: {
    1: 1.00,
    2: 0.50,
    3: 0.66,
    4: 0.60,
    5: 0.60
  },
  defaultThreshold: 0.60,
  minimumMargin: 0.15
};


export {
  APP_BUILD,
  requirements,
  members,
  MEMBER_ORDER,
  debugLogLines,
  analysisProgress,
  ANALYSIS_CONFIG,
  STAR_CONFIG,
  OCR_CONFIG,
  SKILL_MATCH_CONFIG
};
