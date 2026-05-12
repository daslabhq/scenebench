/**
 * scenebench — open harness for running, measuring, and visualizing
 * agent benchmarks. Adapters for AutomationBench, τ-bench, LeRobot,
 * WorkArena, SWE-bench. Pairs with scene-otel and scenecast — also
 * delivers scenecast vendor extensions (Gmail, Slack, Salesforce, …)
 * for the benchmark domains it covers.
 */

export type { SceneEvent, BenchRun, Metric, RunSummary } from "./types.js";
export { parseSpan, parseJsonl } from "./parse.js";
export * as evaluators from "./evaluators/index.js";
export * as reporters from "./reporters/index.js";
