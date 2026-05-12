/**
 * AutomationBench → SceneGradEnv wrapper.
 *
 * Loads any AB task from /tasks/<slug>.json, exposes it as a scenegrad
 * env. Assertions translated via assertions.ts. Tools are enumerated
 * from zapier_tools but with stub semantics — for v0.0.1 we support
 * the 4-5 tools needed for the simple-task family. Other tasks need
 * the Python adapter (Verifiers env) for real execution.
 *
 * For observer-mode use (your agent runs the tools elsewhere), the
 * env is fully functional — just wire the watcher's snapshot to
 * read your real-world state.
 */

import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type { SceneGradEnv, Goal, StepResult, ToolCall, Assertion } from "scenegrad";
import { type ABWorld, translateAssertions } from "./assertions.js";
import { applyTool, listToolNames } from "./tools.js";

export interface ABTask {
  example_id:  number;
  task:        string;
  prompt:      Array<{ role: string; content: string }>;
  answer:      string;
  info: {
    zapier_tools:  string[];
    initial_state: ABWorld;
    assertions:    any[];
  };
}

export class AutomationBenchEnv implements SceneGradEnv<ABWorld, ToolCall> {
  private state!:    ABWorld;
  private task!:     ABTask;
  private assertions!: Assertion<ABWorld>[];

  reset(taskId?: string): ABWorld {
    if (!taskId) throw new Error("AutomationBenchEnv.reset requires a task id");
    this.task = loadTask(taskId);
    // Deep clone so tools mutate our copy, not the canonical fixture.
    this.state = structuredClone(this.task.info.initial_state);
    this.assertions = translateAssertions(this.task.info.assertions);
    return this.state;
  }

  scene(): ABWorld { return this.state; }

  goal(): Goal<ABWorld> {
    return { assertions: this.assertions };
  }

  tools(): ToolCall[] {
    // For pure-data execution we expose only the tools we have semantics for.
    // The full zapier_tools list is available via this.task.info.zapier_tools
    // for users who want to run via their own executor.
    const supported = listToolNames();
    return this.task.info.zapier_tools
      .filter(t => supported.includes(t))
      .map(name => ({ name, args: {} }));
  }

  /** All zapier tool names declared by the task — including ones we don't
   *  have TS semantics for. Callers running their own executor should use
   *  this list rather than tools(). */
  declaredTools(): string[] {
    return this.task.info.zapier_tools;
  }

  step(tool: ToolCall): StepResult<ABWorld> {
    try {
      const out = applyTool(this.state, tool);
      this.state = out;
      return { scene_after: out, ok: true };
    } catch (e) {
      return { scene_after: this.state, ok: false, error: String(e) };
    }
  }

  done(): boolean {
    return this.assertions.every(a => a.check(this.state).satisfied);
  }

  simulate(tool: ToolCall): StepResult<ABWorld> {
    try {
      const out = applyTool(structuredClone(this.state), tool);
      return { scene_after: out, ok: true };
    } catch (e) {
      return { scene_after: this.state, ok: false, error: String(e) };
    }
  }

  /** The original user prompt for the task — pass to your agent. */
  userPrompt(): string {
    const userMsg = this.task.prompt.find(p => p.role === "user");
    return userMsg?.content ?? "";
  }

  /** The system prompt from the task definition. */
  systemPrompt(): string {
    const sysMsg = this.task.prompt.find(p => p.role === "system");
    return sysMsg?.content ?? "";
  }

  /** All metadata for the task. Useful for logging / display. */
  meta(): { id: string; example_id: number; declared_tools: string[]; assertions: any[] } {
    return {
      id:             this.task.task,
      example_id:     this.task.example_id,
      declared_tools: this.task.info.zapier_tools,
      assertions:     this.task.info.assertions,
    };
  }
}

// ---------------------------------------------------------------------------
// Task loading — reads from adapters/automationbench/tasks/<slug>.json
// ---------------------------------------------------------------------------

const HERE = dirname(fileURLToPath(import.meta.url));
const TASK_DIR = join(HERE, "..", "..", "adapters", "automationbench", "tasks");

export function loadTask(taskOrSlug: string): ABTask {
  // Accept both "simple.email_sf_contact_phone_update" and the slug form.
  const slug = taskOrSlug.replace(/\./g, "_");
  const path = join(TASK_DIR, `${slug}.json`);
  return JSON.parse(readFileSync(path, "utf8"));
}
