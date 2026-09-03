import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import { compileViewpoint } from "../src/core/compiler";
import { relationFamilies } from "../src/core/types";
import { sampleIr } from "./fixtures";

describe("compiler", () => {
  it("creates a cognitive scene and primitive for every relation family", () => {
    const result = compileViewpoint(sampleIr, { maxNodesPerScene: 4 });
    for (const family of relationFamilies) {
      expect(result.presentationGraph.scenes.some((scene) => scene.relationFamily === family)).toBe(true);
      expect(result.presentationGraph.edges.find((edge) => edge.family === family)?.visualPrimitive).toBeTruthy();
    }
    expect(result.presentationGraph.edges.find((edge) => edge.family === "CAUSE")?.visualPrimitive).not.toBe(result.presentationGraph.edges.find((edge) => edge.family === "INFER")?.visualPrimitive);
  });

  it("keeps the main conclusion and records collapsed information", () => {
    const result = compileViewpoint(sampleIr, { maxNodesPerScene: 2 });
    expect(result.presentationGraph.nodes.some((node) => node.id === "p6" && node.emphasis === "strong")).toBe(true);
    expect(result.presentationGraph.collapsedPropositionIds).toContain("p10");
    expect(result.presentationGraph.scenes.every((scene) => scene.nodeIds.length <= 2)).toBe(true);
  });

  it("compiles cycles deterministically instead of recursing", () => {
    const cyclic = structuredClone(sampleIr);
    cyclic.relations.push({ id: "cycle", source: "p2", target: "p1", family: "CAUSE", subtype: "cause", confidence: 0.5, sectionId: "s1" });
    const first = compileViewpoint(cyclic);
    const second = compileViewpoint(cyclic);
    expect(first.visualIR).toEqual(second.visualIR);
  });

  it("accepts the AI/engineer end-to-end acceptance example", async () => {
    const example = JSON.parse(await readFile(new URL("../examples/ai-engineer.json", import.meta.url), "utf8"));
    const result = compileViewpoint(example);
    expect(result.visualIR.scenes.length).toBeGreaterThanOrEqual(3);
    expect(result.presentationGraph.nodes.find((node) => node.id === "p_role_changes")?.emphasis).toBe("strong");
    expect(result.timeline.durationMs).toBeGreaterThan(0);
  });
});
