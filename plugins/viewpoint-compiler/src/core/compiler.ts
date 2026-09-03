import {
  defaultSettings,
  type CompilerSettings,
  type PresentationEdge,
  type PresentationGraph,
  type PresentationNode,
  type Proposition,
  type ReasoningRelation,
  type RelationFamily,
  type Scene,
  type Timeline,
  type TimelineEvent,
  type ViewpointIR,
  type VisualIR,
  type VisualNode,
  type VisualScene
} from "./types.js";
import { parseSettings, parseViewpointIR } from "./schema.js";

const primitiveByFamily: Record<RelationFamily, string> = {
  SUPPORT: "evidence-converge",
  OPPOSE: "collision-barrier",
  CAUSE: "directional-flow",
  CONDITION: "gate",
  COMPARE: "split-compare",
  DECOMPOSE: "branch-expand",
  TEMPORAL: "timeline",
  INFER: "premises-conclusion"
};

const actionByFamily: Record<RelationFamily, Scene["cognitiveAction"]> = {
  SUPPORT: "Support",
  OPPOSE: "Challenge",
  CAUSE: "Explain Cause",
  CONDITION: "Condition",
  COMPARE: "Compare",
  DECOMPOSE: "Decompose",
  TEMPORAL: "Sequence",
  INFER: "Infer"
};

const familyOrder: RelationFamily[] = ["TEMPORAL", "DECOMPOSE", "COMPARE", "CAUSE", "CONDITION", "SUPPORT", "OPPOSE", "INFER"];

function scoreProposition(proposition: Proposition, degree: number, globalClaims: Set<string>, pinned: Set<string>): number {
  return proposition.metadata.importance * 4 + proposition.metadata.presentationPriority * 3 + proposition.metadata.confidence + Math.min(degree, 5) * 0.35 + (proposition.metadata.isMainClaim ? 5 : 0) + (globalClaims.has(proposition.id) ? 6 : 0) + (pinned.has(proposition.id) ? 10 : 0);
}

function visualType(proposition: Proposition): VisualNode["visualType"] {
  if (proposition.intent === "QUESTION" || proposition.intent === "DOUBT") return "question";
  if (proposition.intent === "PREDICT") return "prediction";
  if (proposition.intent === "RECOMMEND") return "recommendation";
  if (proposition.metadata.isMainClaim) return "claim";
  return "proposition";
}

function layout(family: RelationFamily | undefined, nodes: PresentationNode[]): PresentationNode[] {
  const width = 960;
  const height = 540;
  const count = Math.max(nodes.length, 1);
  return nodes.map((node, index) => {
    let x = width * ((index + 1) / (count + 1));
    let y = height / 2;
    if (family === "SUPPORT" || family === "INFER") {
      const conclusion = index === count - 1;
      x = conclusion ? width / 2 : width * ((index + 1) / count);
      y = conclusion ? height * 0.72 : height * 0.28;
    } else if (family === "DECOMPOSE") {
      x = index === 0 ? width / 2 : width * (index / count);
      y = index === 0 ? height * 0.25 : height * 0.68;
    } else if (family === "CONDITION") {
      x = width / 2;
      y = height * ((index + 1) / (count + 1));
    } else if (family === "OPPOSE" || family === "COMPARE") {
      x = index % 2 === 0 ? width * 0.3 : width * 0.7;
      y = height * (0.35 + Math.floor(index / 2) * 0.25);
    } else if (!family) {
      const cols = Math.ceil(Math.sqrt(count));
      x = width * ((index % cols) + 1) / (cols + 1);
      y = height * (Math.floor(index / cols) + 1) / (Math.ceil(count / cols) + 1);
    }
    return { ...node, x: Math.round(x), y: Math.round(y) };
  });
}

function makeSceneId(sectionId: string, family?: RelationFamily, suffix = ""): string {
  return `${sectionId}:${family?.toLowerCase() ?? "introduce"}${suffix}`;
}

export function compileViewpoint(input: unknown, requestedSettings: Partial<CompilerSettings> = {}): { presentationGraph: PresentationGraph; visualIR: VisualIR; timeline: Timeline; settings: CompilerSettings } {
  const ir = parseViewpointIR(input);
  const settings = parseSettings({ ...defaultSettings, ...requestedSettings });
  const propositionById = new Map(ir.propositions.map((item) => [item.id, item]));
  const degree = new Map<string, number>();
  for (const relation of ir.relations) {
    degree.set(relation.source, (degree.get(relation.source) ?? 0) + 1);
    degree.set(relation.target, (degree.get(relation.target) ?? 0) + 1);
  }
  const globalClaims = new Set(ir.globalClaimIds);
  const pinned = new Set(ir.presentation?.pinnedPropositionIds ?? []);
  const scored = new Map(ir.propositions.map((p) => [p.id, scoreProposition(p, degree.get(p.id) ?? 0, globalClaims, pinned)]));
  const sections = ir.sections.length ? ir.sections : [{ id: "root", title: ir.title, propositionIds: ir.propositions.map((p) => p.id) }];
  const selectedIds = new Set<string>();
  const scenes: Scene[] = [];

  for (const section of sections) {
    const sectionIds = new Set(section.propositionIds);
    const sectionRelations = ir.relations.filter((relation) => sectionIds.has(relation.source) && sectionIds.has(relation.target));
    const groups = new Map<RelationFamily, ReasoningRelation[]>();
    for (const relation of sectionRelations) groups.set(relation.family, [...(groups.get(relation.family) ?? []), relation]);
    if (!groups.size) {
      const nodes = section.propositionIds.sort((a, b) => (scored.get(b) ?? 0) - (scored.get(a) ?? 0)).slice(0, settings.maxNodesPerScene);
      nodes.forEach((node) => selectedIds.add(node));
      scenes.push({ id: makeSceneId(section.id), title: section.title, cognitiveAction: "Introduce", sectionId: section.id, nodeIds: nodes, relationIds: [], hidden: false, durationMs: Math.max(2600, nodes.length * 650) });
      continue;
    }
    for (const family of familyOrder) {
      const relations = groups.get(family);
      if (!relations?.length) continue;
      const candidates = new Set(relations.flatMap((relation) => [relation.source, relation.target]));
      const nodeIds = [...candidates].sort((a, b) => (scored.get(b) ?? 0) - (scored.get(a) ?? 0)).slice(0, settings.maxNodesPerScene);
      nodeIds.forEach((node) => selectedIds.add(node));
      const visible = new Set(nodeIds);
      const relationIds = relations.filter((relation) => visible.has(relation.source) && visible.has(relation.target)).map((relation) => relation.id);
      scenes.push({ id: makeSceneId(section.id, family), title: section.title, cognitiveAction: actionByFamily[family], relationFamily: family, sectionId: section.id, nodeIds, relationIds, hidden: false, durationMs: Math.max(3200, nodeIds.length * 650 + relationIds.length * 350) });
    }
  }

  const conclusionIds = ir.globalClaimIds.filter((id) => propositionById.has(id));
  if (conclusionIds.length && !conclusionIds.every((id) => scenes.at(-1)?.nodeIds.includes(id))) {
    conclusionIds.forEach((id) => selectedIds.add(id));
    scenes.push({ id: "global:conclusion", title: ir.title, cognitiveAction: "Conclude", nodeIds: conclusionIds.slice(0, settings.maxNodesPerScene), relationIds: [], hidden: false, durationMs: 3000 });
  }
  const hiddenScenes = new Set(ir.presentation?.hiddenSceneIds ?? []);
  for (const scene of scenes) scene.hidden = hiddenScenes.has(scene.id);
  const requestedOrder = ir.presentation?.sceneOrder ?? [];
  scenes.sort((a, b) => {
    const ai = requestedOrder.indexOf(a.id), bi = requestedOrder.indexOf(b.id);
    if (ai >= 0 || bi >= 0) return (ai < 0 ? Number.MAX_SAFE_INTEGER : ai) - (bi < 0 ? Number.MAX_SAFE_INTEGER : bi);
    return 0;
  });

  const presentationNodes: PresentationNode[] = ir.propositions.filter((p) => selectedIds.has(p.id)).map((p) => ({
    id: p.id,
    label: p.label,
    intent: p.intent,
    score: scored.get(p.id) ?? 0,
    emphasis: globalClaims.has(p.id) || p.metadata.isMainClaim ? "strong" : "normal",
    x: 0,
    y: 0
  }));
  const selectedRelations = new Set(scenes.flatMap((scene) => scene.relationIds));
  const edges: PresentationEdge[] = ir.relations.filter((r) => selectedRelations.has(r.id)).map((r) => ({ ...r, visualPrimitive: primitiveByFamily[r.family] }));

  const visualScenes: VisualScene[] = scenes.map((scene) => {
    const laidOut = layout(scene.relationFamily, scene.nodeIds.map((id) => presentationNodes.find((node) => node.id === id)!).filter(Boolean)).map((node) => {
      const manual = ir.presentation?.nodePositions?.[node.id];
      return manual ? { ...node, x: manual.x, y: manual.y } : node;
    });
    return {
      ...scene,
      nodes: laidOut.map((node) => ({ ...node, visualType: visualType(propositionById.get(node.id)!) })),
      edges: edges.filter((edge) => scene.relationIds.includes(edge.id)),
      viewBox: { width: 960, height: 540 }
    };
  });
  const positioned = new Map(visualScenes.flatMap((scene) => scene.nodes.map((node) => [node.id, node])));
  const presentationGraph: PresentationGraph = {
    version: "0.1",
    nodes: presentationNodes.map((node) => positioned.get(node.id) ?? node),
    edges,
    scenes,
    collapsedPropositionIds: ir.propositions.filter((p) => !selectedIds.has(p.id)).map((p) => p.id),
    hiddenRelationIds: ir.relations.filter((r) => !selectedRelations.has(r.id)).map((r) => r.id)
  };
  const visualIR: VisualIR = { version: "0.1", theme: settings.theme, aspectRatio: settings.aspectRatio, scenes: visualScenes };
  const events: TimelineEvent[] = [];
  let cursor = 0;
  for (const scene of scenes.filter((item) => !item.hidden)) {
    events.push({ id: `${scene.id}:enter`, sceneId: scene.id, atMs: cursor, durationMs: 250, targetId: scene.id, action: "scene-enter" });
    scene.nodeIds.forEach((nodeId, index) => events.push({ id: `${scene.id}:node:${nodeId}`, sceneId: scene.id, atMs: cursor + 250 + index * 420, durationMs: 480, targetId: nodeId, action: "node-reveal" }));
    scene.relationIds.forEach((edgeId, index) => events.push({ id: `${scene.id}:edge:${edgeId}`, sceneId: scene.id, atMs: cursor + 520 + index * 420, durationMs: 600, targetId: edgeId, action: "edge-draw" }));
    const emphasized = scene.nodeIds.find((id) => globalClaims.has(id));
    if (emphasized) events.push({ id: `${scene.id}:emphasis`, sceneId: scene.id, atMs: cursor + scene.durationMs - 700, durationMs: 500, targetId: emphasized, action: "node-emphasize" });
    cursor += scene.durationMs;
  }
  return { presentationGraph, visualIR, timeline: { version: "0.1", durationMs: cursor, events }, settings };
}
