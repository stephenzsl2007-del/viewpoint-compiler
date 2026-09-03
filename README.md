# Viewpoint Compiler

[简体中文](README.md) | [English](README.en.md)

把自然语言观点编译成可检查、可修改、可播放的推理图和离线 HTML 动画。

Viewpoint Compiler 是一个面向 Codex 与其他 coding agent 的本地插件。宿主 Agent 负责语义理解，Skill 规定解析流程，本地 MCP Server 负责 Schema 校验、结构优化、布局、保存和确定性动画渲染。它不调用 OpenAI API，也不要求用户配置 API Key。

## 一条命令安装

需要 Node.js 20+ 和支持 Plugins 的 Codex：

```bash
npx --yes github:stephenzsl2007-del/viewpoint-compiler install
```

安装完成后重启 Codex 或新建一个任务，然后输入：

```text
$viewpoint-compiler 把下面这段观点编译成可编辑动画：……
```

也可以直接说：

```text
把这段观点编译成推理动画，保留否定、概率、因果和推断关系，完成后打开编辑器。
```

安装器会自动：

1. 把插件安装到 `~/plugins/viewpoint-compiler`；
2. 安装依赖并构建本地 MCP Server 与编辑器；
3. 安全合并 `~/.agents/plugins/marketplace.json`，不覆盖其他插件；
4. 在检测到 Codex CLI 时自动注册插件；
5. 否则输出一个可在 Codex 中打开的安装链接。

### 更新、诊断与卸载

```bash
npx --yes github:stephenzsl2007-del/viewpoint-compiler update
npx --yes github:stephenzsl2007-del/viewpoint-compiler doctor
npx --yes github:stephenzsl2007-del/viewpoint-compiler uninstall
```

## 从 GitHub Release 安装

不想在本机编译时，可以打开 [Releases](https://github.com/stephenzsl2007-del/viewpoint-compiler/releases/latest) 下载预构建安装包。

- Windows：解压 ZIP，双击 `install.cmd`；
- macOS/Linux：解压 `tar.gz`，在目录中运行 `./install.sh`。

Release 包含编译好的 MCP Server、单文件编辑器和运行时依赖，安装过程不再执行构建。

## 使用示例

```text
$viewpoint-compiler

把下面的观点编译成推理动画，使用 16:9 Academic 主题，完成后打开编辑器：

AI 不会简单地替代所有程序员。更可能发生的是，能把需求拆解并验证结果的程序员
获得更高杠杆，而只执行重复编码任务的岗位会减少。因此，学习重点应从记忆 API
转向建模、判断和系统设计。
```

你可以继续要求 Codex：

```text
把第二条关系从 CAUSE 改成 INFER，并把结论改成“程序员的核心竞争力将转向问题建模”。
```

```text
切换为 9:16 Social 主题，隐藏次要论据并重新编译。
```

```text
导出当前项目为可离线播放的 HTML。
```

## 输出文件

每个项目写入用户指定工作区中的：

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

写入被限制在 `.viewpoint-compiler/` 内，并包含路径穿越防护。`index.html` 是无服务器依赖的自包含文件，可以直接离线播放。

## 架构

```text
用户自然语言
    ↓
宿主 Agent + Viewpoint Compiler Skill
    ↓
Viewpoint IR
    ↓
本地 viewpoint_compiler MCP Server
    ↓
Presentation Graph / Visual IR / Timeline
    ↓
Codex 编辑器或离线 index.html
```

插件包含：

- `plugins/viewpoint-compiler/skills/viewpoint-compiler/`：Skill、Ontology 与 IR 指南；
- `plugins/viewpoint-compiler/src/`：Schema、编译器、存储和 MCP Server；
- `plugins/viewpoint-compiler/ui/`：React/SVG 编辑器与播放器；
- `.agents/plugins/marketplace.json`：仓库级开发 marketplace；
- `bin/viewpoint-compiler.mjs`：公开分发使用的一键安装器。

## MCP 工具

| 工具 | 用途 |
| --- | --- |
| `create_viewpoint_project` | 校验 IR 并创建本地项目 |
| `get_viewpoint_project` | 读取项目、编译结果和 revision |
| `update_viewpoint_project` | 使用带 revision 的结构化 patch 更新项目 |
| `compile_viewpoint` | 优化、布局并生成 Visual IR 与 Timeline |
| `open_viewpoint_editor` | 打开绑定项目状态的编辑器 |
| `export_viewpoint_html` | 导出自包含、可离线播放的 HTML |

## 其他 coding agent

Codex 插件清单和 marketplace 是 Codex 的分发层；跨 Agent 的通用部分是 Skill + stdio MCP。

构建仓库后，在目标 Agent 中注册：

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

同时加载整个 Skill 目录：

```text
plugins/viewpoint-compiler/skills/viewpoint-compiler/
```

只注册 MCP 而不加载 Skill，工具仍可调用，但 Agent 不一定能稳定地产生完整 Viewpoint IR。不支持 MCP Apps UI 的宿主仍可使用 `export_viewpoint_html`。

## 本地开发

```bash
git clone https://github.com/stephenzsl2007-del/viewpoint-compiler.git
cd viewpoint-compiler
npm install
npm run typecheck
npm test
```

安装当前 checkout 进行测试：

```bash
node bin/viewpoint-compiler.mjs install --source .
```

创建版本标签后，GitHub Actions 会自动测试并发布 ZIP 与 `tar.gz`：

```bash
git tag v0.1.0
git push origin v0.1.0
```

## V0 边界

- 支持中英文、短观点与章节化长文；
- 支持 `9:16`、`1:1`、`16:9`；
- 支持 Minimal、Academic、Social、Playful、Technical；
- 支持 SUPPORT、OPPOSE、CAUSE、CONDITION、COMPARE、DECOMPOSE、TEMPORAL、INFER；
- 只导出 HTML，不包含 MP4、GIF、配音、音乐、自动发布、账号或云同步。

## License

[MIT](LICENSE)
