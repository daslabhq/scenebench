/**
 * Render a list of evaluated runs as a Markdown leaderboard / summary.
 *
 * Useful for: README inserts, GitHub PR comments, Slack updates.
 */

import type { BenchRun, Metric } from "../types.js";

export interface ReportedRun {
  run:     BenchRun;
  metrics: Metric[];
}

export function toMarkdown(reports: ReportedRun[]): string {
  if (reports.length === 0) return "_(no runs)_";
  const rows = reports.map(({ run, metrics }) => {
    const m = metrics.reduce<Record<string, number>>((acc, x) => { acc[x.name] = x.value; return acc; }, {});
    return {
      task:     run.task,
      reward:   run.reward != null ? run.reward.toFixed(2) : "—",
      tokens:   run.tokens ? `${run.tokens.input}+${run.tokens.output}` : "—",
      events:   m["events_total"] ?? 0,
      intents:  m["events_intent"] ?? 0,
      drifts:   m["drift_count"] ?? 0,
      duration: run.durationMs != null ? `${run.durationMs}ms` : "—",
    };
  });
  const header = "| task | reward | tokens | events | intents | drifts | duration |";
  const sep    = "|---|---|---|---|---|---|---|";
  const body   = rows.map(r => `| ${r.task} | ${r.reward} | ${r.tokens} | ${r.events} | ${r.intents} | ${r.drifts} | ${r.duration} |`).join("\n");
  return `${header}\n${sep}\n${body}`;
}
