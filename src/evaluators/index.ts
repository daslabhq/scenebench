/**
 * Evaluator registry — runs metrics over a BenchRun.
 *
 * Each evaluator is a pure function (BenchRun) → Metric[]. Add new
 * evaluators here by exporting them and registering in evaluateRun.
 */

import type { BenchRun, Metric } from "../types.js";
import { beliefTruth } from "./belief_truth.js";

export { beliefTruth };

/** Run all evaluators over one run, returning a flat list of metrics. */
export function evaluateRun(run: BenchRun): Metric[] {
  return [
    ...beliefTruth(run),
    ...basicStats(run),
  ];
}

/** Free metrics that fall out of the run shape. */
function basicStats(run: BenchRun): Metric[] {
  const totalEvents  = run.events.length;
  const intentCount  = run.events.filter(e => e.kind === "intent").length;
  const actualCount  = run.events.filter(e => e.kind === "actual").length;
  const distinctKeys = new Set(run.events.map(e => e.key)).size;
  return [
    { name: "events_total",        value: totalEvents },
    { name: "events_intent",       value: intentCount },
    { name: "events_actual",       value: actualCount },
    { name: "scene_keys_distinct", value: distinctKeys },
  ];
}
