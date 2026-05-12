/**
 * Salesforce — contacts, accounts, opportunities, cases.
 */

import { defineAsset } from "scenecast";
import { defineView } from "scenecast";
import { TableView, MetricView } from "scenecast/views/primitives.js";

export interface SalesforceContact {
  Id:         string;
  FirstName:  string;
  LastName:   string;
  Email?:     string;
  Phone?:     string;
  AccountId?: string;
  Title?:     string;
}

export interface SalesforceOpportunity {
  Id:         string;
  Name:       string;
  Stage:      string;
  Amount?:    number;
  CloseDate?: string;
  AccountId?: string;
}

export interface SalesforceCase {
  Id:        string;
  Subject:   string;
  Priority:  string;
  Status:    string;
  AccountId?: string;
}

export interface SalesforceAccount {
  Id:    string;
  Name:  string;
  Tier?: string;
}

export interface SalesforceState {
  contacts:      SalesforceContact[];
  opportunities: SalesforceOpportunity[];
  cases:         SalesforceCase[];
  accounts:      SalesforceAccount[];
}

const PipelineView = defineView<SalesforceState>({
  name: "SalesforcePipeline",
  toHTML(s) {
    const open = s.opportunities.filter(o => !/closed/i.test(o.Stage));
    const won  = s.opportunities.filter(o => /won/i.test(o.Stage));
    const totalOpen = open.reduce((acc, o) => acc + (o.Amount ?? 0), 0);
    const totalWon  = won.reduce((acc, o) => acc + (o.Amount ?? 0), 0);
    return `<div class="ws-grid-2">
      ${MetricView.toHTML({ value: `$${(totalOpen / 1000).toFixed(0)}k`, label: "Open pipeline", unit: "" })}
      ${MetricView.toHTML({ value: `$${(totalWon  / 1000).toFixed(0)}k`, label: "Closed won (this period)" })}
    </div>
    ${TableView.toHTML({
      title: "Opportunities",
      rows: s.opportunities.map(o => ({
        Name: o.Name,
        Stage: o.Stage,
        Amount: o.Amount ? `$${o.Amount.toLocaleString()}` : "—",
        Close: o.CloseDate ?? "",
      })),
    })}`;
  },
  toMarkdown(s) {
    return TableView.toMarkdown({
      title: "Salesforce Pipeline",
      rows: s.opportunities.map(o => ({
        Name: o.Name, Stage: o.Stage, Amount: o.Amount ? `$${o.Amount}` : "—",
      })),
    });
  },
});

const ContactsView = defineView<SalesforceState>({
  name: "SalesforceContacts",
  toHTML(s) {
    return TableView.toHTML({
      title: `${s.contacts.length} contacts`,
      columns: ["Name", "Email", "Phone", "Title"],
      rows: s.contacts.map(c => ({
        Name: `${c.FirstName} ${c.LastName}`,
        Email: c.Email ?? "",
        Phone: c.Phone ?? "",
        Title: c.Title ?? "",
      })),
    });
  },
  toMarkdown(s) {
    return TableView.toMarkdown({
      title: "Contacts",
      rows: s.contacts.map(c => ({
        Name:  `${c.FirstName} ${c.LastName}`,
        Email: c.Email ?? "",
        Title: c.Title ?? "",
      })),
    });
  },
});

export const Salesforce = defineAsset<SalesforceState>({
  type: "salesforce/account",
  extends: ["contact/list"],
  description: "Salesforce CRM — contacts, opportunities, cases, accounts.",
  schema: {
    type: "object",
    properties: {
      contacts:      { type: "array" },
      opportunities: { type: "array" },
      cases:         { type: "array" },
      accounts:      { type: "array" },
    },
  },
  defaultView: PipelineView,
  views: { contacts: ContactsView },
  secretFields: ["session_id", "access_token"],
  mockState: () => ({
    contacts: [
      { Id: "c1", FirstName: "Jordan",  LastName: "Lee",   Email: "jordan@acme.com",   Phone: "+1-555-0101", Title: "Director of Ops" },
      { Id: "c2", FirstName: "Maria",   LastName: "Santos", Email: "maria@brightwave.com", Phone: "+1-555-0182", Title: "VP Marketing" },
      { Id: "c3", FirstName: "Aiden",   LastName: "Park",  Email: "aiden@meridian.com", Phone: "+1-555-0301", Title: "CEO" },
    ],
    opportunities: [
      { Id: "o1", Name: "Meridian Corp Platform Deal",   Stage: "Closed Won",       Amount: 245_000, CloseDate: "2026-04-28", AccountId: "a1" },
      { Id: "o2", Name: "Acme Quarterly Renewal",        Stage: "Negotiation",      Amount: 84_000,  CloseDate: "2026-05-15", AccountId: "a2" },
      { Id: "o3", Name: "Brightwave Expansion",          Stage: "Proposal",         Amount: 32_000,  CloseDate: "2026-06-01", AccountId: "a3" },
      { Id: "o4", Name: "Helion Pilot",                  Stage: "Discovery",        Amount: 12_000,  CloseDate: "2026-06-20" },
    ],
    cases: [
      { Id: "case-981", Subject: "API rate limits hit during sync", Priority: "High",   Status: "Open" },
      { Id: "case-1021", Subject: "Outdated invoice address",       Priority: "Low",    Status: "Open" },
    ],
    accounts: [
      { Id: "a1", Name: "Meridian Corp",  Tier: "Enterprise" },
      { Id: "a2", Name: "Acme Inc.",      Tier: "Mid-Market" },
      { Id: "a3", Name: "Brightwave",     Tier: "SMB" },
    ],
  }),
});
