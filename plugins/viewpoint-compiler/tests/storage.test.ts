import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { createProject, exportProjectHtml, getProject, RevisionConflictError, updateProject } from "../src/core/storage";
import { sampleIr } from "./fixtures";

describe("project storage", () => {
  it("persists, updates, reopens and exports an offline project", async () => {
    const workspace = await mkdtemp(path.join(tmpdir(), "viewpoint-compiler-"));
    const created = await createProject(workspace, sampleIr, { theme: "Technical" });
    expect((await getProject(created.projectPath)).revision).toBe(1);
    const changed = structuredClone(sampleIr);
    changed.propositions.find((p) => p.id === "p6")!.label = "工程师角色将被重新定义";
    const updated = await updateProject(created.projectPath, 1, { ir: changed });
    expect(updated.revision).toBe(2);
    expect(updated.ir.propositions.find((p) => p.id === "p6")?.label).toContain("重新定义");
    await expect(updateProject(created.projectPath, 1, { ir: changed })).rejects.toBeInstanceOf(RevisionConflictError);
    const { htmlPath } = await exportProjectHtml(created.projectPath);
    const html = await readFile(htmlPath, "utf8");
    expect(html).toContain("Viewpoint Compiler");
    expect(html).not.toMatch(/<script[^>]+src=/);
    expect(html).not.toMatch(/<link[^>]+href=/);
  });

  it("rejects project reads outside the project root", async () => {
    await expect(getProject(path.resolve(tmpdir(), "not-a-project"))).rejects.toThrow(/\.viewpoint-compiler/);
  });
});

