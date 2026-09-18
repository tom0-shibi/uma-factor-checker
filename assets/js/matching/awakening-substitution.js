/* =========================================================
  目覚め因子の要件代用名

  名称から推測せず、正式な対応先を確認できたものだけを管理する。
  canonicalName自体は変更せず、S/A/B/C要件照合にのみ利用する。
  ========================================================= */

const AWAKENING_REQUIREMENT_SUBSTITUTIONS = Object.freeze({
  "右回りの目覚め": "右回り○",
  "左回りの目覚め": "左回り○",
  "春の目覚め": "春ウマ娘○",
  "夏の目覚め": "夏ウマ娘○",
  "秋の目覚め": "秋ウマ娘○",
  "冬の目覚め": "冬ウマ娘○"
});

function getAwakeningRequirementLookupName(canonicalName) {
  return AWAKENING_REQUIREMENT_SUBSTITUTIONS[canonicalName] ?? null;
}

export {
  AWAKENING_REQUIREMENT_SUBSTITUTIONS,
  getAwakeningRequirementLookupName
};
