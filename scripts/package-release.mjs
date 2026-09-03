import { chmod, cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const packageJson = JSON.parse(await readFile(path.join(root, "package.json"), "utf8"));
const requestedVersion = (process.argv[2] ?? `v${packageJson.version}`).replace(/^v/, "");
const releaseName = `viewpoint-compiler-v${requestedVersion}`;
const releaseRoot = path.join(root, "release");
const stage = path.join(releaseRoot, releaseName);
const sourcePlugin = path.join(root, "plugins", "viewpoint-compiler");
const releasePlugin = path.join(stage, "plugins", "viewpoint-compiler");

await rm(releaseRoot, { recursive: true, force: true });
await mkdir(path.dirname(releasePlugin), { recursive: true });
await cp(sourcePlugin, releasePlugin, {
  recursive: true,
  filter: (entry) => !["node_modules", "coverage"].includes(path.basename(entry)),
});
await mkdir(path.join(stage, "bin"), { recursive: true });
await cp(path.join(root, "bin", "viewpoint-compiler.mjs"), path.join(stage, "bin", "viewpoint-compiler.mjs"));
await cp(path.join(root, "README.md"), path.join(stage, "README.md"));
await cp(path.join(root, "LICENSE"), path.join(stage, "LICENSE"));

await writeFile(path.join(stage, "install.cmd"), [
  "@echo off",
  "node \"%~dp0bin\\viewpoint-compiler.mjs\" install --source \"%~dp0\" --prebuilt",
  "pause",
  "",
].join("\r\n"), "utf8");
await writeFile(path.join(stage, "install.sh"), [
  "#!/usr/bin/env sh",
  "set -eu",
  "SCRIPT_DIR=$(CDPATH= cd -- \"$(dirname -- \"$0\")\" && pwd)",
  "node \"$SCRIPT_DIR/bin/viewpoint-compiler.mjs\" install --source \"$SCRIPT_DIR\" --prebuilt",
  "",
].join("\n"), "utf8");
await chmod(path.join(stage, "install.sh"), 0o755);
console.log(stage);
