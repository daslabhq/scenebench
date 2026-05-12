/**
 * Core types — what every adapter / bench / evaluator agrees on.
 *
 * The pipeline:
 *
 *    [adapter] → JSONL of OTel spans with scene.set events
 *           ↓
 *    [BenchRun parser]
 *           ↓
 *    [evaluators] → metrics
 *           ↓
 *    [reporters] → leaderboard / markdown / JSONL for the scrubber
 */

/** A single scene.set event extracted from JSONL. */
export interface SceneEvent {
  traceId:     string;
  traceName:   string;
  timestampNs: number;
  key:         string;
  kind:        "actual" | "intent";
  type:        string;       // table / metric / text / image / list / json
  value:       unknown;       // already JSON-parsed
  size:        number;
  commitHash:  string;
  description?: string;
}

/** A complete run of a benchmark task. */
export interface BenchRun {
  /** Task identifier — e.g. "simple.email_sf_contact_phone_update". */
  task:        string;
  /** Adapter or bench that produced the run. */
  source:      string;
  /** Model used. */
  model?:      string;
  /** Reward / score from the benchmark's own rubric (0-1 typically). */
  reward?:     number;
  /** Walk-clock duration of the rollout. */
  durationMs?: number;
  /** Token usage if available. */
  tokens?:     { input: number; output: number };
  /** All scene events emitted during the run, ordered by timestamp. */
  events:      SceneEvent[];
}

/** Metric output from an evaluator. */
export interface Metric {
  name:       string;        // e.g. "belief_truth_accuracy"
  value:      number;
  unit?:      string;        // "%", "s", "tokens", …
  details?:   Record<string, unknown>;
}

/** A summary across many runs (per-model leaderboard row). */
export interface RunSummary {
  model:        string;
  runs:         number;
  passed:       number;
  avgReward:    number;
  avgDurationMs: number;
  totalTokens:  number;
  metrics:      Record<string, number>;
}
