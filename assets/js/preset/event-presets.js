import { SKILL_EXAM_HIGH_EFFICIENCY_PRESET } from "./skill-exam-high-efficiency.js";

const EVENT_PRESETS = [
  {
    id: "event:202610-champions-meeting",
    name: "202610 チャンピオンズミーティング",
    eventMonth: "202610",
    eventType: "チャンピオンズミーティング",
    readonly: true,
    candidates: [
      { name: "右回り〇", styles: ["all"] },
      { name: "秋ウマ娘〇", styles: ["all"] },
      { name: "地固め", styles: ["逃げ"] },
      { name: "先駆け", styles: ["逃げ"] },
      { name: "巧みなステップ", styles: ["先行"] },
      { name: "十万バリキ", styles: ["差し"] },
      { name: "お見通し", styles: ["追込"] },
      { name: "尻尾上がり", styles: ["先行", "差し", "追込"] }
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
