import type { ViewpointIR } from "../src/core/types";

const labels = [
  "AI 能力提高", "编程门槛下降", "独立开发者增加", "复杂软件仍需工程判断", "工程师不会消失",
  "工程师角色改变", "工具可靠后企业采用", "角色变化发生在工具普及之后", "规划、检索和工具使用构成 Agent", "被折叠的补充信息"
];

export const sampleIr: ViewpointIR = {
  version: "0.1",
  title: "AI 改变工程师角色",
  language: "zh-CN",
  sourceText: "AI 正在降低编程门槛，因此未来独立开发者会增加。但复杂软件仍然需要工程经验，所以 AI 不会消灭工程师，而是改变工程师的角色。",
  semanticObjects: [
    { id: "o_ai", type: "Entity", label: "AI" },
    { id: "o_engineer", type: "Entity", label: "工程师" },
    { id: "o_role", type: "Property", label: "角色" },
    { id: "o_adoption", type: "Event", label: "工具普及" },
    { id: "o_reliability", type: "State", label: "工具可靠" },
    { id: "o_build", type: "Action", label: "构建软件" },
    { id: "o_share", type: "Quantity", label: "独立开发者数量" }
  ],
  propositions: labels.map((label, index) => ({
    id: `p${index + 1}`,
    label,
    predicate: index === 0 ? "Increase" : "State",
    arguments: [],
    modifiers: { polarity: index === 4 ? "negative" : "positive", modality: index === 2 ? "probable" : "certain" },
    intent: index === 2 ? "PREDICT" : "ASSERT",
    metadata: { importance: index === 5 ? 1 : 0.65, confidence: 0.9, presentationPriority: index === 5 ? 1 : 0.6, sectionId: "s1", isMainClaim: index === 5 }
  })),
  relations: [
    { id: "r1", source: "p1", target: "p2", family: "CAUSE", subtype: "decrease", confidence: 0.9, sectionId: "s1" },
    { id: "r2", source: "p2", target: "p3", family: "SUPPORT", subtype: "explanation", confidence: 0.8, sectionId: "s1" },
    { id: "r3", source: "p4", target: "p5", family: "OPPOSE", subtype: "rebuttal", confidence: 0.9, sectionId: "s1" },
    { id: "r4", source: "p7", target: "p3", family: "CONDITION", subtype: "prerequisite", confidence: 0.8, sectionId: "s1" },
    { id: "r5", source: "p3", target: "p4", family: "COMPARE", subtype: "tradeoff", confidence: 0.7, sectionId: "s1" },
    { id: "r6", source: "p9", target: "p7", family: "DECOMPOSE", subtype: "contains", confidence: 0.8, sectionId: "s1" },
    { id: "r7", source: "p8", target: "p6", family: "TEMPORAL", subtype: "before", confidence: 0.7, sectionId: "s1" },
    { id: "r8", source: "p5", target: "p6", family: "INFER", subtype: "therefore", confidence: 0.95, sectionId: "s1" }
  ],
  sections: [{ id: "s1", title: "变化而非消失", propositionIds: labels.map((_, index) => `p${index + 1}`) }],
  globalClaimIds: ["p6"]
};

