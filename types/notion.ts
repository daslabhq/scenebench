/**
 * Notion — pages and database rows.
 */

import { defineAsset } from "scenecast";
import { defineView } from "scenecast";
import { ListView, DocumentView } from "scenecast/views/primitives.js";

export interface NotionPage {
  id:    string;
  title: string;
  body?: string;
  parent_id?: string;
  last_edited_at?: string;
  tags?: string[];
}

export interface NotionState {
  pages: NotionPage[];
}

const RecentPagesView = defineView<NotionState>({
  name: "NotionRecentPages",
  toHTML(s) {
    const sorted = [...s.pages].sort((a, b) => (b.last_edited_at ?? "").localeCompare(a.last_edited_at ?? ""));
    if (sorted[0]) {
      const featured = DocumentView.toHTML({
        title: sorted[0].title,
        body:  sorted[0].body ?? "",
        meta:  sorted[0].last_edited_at ? `last edited ${sorted[0].last_edited_at}` : "",
      });
      const more = ListView.toHTML({
        title: "Other pages",
        items: sorted.slice(1, 10).map(p => ({
          title: p.title,
          subtitle: p.last_edited_at,
          badge: p.tags?.[0],
        })),
      });
      return featured + more;
    }
    return ListView.toHTML({ title: "Pages", items: [], empty: "no pages" });
  },
  toMarkdown(s) {
    return ListView.toMarkdown({
      title: "Notion pages",
      items: s.pages.slice(0, 10).map(p => ({
        title: p.title, subtitle: p.last_edited_at,
      })),
    });
  },
});

export const Notion = defineAsset<NotionState>({
  type: "notion/workspace",
  extends: ["document/collection"],
  description: "Notion — pages, databases, blocks.",
  schema: { type: "object", properties: { pages: { type: "array" } } },
  defaultView: RecentPagesView,
  secretFields: ["integration_token"],
  mockState: () => ({
    pages: [
      { id: "p1", title: "Q2 launch plan", tags: ["plan"], last_edited_at: "2026-04-30",
        body: "Overview\n\nWe're shipping the new release in three phases. Phase 1 (May 6) covers the core SDK; phase 2 (May 20) adds the new dashboard; phase 3 (June 3) brings the integration suite to general availability." },
      { id: "p2", title: "On-call runbook", tags: ["ops"],  last_edited_at: "2026-04-29" },
      { id: "p3", title: "Customer feedback · April",       tags: ["research"], last_edited_at: "2026-04-28" },
      { id: "p4", title: "Weekly metrics",                  tags: ["metrics"], last_edited_at: "2026-04-26" },
      { id: "p5", title: "Hiring · Senior Eng",             tags: ["hr"],     last_edited_at: "2026-04-22" },
    ],
  }),
});
