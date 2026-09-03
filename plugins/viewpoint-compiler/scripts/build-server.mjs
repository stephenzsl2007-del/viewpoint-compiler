import { build } from "esbuild";
import path from "node:path";
import { fileURLToPath } from "node:url";

const pluginRoot = path.resolve(fileURLToPath(new URL("..", import.meta.url)));

await build({
  absWorkingDir: pluginRoot,
  entryPoints: [path.join(pluginRoot, "src", "server.ts")],
  outfile: path.join(pluginRoot, "dist", "server.js"),
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node20",
  logLevel: "info",
});
