import type { ViewpointProject } from "../../src/core/types";

declare global {
  interface Window {
    openai?: {
      toolOutput?: { project?: ViewpointProject };
      toolInput?: Record<string, unknown>;
      callTool?: (name: string, args: Record<string, unknown>) => Promise<any>;
      requestDisplayMode?: (options: { mode: string }) => Promise<unknown>;
    };
  }
}

type Listener = (project: ViewpointProject) => void;
const listeners = new Set<Listener>();
let rpcId = 1;
const pending = new Map<number, { resolve: (value: any) => void; reject: (error: Error) => void }>();

function emit(value: unknown) {
  const project = (value as any)?.project ?? (value as any)?.structuredContent?.project ?? (value as any)?.toolOutput?.project;
  if (project) listeners.forEach((listener) => listener(project));
}

window.addEventListener("message", (event) => {
  const data = event.data;
  if (!data || data.jsonrpc !== "2.0") return;
  if (typeof data.id === "number" && pending.has(data.id)) {
    const item = pending.get(data.id)!;
    pending.delete(data.id);
    data.error ? item.reject(new Error(data.error.message || "MCP Apps bridge error")) : item.resolve(data.result);
  }
  if (data.method === "ui/notifications/tool-result" || data.method === "openai:set_globals") emit(data.params);
});

function request(method: string, params: unknown): Promise<any> {
  const id = rpcId++;
  window.parent.postMessage({ jsonrpc: "2.0", id, method, params }, "*");
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    window.setTimeout(() => {
      if (pending.delete(id)) reject(new Error(`Host did not answer ${method}`));
    }, 15000);
  });
}

export function initialProject(): ViewpointProject | undefined {
  return window.openai?.toolOutput?.project;
}

export function onProject(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export async function callTool(name: string, args: Record<string, unknown>): Promise<any> {
  if (window.openai?.callTool) return window.openai.callTool(name, args);
  return request("tools/call", { name, arguments: args });
}

export async function requestFullscreen(): Promise<void> {
  if (window.openai?.requestDisplayMode) await window.openai.requestDisplayMode({ mode: "fullscreen" });
}

void request("ui/initialize", {
  protocolVersion: "2025-06-18",
  clientInfo: { name: "viewpoint-compiler-editor", version: "0.1.0" },
  capabilities: {}
}).catch(() => undefined);

