import { mkdir, readFile, rename, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { compileViewpoint } from "./compiler.js";
import { generateStandaloneHtml } from "./html.js";
import { parseSettings, parseViewpointIR } from "./schema.js";
import { defaultSettings, type CompilerSettings, type ViewpointIR, type ViewpointProject } from "./types.js";

export class RevisionConflictError extends Error {
  constructor(public readonly expected: number, public readonly actual: number) {
    super(`Revision conflict: expected ${expected}, current revision is ${actual}`);
  }
}

function slugify(value: string): string {
  const slug = value.normalize("NFKD").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 48);
  return slug || "viewpoint";
}

async function atomicWrite(filePath: string, value: string): Promise<void> {
  const tempPath = `${filePath}.${process.pid}.tmp`;
  await writeFile(tempPath, value, "utf8");
  await rename(tempPath, filePath);
}

function assertProjectPath(projectPath: string): string {
  const resolved = path.resolve(projectPath);
  if (!path.isAbsolute(projectPath) || !resolved.split(path.sep).includes(".viewpoint-compiler")) throw new Error("Project path must be an absolute directory inside .viewpoint-compiler");
  return resolved;
}

async function assertWorkspace(workspacePath: string): Promise<string> {
  if (!path.isAbsolute(workspacePath)) throw new Error("workspacePath must be absolute");
  const resolved = path.resolve(workspacePath);
  const info = await stat(resolved);
  if (!info.isDirectory()) throw new Error("workspacePath must be a directory");
  return resolved;
}

export async function saveProject(project: ViewpointProject): Promise<ViewpointProject> {
  const projectPath = assertProjectPath(project.projectPath);
  await mkdir(projectPath, { recursive: true });
  const files: Array<[string, string]> = [
    ["source.txt", project.ir.sourceText],
    ["viewpoint-ir.json", JSON.stringify(project.ir, null, 2)],
    ["presentation-graph.json", JSON.stringify(project.presentationGraph, null, 2)],
    ["visual-ir.json", JSON.stringify(project.visualIR, null, 2)],
    ["timeline.json", JSON.stringify(project.timeline, null, 2)],
    ["project.json", JSON.stringify(project, null, 2)],
    ["index.html", generateStandaloneHtml(project)]
  ];
  for (const [name, content] of files) await atomicWrite(path.join(projectPath, name), content);
  return project;
}

export async function createProject(workspacePath: string, rawIr: unknown, rawSettings: Partial<CompilerSettings> = {}): Promise<ViewpointProject> {
  const workspace = await assertWorkspace(workspacePath);
  const ir = parseViewpointIR(rawIr);
  const settings = parseSettings({ ...defaultSettings, ...rawSettings });
  const root = path.join(workspace, ".viewpoint-compiler");
  await mkdir(root, { recursive: true });
  const projectId = `${slugify(ir.title)}-${Date.now().toString(36)}`;
  const projectPath = path.join(root, projectId);
  const compiled = compileViewpoint(ir, settings);
  const now = new Date().toISOString();
  return saveProject({ version: "0.1", revision: 1, projectId, projectPath, createdAt: now, updatedAt: now, ir, settings: compiled.settings, presentationGraph: compiled.presentationGraph, visualIR: compiled.visualIR, timeline: compiled.timeline });
}

export async function getProject(projectPath: string): Promise<ViewpointProject> {
  const resolved = assertProjectPath(projectPath);
  return JSON.parse(await readFile(path.join(resolved, "project.json"), "utf8")) as ViewpointProject;
}

export async function updateProject(projectPath: string, expectedRevision: number, patch: { ir?: unknown; settings?: Partial<CompilerSettings> }): Promise<ViewpointProject> {
  const current = await getProject(projectPath);
  if (current.revision !== expectedRevision) throw new RevisionConflictError(expectedRevision, current.revision);
  const ir: ViewpointIR = patch.ir === undefined ? current.ir : parseViewpointIR(patch.ir);
  const settings = parseSettings({ ...current.settings, ...(patch.settings ?? {}) });
  const compiled = compileViewpoint(ir, settings);
  return saveProject({ ...current, revision: current.revision + 1, updatedAt: new Date().toISOString(), ir, settings: compiled.settings, presentationGraph: compiled.presentationGraph, visualIR: compiled.visualIR, timeline: compiled.timeline });
}

export async function recompileProject(projectPath: string): Promise<ViewpointProject> {
  const current = await getProject(projectPath);
  const compiled = compileViewpoint(current.ir, current.settings);
  return saveProject({ ...current, revision: current.revision + 1, updatedAt: new Date().toISOString(), settings: compiled.settings, presentationGraph: compiled.presentationGraph, visualIR: compiled.visualIR, timeline: compiled.timeline });
}

export async function exportProjectHtml(projectPath: string): Promise<{ project: ViewpointProject; htmlPath: string }> {
  const project = await getProject(projectPath);
  const htmlPath = path.join(assertProjectPath(projectPath), "index.html");
  await atomicWrite(htmlPath, generateStandaloneHtml(project));
  return { project, htmlPath };
}

