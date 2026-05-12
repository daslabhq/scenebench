/**
 * Stripe — charges, payouts, customers.
 */

import { defineAsset } from "scenecast";
import { defineView } from "scenecast";
import { TableView, MetricView } from "scenecast/views/primitives.js";

export interface StripeCharge {
  id:        string;
  amount:    number;     // cents
  currency:  string;
  status:    "succeeded" | "failed" | "pending";
  created:   string;
  customer?: string;
  description?: string;
}

export interface StripePayout {
  id:        string;
  amount:    number;     // cents
  currency:  string;
  arrival_date: string;
  status:    "paid" | "in_transit" | "pending";
}

export interface StripeState {
  charges: StripeCharge[];
  payouts: StripePayout[];
  customers: Array<{ id: string; email?: string; name?: string }>;
}

const PaymentsView = defineView<StripeState>({
  name: "StripePayments",
  toHTML(s) {
    const fmt = (cents: number, ccy = "USD") =>
      `${ccy === "USD" ? "$" : ccy + " "}${(cents / 100).toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
    const succ = s.charges.filter(c => c.status === "succeeded");
    const fail = s.charges.filter(c => c.status === "failed");
    const totalSucceeded = succ.reduce((acc, c) => acc + c.amount, 0);
    const failureRate = s.charges.length === 0 ? 0 : (fail.length / s.charges.length) * 100;
    return `<div class="ws-grid-3">
      ${MetricView.toHTML({ value: fmt(totalSucceeded),       label: "Charges (succeeded)" })}
      ${MetricView.toHTML({ value: `${failureRate.toFixed(1)}%`, label: "Failure rate", trend: failureRate > 2 ? "down" : "flat" })}
      ${MetricView.toHTML({ value: s.payouts.length,          label: "Payouts pending" })}
    </div>
    ${TableView.toHTML({
      title: "Recent charges",
      columns: ["Created", "Amount", "Status", "Customer", "Description"],
      rows: s.charges.slice(0, 20).map(c => ({
        Created: c.created.split("T")[0],
        Amount: fmt(c.amount, c.currency),
        Status: c.status,
        Customer: c.customer ?? "—",
        Description: c.description ?? "",
      })),
    })}`;
  },
  toMarkdown(s) {
    const total = s.charges.filter(c => c.status === "succeeded").reduce((acc, c) => acc + c.amount, 0);
    return `**Stripe summary** — $${(total / 100).toFixed(2)} succeeded, ${s.payouts.length} payouts pending`;
  },
});

export const Stripe = defineAsset<StripeState>({
  type: "stripe/account",
  // (no canonical type; vendor-specific shape)
  description: "Stripe — charges, payouts, customers.",
  schema: { type: "object" },
  defaultView: PaymentsView,
  secretFields: ["api_key"],
  mockState: () => ({
    charges: [
      { id: "ch_1", amount: 124000, currency: "USD", status: "succeeded", created: "2026-04-30T10:14:00", customer: "cus_a", description: "Plan renewal · Acme" },
      { id: "ch_2", amount:  84000, currency: "USD", status: "succeeded", created: "2026-04-30T09:21:00", customer: "cus_b", description: "Plan renewal · Brightwave" },
      { id: "ch_3", amount:  29000, currency: "USD", status: "failed",    created: "2026-04-30T08:02:00", customer: "cus_c", description: "Add-on · Helion" },
      { id: "ch_4", amount: 320000, currency: "USD", status: "succeeded", created: "2026-04-29T18:55:00", customer: "cus_d", description: "Annual · Meridian" },
      { id: "ch_5", amount:  19900, currency: "USD", status: "pending",   created: "2026-04-29T14:09:00", customer: "cus_e", description: "Trial conversion · Northwind" },
    ],
    payouts: [
      { id: "po_1", amount: 552000, currency: "USD", arrival_date: "2026-05-02", status: "in_transit" },
    ],
    customers: [
      { id: "cus_a", email: "billing@acme.com",      name: "Acme Inc." },
      { id: "cus_b", email: "ap@brightwave.com",     name: "Brightwave" },
      { id: "cus_d", email: "finance@meridian.com",  name: "Meridian Corp" },
    ],
  }),
});
