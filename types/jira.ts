/**
 * Jira — projects, issues, sprints.
 */

import { defineAsset } from "scenecast";
import { defineView } from "scenecast";
import { TableView, MetricView, ListView } from "scenecast/views/primitives.js";

export interface JiraIssue {
  key:        string;
  summary:    string;
  status:     "To Do" | "In Progress" | "In Review" | "Done" | "Blocked";
  assignee?:  string;
  priority?:  "Highest" | "High" | "Medium" | "Low" | "Lowest";
  story_points?: number;
}

export interface JiraSprint {
  id:        string;
  name:      string;
  state:     "future" | "active" | "closed";
  start_date?: string;
  end_date?:   string;
}

export interface JiraState {
  projects: Array<{ key: string; name: string }>;
  issues:   JiraIssue[];
  sprints:  JiraSprint[];
}

const SprintBoardView = defineView<JiraState>({
  name: "JiraSprintBoard",
  toHTML(s) {
    const byStatus = (status: JiraIssue["status"]) => s.issues.filter(i => i.status === status);
    const counts = {
      "To Do":       byStatus("To Do").length,
      "In Progress": byStatus("In Progress").length,
      "In Review":   byStatus("In Review").length,
      "Done":        byStatus("Done").length,
      "Blocked":     byStatus("Blocked").length,
    };
    const total   = s.issues.length;
    const done    = counts.Done;
    const blocked = counts.Blocked;
    const points  = s.issues.reduce((acc, i) => acc + (i.story_points ?? 0), 0);
    const donePts = s.issues.filter(i => i.status === "Done").reduce((acc, i) => acc + (i.story_points ?? 0), 0);

    return `<div class="ws-grid-3">
      ${MetricView.toHTML({ value: `${done}/${total}`,   label: "Tickets done" })}
      ${MetricView.toHTML({ value: `${donePts}/${points}`, label: "Story points done" })}
      ${MetricView.toHTML({ value: blocked,              label: "Blocked",
                            trend: blocked > 0 ? "down" : "flat" })}
    </div>
    ${TableView.toHTML({
      title: "Issues",
      columns: ["Key", "Summary", "Status", "Assignee", "Pts"],
      rows: s.issues.map(i => ({
        Key: i.key, Summary: i.summary, Status: i.status,
        Assignee: i.assignee ?? "—", Pts: i.story_points ?? "—",
      })),
    })}`;
  },
  toMarkdown(s) {
    return TableView.toMarkdown({
      title: "Sprint board",
      rows: s.issues.map(i => ({ Key: i.key, Summary: i.summary, Status: i.status, Assignee: i.assignee ?? "—" })),
    });
  },
});

export const Jira = defineAsset<JiraState>({
  type: "jira/site",
  extends: ["task/list"],
  description: "Jira — projects, issues, sprints.",
  schema: {
    type: "object",
    properties: { projects: { type: "array" }, issues: { type: "array" }, sprints: { type: "array" } },
  },
  defaultView: SprintBoardView,
  secretFields: ["api_token"],
  mockState: () => ({
    projects: [{ key: "PLAT", name: "Platform" }],
    sprints:  [{ id: "sp-12", name: "Sprint 12", state: "active", start_date: "2026-04-22", end_date: "2026-05-06" }],
    issues: [
      { key: "PLAT-441", summary: "Implement OAuth2 PKCE flow for mobile clients", status: "Done",        assignee: "alice", priority: "High",   story_points: 3 },
      { key: "PLAT-442", summary: "Add request-id header propagation to gateway",   status: "Done",        assignee: "bob",   priority: "High",   story_points: 5 },
      { key: "PLAT-443", summary: "Instrument webhook dispatch with metrics",       status: "In Review",   assignee: "carol", priority: "High",   story_points: 8 },
      { key: "PLAT-444", summary: "Cache CDN assets for 24h",                       status: "In Progress", assignee: "alice", priority: "Medium", story_points: 2 },
      { key: "PLAT-445", summary: "Add p99 latency SLI dashboard",                  status: "To Do",       assignee: "bob",   priority: "High",   story_points: 5 },
      { key: "PLAT-446", summary: "Fix image card aspect-ratio rendering",          status: "Blocked",     assignee: "carol", priority: "Medium", story_points: 3 },
      { key: "PLAT-447", summary: "Docs: REST API authoring guide",                 status: "To Do",       assignee: "alice", priority: "Low",    story_points: 2 },
    ],
  }),
});
