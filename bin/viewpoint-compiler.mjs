#!/usr/bin/env node

import { spawn } from "node:child_process";
import {
  access,
  cp,
  mkdir,
  mkdtemp,
  readFile,
  rename,
  rm,
  writeFile,
} from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const PLUGIN_NAME = "viewpoint-compiler";
const REPOSITORY = "stephenzsl2007-del/viewpoint-compiler";
const MARKETPLACE_ENTRY = {
  name: PLUGIN_NAME,
  source: { source: "local", path: `./plugins/${PLUGIN_NAME}` },
  policy: { installation: "AVAILABLE", authentication: "ON_INSTALL" },
  category: "Productivity",
};

function parseArgs(argv) {
  const options = { command: argv[0] ?? "help", home: undefined, source: undefined, skipCodex: false, prebuilt: false };
  for (let index = 1; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === "--home") options.home = argv[++index];
    else if (value === "--source") options.source = argv[++index];
    else if (value === "--skip-codex") options.skipCodex = true;
    else if (value === "--prebuilt") options.prebuilt = true;
    else throw new Error(`Unknown option: ${value}`);
  }
  return options;
}

function pathsFor(homePath) {
  const resolvedHome = path.resolve(homePath);
  return {
    home: resolvedHome,
    plugin: path.join(resolvedHome, "plugins", PLUGIN_NAME),
    marketplace: path.join(resolvedHome, ".agents", "plugins", "marketplace.json"),
  };
}

async function exists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

async function writeJsonAtomic(filePath, value) {
  await mkdir(path.dirname(filePath), { recursive: true });
  const tempPath = `${filePath}.${process.pid}.tmp`;
  await writeFile(tempPath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  await rename(tempPath, filePath);
}

export async function upsertMarketplace(filePath) {
  const marketplace = (await exists(filePath))
    ? await readJson(filePath)
    : { name: "personal", interface: { displayName: "Personal" }, plugins: [] };

  if (!/^[A-Za-z0-9_-]+$/.test(marketplace.name ?? "")) {
    throw new Error(`Invalid marketplace name in ${filePath}`);
  }
  if (!Array.isArray(marketplace.plugins)) {
    throw new Error(`Invalid plugins array in ${filePath}`);
  }

  const index = marketplace.plugins.findIndex((plugin) => plugin?.name === PLUGIN_NAME);
  if (index >= 0) marketplace.plugins[index] = MARKETPLACE_ENTRY;
  else marketplace.plugins.push(MARKETPLACE_ENTRY);
  await writeJsonAtomic(filePath, marketplace);
  return marketplace.name;
}

export async function removeMarketplaceEntry(filePath) {
  if (!(await exists(filePath))) return false;
  const marketplace = await readJson(filePath);
  if (!Array.isArray(marketplace.plugins)) throw new Error(`Invalid plugins array in ${filePath}`);
  const before = marketplace.plugins.length;
  marketplace.plugins = marketplace.plugins.filter((plugin) => plugin?.name !== PLUGIN_NAME);
  if (marketplace.plugins.length !== before) await writeJsonAtomic(filePath, marketplace);
  return marketplace.plugins.length !== before;
}

function npmInvocation() {
  const npmExecPath = process.env.npm_execpath;
  if (npmExecPath) return { command: process.execPath, prefix: [npmExecPath] };

  const bundledNpm = path.join(path.dirname(process.execPath), "node_modules", "npm", "bin", "npm-cli.js");
  return { command: process.execPath, prefix: [bundledNpm], fallback: process.platform === "win32" ? "npm.cmd" : "npm" };
}

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: options.quiet ? "ignore" : "inherit", cwd: options.cwd, shell: false });
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} exited with code ${code}`));
    });
  });
}

async function runNpm(args, cwd) {
  const invocation = npmInvocation();
  try {
    await run(invocation.command, [...invocation.prefix, ...args], { cwd });
  } catch (error) {
    if (!invocation.fallback || error?.code !== "ENOENT") throw error;
    await run(invocation.fallback, args, { cwd });
  }
}

async function installPlugin(sourceRoot, destination, prebuilt) {
  const sourcePlugin = path.join(sourceRoot, "plugins", PLUGIN_NAME);
  const manifestPath = path.join(sourcePlugin, ".codex-plugin", "plugin.json");
  if (!(await exists(manifestPath))) throw new Error(`Plugin source not found: ${sourcePlugin}`);

  await mkdir(path.dirname(destination), { recursive: true });
  const stageRoot = await mkdtemp(path.join(tmpdir(), "viewpoint-compiler-"));
  const stagedPlugin = path.join(stageRoot, PLUGIN_NAME);
  const backup = `${destination}.backup-${process.pid}`;
  let backedUp = false;

  try {
    await cp(sourcePlugin, stagedPlugin, {
      recursive: true,
      filter: (entry) => !["coverage"].includes(path.basename(entry))
        && (prebuilt || !["node_modules", "dist"].includes(path.basename(entry))),
    });
    if (prebuilt) {
      if (!(await exists(path.join(stagedPlugin, "dist", "server.js")))) {
        throw new Error("The release archive does not contain a compiled MCP server");
      }
    } else {
      const reusableModules = path.join(sourceRoot, "node_modules");
      if (await exists(path.join(reusableModules, "esbuild", "package.json"))) {
        console.log("Reusing installer dependencies and building the local MCP server…");
        await cp(reusableModules, path.join(stagedPlugin, "node_modules"), {
          recursive: true,
          filter: (entry) => path.resolve(entry) !== path.resolve(path.join(reusableModules, PLUGIN_NAME)),
        });
      } else {
        console.log("Installing dependencies and building the local MCP server…");
        await runNpm(["install", "--include=dev", "--cache", path.join(stageRoot, ".npm-cache")], stagedPlugin);
      }
      await runNpm(["run", "build"], stagedPlugin);
      await rm(path.join(stagedPlugin, "node_modules"), { recursive: true, force: true });
    }

    if (await exists(destination)) {
      const installedManifest = path.join(destination, ".codex-plugin", "plugin.json");
      const installed = await readJson(installedManifest).catch(() => null);
      if (installed?.name !== PLUGIN_NAME) throw new Error(`Refusing to replace unexpected directory: ${destination}`);
      await rename(destination, backup);
      backedUp = true;
    }
    await rename(stagedPlugin, destination);
    if (backedUp) await rm(backup, { recursive: true, force: true });
  } catch (error) {
    if (backedUp && !(await exists(destination)) && (await exists(backup))) await rename(backup, destination);
    throw error;
  } finally {
    await rm(stageRoot, { recursive: true, force: true });
  }
}

async function tryCodexInstall(marketplaceName, skipCodex) {
  if (skipCodex) return false;
  try {
    await run("codex", ["plugin", "add", `${PLUGIN_NAME}@${marketplaceName}`]);
    return true;
  } catch {
    return false;
  }
}

function deeplink(marketplacePath) {
  const query = encodeURIComponent(path.resolve(marketplacePath));
  return `codex://plugins/${PLUGIN_NAME}?marketplacePath=${query}`;
}

async function installOrUpdate(options) {
  const homePath = options.home ?? homedir();
  const paths = pathsFor(homePath);
  const sourceRoot = path.resolve(options.source ?? fileURLToPath(new URL("..", import.meta.url)));
  await installPlugin(sourceRoot, paths.plugin, options.prebuilt);
  const marketplaceName = await upsertMarketplace(paths.marketplace);
  const installedByCli = await tryCodexInstall(marketplaceName, options.skipCodex);

  console.log(`\n✓ Viewpoint Compiler installed at ${paths.plugin}`);
  if (installedByCli) console.log("✓ Codex plugin registration completed");
  else {
    console.log("Codex CLI was not available. Open this link in Codex and select Install:");
    console.log(deeplink(paths.marketplace));
  }
  console.log("Start a new Codex task, then invoke: $viewpoint-compiler");
}

async function uninstall(options) {
  const paths = pathsFor(options.home ?? homedir());
  const manifestPath = path.join(paths.plugin, ".codex-plugin", "plugin.json");
  if (await exists(paths.plugin)) {
    const manifest = await readJson(manifestPath).catch(() => null);
    if (manifest?.name !== PLUGIN_NAME) throw new Error(`Refusing to remove unexpected directory: ${paths.plugin}`);
    await rm(paths.plugin, { recursive: true, force: true });
  }
  await removeMarketplaceEntry(paths.marketplace);
  console.log(`✓ Viewpoint Compiler removed from ${paths.plugin}`);
  console.log("Restart Codex or start a new task to clear the previous plugin session.");
}

async function doctor(options) {
  const paths = pathsFor(options.home ?? homedir());
  const checks = [
    ["Node.js >= 20", Number(process.versions.node.split(".")[0]) >= 20, process.version],
    ["Plugin manifest", await exists(path.join(paths.plugin, ".codex-plugin", "plugin.json")), paths.plugin],
    ["Bundled MCP server", await exists(path.join(paths.plugin, "dist", "server.js")), path.join(paths.plugin, "dist", "server.js")],
    ["Personal marketplace", await exists(paths.marketplace), paths.marketplace],
  ];
  if (checks[3][1]) {
    const marketplace = await readJson(paths.marketplace).catch(() => null);
    checks.push(["Marketplace entry", Boolean(marketplace?.plugins?.some((plugin) => plugin?.name === PLUGIN_NAME)), PLUGIN_NAME]);
  }
  for (const [label, ok, detail] of checks) console.log(`${ok ? "✓" : "✗"} ${label}: ${detail}`);
  if (checks.some(([, ok]) => !ok)) process.exitCode = 1;
}

function help() {
  console.log(`Viewpoint Compiler installer

Usage:
  viewpoint-compiler install
  viewpoint-compiler update
  viewpoint-compiler doctor
  viewpoint-compiler uninstall

Options:
  --home <path>      Override the user home directory (mainly for testing)
  --source <path>    Override the repository source directory
  --skip-codex       Do not invoke the Codex CLI
  --prebuilt         Install a prebuilt GitHub Release archive

Repository: https://github.com/${REPOSITORY}`);
}

export async function main(argv = process.argv.slice(2)) {
  const options = parseArgs(argv);
  if (["install", "update"].includes(options.command)) await installOrUpdate(options);
  else if (options.command === "uninstall") await uninstall(options);
  else if (options.command === "doctor") await doctor(options);
  else if (["help", "--help", "-h"].includes(options.command)) help();
  else throw new Error(`Unknown command: ${options.command}`);
}

const invokedDirectly = process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;
if (invokedDirectly) {
  main().catch((error) => {
    console.error(`\nViewpoint Compiler installer failed: ${error.message}`);
    process.exitCode = 1;
  });
}
