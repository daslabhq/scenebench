/**
 * Google Sheets — spreadsheets + worksheets + rows.
 */

import { defineAsset } from "scenecast";
import { defineView } from "scenecast";
import { TableView, ListView } from "scenecast/views/primitives.js";

export interface SheetsRow {
  row_id: number;
  cells:  Record<string, string | number>;
}

export interface SheetsWorksheet {
  id:     string;
  title:  string;
  rows:   SheetsRow[];
}

export interface SheetsSpreadsheet {
  id:    string;
  title: string;
  worksheets: SheetsWorksheet[];
}

export interface SheetsState {
  spreadsheets: SheetsSpreadsheet[];
}

const OverviewView = defineView<SheetsState>({
  name: "SheetsOverview",
  toHTML(s) {
    const items = s.spreadsheets.flatMap(ss =>
      ss.worksheets.map(w => ({
        title: `${ss.title} · ${w.title}`,
        subtitle: `${w.rows.length} row${w.rows.length === 1 ? "" : "s"}`,
        detail: w.rows[0]
          ? "Columns: " + Object.keys(w.rows[0].cells).join(", ")
          : "(empty)",
      }))
    );
    const first = s.spreadsheets[0]?.worksheets[0];
    const preview = first
      ? TableView.toHTML({
          title: `${s.spreadsheets[0]!.title} · ${first.title}`,
          rows: first.rows.map(r => r.cells as Record<string, unknown>),
        })
      : "";
    return ListView.toHTML({ title: "Worksheets", items }) + preview;
  },
  toMarkdown(s) {
    const lines = s.spreadsheets.flatMap(ss =>
      ss.worksheets.map(w => `- **${ss.title} / ${w.title}** — ${w.rows.length} rows`)
    );
    return `**Sheets**\n\n${lines.join("\n")}`;
  },
});

export const GoogleSheets = defineAsset<SheetsState>({
  type: "google_sheets/account",
  // (no canonical type; vendor-specific shape)
  description: "Google Sheets — spreadsheets, worksheets, rows.",
  schema: {
    type: "object",
    properties: { spreadsheets: { type: "array" } },
  },
  defaultView: OverviewView,
  secretFields: ["access_token"],
  mockState: () => ({
    spreadsheets: [
      {
        id: "ss_rates", title: "FX Rates",
        worksheets: [{
          id: "w1", title: "Rates",
          rows: [
            { row_id: 1, cells: { Currency: "EUR", USDRate: 1.10, Updated: "2026-04-10" } },
            { row_id: 2, cells: { Currency: "GBP", USDRate: 1.27, Updated: "2026-04-10" } },
            { row_id: 3, cells: { Currency: "JPY", USDRate: 0.0067, Updated: "2026-04-10" } },
          ],
        }],
      },
      {
        id: "ss_acct", title: "Account Hierarchy",
        worksheets: [{
          id: "w1", title: "Tiers",
          rows: [
            { row_id: 1, cells: { Account: "Meridian Corp",  Tier: "Enterprise" } },
            { row_id: 2, cells: { Account: "Acme Inc.",      Tier: "Mid-Market" } },
            { row_id: 3, cells: { Account: "Brightwave",     Tier: "SMB" } },
          ],
        }],
      },
    ],
  }),
});
