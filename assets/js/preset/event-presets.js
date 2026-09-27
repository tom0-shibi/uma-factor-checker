import { SKILL_EXAM_HIGH_EFFICIENCY_PRESET } from "./skill-exam-high-efficiency.js";

const EVENT_PRESETS = [
  {
    id: "event:202610-champions-meeting",
    name: "202610 チャンピオンズミーティング",
    eventMonth: "202610",
    eventType: "チャンピオンズミーティング",
    readonly: true,
    candidates: [
      { name: "右回り〇" },
      { name: "秋ウマ娘〇" },
      { name: "地固め" },
      { name: "先駆け" },
      { name: "巧みなステップ" },
      { name: "十万バリキ" },
      { name: "お見通し" },
      { name: "尻尾上がり" }
    ],
    skills: null,
    labels: null,
    sample: true
  },
  {
    id: "event:skill-exam-high-efficiency",
    name: "技能試験 高効率用",
    eventMonth: "999912",
    eventType: "技能試験",
    readonly: true,
    persistent: true,
    candidates: [],
    skills: SKILL_EXAM_HIGH_EFFICIENCY_PRESET.skills,
    labels: SKILL_EXAM_HIGH_EFFICIENCY_PRESET.labels,
    sample: false
  }
];

export { EVENT_PRESETS };
