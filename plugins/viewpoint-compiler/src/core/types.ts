export const semanticObjectTypes = ["Entity", "Property", "State", "Event", "Action", "Quantity"] as const;
export const relationFamilies = ["SUPPORT", "OPPOSE", "CAUSE", "CONDITION", "COMPARE", "DECOMPOSE", "TEMPORAL", "INFER"] as const;
export const intents = ["ASSERT", "QUESTION", "ASSUME", "DOUBT", "EMPHASIZE", "CONCEDE", "PREDICT", "RECOMMEND", "DEFINE", "CLARIFY"] as const;
export const modalities = ["certain", "probable", "possible", "hypothetical", "necessary"] as const;
export const polarities = ["positive", "negative"] as const;
export const themes = ["Minimal", "Academic", "Social", "Playful", "Technical"] as const;
export const aspectRatios = ["9:16", "1:1", "16:9"] as const;

export type SemanticObjectType = (typeof semanticObjectTypes)[number];
export type RelationFamily = (typeof relationFamilies)[number];
export type Intent = (typeof intents)[number];
export type Theme = (typeof themes)[number];
export type AspectRatio = (typeof aspectRatios)[number];

export interface SemanticObject {
  id: string;
  type: SemanticObjectType;
  label: string;
  description?: string;
  aliases?: string[];
}

export interface PropositionArgument {
  role: string;
  objectId: string;
}

export interface PropositionModifiers {
  polarity: (typeof polarities)[number];
  modality: (typeof modalities)[number];
  time?: { kind: "past" | "present" | "future" | "specific" | "duration"; value?: string };
  quantification?: { kind: "all" | "most" | "some" | "few" | "one" | "percentage"; value?: string };
}

export interface DisplayMetadata {
  importance: number;
  confidence: number;
  presentationPriority: number;
  sectionId?: string;
  isMainClaim?: boolean;
}

export interface Proposition {
  id: string;
  label: string;
  predicate: string;
  arguments: PropositionArgument[];
  modifiers: PropositionModifiers;
  intent: Intent;
  sourceSpan?: { start: number; end: number; text?: string };
  metadata: DisplayMetadata;
}

export interface ReasoningRelation {
  id: string;
  source: string;
  target: string;
  family: RelationFamily;
  subtype: string;
  label?: string;
  confidence: number;
  sectionId?: string;
}

export interface ViewpointSection {
  id: string;
  title: string;
  summary?: string;
  propositionIds: string[];
}

export interface PresentationPreferences {
  sceneOrder?: string[];
  hiddenSceneIds?: string[];
  pinnedPropositionIds?: string[];
  nodePositions?: Record<string, { x: number; y: number }>;
}

export interface ViewpointIR {
  version: "0.1";
  title: string;
  language: string;
  sourceText: string;
  semanticObjects: SemanticObject[];
  propositions: Proposition[];
  relations: ReasoningRelation[];
  sections: ViewpointSection[];
  globalClaimIds: string[];
  presentation?: PresentationPreferences;
}

export interface CompilerSettings {
  theme: Theme;
  aspectRatio: AspectRatio;
  maxNodesPerScene: number;
  autoplay: boolean;
}

export interface PresentationNode {
  id: string;
  label: string;
  intent: Intent;
  score: number;
  emphasis: "normal" | "strong";
  x: number;
  y: number;
}

export interface PresentationEdge extends ReasoningRelation {
  visualPrimitive: string;
}

export interface Scene {
  id: string;
  title: string;
  cognitiveAction: "Introduce" | "Explain Cause" | "Support" | "Challenge" | "Condition" | "Compare" | "Decompose" | "Sequence" | "Infer" | "Conclude";
  relationFamily?: RelationFamily;
  sectionId?: string;
  nodeIds: string[];
  relationIds: string[];
  hidden: boolean;
  durationMs: number;
}

export interface PresentationGraph {
  version: "0.1";
  nodes: PresentationNode[];
  edges: PresentationEdge[];
  scenes: Scene[];
  collapsedPropositionIds: string[];
  hiddenRelationIds: string[];
}

export interface VisualNode extends PresentationNode {
  visualType: "claim" | "question" | "prediction" | "recommendation" | "proposition";
}

export interface VisualScene extends Scene {
  nodes: VisualNode[];
  edges: PresentationEdge[];
  viewBox: { width: number; height: number };
}

export interface VisualIR {
  version: "0.1";
  theme: Theme;
  aspectRatio: AspectRatio;
  scenes: VisualScene[];
}

export interface TimelineEvent {
  id: string;
  sceneId: string;
  atMs: number;
  durationMs: number;
  targetId: string;
  action: "scene-enter" | "node-reveal" | "edge-draw" | "node-emphasize";
}

export interface Timeline {
  version: "0.1";
  durationMs: number;
  events: TimelineEvent[];
}

export interface ViewpointProject {
  version: "0.1";
  revision: number;
  projectId: string;
  projectPath: string;
  createdAt: string;
  updatedAt: string;
  settings: CompilerSettings;
  ir: ViewpointIR;
  presentationGraph: PresentationGraph;
  visualIR: VisualIR;
  timeline: Timeline;
}

export const defaultSettings: CompilerSettings = {
  theme: "Minimal",
  aspectRatio: "16:9",
  maxNodesPerScene: 8,
  autoplay: true
};
