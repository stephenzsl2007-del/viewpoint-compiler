import { rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const pluginRoot = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const distPath = path.join(pluginRoot, "dist");

if (path.dirname(distPath) !== pluginRoot || path.basename(distPath) !== "dist") {
  throw new Error(`Refusing to clean unexpected path: ${distPath}`);
}
await rm(distPath, { recursive: true, force: true });
