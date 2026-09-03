import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { compileViewpoint } from "./core/compiler.js";
import { createProject, exportProjectHtml, getProject, recompileProject, RevisionConflictError, updateProject } from "./core/storage.js";
import { aspectRatios, themes } from "./core/types.js";

const EDITOR_URI = "ui://viewpoint-compiler/editor.html";
const here = path.dirname(fileURLToPath(import.meta.url));

const server = new McpServer(
  { name: "viewpoint-compiler", version: "0.1.0" },
  { instructions: "Use create_viewpoint_project only after constructing valid Viewpoint IR 0.1. Use open_viewpoint_editor for visual review. Never invent animation code; compilation is deterministic." }
);

const toolMeta = { ui: { resourceUri: EDITOR_URI }, "openai/outputTemplate": EDITOR_URI, "openai/widgetAccessible": true };
const settingsShape = {
  theme: z.enum(themes).optional(),
  aspectRatio: z.enum(aspectRatios).optional(),
  maxNodesPerScene: z.number().int().min(2).max(12).optional(),
  autoplay: z.boolean().optional()
};

function ok(text: string, structuredContent: Record<string, unknown>, meta?: Record<string, unknown>) {
  return { content: [{ type: "text" as const, text }], structuredContent, ...(meta ? { _meta: meta } : {}) };
}

function errorResult(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return { isError: true, content: [{ type: "text" as const, text: message }] };
}

server.registerResource("viewpoint-editor", EDITOR_URI, { title: "Viewpoint Compiler Editor", description: "Editable reasoning graph and animation player", mimeType: "text/html;profile=mcp-app" }, async () => {
  const html = await readFile(path.join(here, "ui", "index.html"), "utf8");
  return { contents: [{ uri: EDITOR_URI, mimeType: "text/html;profile=mcp-app", text: html }] };
});

server.registerTool("create_viewpoint_project", {
  title: "Create viewpoint project",
  description: "Validate agent-produced Viewpoint IR, compile it, and save a new project in the user's workspace.",
  inputSchema: { workspacePath: z.string(), ir: z.unknown(), settings: z.object(settingsShape).optional() },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false }
}, async ({ workspacePath, ir, settings }) => {
  try { const project = await createProject(workspacePath, ir, settings ?? {}); return ok(`Created ${project.ir.title} at ${project.projectPath}`, { projectPath: project.projectPath, projectId: project.projectId, revision: project.revision, project }); }
  catch (error) { return errorResult(error); }
});

server.registerTool("get_viewpoint_project", {
  title: "Get viewpoint project",
  description: "Read a saved Viewpoint Compiler project and all compiled artifacts.",
  inputSchema: { projectPath: z.string() },
  annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false }
}, async ({ projectPath }) => {
  try { const project = await getProject(projectPath); return ok(`Loaded ${project.ir.title} (revision ${project.revision}).`, { project }); }
  catch (error) { return errorResult(error); }
});

server.registerTool("update_viewpoint_project", {
  title: "Update viewpoint project",
  description: "Replace validated IR and/or settings using optimistic revision control, then immediately recompile and save.",
  inputSchema: { projectPath: z.string(), expectedRevision: z.number().int().positive(), patch: z.object({ ir: z.unknown().optional(), settings: z.object(settingsShape).optional() }) },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false }
}, async ({ projectPath, expectedRevision, patch }) => {
  try { const project = await updateProject(projectPath, expectedRevision, patch); return ok(`Saved revision ${project.revision}.`, { project }); }
  catch (error) {
    if (error instanceof RevisionConflictError) return { isError: true, content: [{ type: "text" as const, text: error.message }], structuredContent: { conflict: true, expectedRevision: error.expected, actualRevision: error.actual } };
    return errorResult(error);
  }
});

server.registerTool("compile_viewpoint", {
  title: "Compile viewpoint",
  description: "Compile an unsaved IR preview or recompile an existing project deterministically.",
  inputSchema: { ir: z.unknown().optional(), settings: z.object(settingsShape).optional(), projectPath: z.string().optional() },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false }
}, async ({ ir, settings, projectPath }) => {
  try {
    if (projectPath) { const project = await recompileProject(projectPath); return ok(`Recompiled ${project.ir.title}.`, { project }); }
    if (!ir) throw new Error("Provide ir or projectPath");
    const result = compileViewpoint(ir, settings ?? {}); return ok("Compiled Viewpoint IR preview.", result);
  } catch (error) { return errorResult(error); }
});

server.registerTool("open_viewpoint_editor", {
  title: "Open viewpoint editor",
  description: "Open the full-screen interactive editor and animation preview for a saved project.",
  inputSchema: { projectPath: z.string() },
  _meta: toolMeta,
  annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false }
}, async ({ projectPath }) => {
  try { const project = await getProject(projectPath); return ok(`Opening ${project.ir.title} in the Viewpoint Compiler editor.`, { project }, toolMeta); }
  catch (error) { return errorResult(error); }
});

server.registerTool("export_viewpoint_html", {
  title: "Export viewpoint HTML",
  description: "Regenerate the standalone offline HTML animation for a saved project.",
  inputSchema: { projectPath: z.string() },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false }
}, async ({ projectPath }) => {
  try { const result = await exportProjectHtml(projectPath); return ok(`Exported offline HTML to ${result.htmlPath}`, { htmlPath: result.htmlPath, projectId: result.project.projectId, revision: result.project.revision }); }
  catch (error) { return errorResult(error); }
});

await server.connect(new StdioServerTransport());

