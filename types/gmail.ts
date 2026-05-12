/**
 * Gmail — inbox, drafts, sent, threads.
 *
 * Schema borrowed from AutomationBench's Pydantic GmailState (MIT). The
 * default view summarizes the inbox; alternates render single threads
 * and drafts.
 */

import { defineAsset } from "scenecast";
import { defineView, escapeHtml, truncate } from "scenecast";
import { ListView, KeyValueView } from "scenecast/views/primitives.js";

export interface GmailMessage {
  id:           string;
  thread_id?:   string;
  from_:        string;
  to:           string[];
  subject:      string;
  body_plain?:  string;
  date?:        string;
  is_read?:     boolean;
  label_ids?:   string[];
}

export interface GmailDraft {
  id:        string;
  to:        string[];
  subject:   string;
  body_plain?: string;
  date?:     string;
}

export interface GmailState {
  messages: GmailMessage[];
  drafts:   GmailDraft[];
  labels:   Array<{ id: string; name: string }>;
}

const InboxView = defineView<GmailState>({
  name: "GmailInbox",
  description: "Compact summary of inbox + drafts.",
  toHTML(s) {
    const unread = s.messages.filter(m => !m.is_read).length;
    return ListView.toHTML({
      title: `Inbox · ${s.messages.length} messages${unread ? ` · ${unread} unread` : ""}`,
      items: s.messages.slice(0, 20).map(m => ({
        title: m.subject || "(no subject)",
        subtitle: m.from_,
        detail: truncate(m.body_plain ?? "", 140),
        badge: m.is_read ? undefined : "unread",
      })),
      empty: "no messages",
    });
  },
  toMarkdown(s) {
    const unread = s.messages.filter(m => !m.is_read).length;
    return ListView.toMarkdown({
      title: `Inbox (${s.messages.length} messages, ${unread} unread)`,
      items: s.messages.slice(0, 20).map(m => ({
        title: m.subject || "(no subject)",
        subtitle: `from ${m.from_}${m.is_read ? "" : " · unread"}`,
      })),
    });
  },
});

const DraftsView = defineView<GmailState>({
  name: "GmailDrafts",
  toHTML(s) {
    return ListView.toHTML({
      title: `Drafts · ${s.drafts.length}`,
      items: s.drafts.map(d => ({
        title: d.subject || "(no subject)",
        subtitle: `to ${d.to.join(", ")}`,
        detail: truncate(d.body_plain ?? "", 200),
      })),
      empty: "no drafts",
    });
  },
  toMarkdown(s) {
    if (s.drafts.length === 0) return "**Drafts**: none";
    return s.drafts.map(d =>
      `**Draft to ${d.to.join(", ")}** — ${d.subject}\n\n> ${truncate(d.body_plain ?? "", 200)}`
    ).join("\n\n");
  },
});

export const Gmail = defineAsset<GmailState>({
  type: "gmail/account",
  extends: ["email/mailbox"],
  description: "A Gmail mailbox — inbox, drafts, threads, labels.",
  schema: {
    type: "object",
    properties: {
      messages: { type: "array" },
      drafts:   { type: "array" },
      labels:   { type: "array" },
    },
    required: ["messages", "drafts", "labels"],
  },
  defaultView: InboxView,
  views: { drafts: DraftsView },
  secretFields: ["access_token", "refresh_token"],
  mockState: () => ({
    messages: [
      { id: "m1", from_: "alice@vendor.com",     to: ["me@x.com"], subject: "Invoice #4421 — overdue",          body_plain: "Hi, just a heads up the invoice for $1,240 is past due. Can you confirm payment?", is_read: false, date: "2026-04-30T08:14:00Z" },
      { id: "m2", from_: "ceo@company.com",      to: ["me@x.com"], subject: "Quick question about Q2 plan",     body_plain: "Got a sec to chat about the launch timeline for the new product?",                  is_read: false, date: "2026-04-30T07:55:00Z" },
      { id: "m3", from_: "alerts@stripe.com",    to: ["me@x.com"], subject: "Payout completed: $1,200",         body_plain: "Your payout of $1,200 has been deposited.",                                          is_read: false, date: "2026-04-30T06:30:00Z" },
      { id: "m4", from_: "newsletter@nyt.com",   to: ["me@x.com"], subject: "Morning briefing — Apr 30",        body_plain: "Top stories: …",                                                                     is_read: true,  date: "2026-04-30T05:00:00Z" },
      { id: "m5", from_: "bob@team.com",         to: ["me@x.com"], subject: "Re: standup notes",                body_plain: "Adding two things to the agenda.",                                                   is_read: true,  date: "2026-04-29T22:01:00Z" },
    ],
    drafts: [
      { id: "d1", to: ["alice@vendor.com"], subject: "Re: Invoice #4421", body_plain: "Hi Alice — confirming we'll process this today. Apologies for the delay." },
    ],
    labels: [{ id: "INBOX", name: "Inbox" }, { id: "BILLING", name: "Billing" }],
  }),
});
