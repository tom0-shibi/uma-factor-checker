/* =========================================================
  Factor Master

  正式な白因子名称と分類を管理する静的データ。
  regression fixtureで人が確認した名称と、既存のcanonical
  matching検証で使用していた正式名称を初期データとする。
  OCR誤読aliasはここへ登録しない。
  ========================================================= */

const FACTOR_TYPES = Object.freeze({
  SKILL: "skill",
  RACE: "race",
  OTHER: "other"
});

const FACTOR_MASTER = Object.freeze([
  { name: "春の目覚め", type: FACTOR_TYPES.SKILL },
  { name: "秋の目覚め", type: FACTOR_TYPES.SKILL },
  { name: "冬の目覚め", type: FACTOR_TYPES.SKILL },
  { name: "右回りの目覚め", type: FACTOR_TYPES.SKILL },
  { name: "左回りの目覚め", type: FACTOR_TYPES.SKILL },
  { name: "スピードの目覚め", type: FACTOR_TYPES.SKILL },
  { name: "左回り○", type: FACTOR_TYPES.SKILL },
  { name: "秋ウマ娘○", type: FACTOR_TYPES.SKILL },
  { name: "春ウマ娘○", type: FACTOR_TYPES.SKILL },
  { name: "冬ウマ娘○", type: FACTOR_TYPES.SKILL },
  { name: "マイルコーナー○", type: FACTOR_TYPES.SKILL },
  { name: "マイル直線○", type: FACTOR_TYPES.SKILL },
  { name: "追込コーナー○", type: FACTOR_TYPES.SKILL },
  { name: "根幹距離○", type: FACTOR_TYPES.SKILL },
  { name: "非根幹距離○", type: FACTOR_TYPES.SKILL },
  { name: "良バ場○", type: FACTOR_TYPES.SKILL },
  { name: "一足飛び", type: FACTOR_TYPES.SKILL },
  { name: "胸の高鳴り", type: FACTOR_TYPES.SKILL },
  { name: "序盤巧者", type: FACTOR_TYPES.SKILL },
  { name: "むきだしの情熱", type: FACTOR_TYPES.SKILL },
  { name: "東の雄", type: FACTOR_TYPES.SKILL },
  { name: "西の雄", type: FACTOR_TYPES.SKILL },
  { name: "末脚", type: FACTOR_TYPES.SKILL },
  { name: "二刀流", type: FACTOR_TYPES.SKILL },
  { name: "連綿", type: FACTOR_TYPES.SKILL },
  { name: "負けん気", type: FACTOR_TYPES.SKILL },
  { name: "向こう見ず", type: FACTOR_TYPES.SKILL },
  { name: "風切り", type: FACTOR_TYPES.SKILL },
  { name: "後先恐れず", type: FACTOR_TYPES.SKILL },
  { name: "心弾んで", type: FACTOR_TYPES.SKILL },
  { name: "気合十分", type: FACTOR_TYPES.SKILL },
  { name: "品行方正", type: FACTOR_TYPES.SKILL },
  { name: "たぎる血潮", type: FACTOR_TYPES.SKILL },
  { name: "阿吽の呼吸", type: FACTOR_TYPES.SKILL },
  { name: "好戦的", type: FACTOR_TYPES.SKILL },
  { name: "レースの真髄・体", type: FACTOR_TYPES.SKILL },
  { name: "レースの真髄・力", type: FACTOR_TYPES.SKILL },
  { name: "レースの真髄・速", type: FACTOR_TYPES.SKILL },
  { name: "アメリカンドリーム", type: FACTOR_TYPES.SKILL },
  { name: "いざ我が道へ！", type: FACTOR_TYPES.SKILL },
  { name: "溌剌", type: FACTOR_TYPES.SKILL },

  { name: "安田記念", type: FACTOR_TYPES.RACE },
  { name: "チャンピオンズC", type: FACTOR_TYPES.RACE },
  { name: "ホープフルS", type: FACTOR_TYPES.RACE },
  { name: "マイルCS南部杯", type: FACTOR_TYPES.RACE },
  { name: "ヴィクトリアマイル", type: FACTOR_TYPES.RACE },
  { name: "天皇賞（秋）", type: FACTOR_TYPES.RACE },
  { name: "朝日杯FS", type: FACTOR_TYPES.RACE },
  { name: "東京大賞典", type: FACTOR_TYPES.RACE },
  { name: "BC・サンタアニタパーク", type: FACTOR_TYPES.RACE },
  { name: "マイルCS", type: FACTOR_TYPES.RACE },
  { name: "大阪杯", type: FACTOR_TYPES.RACE },
  { name: "有馬記念", type: FACTOR_TYPES.RACE },
  { name: "JDダービー", type: FACTOR_TYPES.RACE },

  { name: "追込の遺伝子", type: FACTOR_TYPES.OTHER },
  { name: "恩返し、召し上がれ", type: FACTOR_TYPES.OTHER }
]);

export { FACTOR_TYPES, FACTOR_MASTER };
