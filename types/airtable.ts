/**
 * Airtable — bases, tables, records.
 */

import { defineAsset } from "scenecast";
import { defineView } from "scenecast";
import { TableView } from "scenecast/views/primitives.js";

export interface AirtableRecord {
  id:     string;
  fields: Record<string, unknown>;
}

export interface AirtableTable {
  id:      string;
  name:    string;
  records: AirtableRecord[];
}

export interface AirtableBase {
  id:    string;
  name:  string;
  tables: AirtableTable[];
}

export interface AirtableState {
  bases: AirtableBase[];
}

const RecordsView = defineView<AirtableState>({
  name: "AirtableRecords",
  toHTML(s) {
    return s.bases.map(b =>
      b.tables.map(t =>
        TableView.toHTML({
          title: `${b.name} · ${t.name} · ${t.records.length} records`,
          rows: t.records.map(r => r.fields as Record<string, unknown>),
        })
      ).join("")
    ).join("");
  },
  toMarkdown(s) {
    return s.bases.flatMap(b => b.tables.map(t =>
      TableView.toMarkdown({
        title: `${b.name} / ${t.name}`,
        rows: t.records.map(r => r.fields as Record<string, unknown>),
      })
    )).join("\n\n");
  },
});

export const Airtable = defineAsset<AirtableState>({
  type: "airtable/account",
  extends: ["contact/list"],
  description: "Airtable — bases, tables, records.",
  schema: { type: "object", properties: { bases: { type: "array" } } },
  defaultView: RecordsView,
  secretFields: ["api_key"],
  mockState: () => ({
    bases: [{
      id: "base_ops", name: "Operations",
      tables: [{
        id: "tbl_visitors", name: "Visitors",
        records: [
          { id: "rec_104", fields: { Name: "Q. Nguyen", Date: "2026-04-29", Host: "ops-1", "NDA on file": false } },
          { id: "rec_105", fields: { Name: "L. Chen",   Date: "2026-04-30", Host: "ops-1", "NDA on file": true  } },
          { id: "rec_106", fields: { Name: "M. Patel",  Date: "2026-04-30", Host: "ops-2", "NDA on file": false } },
        ],
      }],
    }, {
      id: "base_crm", name: "CRM",
      tables: [{
        id: "tbl_contacts", name: "Contacts",
        records: [
          { id: "ct_1", fields: { Name: "Alex Rivera",      Company: "Acme",       Stage: "MQL"      } },
          { id: "ct_2", fields: { Name: "Sam Patel",        Company: "Globex",     Stage: "SQL"      } },
        ],
      }],
    }],
  }),
});
