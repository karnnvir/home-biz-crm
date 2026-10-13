import type { Recipe, RecipeIngredient } from "../types";

// Parses a quantity as stored (e.g. "35", "1/4", "1 1/2") into a decimal.
export function parseQuantity(raw: string | null): number | null {
  if (!raw) return null;
  const s = raw.trim();
  if (!s) return null;

  const mixed = s.match(/^(\d+)\s+(\d+)\/(\d+)$/);
  if (mixed) {
    const [, whole, num, den] = mixed;
    return Number(whole) + Number(num) / Number(den);
  }

  const frac = s.match(/^(\d+)\/(\d+)$/);
  if (frac) {
    const [, num, den] = frac;
    return Number(num) / Number(den);
  }

  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

// Extracts the leading number from a weight string like "300 g" or "300gm".
export function parseWeightGrams(text: string | null): number | null {
  if (!text) return null;
  const match = text.match(/[\d.]+/);
  if (!match) return null;
  const n = Number(match[0]);
  return Number.isFinite(n) && n > 0 ? n : null;
}

const EIGHTHS: Record<number, string> = {
  1: "1/8",
  2: "1/4",
  3: "3/8",
  4: "1/2",
  5: "5/8",
  6: "3/4",
  7: "7/8",
};

// Units read off a scale or graduated container — always decimal, never
// fractioned, regardless of magnitude (nobody measures "7 1/2 g").
const DECIMAL_UNITS = new Set(["g", "kg", "ml", "l"]);

// Formats a decimal back to a practical measuring quantity — nice eighths
// for spoons/counts (tsp, tbsp, or no unit at all, e.g. "1 banana"), a clean
// decimal for anything measured by weight/volume (g, kg, ml, l).
export function formatQuantity(n: number, unit: string | null): string {
  if (n <= 0) return "0";
  const isDecimalUnit = !!unit && DECIMAL_UNITS.has(unit.trim().toLowerCase());
  if (!isDecimalUnit && n < 10) {
    let whole = Math.floor(n);
    let eighths = Math.round((n - whole) * 8);
    if (eighths === 8) {
      whole += 1;
      eighths = 0;
    }
    if (eighths === 0) return String(whole);
    return whole > 0 ? `${whole} ${EIGHTHS[eighths]}` : EIGHTHS[eighths];
  }
  const rounded = Math.round(n * 10) / 10;
  return String(rounded);
}

export interface ScaledRecipe {
  ingredients: RecipeIngredient[];
  totalWeight: string;
}

// Returns null if the recipe's current total weight isn't set/parseable —
// scaling needs a known starting point to compute the ratio.
export function scaleRecipe(recipe: Recipe, targetWeightGrams: number): ScaledRecipe | null {
  const currentWeight = parseWeightGrams(recipe.totalWeight);
  if (!currentWeight) return null;

  const ratio = targetWeightGrams / currentWeight;
  const ingredients = recipe.ingredients.map((ing) => {
    const q = parseQuantity(ing.quantity);
    if (q === null) return ing; // "to taste" — nothing to scale
    return { ...ing, quantity: formatQuantity(q * ratio, ing.unit) };
  });

  return { ingredients, totalWeight: `${targetWeightGrams} g` };
}
