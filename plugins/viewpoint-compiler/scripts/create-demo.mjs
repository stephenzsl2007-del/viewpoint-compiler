import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createProject } from "../dist/core/storage.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const workspace = path.resolve(process.argv[2] ?? process.cwd());
const ir = JSON.parse(await readFile(path.join(here, "..", "examples", "ai-engineer.json"), "utf8"));
const project = await createProject(workspace, ir, { theme: "Minimal", aspectRatio: "16:9", autoplay: true });
process.stdout.write(`${project.projectPath}\n`);

