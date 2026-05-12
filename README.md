# scenebench

> Open harness for running, measuring, and visualizing agent benchmarks.

Adapters for **AutomationBench** (Zapier), **τ-bench** (Sierra), **LeRobot** (Hugging Face), **WorkArena** (ServiceNow), **SWE-bench**, and more — plus benchmarks we author end-to-end (S4Bench for SAP, more coming).

> **Where things live.**
> - `scenebench` — **harness + content + scenecast extensions**: bench fixtures, Python adapters, evaluators, reporters, **and** the typed vendor implementations (Gmail, Salesforce, Slack, …) for every domain its benchmarks cover. Vendor types ship as scenecast extensions — `extends: ["email/mailbox"]` etc.
> - [`scenecast`](https://github.com/daslabhq/scenecast) — **the API + canonical shapes**: `defineAsset`, `defineView`, multi-format renderers, abstract primitives (Email, Message, Contact, Event, Task, Document). The lean dependency benchmarks build on.
> - [`scene-otel`](https://github.com/daslabhq/scene-otel) — **the wire format**: `scene.set` events, hashing, the generic scrubber.
>
> If you only need types or rendering, install [`scenecast`](https://github.com/daslabhq/scenecast) — its npm package is the lean entry point. `scenebench` is for benchmark runners and is best used by cloning the git repo (which carries fixtures and tasks not shipped to npm).

## What scenebench gives you

- **Run any benchmark with scene-otel instrumentation.** Adapters wrap each benchmark's native rollout loop; every step emits `scene.set` snapshots automatically.
- **Step-level metrics nobody else publishes.** Belief-vs-truth alignment, drift counts, first-unsatisfiable-step, intent resolution rate. Beyond pass/fail.
- **Cross-benchmark normalization.** Same metrics across AutomationBench, τ-bench, LeRobot. Compare belief accuracy of a model on software vs robotics tasks.
- **JSONL output you can scrub.** Drops directly into the [scene-otel](https://github.com/daslabhq/scene-otel) static scrubber for turn-by-turn replay.
- **Markdown leaderboards** for READMEs, PRs, Slack updates.

## Layout

```
scenebench/
├── src/                          TypeScript core (npm-shipped)
│   ├── parse.ts                  JSONL → BenchRun
│   ├── evaluators/               metrics over BenchRuns
│   │   └── belief_truth.ts
│   ├── reporters/                BenchRun + metrics → markdown / leaderboard / JSONL
│   └── types.ts
├── types/                        vendor type declarations (npm-shipped, a-la-carte)
│   ├── gmail.ts                  authored via `defineAsset` from scenecast, extends "email/mailbox"
│   ├── slack.ts                  extends "message/channel"
│   ├── salesforce.ts             extends "contact/list"
│   ├── google_calendar.ts        extends "event/list"
│   ├── jira.ts · github.ts       extends "task/list"
│   ├── notion.ts                 extends "document/single"
│   ├── google_sheets.ts · stripe.ts · airtable.ts
│   └── index.ts                  vendorTypes registry
├── adapters/                     per-benchmark wrappers (git-only, not shipped to npm)
│   └── automationbench/          ✓ shipped
│       ├── scene.py              Python port of scene-otel's wire format
│       ├── instrument.py         Verifiers env subclass that emits scene events
│       ├── run.py                CLI: pick tasks, run model, dump JSONL
│       ├── schemas/              49 JSON Schemas synced from Zapier's Pydantic models
│       ├── tasks/                806 task definitions (initial_state + prompt + assertions)
│       └── scripts/              sync + fixture-build scripts
├── viewer/example-traces/        bundled JSONL fixtures (git-only)
├── benches/                      benchmarks WE author end-to-end (git-only)
│   └── (s4 / sfdc / d365 — coming, each with its own types/)
└── examples/
```

**Adapters** wrap external benchmarks (we don't own their tasks). **Benches** are ones we author end-to-end (tasks + fixtures + rubric). **Vendor types** are written using scenecast's `defineAsset` / `defineView` API and declare `extends: ["email/mailbox"]` etc. — so the canonicals in [`scenecast`](https://github.com/daslabhq/scenecast) (Email, Message, Contact, Event, Task, Document) unify them at the abstract level.

The npm package ships only `src/` and `types/`. Heavy data (806 AB tasks, 49 schemas, JSONL fixtures) lives in the git repo for benchmark runners — `git clone`, don't `npm install`. For genuinely large datasets we expect to publish to HuggingFace Datasets / S3 and reference them from `benches/<bench>/DATA.md`.

## Quick start

### Run AutomationBench (Python adapter)

The AutomationBench adapter wraps Sierra's [Verifiers](https://github.com/willccbb/verifiers) env. Requires their repo cloned somewhere + an Anthropic / OpenAI key.

```bash
# clone the AB repo somewhere; point AB_ROOT at it
export AB_ROOT=/path/to/AutomationBench

# from scenebench/adapters/automationbench/
PYTHONPATH=. $AB_ROOT/.venv/bin/python run.py 3
# → ../../viewer/example-traces/automationbench-real-*.jsonl
```

3 tasks against `claude-haiku-4-5`. Produces JSONL traces with `scene.set` snapshots per step.

### Sync AB schemas + tasks (one-time, or after AB updates)

```bash
AB_ROOT=/path/to/AutomationBench \
  $AB_ROOT/.venv/bin/python adapters/automationbench/scripts/sync-automationbench.py
bun adapters/automationbench/scripts/build-ab-fixtures.ts
```

### Read + evaluate the JSONL (TypeScript)

```ts
import { parseJsonl, evaluators, reporters } from "scenebench";

const runs = parseJsonl("trace.jsonl", "automationbench");
for (const run of runs) {
  const metrics = evaluators.evaluateRun(run);
  console.log(reporters.toMarkdown([{ run, metrics }]));
}
```

Output:

```
| task | reward | tokens | events | intents | drifts | duration |
|---|---|---|---|---|---|---|
| simple.email_sf_contact_phone_update | 1.00 | 6191+780 | 6 | 3 | 0 | 7600ms |
```

## Metrics today

The `belief_truth` evaluator emits:

| Metric | Meaning |
|---|---|
| `intent_rate` | fraction of tool calls where an intent was declared |
| `intent_resolution_rate` | fraction of intents that got resolved by an actual outcome |
| `drift_count` | intents whose value diverged from the actual outcome |
| `first_drift_step` | step index where the first drift occurred (or undefined) |

Plus baseline counts:

| Metric | Meaning |
|---|---|
| `events_total` | total scene events emitted |
| `events_intent` / `events_actual` | breakdown by kind |
| `scene_keys_distinct` | unique asset keys touched in the run |

More evaluators planned: milestone tracking, inflection-step detection, cost-per-belief-correctness.

## Adapters shipping today

| Adapter | Status | Notes |
|---|---|---|
| AutomationBench | ✓ shipped | wraps Sierra Verifiers' StatefulToolEnv; emits per-tool intent + actual |
| τ-bench | planned | same shape — Sierra's customer-service benchmark |
| LeRobot | planned | episode-level scene events from manipulation/navigation datasets |
| WorkArena | planned | ServiceNow workflow tasks |
| SWE-bench | planned | code agents — file system + test results as scene state |

## Roadmap

v0.0.1 (current)

- ✅ TypeScript core: types, parser, evaluators, markdown reporter
- ✅ AutomationBench adapter (Python)
- ✅ Belief-vs-truth + basic stats evaluators

Coming next

- **Milestone evaluator** — assertion-aware scoring (PENDING / SATISFIED / BROKEN / UNSATISFIABLE) with first-unsatisfiable-step detection
- **Leaderboard reporter** — per-model rollup across many runs, exportable as JSON / web
- **τ-bench adapter** — second adapter validates the pattern
- **S4Bench** — first benchmark we author end-to-end (SAP S/4HANA workflows)
- **CLI**: `npx scenebench run --benchmark X --model Y` one-liner

## License

MIT. See [LICENSE](./LICENSE).

## Related

- [`scene-otel`](https://github.com/daslabhq/scene-otel) — wire format for scene events, with the static scrubber that visualizes scenebench output
- [`scenecast`](https://github.com/daslabhq/scenecast) — typed asset shapes + views; gives every benchmark consistent visual language
- [`agent-otel`](https://github.com/mirkokiefer/agent-otel) — generic OTel router for agent telemetry
- [`autocompile`](https://github.com/mirkokiefer/autocompile) — observes repeated runs, compiles invariants to code
