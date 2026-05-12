/**
 * Run an AutomationBench task as a scenegrad observer-mode bench.
 *
 * The agent uses Anthropic's native tool calling (full args). scenegrad
 * sits alongside, observes the world, gives the agent a runtime status
 * via system prompt, records per-step deltas.
 *
 * Usage:
 *   bun benches/automationbench/run.ts \
 *     --task simple_email_sf_contact_phone_update \
 *     --model claude-haiku-4-5
 *
 *   # multiple tasks via glob:
 *   bun benches/automationbench/run.ts --tasks "simple_*" --model claude-haiku-4-5
 *
 * Output: per-task summary + JSONL trajectory in viewer/example-traces/.
 */

import { writeFileSync, mkdirSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import Anthropic from "@anthropic-ai/sdk";
import { observe } from "scenegrad";
import { AutomationBenchEnv } from "./env.js";
import { applyTool } from "./tools.js";
import { translateAssertions, type ABWorld } from "./assertions.js";

interface CliArgs {
  task?:    string;
  tasks?:   string;
  model:    string;
  maxTurns: number;
}

function parseArgs(): CliArgs {
  const argv = process.argv.slice(2);
  const args: CliArgs = { model: "claude-haiku-4-5", maxTurns: 8 };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    switch (a) {
      case "--task":      args.task      = argv[++i]; break;
      case "--tasks":     args.tasks     = argv[++i]; break;
      case "--model":     args.model     = argv[++i]!; break;
      case "--max-turns": args.maxTurns  = parseInt(argv[++i]!, 10); break;
    }
  }
  return args;
}

const HERE = dirname(fileURLToPath(import.meta.url));
const TASK_DIR   = join(HERE, "..", "..", "adapters", "automationbench", "tasks");
const TRACES_DIR = join(HERE, "..", "..", "viewer", "example-traces");

function listTasksMatching(pattern: string): string[] {
  const regex = new RegExp("^" + pattern.replace(/\*/g, ".*") + "$");
  return readdirSync(TASK_DIR)
    .filter(f => f.endsWith(".json") && f !== "tasks-manifest.json")
    .map(f => f.replace(/\.json$/, ""))
    .filter(slug => regex.test(slug));
}

// ---------------------------------------------------------------------------
// Tool schemas — what we expose to Claude. Anthropic native tool calling
// drives args; we apply via our TS handlers in tools.ts.
// ---------------------------------------------------------------------------

const TOOL_SCHEMAS: Record<string, Anthropic.Tool> = {
  gmail_find_email: {
    name: "gmail_find_email",
    description: "Search for emails by query, sender, or subject. Returns matches without modifying state.",
    input_schema: { type: "object", properties: {
      query:   { type: "string", description: "freetext search across subject/from/body" },
      from:    { type: "string", description: "filter by sender" },
      subject: { type: "string", description: "filter by subject substring" },
    }} as any,
  },
  gmail_get_email_by_id: {
    name: "gmail_get_email_by_id",
    description: "Read the full body of an email given its id.",
    input_schema: { type: "object", properties: {
      id: { type: "string" },
    }, required: ["id"] } as any,
  },
  gmail_send_email: {
    name: "gmail_send_email",
    description: "Send an email.",
    input_schema: { type: "object", properties: {
      to:      { type: "array", items: { type: "string" } },
      subject: { type: "string" },
      body:    { type: "string" },
    }, required: ["to","subject","body"] } as any,
  },
  salesforce_find_records: {
    name: "salesforce_find_records",
    description: "Search Salesforce records by collection (contacts/accounts/leads/...) and filter.",
    input_schema: { type: "object", properties: {
      collection: { type: "string" },
      filter:     { type: "object", description: "field equality filters, e.g. { first_name: \"Jordan\" }" },
    }, required: ["collection"] } as any,
  },
  salesforce_contact_update: {
    name: "salesforce_contact_update",
    description: "Update fields on a Salesforce contact by id.",
    input_schema: { type: "object", properties: {
      id:    { type: "string", description: "contact id" },
      phone: { type: "string" },
      email: { type: "string" },
      title: { type: "string" },
      first_name: { type: "string" },
      last_name:  { type: "string" },
    }, required: ["id"] } as any,
  },
  salesforce_contact_create: {
    name: "salesforce_contact_create",
    description: "Create a new Salesforce contact.",
    input_schema: { type: "object", properties: {
      first_name: { type: "string" },
      last_name:  { type: "string" },
      email:      { type: "string" },
      phone:      { type: "string" },
      title:      { type: "string" },
    }} as any,
  },
};

// ---------------------------------------------------------------------------
// Run one task in observer mode
// ---------------------------------------------------------------------------

async function runOne(taskId: string, args: CliArgs) {
  const env = new AutomationBenchEnv();
  env.reset(taskId);

  // Mutable world held in this closure — tool calls mutate it; watcher snapshots it.
  let world: ABWorld = env.scene();

  const watcher = observe<ABWorld>({
    snapshot: async () => structuredClone(world),
    goal: () => translateAssertions(env.meta().assertions),
  });

  // Prepare tool list — only the ones declared by this task AND we have schemas for
  const declared = env.declaredTools();
  const tools = declared
    .filter(name => TOOL_SCHEMAS[name])
    .map(name => TOOL_SCHEMAS[name]!);

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const history: Anthropic.MessageParam[] = [
    { role: "user", content: env.userPrompt() },
  ];

  console.log(`\n→ ${taskId} [observer:${args.model}]`);
  console.log(`  prompt: ${env.userPrompt()}`);

  const t_start = Date.now();
  let completed = false;

  for (let turn = 0; turn < args.maxTurns; turn++) {
    const status = await watcher.status();
    if (status.done) { completed = true; break; }

    const system = [
      env.systemPrompt(),
      "",
      "Progress:",
      `  Satisfied: ${status.satisfied.map(a => a.name).join(", ") || "(none yet)"}`,
      `  Unmet:     ${status.unmet.map(a => a.name).join(", ")}`,
      `  Distance:  ${status.gap}`,
    ].filter(Boolean).join("\n");

    const response = await client.messages.create({
      model:      args.model,
      max_tokens: 1024,
      system,
      tools,
      messages:   history,
    });

    history.push({ role: "assistant", content: response.content });

    const toolUses = response.content.filter((b): b is Anthropic.ToolUseBlock => b.type === "tool_use");
    if (toolUses.length === 0) break;

    const toolResults: Anthropic.ToolResultBlockParam[] = [];
    for (const use of toolUses) {
      try {
        // Apply mutating tools to world; read-only tools also pass through here harmlessly.
        const newWorld = applyTool(world, { name: use.name, args: use.input as any });
        world = newWorld;

        // For read tools, return a useful payload to the agent
        let resultPayload: string;
        switch (use.name) {
          case "gmail_find_email": {
            const matches = filterMessages(world.gmail?.messages ?? [], use.input as any);
            resultPayload = JSON.stringify(matches);
            break;
          }
          case "gmail_get_email_by_id": {
            const m = (world.gmail?.messages ?? []).find((x: any) => x.id === (use.input as any).id);
            resultPayload = JSON.stringify(m ?? { error: "not found" });
            break;
          }
          case "salesforce_find_records": {
            const collection = (use.input as any).collection;
            const filter = (use.input as any).filter ?? {};
            const records = (world.salesforce?.[collection] ?? [])
              .filter((r: any) => Object.entries(filter).every(([k, v]) =>
                String(r[k] ?? "").toLowerCase().includes(String(v).toLowerCase())));
            resultPayload = JSON.stringify(records);
            break;
          }
          default:
            resultPayload = JSON.stringify({ ok: true });
        }

        toolResults.push({ type: "tool_result", tool_use_id: use.id, content: resultPayload });

        await watcher.recordStep({
          tool: { name: use.name, args: use.input as any },
        });
      } catch (e) {
        toolResults.push({ type: "tool_result", tool_use_id: use.id, content: `ERROR: ${e}`, is_error: true });
        await watcher.recordStep({
          tool: { name: use.name, args: use.input as any },
          ok: false, error: String(e),
        });
      }
    }

    history.push({ role: "user", content: toolResults });

    if (response.stop_reason === "end_turn") break;
  }

  const final = await watcher.status();
  const success = final.done;
  const duration_ms = Date.now() - t_start;

  console.log(`  ${success ? "✓" : "✗"}  d_initial=${watcher.trajectory()[0]?.d_before ?? final.gap}  d_final=${final.gap}  steps=${watcher.trajectory().length}  ${duration_ms}ms`);
  for (const t of watcher.trajectory()) {
    const tool = t.tool ? `${t.tool.name}(${JSON.stringify(t.tool.args).slice(0, 80)})` : "(none)";
    console.log(`    #${t.step} ${tool}  d:${t.d_before}→${t.d_after} (Δ${t.delta})${t.error ? ` ERROR: ${t.error}` : ""}`);
  }

  // Dump JSONL
  mkdirSync(TRACES_DIR, { recursive: true });
  const outPath = join(TRACES_DIR, `scenegrad-ab-${taskId}-${args.model}.jsonl`);
  writeFileSync(outPath, serialize({
    task_id: taskId, model: args.model, success, duration_ms,
    trajectory: watcher.trajectory(),
    d_initial: watcher.trajectory()[0]?.d_before ?? final.gap,
    d_final:   final.gap,
  }));
  console.log(`    → ${outPath}`);

  return { taskId, success };
}

function filterMessages(msgs: any[], args: any): any[] {
  return msgs.filter((m: any) => {
    if (args.query) {
      const q = String(args.query).toLowerCase();
      return [m.subject, m.from_, m.body_plain].some(f => String(f ?? "").toLowerCase().includes(q));
    }
    if (args.from)    return String(m.from_ ?? "").toLowerCase().includes(String(args.from).toLowerCase());
    if (args.subject) return String(m.subject ?? "").toLowerCase().includes(String(args.subject).toLowerCase());
    return true;
  });
}

function serialize(r: any): string {
  const trace_id = randomHex(32), span_id = randomHex(16);
  const start_ns = Date.now() * 1e6;
  const end_ns = (Date.now() + r.duration_ms) * 1e6;

  const events = (r.trajectory as any[]).flatMap((t) => {
    const ts_ns = start_ns + (t.ts_ms ?? 0) * 1e6;
    const out: any[] = [];
    if (t.tool) {
      out.push({
        name: "scene.set", time_ns: ts_ns,
        attributes: {
          "scene.key": "tool", "scene.kind": "intent",
          "scene.value": JSON.stringify({ tool: t.tool, predicted_delta: t.predicted_delta, reasoning: t.reasoning }),
          "scene.value.type": "json", "scene.value.size": 0, "scene.commit_hash": "",
          "scene.description": t.tool.name,
        },
      });
    }
    out.push({
      name: "scene.set", time_ns: ts_ns + 1,
      attributes: {
        "scene.key": "distance", "scene.kind": "actual",
        "scene.value": JSON.stringify({ d_before: t.d_before, d_after: t.d_after, delta: t.delta }),
        "scene.value.type": "json", "scene.value.size": 0, "scene.commit_hash": "",
        "scene.description": `step ${t.step}: d ${t.d_before}→${t.d_after}`,
      },
    });
    return out;
  });

  return JSON.stringify({
    trace_id, span_id, parent_span_id: null,
    name: `ab.${r.task_id}.observer`,
    start_time_ns: start_ns, end_time_ns: end_ns,
    kind: 0, status: { code: r.success ? 0 : 2 },
    attributes: {
      "bench.task_id": r.task_id, "bench.solver": "observer",
      "bench.model": r.model, "bench.success": r.success,
      "bench.steps": r.trajectory.length,
      "bench.d_initial": r.d_initial, "bench.d_final": r.d_final,
      "bench.duration_ms": r.duration_ms,
    },
    events,
  }) + "\n";
}

function randomHex(n: number): string {
  let s = ""; for (let i = 0; i < n; i++) s += "0123456789abcdef"[Math.floor(Math.random() * 16)];
  return s;
}

// ---------------------------------------------------------------------------

async function main() {
  const args = parseArgs();
  if (!process.env.ANTHROPIC_API_KEY) { console.error("ANTHROPIC_API_KEY not set"); process.exit(1); }
  const tasks = args.tasks ? listTasksMatching(args.tasks) : (args.task ? [args.task] : []);
  if (tasks.length === 0) { console.error("specify --task <id> or --tasks <pattern>"); process.exit(1); }

  const results: { taskId: string; success: boolean }[] = [];
  for (const t of tasks) {
    try { results.push(await runOne(t, args)); }
    catch (e) { console.error(`  ✗ ${t} threw:`, e); }
  }

  if (results.length > 1) {
    const ok = results.filter(r => r.success).length;
    console.log(`\n=== Summary === ${args.model}  ${ok}/${results.length} solved`);
    for (const r of results) console.log(`  ${r.success ? "✓" : "✗"} ${r.taskId}`);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
