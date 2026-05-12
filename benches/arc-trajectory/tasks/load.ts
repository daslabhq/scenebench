/**
 * Load ARC puzzles from local sample JSON files.
 *
 * v0.0.1: just our hand-crafted samples in tasks/samples/.
 * Later: pull real ARC-AGI-2 puzzles from HuggingFace.
 */

import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type { Grid } from "../grid.js";

export interface ArcPuzzle {
  id:          string;
  description: string;
  input:       Grid;
  output:      Grid;
}

const HERE = dirname(fileURLToPath(import.meta.url));
const SAMPLES = join(HERE, "samples");

export function loadPuzzle(id: string): ArcPuzzle {
  const path = join(SAMPLES, `${id}.json`);
  const raw = readFileSync(path, "utf8");
  return JSON.parse(raw);
}

export function listPuzzles(): string[] {
  return readdirSync(SAMPLES)
    .filter(f => f.endsWith(".json"))
    .map(f => f.replace(/\.json$/, ""));
}
