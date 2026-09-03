# Viewpoint Compiler

Viewpoint Compiler 是一个面向 Codex 与其他 coding agent 的本地插件：它把一段自然语言观点编译为可检查、可修改、可播放的推理图和离线 HTML 动画。

它不是一个需要独立账号或云端后端的网站。宿主 Agent 负责理解语义，插件内的 Skill 规定解析流程，本地 MCP Server 负责校验、编译、保存和渲染。插件不会调用 OpenAI API，也不需要配置 `OPENAI_API_KEY`。

> 当前版本：V0 / `0.1.0`。支持中英文、短观点与章节化长文，输出 HTML；暂不支持 MP4、配音、云同步和多人协作。

## 它如何工作

```text
用户自然语言
    ↓
宿主 Agent + viewpoint-compiler Skill（语义理解）
    ↓
Viewpoint IR
    ↓
本地 viewpoint_compiler MCP Server（确定性编译）
    ↓
Presentation Graph / Visual IR / Timeline
    ↓
内嵌编辑器，或可离线打开的 index.html
```

插件包含：

- `plugins/viewpoint-compiler/skills/viewpoint-compiler/`：Agent Skill 与 Ontology/IR 指南；
- `plugins/viewpoint-compiler/.mcp.json`：Codex 使用的本地 MCP 配置；
- `plugins/viewpoint-compiler/src/`：Schema、编译器、项目存储和 MCP Server；
- `plugins/viewpoint-compiler/ui/`：React/SVG 编辑器与播放器；
- `.agents/plugins/marketplace.json`：仓库级 Codex marketplace；
- `plugins/viewpoint-compiler/tests/`：Schema、编译器、MCP、UI 和快照测试。

## 环境要求

- Node.js 20 或更高版本；
- npm 10 或兼容版本；
- Codex，或支持 stdio MCP 的 coding agent；
- 若要在 Agent 内显示编辑器，宿主还需要支持 MCP Apps/UI；不支持时仍可导出并打开独立 HTML。

## 下载与构建

把下面的仓库地址替换为你上传后的 GitHub 地址：

```bash
git clone https://github.com/stephenzsl2007-del/viewpoint-compiler.git
cd viewpoint-compiler
npm install
npm run build
npm test
```

构建后必须存在：

```text
plugins/viewpoint-compiler/dist/server.js
plugins/viewpoint-compiler/dist/ui/index.html
```

`dist/` 没有提交到 Git，安装者在首次使用前需要执行一次 `npm install && npm run build`。

## 在 Codex 中安装

本仓库已经包含可安装的 repo marketplace。进入仓库根目录后执行：

```bash
codex plugin marketplace add .agents/plugins
codex plugin add viewpoint-compiler@viewpoint-compiler-local
```

然后重启 Codex 或新建一个任务，使插件和 MCP Server 重新加载。之后可以显式调用：

```text
$viewpoint-compiler 把下面这段观点编译成可编辑动画：……
```

也可以直接使用自然语言：

```text
把这段观点编译成动画，并打开编辑器让我检查推理关系。
```

如果你的 Codex 版本还没有 `codex plugin` 命令，请升级到支持 Plugins 的版本，或在 Codex 的 Plugins 页面中添加本仓库的 `.agents/plugins` marketplace。Codex 插件的标准结构和本地/repo marketplace 说明见 [OpenAI 官方插件打包文档](https://developers.openai.com/plugins/build/plugins)。

### 更新插件

```bash
git pull
npm install
npm run build
codex plugin add viewpoint-compiler@viewpoint-compiler-local
```

更新后重启 Codex 或新建任务。开发期间如果宿主缓存了插件，可先移除再重新安装。

## 在其他 coding agent 中配置

“插件”清单是 Codex 的分发形式；跨 Agent 的通用部分是 **Skill + MCP Server**。不同 Agent 的配置文件位置不同，但接入逻辑相同。

### 1. 构建 MCP Server

```bash
npm install
npm run build
```

### 2. 注册 stdio MCP Server

在目标 Agent 的 MCP 配置里加入下面内容，并把路径改成仓库的绝对路径：

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

Windows 示例：

```json
{
  "mcpServers": {
    "viewpoint_compiler": {
      "command": "node",
      "args": [
        "C:\\Users\\you\\Projects\\viewpoint-compiler\\plugins\\viewpoint-compiler\\dist\\server.js"
      ]
    }
  }
}
```

重启目标 Agent 后，确认它能看到以下六个工具：

| 工具 | 用途 |
| --- | --- |
| `create_viewpoint_project` | 校验 IR 并创建本地项目 |
| `get_viewpoint_project` | 读取项目、编译结果和 revision |
| `update_viewpoint_project` | 用带 revision 的结构化 patch 更新项目 |
| `compile_viewpoint` | 重新优化、布局并生成 Visual IR/Timeline |
| `open_viewpoint_editor` | 打开绑定项目状态的编辑器 |
| `export_viewpoint_html` | 导出自包含、可离线播放的 HTML |

### 3. 安装或加载 Skill

如果目标 Agent 支持 [Agent Skills](https://agentskills.io/)，把整个目录复制或链接到它的 skills 目录：

```text
plugins/viewpoint-compiler/skills/viewpoint-compiler/
```

必须保留其中的 `SKILL.md` 和 `references/`。如果目标 Agent 不支持 Skill 标准，可把 `SKILL.md` 作为项目级 Agent 指令加载，但仍需让 Agent 能读取 `references/ontology.md` 和 `references/ir-format.md`。

只注册 MCP 而不加载 Skill，工具依然可调用，但 Agent 不一定会稳定地产生合格的四层 Viewpoint IR。Skill 和 MCP 应一起配置。

### 4. UI 降级行为

- 支持 MCP Apps/UI 的宿主：`open_viewpoint_editor` 可返回内嵌编辑器；
- 不支持内嵌 UI 的宿主：调用 `export_viewpoint_html`，然后打开项目目录里的 `index.html`；
- 无论哪种方式，数据都保存在当前工作区，不依赖远程服务。

## 使用流程

1. 把原始观点交给 Agent；
2. Agent 按 Skill 构造 Viewpoint IR；
3. `create_viewpoint_project` 创建并首次编译项目；
4. `open_viewpoint_editor` 打开推理图；
5. 修改文字、关系、重点、场景、主题或画布比例；
6. 每次更新通过 revision 校验后重新编译；
7. `export_viewpoint_html` 生成最终离线文件。

示例提示词：

```text
把下面的观点编译成推理动画。保留其中的否定、概率判断和因果关系，
使用 16:9 Academic 主题，完成后打开编辑器：

AI 不会简单地替代所有程序员。更可能发生的是，能把需求拆解并验证结果的程序员
获得更高杠杆，而只执行重复编码任务的岗位会减少。因此，学习重点应从记忆 API
转向建模、判断和系统设计。
```

项目文件默认写入调用时指定工作区下的：

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

写入被限制在 `.viewpoint-compiler/` 内，并包含路径穿越防护。该目录默认被 `.gitignore` 忽略。

## 本地开发

```bash
npm install
npm run typecheck
npm run build
npm test
```

主要开发入口：

```text
plugins/viewpoint-compiler/src/server.ts       MCP 工具入口
plugins/viewpoint-compiler/src/compiler/       优化、布局、Visual IR、Timeline
plugins/viewpoint-compiler/src/schemas/        Viewpoint IR Schema
plugins/viewpoint-compiler/ui/                 编辑器与播放器
plugins/viewpoint-compiler/tests/              自动化测试
```

## 上传到 GitHub 前

1. 确认仓库地址仍为 `https://github.com/stephenzsl2007-del/viewpoint-compiler`；
2. 决定并添加开源许可证；
3. 检查 `git status`，不要提交 `.viewpoint-compiler/`、`node_modules/` 或本地日志；
4. 执行 `npm run typecheck && npm test`；
5. 创建 GitHub 仓库并推送：

```bash
git add .
git commit -m "Release Viewpoint Compiler V0"
git branch -M main
git remote add origin https://github.com/stephenzsl2007-del/viewpoint-compiler.git
git push -u origin main
```

如果当前仓库已经存在 `origin`，不要重复执行 `git remote add origin`，应使用 `git remote -v` 检查后再更新地址。

## V0 边界

- 支持 `9:16`、`1:1`、`16:9`；
- 支持 Minimal、Academic、Social、Playful、Technical；
- 支持 SUPPORT、OPPOSE、CAUSE、CONDITION、COMPARE、DECOMPOSE、TEMPORAL、INFER；
- 支持短观点与章节化长文；
- 只导出 HTML，不包含 MP4、GIF、配音、音乐、自动发布、账号或云同步。

## License

尚未选择。公开发布前请添加与你的开源策略一致的许可证文件。
