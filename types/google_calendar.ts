/**
 * Google Calendar — events across calendars.
 */

import { defineAsset } from "scenecast";
import { CalendarView, type CalendarProps } from "scenecast/views/primitives.js";

export interface CalendarStateEvent {
  id:        string;
  summary:   string;
  start:     string;
  end?:      string;
  location?: string;
  attendees?: string[];
  all_day?:  boolean;
  calendar_id?: string;
}

export interface CalendarState {
  calendars: Array<{ id: string; summary: string }>;
  events:    CalendarStateEvent[];
}

import { defineView } from "scenecast";

const NextUpView = defineView<CalendarState>({
  name: "CalendarNextUp",
  toHTML(s) {
    const props: CalendarProps = {
      title: "Upcoming",
      events: s.events.map(e => ({
        title: e.summary, start: e.start, end: e.end,
        location: e.location, attendees: e.attendees, allDay: e.all_day,
      })),
    };
    return CalendarView.toHTML(props);
  },
  toMarkdown(s) {
    return CalendarView.toMarkdown({
      title: "Upcoming",
      events: s.events.map(e => ({
        title: e.summary, start: e.start, end: e.end,
        location: e.location, attendees: e.attendees, allDay: e.all_day,
      })),
    });
  },
});

export const GoogleCalendar = defineAsset<CalendarState>({
  type: "google_calendar/account",
  extends: ["event/calendar"],
  description: "Google Calendar — events, attendees, locations.",
  schema: {
    type: "object",
    properties: { calendars: { type: "array" }, events: { type: "array" } },
  },
  defaultView: NextUpView,
  secretFields: ["access_token"],
  mockState: () => ({
    calendars: [
      { id: "primary", summary: "primary" },
      { id: "team",    summary: "Team" },
    ],
    events: [
      { id: "ev1", summary: "Daily standup",     start: "2026-05-02T10:00:00", end: "2026-05-02T10:15:00", attendees: ["alice@team", "bob@team", "carol@team"] },
      { id: "ev2", summary: "Sales review · Q2", start: "2026-05-02T13:00:00", end: "2026-05-02T14:00:00", location: "Conf Room 3", attendees: ["jordan@x.com", "ceo@company.com"] },
      { id: "ev3", summary: "Customer call: Brightwave", start: "2026-05-02T15:30:00", end: "2026-05-02T16:00:00", location: "Zoom" },
      { id: "ev4", summary: "Lunch w/ Maria",     start: "2026-05-03T12:30:00", end: "2026-05-03T13:30:00", location: "Tartine" },
      { id: "ev5", summary: "Design review",     start: "2026-05-03T16:00:00", end: "2026-05-03T17:00:00" },
      { id: "ev6", summary: "Off-site planning", start: "2026-05-04",         all_day: true },
    ],
  }),
});
