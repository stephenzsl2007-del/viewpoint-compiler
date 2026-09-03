import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { sampleIr } from "./fixtures";

const pluginRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
let client: Client;

describe("MCP server", () => {
  beforeAll(async () => {
    const config = JSON.parse(await readFile(path.join(pluginRoot, ".mcp.json"), "utf8"));
    const declared = config.mcpServers.viewpoint_compiler;
    client = new Client({ name: "viewpoint-compiler-tests", version: "0.1.0" }, { capabilities: {} });
    await client.connect(new StdioClientTransport({ command: declared.command, args: declared.args, cwd: pluginRoot, stderr: "pipe" }));
  });

  afterAll(async () => { await client.close(); });

  it("advertises the complete compiler tool surface", async () => {
    const tools = await client.listTools();
    expect(tools.tools.map((tool) => tool.name)).toEqual(expect.arrayContaining([
      "create_viewpoint_project", "get_viewpoint_project", "update_viewpoint_project",
      "compile_viewpoint", "open_viewpoint_editor", "export_viewpoint_html"
    ]));
  });

  it("creates a project and serves the embedded editor resource", async () => {
    const workspace = await mkdtemp(path.join(tmpdir(), "viewpoint-mcp-"));
    const result = await client.callTool({ name: "create_viewpoint_project", arguments: { workspacePath: workspace, ir: sampleIr } });
    expect(result.isError).not.toBe(true);
    expect((result.structuredContent as any).projectPath).toContain(".viewpoint-compiler");
    const resource = await client.readResource({ uri: "ui://viewpoint-compiler/editor.html" });
    expect(resource.contents[0].mimeType).toBe("text/html;profile=mcp-app");
    expect((resource.contents[0] as any).text).toContain("Viewpoint Compiler");
  });
});
