---
name: viewpoint-compiler
description: Compile natural-language arguments, opinions, explanations, predictions, or recommendations into editable reasoning graphs and deterministic HTML animations. Use when the user asks to visualize, animate, map, compile, or clarify the internal logic of a viewpoint. Do not use for ordinary decorative videos, generic diagrams, or summaries that do not need reasoning preservation.
---

# Viewpoint Compiler

Turn the user's meaning into a reviewable reasoning structure before rendering it. The host model performs semantic interpretation; the `viewpoint_compiler` tools validate, optimize, persist, and render it. Never call a separate model API or ask the user for an API key.

## Workflow

1. Identify the exact source text. If it is already in the conversation or a readable file, do not ask the user to paste it again.
2. Read [references/ontology.md](references/ontology.md) before constructing a new IR or changing relation semantics.
3. Read [references/ir-format.md](references/ir-format.md) when creating or repairing the JSON object passed to a tool.
4. For short input, build one coherent graph. For long or multi-argument input, partition by argumentative purpose, create sections, and mark the cross-section conclusion in `globalClaimIds`.
5. Create atomic propositions: one independently assessable claim per proposition. Preserve negation, modality, time, quantification, uncertainty, exceptions, and the distinction between real-world cause and epistemic inference.
6. Call `create_viewpoint_project` with the current absolute workspace path, the source text embedded in the IR, and optional presentation settings. If validation fails, repair only the reported semantic or referential defect and retry once.
7. Call `open_viewpoint_editor` so the user can inspect and edit the compiled result. Report the project path and explain that changes are saved automatically.
8. On later requests, use `get_viewpoint_project` before making conversational corrections, then call `update_viewpoint_project` with its current revision. Use `export_viewpoint_html` when the user wants a standalone artifact.

## Quality gates

- Every proposition must have a concise audience-facing `label` as well as a canonical `predicate`.
- Relations connect propositions, not semantic objects. Arguments connect propositions to semantic objects.
- `CAUSE` describes change in the world. `INFER` describes how premises justify a conclusion.
- `SUPPORT` raises credibility without claiming causation. `OPPOSE` weakens, limits, or rebuts.
- Put the user's actual conclusion—not merely the last sentence—in `globalClaimIds`.
- Use confidence to expose genuine parsing uncertainty; do not present uncertain interpretation as certain.
- Never invent factual evidence. The graph reconstructs the user's reasoning; it does not verify truth unless the user separately asks for verification.
- Keep scene labels minimal and accurate. Visual style may change presentation but must not change the IR's meaning.

## Output behavior

Lead with the completed artifact. Keep implementation details brief. If the source is ambiguous in a way that would materially change the reasoning graph, state the ambiguity and use the most contextually supported interpretation rather than blocking; the editor provides the correction loop.
