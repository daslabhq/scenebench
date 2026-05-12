/**
 * ARC primitive toolkit — pure functions on grids.
 *
 * Each tool is `(grid, args) → grid'`. Composing them solves puzzles.
 *
 * v0.0.1: small set of high-leverage primitives. Enough to validate
 * the scenegrad loop on hand-crafted puzzles. Real ARC needs more.
 */

import type { Grid, Color } from "./grid.js";
import { clone, colors, dims } from "./grid.js";
import type { ToolCall } from "scenegrad";

export type ArcTool = ToolCall;

// ---------------------------------------------------------------------------
// Tool handlers — each is (grid, args) → grid'
// ---------------------------------------------------------------------------

export const HANDLERS: Record<string, (g: Grid, args: Record<string, any>) => Grid> = {
  // Replace all cells of one color with another.
  recolor(g, { from, to }) {
    const out = clone(g);
    for (let y = 0; y < out.length; y++) {
      for (let x = 0; x < out[y]!.length; x++) {
        if (out[y]![x] === from) out[y]![x] = to;
      }
    }
    return out;
  },

  // Fill all 0 cells with given color.
  fill_background(g, { color }) {
    const out = clone(g);
    for (let y = 0; y < out.length; y++) {
      for (let x = 0; x < out[y]!.length; x++) {
        if (out[y]![x] === 0) out[y]![x] = color;
      }
    }
    return out;
  },

  // Mirror horizontally (reverse each row).
  mirror_h(g) {
    return g.map(row => row.slice().reverse());
  },

  // Mirror vertically (reverse rows).
  mirror_v(g) {
    return g.slice().reverse().map(row => row.slice());
  },

  // Rotate 90° clockwise.
  rotate_cw(g) {
    const { rows, cols } = dims(g);
    const out: Grid = Array.from({ length: cols }, () => Array(rows).fill(0));
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        out[x]![rows - 1 - y] = g[y]![x]!;
      }
    }
    return out;
  },

  // Rotate 180°.
  rotate_180(g) {
    return g.slice().reverse().map(row => row.slice().reverse());
  },

  // Set a single cell.
  set_cell(g, { x, y, color }) {
    const out = clone(g);
    if (y >= 0 && y < out.length && x >= 0 && x < (out[y]?.length ?? 0)) {
      out[y]![x] = color;
    }
    return out;
  },
};

// ---------------------------------------------------------------------------
// Tool enumeration — given a grid, what concrete (pre-bound-args) tools
// are worth simulating? Greedy needs a finite set.
// ---------------------------------------------------------------------------

/**
 * Generate the set of concrete tool calls available for this grid.
 * Greedy will dry-run all of them; LLM picks one by index.
 *
 * v0.0.1 strategy:
 *   - recolor: every (from, to) pair where from is present in grid
 *   - fill_background: every color (when 0 is present)
 *   - mirror_h, mirror_v, rotate_cw, rotate_180: parameter-free
 *   - set_cell: omitted from auto-enumeration (too combinatorial; LLM
 *     can still call it via direct tool name + args if we choose to wire it)
 */
export function enumerateTools(g: Grid): ArcTool[] {
  const present = colors(g);
  const out: ArcTool[] = [];

  // recolor pairs
  for (const from of present) {
    for (let to = 0; to <= 9; to++) {
      if (to === from) continue;
      out.push({ name: "recolor", args: { from, to } });
    }
  }

  // fill_background variants (only meaningful when 0 is present)
  if (present.has(0)) {
    for (let color = 1; color <= 9; color++) {
      out.push({ name: "fill_background", args: { color } });
    }
  }

  // parameter-free transforms
  out.push({ name: "mirror_h", args: {} });
  out.push({ name: "mirror_v", args: {} });
  out.push({ name: "rotate_cw", args: {} });
  out.push({ name: "rotate_180", args: {} });

  return out;
}

/** Apply a tool call to a grid. Returns the new grid (or throws on bad args). */
export function applyTool(g: Grid, tool: ArcTool): Grid {
  const handler = HANDLERS[tool.name];
  if (!handler) throw new Error(`unknown tool: ${tool.name}`);
  return handler(g, tool.args);
}
