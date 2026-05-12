/**
 * Minimal TS implementations of the most common Zapier tools used in AB.
 *
 * v0.0.1: just enough for the simple-task family (email + Salesforce CRUD).
 * Future: gmail send, slack post, sheets write, calendar create, airtable
 * upsert. For tasks that need tools we don't implement, callers should use
 * the Python adapter (Verifiers env) and the env in observer mode.
 */

import type { ToolCall } from "scenegrad";
import type { ABWorld } from "./assertions.js";

type Handler = (world: ABWorld, args: Record<string, any>) => ABWorld;

// ---------------------------------------------------------------------------
// Gmail
// ---------------------------------------------------------------------------

const gmail_find_email: Handler = (w, args) => {
  // Search side-effect-free. The search "result" is conceptually a return
  // value; for state-tracking purposes we don't mutate the world. Real Zapier
  // would return matching messages; we trust the agent to remember them.
  const msgs = (w.gmail?.messages ?? []).filter((m: any) => {
    if (args.query) {
      const q = String(args.query).toLowerCase();
      return [m.subject, m.from_, m.body_plain]
        .filter(Boolean)
        .some(f => String(f).toLowerCase().includes(q));
    }
    if (args.from) return String(m.from_ ?? "").toLowerCase().includes(String(args.from).toLowerCase());
    if (args.subject) return String(m.subject ?? "").toLowerCase().includes(String(args.subject).toLowerCase());
    return true;
  });
  // Return world unchanged. Agent's tool result is conceptually `msgs`,
  // but our return shape is the world; agent reads the messages from
  // its previous gmail snapshot.
  return w;
};

const gmail_get_email_by_id: Handler = (w, _args) => {
  // Read-only.
  return w;
};

const gmail_send_email: Handler = (w, args) => {
  const msg = {
    id:         `out_${Date.now()}`,
    thread_id:  `out_thr_${Date.now()}`,
    from_:      "agent@company.example.com",
    to:         Array.isArray(args.to) ? args.to : [args.to],
    subject:    args.subject ?? "",
    body_plain: args.body ?? args.body_plain ?? "",
    label_ids:  ["SENT"],
    is_read:    true,
    date:       new Date().toISOString(),
  };
  return {
    ...w,
    gmail: {
      ...(w.gmail ?? {}),
      messages: [...(w.gmail?.messages ?? []), msg],
    },
  };
};

// ---------------------------------------------------------------------------
// Salesforce
// ---------------------------------------------------------------------------

const salesforce_find_records: Handler = (_w, args) => {
  // Read-only.
  return _w;
};

const salesforce_contact_update: Handler = (w, args) => {
  const id = args.id ?? args.record_id ?? args.contact_id;
  const updates = args.fields ?? args.updates ?? args;
  if (!id) throw new Error("salesforce_contact_update needs id");

  const contacts = (w.salesforce?.contacts ?? []).map((c: any) => {
    if (c.id !== id) return c;
    const next = { ...c };
    for (const [k, v] of Object.entries(updates)) {
      if (k === "id" || k === "record_id" || k === "contact_id" || k === "fields" || k === "updates") continue;
      next[k] = v;
    }
    return next;
  });
  return {
    ...w,
    salesforce: { ...(w.salesforce ?? {}), contacts },
  };
};

const salesforce_contact_create: Handler = (w, args) => {
  const id = args.id ?? `003_${Date.now()}`;
  const contact = { id, ...args };
  return {
    ...w,
    salesforce: {
      ...(w.salesforce ?? {}),
      contacts: [...(w.salesforce?.contacts ?? []), contact],
    },
  };
};

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

const HANDLERS: Record<string, Handler> = {
  gmail_find_email,
  gmail_get_email_by_id,
  gmail_send_email,
  salesforce_find_records,
  salesforce_contact_update,
  salesforce_contact_create,
};

export function listToolNames(): string[] {
  return Object.keys(HANDLERS);
}

export function applyTool(world: ABWorld, tool: ToolCall): ABWorld {
  const handler = HANDLERS[tool.name];
  if (!handler) throw new Error(`unknown tool: ${tool.name}`);
  return handler(world, tool.args ?? {});
}
