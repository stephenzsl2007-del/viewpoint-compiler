import { z } from "zod";
import {
  aspectRatios,
  intents,
  modalities,
  polarities,
  relationFamilies,
  semanticObjectTypes,
  themes,
  type CompilerSettings,
  type ViewpointIR
} from "./types.js";

const id = z.string().min(1).max(120).regex(/^[A-Za-z0-9][A-Za-z0-9._:-]*$/, "IDs must be stable ASCII identifiers");
const unit = z.number().min(0).max(1);

export const semanticObjectSchema = z.object({
  id,
  type: z.enum(semanticObjectTypes),
  label: z.string().min(1).max(240),
  description: z.string().max(1000).optional(),
  aliases: z.array(z.string().min(1).max(240)).max(20).optional()
});

export const propositionSchema = z.object({
  id,
  label: z.string().min(1).max(500),
  predicate: z.string().min(1).max(120),
  arguments: z.array(z.object({ role: z.string().min(1).max(80), objectId: id })).max(20),
  modifiers: z.object({
    polarity: z.enum(polarities),
    modality: z.enum(modalities),
    time: z.object({
      kind: z.enum(["past", "present", "future", "specific", "duration"]),
      value: z.string().max(200).optional()
    }).optional(),
    quantification: z.object({
      kind: z.enum(["all", "most", "some", "few", "one", "percentage"]),
      value: z.string().max(100).optional()
    }).optional()
  }),
  intent: z.enum(intents),
  sourceSpan: z.object({ start: z.number().int().min(0), end: z.number().int().min(0), text: z.string().optional() }).optional(),
  metadata: z.object({
    importance: unit,
    confidence: unit,
    presentationPriority: unit,
    sectionId: id.optional(),
    isMainClaim: z.boolean().optional()
  })
});

export const relationSubtypeMap = {
  SUPPORT: ["evidence", "example", "authority", "explanation", "observation"],
  OPPOSE: ["contradiction", "counterexample", "exception", "limitation", "rebuttal"],
  CAUSE: ["cause", "enable", "prevent", "increase", "decrease", "trigger"],
  CONDITION: ["necessary_condition", "sufficient_condition", "prerequisite", "unless"],
  COMPARE: ["similarity", "difference", "advantage", "disadvantage", "tradeoff"],
  DECOMPOSE: ["part_of", "type_of", "instance_of", "contains", "dimension_of"],
  TEMPORAL: ["before", "after", "simultaneous", "sequence", "during"],
  INFER: ["deduction", "induction", "abduction", "therefore"]
} as const;

export const relationSchema = z.object({
  id,
  source: id,
  target: id,
  family: z.enum(relationFamilies),
  subtype: z.string().min(1).max(80),
  label: z.string().max(200).optional(),
  confidence: unit,
  sectionId: id.optional()
}).superRefine((relation, ctx) => {
  const allowed = relationSubtypeMap[relation.family] as readonly string[];
  if (!allowed.includes(relation.subtype)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["subtype"], message: `Invalid ${relation.family} subtype` });
  }
});

export const viewpointIRSchema = z.object({
  version: z.literal("0.1"),
  title: z.string().min(1).max(240),
  language: z.string().min(2).max(35),
  sourceText: z.string().min(1).max(100_000),
  semanticObjects: z.array(semanticObjectSchema).max(2000),
  propositions: z.array(propositionSchema).min(1).max(2000),
  relations: z.array(relationSchema).max(5000),
  sections: z.array(z.object({
    id,
    title: z.string().min(1).max(240),
    summary: z.string().max(1000).optional(),
    propositionIds: z.array(id)
  })).max(200),
  globalClaimIds: z.array(id),
  presentation: z.object({
    sceneOrder: z.array(id).optional(),
    hiddenSceneIds: z.array(id).optional(),
    pinnedPropositionIds: z.array(id).optional(),
    nodePositions: z.record(id, z.object({ x: z.number().finite(), y: z.number().finite() })).optional()
  }).optional()
}).superRefine((value, ctx) => {
  const objectIds = new Set(value.semanticObjects.map((item) => item.id));
  const propositionIds = new Set(value.propositions.map((item) => item.id));
  const sectionIds = new Set(value.sections.map((item) => item.id));
  const allIds = [...objectIds, ...propositionIds];
  if (allIds.length !== new Set(allIds).size) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "All semantic object and proposition IDs must be unique" });
  for (const proposition of value.propositions) {
    for (const argument of proposition.arguments) if (!objectIds.has(argument.objectId)) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["propositions", proposition.id], message: `Unknown object ${argument.objectId}` });
    if (proposition.metadata.sectionId && !sectionIds.has(proposition.metadata.sectionId)) ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Unknown section ${proposition.metadata.sectionId}` });
    if (proposition.sourceSpan && proposition.sourceSpan.end < proposition.sourceSpan.start) ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Invalid source span on ${proposition.id}` });
  }
  for (const relation of value.relations) {
    if (!propositionIds.has(relation.source) || !propositionIds.has(relation.target)) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["relations", relation.id], message: "Relations must connect propositions" });
    if (relation.source === relation.target) ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Self relation ${relation.id} is not allowed` });
    if (relation.sectionId && !sectionIds.has(relation.sectionId)) ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Unknown section ${relation.sectionId}` });
  }
  for (const section of value.sections) for (const propositionId of section.propositionIds) if (!propositionIds.has(propositionId)) ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Unknown proposition ${propositionId} in section ${section.id}` });
  for (const claimId of value.globalClaimIds) if (!propositionIds.has(claimId)) ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Unknown global claim ${claimId}` });
});

export const settingsSchema = z.object({
  theme: z.enum(themes),
  aspectRatio: z.enum(aspectRatios),
  maxNodesPerScene: z.number().int().min(2).max(12),
  autoplay: z.boolean()
});

export function parseViewpointIR(input: unknown): ViewpointIR {
  return viewpointIRSchema.parse(input) as ViewpointIR;
}

export function parseSettings(input: unknown): CompilerSettings {
  return settingsSchema.parse(input) as CompilerSettings;
}
