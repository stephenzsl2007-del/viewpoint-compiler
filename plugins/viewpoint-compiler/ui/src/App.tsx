import { useEffect, useMemo, useRef, useState } from "react";
import { ReactFlow, Background, Controls, MiniMap, MarkerType, type Connection, type Edge, type Node, type OnNodeDrag } from "@xyflow/react";
import { callTool, initialProject, onProject, requestFullscreen } from "./bridge";
import {
  aspectRatios,
  intents,
  modalities,
  relationFamilies,
  themes,
  type CompilerSettings,
  type Proposition,
  type ReasoningRelation,
  type RelationFamily,
  type ViewpointIR,
  type ViewpointProject,
  type VisualScene
} from "../../src/core/types";

const subtypeMap: Record<RelationFamily, string[]> = {
  SUPPORT: ["evidence", "example", "authority", "explanation", "observation"],
  OPPOSE: ["contradiction", "counterexample", "exception", "limitation", "rebuttal"],
  CAUSE: ["cause", "enable", "prevent", "increase", "decrease", "trigger"],
  CONDITION: ["necessary_condition", "sufficient_condition", "prerequisite", "unless"],
  COMPARE: ["similarity", "difference", "advantage", "disadvantage", "tradeoff"],
  DECOMPOSE: ["part_of", "type_of", "instance_of", "contains", "dimension_of"],
  TEMPORAL: ["before", "after", "simultaneous", "sequence", "during"],
  INFER: ["deduction", "induction", "abduction", "therefore"]
};

function extractProject(result: any): ViewpointProject {
  const project = result?.structuredContent?.project ?? result?.project;
  if (!project) throw new Error(result?.content?.[0]?.text || "Tool returned no project");
  return project;
}

function edgeColor(family: RelationFamily): string {
  return ({ SUPPORT: "#20a37a", OPPOSE: "#ef5b5b", CAUSE: "#6d5ef7", CONDITION: "#e69d22", COMPARE: "#387ed1", DECOMPOSE: "#9a62c7", TEMPORAL: "#557070", INFER: "#22252c" } as const)[family];
}

function AnimationPreview({ scene, tick }: { scene?: VisualScene; tick: number }) {
  if (!scene) return <div className="empty-canvas">没有可播放的场景</div>;
  const byId = new Map(scene.nodes.map((node) => [node.id, node]));
  return <div className="animation-stage" key={`${scene.id}-${tick}`}>
    <div className="scene-caption"><span>{scene.cognitiveAction}</span><strong>{scene.title}</strong></div>
    <svg viewBox="0 0 960 540">
      <defs><marker id="preview-arrow" markerWidth="10" markerHeight="10" refX="8" refY="3" orient="auto"><path d="M0,0 L0,6 L9,3 z" /></marker></defs>
      {scene.edges.map((edge, index) => {
        const from = byId.get(edge.source), to = byId.get(edge.target);
        if (!from || !to) return null;
        return <g className="preview-edge" style={{ animationDelay: `${0.45 + index * 0.32}s` }} key={edge.id}><line x1={from.x} y1={from.y} x2={to.x} y2={to.y} markerEnd="url(#preview-arrow)" /><text x={(from.x + to.x) / 2} y={(from.y + to.y) / 2 - 10}>{edge.subtype}</text></g>;
      })}
      {scene.nodes.map((node, index) => <g className={`preview-node ${node.emphasis === "strong" ? "strong" : ""}`} style={{ animationDelay: `${0.14 + index * 0.32}s` }} transform={`translate(${node.x - 105} ${node.y - 40})`} key={node.id}><rect width="210" height="80" rx="18"/><foreignObject x="14" y="10" width="182" height="60"><div className="node-copy">{node.label}</div></foreignObject></g>)}
    </svg>
  </div>;
}

function Inspector({ ir, selectedNode, selectedEdge, updateIr, deleteSelection }: { ir: ViewpointIR; selectedNode?: Proposition; selectedEdge?: ReasoningRelation; updateIr: (ir: ViewpointIR) => void; deleteSelection: () => void }) {
  if (!selectedNode && !selectedEdge) return <aside className="inspector"><div className="panel-heading">检查器</div><div className="muted-block">选择一个命题或关系进行编辑。</div></aside>;
  if (selectedNode) {
    const update = (patch: Partial<Proposition>) => updateIr({ ...ir, propositions: ir.propositions.map((item) => item.id === selectedNode.id ? { ...item, ...patch } : item) });
    const updateMeta = (key: "importance" | "confidence" | "presentationPriority", value: number) => update({ metadata: { ...selectedNode.metadata, [key]: value } });
    return <aside className="inspector"><div className="panel-heading">命题</div><label>文字<textarea value={selectedNode.label} onChange={(e) => update({ label: e.target.value })}/></label><label>Predicate<input value={selectedNode.predicate} onChange={(e) => update({ predicate: e.target.value })}/></label><div className="two"><label>Intent<select value={selectedNode.intent} onChange={(e) => update({ intent: e.target.value as Proposition["intent"] })}>{intents.map((v) => <option key={v}>{v}</option>)}</select></label><label>Modality<select value={selectedNode.modifiers.modality} onChange={(e) => update({ modifiers: { ...selectedNode.modifiers, modality: e.target.value as any } })}>{modalities.map((v) => <option key={v}>{v}</option>)}</select></label></div><label className="check"><input type="checkbox" checked={selectedNode.modifiers.polarity === "negative"} onChange={(e) => update({ modifiers: { ...selectedNode.modifiers, polarity: e.target.checked ? "negative" : "positive" } })}/>否定命题</label>{(["importance", "confidence", "presentationPriority"] as const).map((key) => <label key={key}>{key}<div className="range"><input type="range" min="0" max="1" step="0.05" value={selectedNode.metadata[key]} onChange={(e) => updateMeta(key, Number(e.target.value))}/><span>{selectedNode.metadata[key].toFixed(2)}</span></div></label>)}<label className="check"><input type="checkbox" checked={!!selectedNode.metadata.isMainClaim} onChange={(e) => update({ metadata: { ...selectedNode.metadata, isMainClaim: e.target.checked } })}/>核心主张</label><button className="danger" onClick={deleteSelection}>删除命题</button></aside>;
  }
  const edge = selectedEdge!;
  const update = (patch: Partial<ReasoningRelation>) => updateIr({ ...ir, relations: ir.relations.map((item) => item.id === edge.id ? { ...item, ...patch } : item) });
  return <aside className="inspector"><div className="panel-heading">推理关系</div><label>Family<select value={edge.family} onChange={(e) => { const family = e.target.value as RelationFamily; update({ family, subtype: subtypeMap[family][0] }); }}>{relationFamilies.map((v) => <option key={v}>{v}</option>)}</select></label><label>Subtype<select value={edge.subtype} onChange={(e) => update({ subtype: e.target.value })}>{subtypeMap[edge.family].map((v) => <option key={v}>{v}</option>)}</select></label><label>显示标签<input value={edge.label ?? ""} placeholder={edge.subtype} onChange={(e) => update({ label: e.target.value || undefined })}/></label><label>Confidence<div className="range"><input type="range" min="0" max="1" step="0.05" value={edge.confidence} onChange={(e) => update({ confidence: Number(e.target.value) })}/><span>{edge.confidence.toFixed(2)}</span></div></label><button className="danger" onClick={deleteSelection}>删除关系</button></aside>;
}

export function App() {
  const [project, setProject] = useState<ViewpointProject | undefined>(() => initialProject());
  const [ir, setIr] = useState<ViewpointIR | undefined>(() => initialProject()?.ir);
  const [settings, setSettings] = useState<CompilerSettings | undefined>(() => initialProject()?.settings);
  const [selectedNodeId, setSelectedNodeId] = useState<string>();
  const [selectedEdgeId, setSelectedEdgeId] = useState<string>();
  const [sceneIndex, setSceneIndex] = useState(0);
  const [mode, setMode] = useState<"graph" | "animation">("graph");
  const [tick, setTick] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [status, setStatus] = useState("就绪");
  const projectRef = useRef<ViewpointProject | undefined>(project);
  const pendingRef = useRef<{ ir: ViewpointIR; settings: CompilerSettings } | undefined>(undefined);
  const savingRef = useRef(false);
  const timerRef = useRef<number | undefined>(undefined);

  useEffect(() => onProject((next) => { projectRef.current = next; setProject(next); setIr(next.ir); setSettings(next.settings); }), []);
  useEffect(() => { projectRef.current = project; }, [project]);

  const flush = async () => {
    if (savingRef.current || !pendingRef.current || !projectRef.current) return;
    const snapshot = pendingRef.current;
    pendingRef.current = undefined;
    savingRef.current = true;
    setStatus("正在编译…");
    try {
      const result = await callTool("update_viewpoint_project", { projectPath: projectRef.current.projectPath, expectedRevision: projectRef.current.revision, patch: snapshot });
      const next = extractProject(result);
      projectRef.current = next;
      setProject(next);
      if (!pendingRef.current) { setIr(next.ir); setSettings(next.settings); }
      setStatus(`已保存 · r${next.revision}`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "保存失败");
    } finally {
      savingRef.current = false;
      if (pendingRef.current) window.setTimeout(flush, 30);
    }
  };

  const queueSave = (nextIr: ViewpointIR, nextSettings: CompilerSettings) => {
    pendingRef.current = { ir: nextIr, settings: nextSettings };
    setStatus("有未编译修改");
    window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(flush, 500);
  };
  const updateIr = (next: ViewpointIR) => { if (!settings) return; setIr(next); queueSave(next, settings); };
  const updateSettings = (patch: Partial<CompilerSettings>) => { if (!ir || !settings) return; const next = { ...settings, ...patch }; setSettings(next); queueSave(ir, next); };

  const visibleScenes = project?.visualIR.scenes.filter((scene) => !scene.hidden) ?? [];
  useEffect(() => {
    if (!playing || !visibleScenes.length) return;
    const scene = visibleScenes[Math.min(sceneIndex, visibleScenes.length - 1)];
    const timer = window.setTimeout(() => { setSceneIndex((value) => (value + 1) % visibleScenes.length); setTick((value) => value + 1); }, scene.durationMs);
    return () => window.clearTimeout(timer);
  }, [playing, sceneIndex, tick, visibleScenes.length]);

  const graphNodes: Node[] = useMemo(() => project?.presentationGraph.nodes.map((node) => ({ id: node.id, position: { x: node.x - 105, y: node.y - 40 }, data: { label: node.label }, className: node.emphasis === "strong" ? "claim-node" : "argument-node", style: { width: 210, minHeight: 80 } })) ?? [], [project]);
  const graphEdges: Edge[] = useMemo(() => project?.presentationGraph.edges.map((edge) => ({ id: edge.id, source: edge.source, target: edge.target, label: `${edge.family} · ${edge.subtype}`, markerEnd: { type: MarkerType.ArrowClosed }, style: { stroke: edgeColor(edge.family), strokeWidth: 2.5 }, labelStyle: { fill: edgeColor(edge.family), fontWeight: 700 } })) ?? [], [project]);
  const onConnect = (connection: Connection) => {
    if (!ir || !connection.source || !connection.target) return;
    const id = `r_${Date.now().toString(36)}`;
    updateIr({ ...ir, relations: [...ir.relations, { id, source: connection.source, target: connection.target, family: "CAUSE", subtype: "cause", confidence: 0.8 }] });
    setSelectedEdgeId(id); setSelectedNodeId(undefined);
  };
  const onNodeDragStop: OnNodeDrag<Node> = (_, node) => {
    if (!ir) return;
    updateIr({ ...ir, presentation: { ...ir.presentation, nodePositions: { ...(ir.presentation?.nodePositions ?? {}), [node.id]: { x: Math.round(node.position.x + 105), y: Math.round(node.position.y + 40) } } } });
  };
  const addProposition = () => {
    if (!ir) return;
    const id = `p_${Date.now().toString(36)}`;
    const sectionId = ir.sections[0]?.id;
    const proposition: Proposition = { id, label: "新命题", predicate: "State", arguments: [], modifiers: { polarity: "positive", modality: "certain" }, intent: "ASSERT", metadata: { importance: 0.5, confidence: 0.8, presentationPriority: 0.5, sectionId } };
    updateIr({ ...ir, propositions: [...ir.propositions, proposition], sections: ir.sections.map((section, index) => index === 0 ? { ...section, propositionIds: [...section.propositionIds, id] } : section), presentation: { ...ir.presentation, pinnedPropositionIds: [...(ir.presentation?.pinnedPropositionIds ?? []), id] } });
    setSelectedNodeId(id); setSelectedEdgeId(undefined);
  };
  const deleteSelection = () => {
    if (!ir) return;
    if (selectedNodeId) updateIr({ ...ir, propositions: ir.propositions.filter((p) => p.id !== selectedNodeId), relations: ir.relations.filter((r) => r.source !== selectedNodeId && r.target !== selectedNodeId), globalClaimIds: ir.globalClaimIds.filter((id) => id !== selectedNodeId), sections: ir.sections.map((s) => ({ ...s, propositionIds: s.propositionIds.filter((id) => id !== selectedNodeId) })) });
    else if (selectedEdgeId) updateIr({ ...ir, relations: ir.relations.filter((r) => r.id !== selectedEdgeId) });
    setSelectedNodeId(undefined); setSelectedEdgeId(undefined);
  };
  const moveScene = (sceneId: string, delta: number) => {
    if (!ir || !project) return;
    const order = project.presentationGraph.scenes.map((scene) => scene.id);
    const index = order.indexOf(sceneId), target = index + delta;
    if (target < 0 || target >= order.length) return;
    [order[index], order[target]] = [order[target], order[index]];
    updateIr({ ...ir, presentation: { ...ir.presentation, sceneOrder: order } });
  };
  const toggleScene = (sceneId: string) => {
    if (!ir) return;
    const hidden = new Set(ir.presentation?.hiddenSceneIds ?? []);
    hidden.has(sceneId) ? hidden.delete(sceneId) : hidden.add(sceneId);
    updateIr({ ...ir, presentation: { ...ir.presentation, hiddenSceneIds: [...hidden] } });
  };

  if (!project || !ir || !settings) return <div className="loading"><div className="mark">VC</div><h1>Viewpoint Compiler</h1><p>请通过 <code>open_viewpoint_editor</code> 打开一个项目。</p></div>;
  const selectedNode = ir.propositions.find((item) => item.id === selectedNodeId);
  const selectedEdge = ir.relations.find((item) => item.id === selectedEdgeId);
  const activeScene = visibleScenes[Math.min(sceneIndex, Math.max(visibleScenes.length - 1, 0))];

  return <div className={`shell theme-${settings.theme.toLowerCase()}`}>
    <header className="topbar"><div className="identity"><div className="mark">VC</div><div><h1>{ir.title}</h1><span>{ir.propositions.length} 命题 · {ir.relations.length} 关系 · {project.presentationGraph.scenes.length} 场景</span></div></div><div className="top-actions"><span className="save-status">{status}</span><select value={settings.theme} onChange={(e) => updateSettings({ theme: e.target.value as any })}>{themes.map((value) => <option key={value}>{value}</option>)}</select><select value={settings.aspectRatio} onChange={(e) => updateSettings({ aspectRatio: e.target.value as any })}>{aspectRatios.map((value) => <option key={value}>{value}</option>)}</select><button onClick={() => requestFullscreen()}>全屏</button></div></header>
    <div className="workspace">
      <aside className="scenes"><div className="panel-heading"><span>认知场景</span><button className="icon-button" onClick={addProposition} title="添加命题">＋</button></div>{project.presentationGraph.scenes.map((scene, index) => <div className={`scene-row ${activeScene?.id === scene.id ? "active" : ""} ${scene.hidden ? "hidden" : ""}`} key={scene.id} onClick={() => { const visibleIndex = visibleScenes.findIndex((s) => s.id === scene.id); if (visibleIndex >= 0) setSceneIndex(visibleIndex); }}><span className="scene-number">{String(index + 1).padStart(2, "0")}</span><div><strong>{scene.cognitiveAction}</strong><small>{scene.title}</small></div><div className="row-actions"><button onClick={(e) => { e.stopPropagation(); moveScene(scene.id, -1); }}>↑</button><button onClick={(e) => { e.stopPropagation(); moveScene(scene.id, 1); }}>↓</button><button onClick={(e) => { e.stopPropagation(); toggleScene(scene.id); }}>{scene.hidden ? "○" : "●"}</button></div></div>)}</aside>
      <main className="canvas"><div className="canvas-tabs"><button className={mode === "graph" ? "active" : ""} onClick={() => setMode("graph")}>结构图</button><button className={mode === "animation" ? "active" : ""} onClick={() => setMode("animation")}>动画预览</button><span>{project.presentationGraph.collapsedPropositionIds.length} 个命题已折叠</span></div><div className={`canvas-body ratio-${settings.aspectRatio.replace(":", "-")}`}>{mode === "graph" ? <ReactFlow nodes={graphNodes} edges={graphEdges} fitView onConnect={onConnect} onNodeDragStop={onNodeDragStop} onNodeClick={(_, node) => { setSelectedNodeId(node.id); setSelectedEdgeId(undefined); }} onEdgeClick={(_, edge) => { setSelectedEdgeId(edge.id); setSelectedNodeId(undefined); }}><Background gap={20} size={1}/><MiniMap pannable zoomable/><Controls/></ReactFlow> : <AnimationPreview scene={activeScene} tick={tick}/>}</div><div className="timeline"><button onClick={() => { setSceneIndex((value) => Math.max(0, value - 1)); setTick((v) => v + 1); }}>←</button><button className="play" onClick={() => { setPlaying((value) => !value); setTick((v) => v + 1); }}>{playing ? "暂停" : "播放"}</button><button onClick={() => { setSceneIndex((value) => Math.min(visibleScenes.length - 1, value + 1)); setTick((v) => v + 1); }}>→</button><div className="scene-dots">{visibleScenes.map((scene, index) => <button key={scene.id} className={index === sceneIndex ? "active" : ""} onClick={() => { setSceneIndex(index); setTick((v) => v + 1); }} title={scene.cognitiveAction}/>)}</div><span>{sceneIndex + 1} / {visibleScenes.length}</span></div></main>
      <Inspector ir={ir} selectedNode={selectedNode} selectedEdge={selectedEdge} updateIr={updateIr} deleteSelection={deleteSelection}/>
    </div>
  </div>;
}
