/**
 * Vendor types catalogue — shapes extracted from existing benchmarks.
 *
 * Each vendor type extends a canonical type from scenecast (Email,
 * Message, Contact, Event, Task, Document) and adds vendor-specific
 * fields. Tools that consume canonical types work uniformly across all
 * vendors that implement them.
 *
 * Origin: AutomationBench (Zapier) Pydantic schemas, MIT-licensed.
 * Future benchmarks (S4Bench, SFDCBench, …) will add their own
 * vendor types under benches/<name>/types/.
 */

export { Gmail }          from "./gmail.js";
export { Salesforce }     from "./salesforce.js";
export { Slack }          from "./slack.js";
export { GoogleSheets }   from "./google_sheets.js";
export { GoogleCalendar } from "./google_calendar.js";
export { Airtable }       from "./airtable.js";
export { Jira }           from "./jira.js";
export { Notion }         from "./notion.js";
export { Stripe }         from "./stripe.js";
export { GitHub }         from "./github.js";

import { Gmail }          from "./gmail.js";
import { Salesforce }     from "./salesforce.js";
import { Slack }          from "./slack.js";
import { GoogleSheets }   from "./google_sheets.js";
import { GoogleCalendar } from "./google_calendar.js";
import { Airtable }       from "./airtable.js";
import { Jira }           from "./jira.js";
import { Notion }         from "./notion.js";
import { Stripe }         from "./stripe.js";
import { GitHub }         from "./github.js";

export const vendorTypes = {
  Gmail, Salesforce, Slack,
  GoogleSheets, GoogleCalendar, Airtable,
  Jira, Notion, Stripe, GitHub,
} as const;
