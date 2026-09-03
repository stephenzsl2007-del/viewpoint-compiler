# Viewpoint IR 0.1 format

IDs use stable ASCII strings such as `o_ai`, `p_barrier_down`, and `r_ai_barrier`. Scores are numbers from 0 to 1. Relations may only reference proposition IDs; proposition arguments may only reference semantic object IDs.

```json
{
  "version": "0.1",
  "title": "AI changes the engineer role",
  "language": "zh-CN",
  "sourceText": "AI 正在降低编程门槛……",
  "semanticObjects": [
    { "id": "o_ai", "type": "Entity", "label": "AI" },
    { "id": "o_barrier", "type": "State", "label": "编程门槛" }
  ],
  "propositions": [
    {
      "id": "p_barrier_down",
      "label": "AI 降低编程门槛",
      "predicate": "Reduce",
      "arguments": [
        { "role": "agent", "objectId": "o_ai" },
        { "role": "patient", "objectId": "o_barrier" }
      ],
      "modifiers": {
        "polarity": "positive",
        "modality": "certain",
        "time": { "kind": "present" }
      },
      "intent": "ASSERT",
      "metadata": {
        "importance": 0.8,
        "confidence": 0.9,
        "presentationPriority": 0.8,
        "sectionId": "s_mechanism"
      }
    }
  ],
  "relations": [],
  "sections": [
    {
      "id": "s_mechanism",
      "title": "门槛下降",
      "propositionIds": ["p_barrier_down"]
    }
  ],
  "globalClaimIds": ["p_barrier_down"],
  "presentation": {
    "pinnedPropositionIds": ["p_barrier_down"],
    "hiddenSceneIds": [],
    "sceneOrder": []
  }
}
```

`sourceSpan` is optional and uses zero-based character offsets: `{ "start": 0, "end": 12, "text": "..." }`. Omit it rather than guessing offsets.

Default settings are:

```json
{
  "theme": "Minimal",
  "aspectRatio": "16:9",
  "maxNodesPerScene": 8,
  "autoplay": true
}
```

Allowed themes: `Minimal`, `Academic`, `Social`, `Playful`, `Technical`. Allowed aspect ratios: `9:16`, `1:1`, `16:9`.

