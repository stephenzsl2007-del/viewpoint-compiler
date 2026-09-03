# Viewpoint Ontology V0

Use semantic roles rather than parts of speech.

## Semantic objects

- `Entity`: person, organization, object, system, or abstract concept.
- `Property`: a relatively stable quality of an object.
- `State`: a condition an object is in, including recession or unemployment.
- `Event`: something that happens or is expected to happen.
- `Action`: an action performed by an actor.
- `Quantity`: an amount, proportion, intensity, rate, or explicit change value.

## Proposition modifiers

- `polarity`: `positive` or `negative`.
- `modality`: `certain`, `probable`, `possible`, `hypothetical`, or `necessary`.
- `time.kind`: `past`, `present`, `future`, `specific`, or `duration`; include `value` when the wording supplies it.
- `quantification.kind`: `all`, `most`, `some`, `few`, `one`, or `percentage`; include `value` when needed.

## Relation families and subtypes

- `SUPPORT`: `evidence`, `example`, `authority`, `explanation`, `observation`.
- `OPPOSE`: `contradiction`, `counterexample`, `exception`, `limitation`, `rebuttal`.
- `CAUSE`: `cause`, `enable`, `prevent`, `increase`, `decrease`, `trigger`.
- `CONDITION`: `necessary_condition`, `sufficient_condition`, `prerequisite`, `unless`.
- `COMPARE`: `similarity`, `difference`, `advantage`, `disadvantage`, `tradeoff`.
- `DECOMPOSE`: `part_of`, `type_of`, `instance_of`, `contains`, `dimension_of`.
- `TEMPORAL`: `before`, `after`, `simultaneous`, `sequence`, `during`.
- `INFER`: `deduction`, `induction`, `abduction`, `therefore`.

Relations are directed from source to target. For support, source is evidence and target is the supported claim. For opposition, source is the objection and target is the weakened claim. For inference, source is a premise and target is the conclusion.

## Communicative intent

Use one of `ASSERT`, `QUESTION`, `ASSUME`, `DOUBT`, `EMPHASIZE`, `CONCEDE`, `PREDICT`, `RECOMMEND`, `DEFINE`, or `CLARIFY` according to the author's communicative role, not only sentence punctuation.

## Long-form segmentation

Create a section when the discourse changes argumentative purpose, such as moving from background to mechanism, evidence, objection, resolution, or recommendation. Sections are not paragraph copies. Each proposition belongs to the most relevant section. Cross-section conclusions belong in `globalClaimIds`; duplicate wording should not create duplicate propositions.

