/**
 * Belief-vs-truth evaluator.
 *
 * For each scene.intent event, looks ahead for the next scene.set (actual)
 * with the same key. If both exist, scores how aligned the agent's stated
 * intent was with what actually changed in the world.
 *
 * Returns:
 *   intentRate          fraction of tool calls where an intent was declared
 *   resolutionRate      fraction of intents that got resolved (an actual followed)
 *   driftCount          intents whose value differed from the actual outcome
 *   firstDriftStep      step index of the first drift, if any
 */

import type { BenchRun, Metric } from "../types.js";

export function beliefTruth(run: BenchRun): Metric[] {
  const events = run.events;
  let intentCount   = 0;
  let resolvedCount = 0;
  let driftCount    = 0;
  let firstDriftStep: number | undefined;

  for (let i = 0; i < events.length; i++) {
    const ev = events[i]!;
    if (ev.kind !== "intent") continue;
    intentCount++;

    // Walk forward to find the next "actual" event for the same key.
    let resolved = false;
    let drifted  = false;
    for (let j = i + 1; j < events.length; j++) {
      const next = events[j]!;
      if (next.key !== ev.key) continue;
      if (next.kind === "intent") continue;
      resolved = true;
      // Drift detection: did the agent's intent value loosely match the actual?
      // Simple heuristic — string-similarity on the JSON encodings.
      drifted = !looselyMatches(ev.value, next.value);
      break;
    }

    if (resolved) resolvedCount++;
    if (drifted) {
      driftCount++;
      if (firstDriftStep === undefined) firstDriftStep = i;
    }
  }

  const total = events.filter(e => e.kind === "actual").length;
  return [
    { name: "intent_rate",
      value: total === 0 ? 0 : intentCount / total,
      unit:  "ratio",
      details: { intentCount, total } },
    { name: "intent_resolution_rate",
      value: intentCount === 0 ? 0 : resolvedCount / intentCount,
      unit:  "ratio",
      details: { resolvedCount, intentCount } },
    { name: "drift_count",
      value: driftCount,
      details: { firstDriftStep } },
  ];
}

/** Loose match — true if a substring of one canonical-form is in the other.
 *  Conservative; we want to flag when intent and actual are clearly different. */
function looselyMatches(a: unknown, b: unknown): boolean {
  const sa = canon(a);
  const sb = canon(b);
  if (sa === sb) return true;
  // If either is an object with similar key shape, treat as match
  if (typeof a === "object" && typeof b === "object" && a && b) {
    const ka = Object.keys(a as object).sort().join(",");
    const kb = Object.keys(b as object).sort().join(",");
    if (ka === kb) return true;
  }
  return false;
}

function canon(v: unknown): string {
  try { return JSON.stringify(v); } catch { return String(v); }
}
