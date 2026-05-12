/**
 * Run ARC scenegrad bench. End-to-end CLI.
 *
 * Usage:
 *   bun benches/arc-trajectory/run.ts --task recolor_1_to_2 --solver greedy
 *   bun benches/arc-trajectory/run.ts --task recolor_1_to_2 --solver llm --model claude-haiku-4-5
 *   bun benches/arc-trajectory/run.ts --solver greedy --all
 *
 * Output: prints summary; writes JSONL to viewer/example-traces/scenegrad-arc-<task>-<solver>.jsonl
 */

import { writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { GreedySolver, LLMSolver, type SolveResult } from "scenegrad";
import { ArcEnv } from "./env.js";
import { listPuzzles } from "./tasks/load.js";
import { format } from "./grid.js";

interface CliArgs {
  task?:    string;
  solver:   "greedy" | "llm";
  model:    string;
  out?:     string;
  maxSteps: number;
  all:      boolean;
}

function parseArgs(): CliArgs {
  const argv = process.argv.slice(2);
  const args: CliArgs = {
    solver: "greedy",
    model: "claude-haiku-4-5",
    maxSteps: 15,
    all: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    switch (a) {
      case "--task":     args.task = argv[++i]; break;
      case "--solver":   args.solver = argv[++i] as "greedy" | "llm"; break;
      case "--model":    args.model = argv[++i]!; break;
      case "--out":      args.out = argv[++i]; break;
      case "--max-steps":args.maxSteps = parseInt(argv[++i]!, 10); break;
      case "--all":      args.all = true; break;
    }
  }
  return args;
}

const HERE = dirname(fileURLToPath(import.meta.url));
const TRACES_DIR = join(HERE, "..", "..", "viewer", "example-traces");

async function runOne(taskId: string, args: CliArgs): Promise<SolveResult> {
  const env = new ArcEnv();
  // Reset early so describeTask() can capture the target grid in its closure.
  env.reset(taskId);
  const solver = args.solver === "greedy"
    ? new GreedySolver()
    : new LLMSolver({
        model: args.model,
        formatScene: ArcEnv.formatScene,
        describeTask: () => env.describeTask(),
      });

  console.log(`\n→ ${taskId} [${solver.name}]`);
  const result = await solver.solve(env, taskId, { maxSteps: args.maxSteps });

  console.log(`  ${result.success ? "✓" : "✗"}  d_initial=${result.d_initial}  d_final=${result.d_final}  steps=${result.steps}  ${result.duration_ms}ms`);

  if (!result.success && result.trajectory.length > 0) {
    const last = result.trajectory[result.trajectory.length - 1]!;
    console.log(`     final scene:\n${format(env.scene()).split("\n").map(l => "       " + l).join("\n")}`);
    if (last.error) console.log(`     last error: ${last.error}`);
  }

  // Per-step trajectory summary
  for (const t of result.trajectory) {
    const tool = t.tool ? `${t.tool.name}(${JSON.stringify(t.tool.args)})` : "(none)";
    const pred = t.predicted_delta !== undefined ? ` predicted=${t.predicted_delta}` : "";
    console.log(`     #${t.step} ${tool}  d:${t.d_before}→${t.d_after} (Δ${t.delta})${pred}`);
  }

  // Write JSONL
  const outPath = args.out ?? join(TRACES_DIR, `scenegrad-arc-${taskId}-${args.solver === "llm" ? args.model : args.solver}.jsonl`);
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, serializeAsSceneOtel(result, taskId));
  console.log(`     → ${outPath}`);

  return result;
}

/**
 * Serialize a SolveResult as scene-otel-format JSONL.
 * Each step becomes a span event so the existing scrubber can render it.
 */
function serializeAsSceneOtel(result: SolveResult, taskId: string): string {
  const trace_id = randomHex(32);
  const span_id  = randomHex(16);
  const start_ns = Date.now() * 1e6;
  const end_ns   = (Date.now() + result.duration_ms) * 1e6;

  const events = result.trajectory.flatMap((t, i) => {
    const ts_ns = start_ns + (t.ts_ms ?? 0) * 1e6;
    const out = [];

    // Intent: which tool was picked + predicted closure
    if (t.tool) {
      out.push({
        name: "scene.set",
        time_ns: ts_ns,
        attributes: {
          "scene.key": "tool",
          "scene.kind": "intent",
          "scene.value": JSON.stringify({ tool: t.tool, predicted_delta: t.predicted_delta, reasoning: t.reasoning }),
          "scene.value.type": "json",
          "scene.value.size": 0,
          "scene.commit_hash": "",
          "scene.description": t.tool.name,
        },
      });
    }

    // Actual: the resulting state after the tool ran
    out.push({
      name: "scene.set",
      time_ns: ts_ns + 1,
      attributes: {
        "scene.key": "distance",
        "scene.kind": "actual",
        "scene.value": JSON.stringify({ d_before: t.d_before, d_after: t.d_after, delta: t.delta }),
        "scene.value.type": "json",
        "scene.value.size": 0,
        "scene.commit_hash": "",
        "scene.description": `step ${t.step}: d ${t.d_before}→${t.d_after}`,
      },
    });

    return out;
  });

  const span = {
    trace_id,
    span_id,
    parent_span_id: null,
    name: `arc.${taskId}.${result.solver}`,
    start_time_ns: start_ns,
    end_time_ns: end_ns,
    kind: 0,
    status: { code: result.success ? 0 : 2 },
    attributes: {
      "bench.task_id": taskId,
      "bench.solver": result.solver,
      "bench.model": result.model ?? null,
      "bench.success": result.success,
      "bench.steps": result.steps,
      "bench.d_initial": result.d_initial,
      "bench.d_final": result.d_final,
      "bench.duration_ms": result.duration_ms,
    },
    events,
  };

  return JSON.stringify(span) + "\n";
}

function randomHex(n: number): string {
  let s = "";
  for (let i = 0; i < n; i++) s += "0123456789abcdef"[Math.floor(Math.random() * 16)];
  return s;
}

// ---------------------------------------------------------------------------

async function main() {
  const args = parseArgs();

  if (args.solver === "llm" && !process.env.ANTHROPIC_API_KEY) {
    console.error("ANTHROPIC_API_KEY not set");
    process.exit(1);
  }

  const tasks = args.all ? listPuzzles() : (args.task ? [args.task] : []);
  if (tasks.length === 0) {
    console.error("specify --task <id> or --all");
    console.error("available:", listPuzzles().join(", "));
    process.exit(1);
  }

  const results: SolveResult[] = [];
  for (const taskId of tasks) {
    try {
      results.push(await runOne(taskId, args));
    } catch (e) {
      console.error(`  ✗ ${taskId} threw:`, e);
    }
  }

  // Summary
  if (results.length > 1) {
    console.log("\n=== Summary ===");
    const ok = results.filter(r => r.success).length;
    console.log(`solver: ${args.solver}${args.solver === "llm" ? ` (${args.model})` : ""}`);
    console.log(`tasks:  ${ok}/${results.length} solved`);
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
