/**
 * ArcEnv — first concrete SceneGradEnv impl.
 *
 * scene_now: a Grid (the working canvas).
 * scene_then: a single coarse assertion "grid matches target" with
 *             gap = count of mismatched cells.
 * tools: enumerated parametric ARC primitives (recolor, mirror, rotate, ...).
 * step: apply tool, return new grid (pure functional — env state is just current grid).
 */

import type { SceneGradEnv, Goal, StepResult } from "scenegrad";
import type { Grid } from "./grid.js";
import { clone, countMismatches, equals, format } from "./grid.js";
import type { ArcTool } from "./toolkit.js";
import { applyTool, enumerateTools } from "./toolkit.js";
import { loadPuzzle, type ArcPuzzle } from "./tasks/load.js";

export class ArcEnv implements SceneGradEnv<Grid, ArcTool> {
  private current!: Grid;
  private target_grid!: Grid;
  private puzzle!: ArcPuzzle;

  reset(taskId?: string): Grid {
    if (!taskId) throw new Error("ArcEnv.reset requires a taskId");
    this.puzzle = loadPuzzle(taskId);
    this.current = clone(this.puzzle.input);
    this.target_grid = this.puzzle.output;
    return this.current;
  }

  scene(): Grid {
    return this.current;
  }

  goal(): Goal<Grid> {
    const target = this.target_grid;
    return {
      assertions: [{
        name: "grid matches target",
        check: (s: Grid) => {
          const gap = countMismatches(s, target);
          return { satisfied: gap === 0, gap };
        },
      }],
    };
  }

  tools(): ArcTool[] {
    return enumerateTools(this.current);
  }

  step(tool: ArcTool): StepResult<Grid> {
    try {
      const newGrid = applyTool(this.current, tool);
      this.current = newGrid;
      const gap = countMismatches(newGrid, this.target_grid);
      return {
        scene_after: newGrid,
        ok: true,
        distance_after: gap,
      };
    } catch (e) {
      return {
        scene_after: this.current,
        ok: false,
        error: String(e),
      };
    }
  }

  done(): boolean {
    return equals(this.current, this.target_grid);
  }

  /**
   * Cheap simulate — apply tool to a clone of current, return result without
   * mutating env. Tools are pure so this is straightforward.
   */
  simulate(tool: ArcTool): StepResult<Grid> {
    try {
      const result = applyTool(this.current, tool);
      const gap = countMismatches(result, this.target_grid);
      return {
        scene_after: result,
        ok: true,
        distance_after: gap,
      };
    } catch (e) {
      return {
        scene_after: this.current,
        ok: false,
        error: String(e),
      };
    }
  }

  /** Bonus: how grids render in the LLM prompt. */
  static formatScene(scene: unknown): string {
    return format(scene as Grid);
  }

  /** Public read of target_grid for prompt rendering. */
  target(): Grid {
    return this.target_grid;
  }

  /** Render task context for the LLM solver: input + target side-by-side. */
  describeTask(): string {
    return [
      "CURRENT GRID:",
      format(this.current),
      "",
      "TARGET GRID (transform current into this):",
      format(this.target_grid),
      "",
      "Cells of CURRENT that don't match TARGET = the gradient.",
      "Pick a tool that turns CURRENT into something closer to TARGET.",
    ].join("\n");
  }
}
