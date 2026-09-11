import assert from "node:assert/strict";
import {
  APP_BUILD,
  SKILL_MATCH_CONFIG,
  requirements
} from "../assets/js/config.js";
import {
  getCanonicalSkillCandidates,
  getTemporaryCandidateCount
} from "../assets/js/matching/candidate-provider.js";
import {
  findBestSkillMatch,
  createSkillMatchContext,
  assessSkillMatch,
  getRequirementRank
} from "../assets/js/matching/matching.js";
import {
  getShortSkillFallbackDecision,
  shouldRunShortSkillFallback,
  evaluateStrongShortSkillFallbackResult,
  isStrongShortSkillFallbackResult
} from "../assets/js/matching/fallback-policy.js";

assert.equal(APP_BUILD, "20260911-result-summary-03");
assert.deepEqual(SKILL_MATCH_CONFIG, {
  thresholds: {
    1: 1.00,
    2: 0.50,
    3: 0.66,
    4: 0.60,
    5: 0.60
  },
  defaultThreshold: 0.60,
  minimumMargin: 0.15
});
assert.equal(getTemporaryCandidateCount(), 31);

requirements.S = ["連綿", "負けん気", "いざ我が道へ！"];
requirements.A = ["向こう見ず", "マイルコーナー〇"];
requirements.B = ["マイル直線〇", "秋ウマ娘〇"];
requirements.C = [];

const dictionary = getCanonicalSkillCandidates();
const context = createSkillMatchContext(dictionary);

assert.equal(
  dictionary.filter(name => name === "連綿").length,
  1,
  "暫定候補と要件名称の重複を除去する"
);
requirements.C = ["要件だけに存在する名称"];
assert.ok(
  getCanonicalSkillCandidates().includes("要件だけに存在する名称"),
  "要件変更時にcandidate cacheを更新する"
);
requirements.C = [];

function resolve(ocrText) {
  const matchResult = findBestSkillMatch(ocrText, dictionary);
  const assessment = assessSkillMatch(matchResult, context);
  const canonicalName = assessment.finalStatus === "confirmed"
    ? matchResult.candidate
    : null;
  const requirementRank = canonicalName
    ? getRequirementRank(canonicalName)
    : null;
  return {
    matchResult,
    assessment,
    canonicalName,
    requirementRank
  };
}

for (const skill of [
  "負けん気",
  "向こう見ず",
  "風切り",
  "後先恐れず",
  "連綿",
  "レースの真髄・体",
  "レースの真髄・速",
  "アメリカンドリーム",
  "心弾んで",
  "左回り○",
  "気合十分",
  "いざ我が道へ！",
  "品行方正",
  "たぎる血潮",
  "マイルコーナー〇",
  "マイル直線○",
  "秋ウマ娘○"
]) {
  assert.equal(resolve(skill).assessment.finalStatus, "confirmed", skill);
}

for (const [ocrText, expected] of [
  ["向こう見すず", "向こう見ず"],
  ["向こう見すずビ", "向こう見ず"],
  ["を左回り〇", "左回り○"],
  ["マイルコーナーのO〇", "マイルコーナー○"],
  ["マイルコーナーの〇", "マイルコーナー○"],
  ["秋ウマ娘〇ンー", "秋ウマ娘○"],
  ["負けん気器量", "負けん気"],
  ["いざ我が道へ/", "いざ我が道へ！"]
]) {
  const result = resolve(ocrText);
  assert.equal(result.canonicalName, expected, ocrText);
  assert.equal(result.assessment.finalStatus, "confirmed", ocrText);
}

for (const [ocrText, canonicalName] of [
  ["末且", "末脚"],
  ["ーー足飛び", "一足飛び"],
  ["胞の高喝り", "胸の高鳴り"],
  ["序般巧者", "序盤巧者"],
  ["序能巧者", "序盤巧者"],
  ["おきだしの情熱", "むきだしの情熱"],
  ["西の雑", "西の雄"],
  ["東の雑", "東の雄"]
]) {
  const result = resolve(ocrText);
  assert.equal(result.canonicalName, canonicalName, ocrText);
  assert.equal(result.requirementRank, null, ocrText);
}

for (const ocrText of ["吾の目覚め。", "の目質め。"]) {
  const result = resolve(ocrText);
  assert.equal(result.assessment.finalStatus, "review", ocrText);
  assert.equal(result.canonicalName, null, ocrText);
  assert.equal(
    result.assessment.reason,
    "ambiguous-similar-candidates",
    ocrText
  );
}

for (const ocrText of [
  "大阪杯",
  "ヴィクトリアマイル",
  "安田記念",
  "Dreamsシナリオ",
  "マイルの遺伝子",
  "omキリ",
  "洪処",
  "漠制",
  "渓刺"
]) {
  const result = resolve(ocrText);
  assert.equal(result.assessment.finalStatus, "unresolved", ocrText);
  assert.equal(result.canonicalName, null, ocrText);
  assert.equal(result.requirementRank, null, ocrText);
}

const pursuitCorner = resolve("過込コーナーO〇");
assert.equal(pursuitCorner.assessment.finalStatus, "review");
assert.equal(pursuitCorner.canonicalName, null);
assert.equal(pursuitCorner.requirementRank, null);

assert.equal(resolve("連綿").requirementRank, "S");
assert.equal(resolve("向こう見すず").requirementRank, "A");
assert.equal(resolve("末脚").requirementRank, null);

assert.equal(
  shouldRunShortSkillFallback({
    finalStatus: "unresolved",
    matchStatus: "unmatched",
    ocrConfidence: 0,
    shortSkillCount: 1,
    hasOcrCanvas: true
  }),
  true
);
assert.equal(
  shouldRunShortSkillFallback({
    finalStatus: "confirmed",
    matchStatus: "exact",
    ocrConfidence: 0,
    shortSkillCount: 1,
    hasOcrCanvas: true
  }),
  false
);

const weakTwoCharacterDecision = getShortSkillFallbackDecision({
  finalStatus: "confirmed",
  matchStatus: "similar",
  ocrConfidence: 11,
  shortSkillCount: 5,
  hasOcrCanvas: true,
  candidateLength: 2,
  firstSimilarity: 0.50,
  threshold: 0.50
});
assert.deepEqual(weakTwoCharacterDecision, {
  shouldRun: true,
  reason: "weak-short-canonical-match"
});

const weakThreeCharacterDecision = getShortSkillFallbackDecision({
  finalStatus: "unresolved",
  matchStatus: "unmatched",
  ocrConfidence: 45,
  shortSkillCount: 5,
  hasOcrCanvas: true,
  candidateLength: 3,
  firstSimilarity: 0.40,
  threshold: 0.60
});
assert.deepEqual(weakThreeCharacterDecision, {
  shouldRun: true,
  reason: "weak-short-canonical-match"
});

assert.equal(
  shouldRunShortSkillFallback({
    finalStatus: "confirmed",
    matchStatus: "similar",
    ocrConfidence: 64,
    shortSkillCount: 5,
    hasOcrCanvas: true,
    candidateLength: 4,
    firstSimilarity: 0.60,
    threshold: 0.60
  }),
  false,
  "安全に確定済みの一足飛び相当はfallbackしない"
);

assert.equal(
  shouldRunShortSkillFallback({
    finalStatus: "review",
    matchStatus: "review",
    ocrConfidence: 11,
    shortSkillCount: 5,
    hasOcrCanvas: true,
    candidateLength: 2,
    firstSimilarity: 0.80,
    threshold: 0.50
  }),
  false,
  "ambiguity reviewはfallbackで上書きしない"
);

assert.equal(
  isStrongShortSkillFallbackResult({
    fallbackAssessment: { finalStatus: "confirmed" },
    fallbackMatchResult: {
      candidate: "末脚",
      similarity: 1,
      similarityMargin: 1
    },
    fallbackConfidence: 73,
    normalMatchResult: {
      candidate: "末脚",
      similarity: 0.5,
      similarityMargin: 0.5
    }
  }),
  true,
  "fallback完全一致は採用できる"
);

assert.equal(
  isStrongShortSkillFallbackResult({
    fallbackAssessment: { finalStatus: "confirmed" },
    fallbackMatchResult: {
      candidate: "末脚",
      similarity: 0.5,
      similarityMargin: 0.5
    },
    fallbackConfidence: 30,
    normalMatchResult: {
      candidate: "末脚",
      similarity: 0.5,
      similarityMargin: 0.5
    }
  }),
  false,
  "通常結果と同程度の弱いfallbackは採用しない"
);

assert.equal(
  isStrongShortSkillFallbackResult({
    fallbackAssessment: { finalStatus: "confirmed" },
    fallbackMatchResult: {
      candidate: "二刀流",
      similarity: 0.60,
      similarityMargin: 0.20
    },
    fallbackConfidence: 45,
    normalMatchResult: {
      candidate: "二刀流",
      similarity: 0.40,
      similarityMargin: 0.178
    }
  }),
  true,
  "同一候補へ類似度が明確に改善した安全なfallbackは採用する"
);

assert.deepEqual(
  evaluateStrongShortSkillFallbackResult({
    fallbackAssessment: { finalStatus: "confirmed" },
    fallbackMatchResult: {
      candidate: "二刀流",
      similarity: 0.60,
      similarityMargin: 0.20
    },
    fallbackConfidence: 45,
    normalMatchResult: {
      candidate: "二刀流",
      similarity: 0.40,
      similarityMargin: 0.178
    }
  }).reason,
  "fallback-consistent-improvement",
  "採用理由をdebugログ向けに保持する"
);

assert.equal(
  isStrongShortSkillFallbackResult({
    fallbackAssessment: { finalStatus: "confirmed" },
    fallbackMatchResult: {
      candidate: "別候補",
      similarity: 0.60,
      similarityMargin: 0.20
    },
    fallbackConfidence: 70,
    normalMatchResult: {
      candidate: "二刀流",
      similarity: 0.40,
      similarityMargin: 0.178
    }
  }),
  false,
  "fallbackで別候補へ寄った場合は採用しない"
);

for (const [label, overrides] of [
  ["confidence不足", { fallbackConfidence: 39 }],
  [
    "類似度改善不足",
    {
      fallbackSimilarity: 0.54,
      fallbackMargin: 0.20
    }
  ],
  ["候補差悪化", { fallbackMargin: 0.17 }]
]) {
  assert.equal(
    isStrongShortSkillFallbackResult({
      fallbackAssessment: { finalStatus: "confirmed" },
      fallbackMatchResult: {
        candidate: "二刀流",
        similarity: overrides.fallbackSimilarity ?? 0.60,
        similarityMargin: overrides.fallbackMargin ?? 0.20
      },
      fallbackConfidence: overrides.fallbackConfidence ?? 45,
      normalMatchResult: {
        candidate: "二刀流",
        similarity: 0.40,
        similarityMargin: 0.178
      }
    }),
    false,
    label
  );
}

console.log("matching regression tests: OK");
