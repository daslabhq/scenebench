/**
 * Grid — the scene type for ARC.
 *
 * 2D array of integers 0..9, each representing a color. ARC convention.
 */

export type Color = number;
export type Grid = Color[][];

export function clone(g: Grid): Grid {
  return g.map(row => row.slice());
}

export function dims(g: Grid): { rows: number; cols: number } {
  return { rows: g.length, cols: g[0]?.length ?? 0 };
}

export function equals(a: Grid, b: Grid): boolean {
  if (a.length !== b.length) return false;
  for (let y = 0; y < a.length; y++) {
    if (a[y]!.length !== b[y]!.length) return false;
    for (let x = 0; x < a[y]!.length; x++) {
      if (a[y]![x] !== b[y]![x]) return false;
    }
  }
  return true;
}

export function countMismatches(a: Grid, b: Grid): number {
  if (a.length !== b.length || a[0]?.length !== b[0]?.length) {
    // Treat differently-sized grids as fully mismatched.
    return Math.max(a.length * (a[0]?.length ?? 0), b.length * (b[0]?.length ?? 0));
  }
  let n = 0;
  for (let y = 0; y < a.length; y++) {
    for (let x = 0; x < a[y]!.length; x++) {
      if (a[y]![x] !== b[y]![x]) n++;
    }
  }
  return n;
}

/** Distinct colors present in the grid. */
export function colors(g: Grid): Set<Color> {
  const s = new Set<Color>();
  for (const row of g) for (const c of row) s.add(c);
  return s;
}

/** Pretty-print a grid for prompts. */
export function format(g: Grid): string {
  return g.map(row => row.map(c => c.toString()).join(" ")).join("\n");
}
