# Viewpoint Compiler

[简体中文](README.md) | [English](README.en.md)

Compile natural-language viewpoints into reasoning graphs and offline HTML animations that can be inspected, edited, and played.

Viewpoint Compiler is a local plugin for Codex and other coding agents. The host agent performs semantic interpretation, the Skill defines the analysis workflow, and the local MCP server handles schema validation, structure optimization, layout, persistence, and deterministic animation rendering. It does not call the OpenAI API and does not require users to configure an API key.

## One-command installation

Requires Node.js 20+ and a version of Codex that supports Plugins:

```bash
npx --yes github:stephenzsl2007-del/viewpoint-compiler install
```

After installation, restart Codex or start a new task, then enter:

```text
$viewpoint-compiler Compile the following viewpoint into an editable animation: ...
```

You can also trigger it with natural language:

```text
Compile this viewpoint into a reasoning animation. Preserve its negation, probability,
causal, and inferential relationships, then open the editor.
```

The installer automatically:

1. Installs the plugin to `~/plugins/viewpoint-compiler`;
2. Installs dependencies and builds the local MCP server and editor;
3. Safely merges `~/.agents/plugins/marketplace.json` without overwriting other plugins;
4. Registers the plugin when the Codex CLI is available;
5. Otherwise prints an installation link that can be opened in Codex.

### Update, diagnose, and uninstall

```bash
npx --yes github:stephenzsl2007-del/viewpoint-compiler update
npx --yes github:stephenzsl2007-del/viewpoint-compiler doctor
npx --yes github:stephenzsl2007-del/viewpoint-compiler uninstall
```

## Install from a GitHub Release

To avoid building locally, open [Releases](https://github.com/stephenzsl2007-del/viewpoint-compiler/releases/latest) and download a prebuilt package.

- Windows: extract the ZIP and double-click `install.cmd`;
- macOS/Linux: extract the `tar.gz` archive and run `./install.sh` from that directory.

The release contains the bundled MCP server, single-file editor, and runtime code, so the installation process does not perform a build.

## Usage example

```text
$viewpoint-compiler

Compile the following viewpoint into a reasoning animation. Use the 16:9 Academic theme
and open the editor when finished:

AI will not simply replace every programmer. A more likely outcome is that programmers
who can decompose requirements and verify results will gain leverage, while roles focused
only on repetitive coding will decline. Learning should therefore shift from memorizing
APIs toward modeling, judgment, and system design.
```

You can continue by asking Codex to make structural or visual changes:

```text
Change the second relation from CAUSE to INFER, and revise the conclusion to
“A programmer's core advantage will shift toward problem modeling.”
```

```text
Switch to the 9:16 Social theme, hide secondary evidence, and recompile.
```

```text
Export the current project as an offline HTML file.
```

## Output files

Each project is written inside the workspace selected by the user:

```text
.viewpoint-compiler/<project-slug>/
├── source.txt
├── project.json
├── viewpoint-ir.json
├── presentation-graph.json
├── visual-ir.json
├── timeline.json
└── index.html
```

Writes are restricted to `.viewpoint-compiler/` and protected against path traversal. `index.html` is a self-contained artifact that plays offline without a server.

## Architecture

```text
Natural-language input
    ↓
Host agent + Viewpoint Compiler Skill
    ↓
Viewpoint IR
    ↓
Local viewpoint_compiler MCP server
    ↓
Presentation Graph / Visual IR / Timeline
    ↓
Codex editor or offline index.html
```

The plugin contains:

- `plugins/viewpoint-compiler/skills/viewpoint-compiler/`: the Skill, ontology, and IR guidance;
- `plugins/viewpoint-compiler/src/`: schemas, compiler, storage, and MCP server;
- `plugins/viewpoint-compiler/ui/`: the React/SVG editor and player;
- `.agents/plugins/marketplace.json`: the repository marketplace for development;
- `bin/viewpoint-compiler.mjs`: the one-command public installer.

## MCP tools

| Tool | Purpose |
| --- | --- |
| `create_viewpoint_project` | Validate IR and create a local project |
| `get_viewpoint_project` | Read a project, compiled artifacts, and its revision |
| `update_viewpoint_project` | Apply a revision-aware structured patch |
| `compile_viewpoint` | Optimize, lay out, and generate Visual IR and Timeline |
| `open_viewpoint_editor` | Open the editor bound to the saved project state |
| `export_viewpoint_html` | Export a self-contained offline HTML animation |

## Other coding agents

The Codex manifest and marketplace form the Codex-specific distribution layer. The portable integration shared by coding agents is the Skill plus the stdio MCP server.

After building the repository, register the MCP server in the target agent:

```json
{
  "mcpServers": {
    "viewpoint_compiler": {
      "command": "node",
      "args": [
        "/absolute/path/to/viewpoint-compiler/plugins/viewpoint-compiler/dist/server.js"
      ]
    }
  }
}
```

Also load the complete Skill directory:

```text
plugins/viewpoint-compiler/skills/viewpoint-compiler/
```

The tools remain callable if only the MCP server is registered, but without the Skill the agent may not consistently produce a complete Viewpoint IR. Hosts without MCP Apps UI support can still use `export_viewpoint_html`.

## Local development

```bash
git clone https://github.com/stephenzsl2007-del/viewpoint-compiler.git
cd viewpoint-compiler
npm install
npm run typecheck
npm test
```

Install the current checkout for local testing:

```bash
node bin/viewpoint-compiler.mjs install --source .
```

Pushing a version tag makes GitHub Actions test the repository and publish ZIP and `tar.gz` assets automatically:

```bash
git tag v0.1.0
git push origin v0.1.0
```

## V0 scope

- First-class Chinese and English input, including short viewpoints and sectioned long-form text;
- `9:16`, `1:1`, and `16:9` aspect ratios;
- Minimal, Academic, Social, Playful, and Technical themes;
- SUPPORT, OPPOSE, CAUSE, CONDITION, COMPARE, DECOMPOSE, TEMPORAL, and INFER relations;
- HTML export only; no MP4, GIF, voice-over, music, automatic publishing, accounts, or cloud sync.

## License

[MIT](LICENSE)
