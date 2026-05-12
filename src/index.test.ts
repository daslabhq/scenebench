/**
 * End-to-end smoke test — parse a JSONL fixture from scene-otel's real
 * AutomationBench run, evaluate it, render a markdown report.
 */

import { test, expect, describe } from "bun:test";
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { parseJsonl, evaluators, reporters } from "./index.js";

// A minimal handcrafted fixture — one span with intent + actual events.
const FIXTURE = JSON.stringify({
  trace_id: "abc",
  span_id:  "def",
  name:     "simple.email_sf_contact_phone_update",
  start_time_ns: 1000000000n.toString(),
  end_time_ns:   3000000000n.toString(),
  attributes: {},
  events: [
    {
      name: "scene.set",
      time_ns: 1100000000,
      attributes: {
        "scene.key": "request", "scene.kind": "actual",
        "scene.value": JSON.stringify("Find the email and update phone"),
        "scene.value.type": "text", "scene.value.size": 32, "scene.commit_hash": "h1",
      },
    },
    {
      name: "scene.set",
      time_ns: 1200000000,
      attributes: {
        "scene.key": "gmail", "scene.kind": "intent",
        "scene.value": JSON.stringify({ tool: "gmail_find_email", args: { query: "Jordan Lee" } }),
        "scene.value.type": "json", "scene.value.size": 80, "scene.commit_hash": "h2",
        "scene.description": "gmail_find_email",
      },
    },
    {
      name: "scene.set",
      time_ns: 1300000000,
      attributes: {
        "scene.key": "gmail", "scene.kind": "actual",
        "scene.value": JSON.stringify({ messages: [{ id: "m1", from: "jordan@x" }] }),
        "scene.value.type": "json", "scene.value.size": 60, "scene.commit_hash": "h3",
      },
    },
    {
      name: "scene.set",
      time_ns: 1400000000,
      attributes: {
        "scene.key": "salesforce", "scene.kind": "intent",
        "scene.value": JSON.stringify({ tool: "salesforce_contact_update", args: { id: "c1", phone: "+1-555-0101" } }),
        "scene.value.type": "json", "scene.value.size": 90, "scene.commit_hash": "h4",
        "scene.description": "salesforce_contact_update",
      },
    },
    {
      name: "scene.set",
      time_ns: 1500000000,
      attributes: {
        "scene.key": "salesforce", "scene.kind": "actual",
        "scene.value": JSON.stringify({ contacts: [{ Id: "c1", Phone: "+1-555-0101" }] }),
        "scene.value.type": "json", "scene.value.size": 65, "scene.commit_hash": "h5",
      },
    },
  ],
});

describe("end-to-end pipeline", () => {
  const dir = mkdirSync(join(tmpdir(), `scenebench-test-${Date.now()}`), { recursive: true })!;
  const file = join(dir, "fixture.jsonl");
  writeFileSync(file, FIXTURE);

  const runs = parseJsonl(file, "test");

  test("parses to a BenchRun", () => {
    expect(runs).toHaveLength(1);
    const run = runs[0]!;
    expect(run.task).toBe("simple.email_sf_contact_phone_update");
    expect(run.events).toHaveLength(5);
    expect(run.events[0]!.key).toBe("request");
    expect(run.events[1]!.kind).toBe("intent");
  });

  test("belief-truth evaluator reports metrics", () => {
    const metrics = evaluators.beliefTruth(runs[0]!);
    const m = Object.fromEntries(metrics.map(x => [x.name, x.value]));
    expect(m["intent_rate"]).toBeGreaterThan(0);
    expect(m["intent_resolution_rate"]).toBe(1);   // both intents resolved
  });

  test("evaluateRun returns combined metrics", () => {
    const metrics = evaluators.evaluateRun(runs[0]!);
    const names = metrics.map(m => m.name);
    expect(names).toContain("events_total");
    expect(names).toContain("events_intent");
    expect(names).toContain("intent_rate");
  });

  test("markdown reporter produces a leaderboard row", () => {
    const md = reporters.toMarkdown([{ run: runs[0]!, metrics: evaluators.evaluateRun(runs[0]!) }]);
    expect(md).toContain("simple.email_sf_contact_phone_update");
    expect(md).toContain("| task |");
  });
});
