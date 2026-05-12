/**
 * Parse JSONL OTel traces (the format emitted by adapters) into BenchRun objects.
 */

import { readFileSync } from "node:fs";
import type { BenchRun, SceneEvent } from "./types.js";

/** Parse a single span (one JSONL line) into a BenchRun. */
export function parseSpan(spanJson: string, source = "unknown"): BenchRun | null {
  let s: any;
  try { s = JSON.parse(spanJson); } catch { return null; }
  if (!s.events) return null;

  const events: SceneEvent[] = [];
  for (const ev of s.events) {
    if (ev.name !== "scene.set") continue;
    const a = ev.attributes ?? {};
    let value: unknown;
    try { value = JSON.parse(a["scene.value"]); } catch { value = a["scene.value"]; }
    events.push({
      traceId:     s.trace_id ?? "",
      traceName:   s.name ?? "",
      timestampNs: ev.time_ns ?? 0,
      key:         a["scene.key"],
      kind:        a["scene.kind"] ?? "actual",
      type:        a["scene.value.type"] ?? "json",
      value,
      size:        a["scene.value.size"] ?? 0,
      commitHash:  a["scene.commit_hash"] ?? "",
      description: a["scene.description"],
    });
  }
  events.sort((a, b) => a.timestampNs - b.timestampNs);

  return {
    task:        s.name ?? "unknown",
    source,
    durationMs:  s.start_time_ns && s.end_time_ns
                   ? Math.round((s.end_time_ns - s.start_time_ns) / 1e6)
                   : undefined,
    events,
  };
}

/** Parse a JSONL file containing one or more BenchRuns. */
export function parseJsonl(path: string, source = "unknown"): BenchRun[] {
  const text = readFileSync(path, "utf8");
  const out: BenchRun[] = [];
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim()) continue;
    const run = parseSpan(line, source);
    if (run) out.push(run);
  }
  return out;
}
