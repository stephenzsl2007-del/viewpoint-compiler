import { describe, expect, it } from "vitest";
import { parseViewpointIR, viewpointIRSchema } from "../src/core/schema";
import { sampleIr } from "./fixtures";

describe("Viewpoint IR schema", () => {
  it("accepts all V0 semantic and relation families", () => {
    expect(parseViewpointIR(sampleIr).relations).toHaveLength(8);
  });

  it("rejects a relation that references an unknown proposition", () => {
    const invalid = structuredClone(sampleIr);
    invalid.relations[0].target = "missing";
    expect(viewpointIRSchema.safeParse(invalid).success).toBe(false);
  });

  it("rejects a subtype from the wrong family", () => {
    const invalid = structuredClone(sampleIr);
    invalid.relations[0].subtype = "evidence";
    expect(viewpointIRSchema.safeParse(invalid).success).toBe(false);
  });

  it("preserves negation, modality and global claims", () => {
    const parsed = parseViewpointIR(sampleIr);
    expect(parsed.propositions.find((p) => p.id === "p5")?.modifiers.polarity).toBe("negative");
    expect(parsed.propositions.find((p) => p.id === "p3")?.modifiers.modality).toBe("probable");
    expect(parsed.globalClaimIds).toEqual(["p6"]);
  });
});

