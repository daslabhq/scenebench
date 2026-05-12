/**
 * Slack — channels, messages, DMs, mentions.
 */

import { defineAsset } from "scenecast";
import { defineView, escapeHtml, truncate } from "scenecast";
import { ListView } from "scenecast/views/primitives.js";

export interface SlackMessage {
  ts:        string;
  channel:   string;
  user:      string;
  text:      string;
  thread_ts?: string;
  reactions?: Array<{ name: string; count: number }>;
}

export interface SlackChannel {
  id:           string;
  name:         string;
  is_private?:  boolean;
  member_count?: number;
}

export interface SlackState {
  channels: SlackChannel[];
  messages: SlackMessage[];
  users:    Array<{ id: string; name: string; real_name?: string }>;
}

const ActivityView = defineView<SlackState>({
  name: "SlackActivity",
  toHTML(s) {
    const byChannel = new Map<string, SlackMessage[]>();
    for (const m of s.messages) {
      const list = byChannel.get(m.channel) ?? [];
      list.push(m); byChannel.set(m.channel, list);
    }
    const items = [...byChannel.entries()].map(([channel, msgs]) => {
      const recent = msgs[msgs.length - 1];
      return {
        title:    `#${channel}`,
        subtitle: `${msgs.length} message${msgs.length === 1 ? "" : "s"}`,
        detail:   recent ? `${recent.user}: ${truncate(recent.text, 110)}` : "",
        badge:    msgs.length > 5 ? "active" : undefined,
      };
    });
    return ListView.toHTML({ title: "Recent activity", items });
  },
  toMarkdown(s) {
    const byChannel = new Map<string, SlackMessage[]>();
    for (const m of s.messages) byChannel.set(m.channel, [...(byChannel.get(m.channel) ?? []), m]);
    return [...byChannel.entries()].map(([c, msgs]) =>
      `**#${c}** (${msgs.length} messages)\n` + msgs.slice(-3).map(m => `> ${m.user}: ${truncate(m.text, 120)}`).join("\n")
    ).join("\n\n");
  },
});

export const Slack = defineAsset<SlackState>({
  type: "slack/workspace",
  extends: ["message/channels"],
  description: "Slack workspace — channels, messages, DMs, threads.",
  schema: {
    type: "object",
    properties: {
      channels: { type: "array" },
      messages: { type: "array" },
      users:    { type: "array" },
    },
  },
  defaultView: ActivityView,
  secretFields: ["bot_token", "user_token"],
  mockState: () => ({
    channels: [
      { id: "C-eng", name: "engineering",      member_count: 24 },
      { id: "C-mkt", name: "marketing-ops",    member_count: 9 },
      { id: "C-sup", name: "support-incidents", member_count: 14, is_private: true },
    ],
    messages: [
      { ts: "1714465500.0001", channel: "engineering", user: "alice",   text: "Deploy is green; canary at 5%."             },
      { ts: "1714465700.0002", channel: "engineering", user: "bob",     text: "Looks good — bumping to 25%."               },
      { ts: "1714466100.0003", channel: "engineering", user: "carol",   text: "Hit a flake on test_billing — retrying."   },
      { ts: "1714466500.0004", channel: "marketing-ops", user: "dave",  text: "Paused c-retain. CPA was $203 vs $150 cap." },
      { ts: "1714466700.0005", channel: "marketing-ops", user: "eve",   text: "Nice — let's revisit creative on Friday."   },
      { ts: "1714467000.0006", channel: "support-incidents", user: "frank", text: "Page from PagerDuty — checking #db-replicas." },
    ],
    users: [
      { id: "U1", name: "alice", real_name: "Alice Chen" },
      { id: "U2", name: "bob",   real_name: "Bobby Patel" },
      { id: "U3", name: "carol", real_name: "Carol Diaz" },
    ],
  }),
});
