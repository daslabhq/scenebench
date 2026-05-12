/**
 * Translate AutomationBench's typed assertion format into scenegrad
 * Assertion<WorldState>.
 *
 * Implementation: delegates to `autocheck` for both translation (AB flat
 * dict → CheckExpr) and evaluation (CheckExpr × world → CheckResult).
 *
 * autocheck is differentially equivalent to Zapier's official Python
 * grader on the supported types — verified at 99.57% on 5290 cases
 * across 18 types covering ~58% of the corpus.
 * See oss/autocheck/scripts/diff-vs-zapier.ts.
 *
 * Assertion types not yet translated by autocheck fall through to a
 * NEUTRAL stub: satisfied=false, gap=1, weight=0. Different from the
 * previous permissive "satisfied=true, weight=0" stub — the old
 * behavior caused silent false-passes (tasks reported solved with
 * d_initial=0 even though the assertion was untestable). Neutral stubs
 * at least don't claim work is done; they simply don't contribute to
 * the gradient.
 */

import type { Assertion } from "scenegrad";
import { runCheck, type CheckExpr } from "autocheck";
import { translate, SUPPORTED_TYPES } from "autocheck/translate/automationbench";

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
  type:           string;
  [field: string]: any;
}

/* ---------------------------------------------------------------------------
 * Translate one AB assertion to a scenegrad Assertion.
 *
 * The returned Assertion's `check()` runs autocheck's evaluator at scoring
 * time, so the world doesn't need to be reified up-front and the scenegrad
 * interface is preserved.
 * ------------------------------------------------------------------------*/

export function translateAssertion(a: ABAssertion): Assertion<ABWorld> {
  const summary = describeAssertion(a);
  const result = translate(a as any);

  if (!result) {
    // Type not yet translatable. Neutral stub — doesn't claim work is done,
    // doesn't contribute to gradient. Visible in trajectory as `[unhandled]`.
    return {
      name: `[unhandled: ${a.type}] ${summary}`,
      check: () => ({ satisfied: false, gap: 1, weight: 0 }),
    };
  }

  const check: CheckExpr = result.check;
  return {
    name: summary,
    check: (world) => {
      const r = runCheck(world as unknown, check);
      return { satisfied: r.pass, gap: r.gap, weight: 1 };
    },
  };
}

/** Translate an array of AB assertions to scenegrad assertions. */
export function translateAssertions(assertions: ABAssertion[]): Assertion<ABWorld>[] {
  return assertions.map(translateAssertion);
}

/* ---------------------------------------------------------------------------
 * Helpers
 * ------------------------------------------------------------------------*/

function describeAssertion(a: ABAssertion): string {
  const fields = Object.entries(a)
    .filter(([k]) => k !== "type")
    .map(([k, v]) => `${k}=${typeof v === "string" ? v : JSON.stringify(v)}`)
    .join(", ");
  return `${a.type}(${fields})`;
}

/** Coverage info — useful for reports and CI gating. */
export const ASSERTION_COVERAGE: { supported: ReadonlySet<string> } = {
  supported: SUPPORTED_TYPES,
};
