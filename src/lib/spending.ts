import { RICE_PATTERN, WEEKLY_BUDGET } from "./config";
import { weekStart } from "./date";
import { sum } from "./format";
import type { Purchase } from "./types";

export const purchaseDate = (p: Purchase) => p.date ?? p.tripDate;
export const isRice = (p: Purchase) => RICE_PATTERN.test(p.name);
/** 週予算に数えるもの：費目が「食材」で、米以外 */
export const countsToBudget = (p: Purchase) => (p.category ?? "食材") === "食材" && !isRice(p);

export interface WeekSpend {
  week: string;
  food: number;
  rice: number;
  other: number;
  total: number;
  items: Purchase[];
}

export function spendByWeek(purchases: Purchase[]): Map<string, WeekSpend> {
  const map = new Map<string, WeekSpend>();
  for (const p of purchases) {
    const d = purchaseDate(p);
    if (!d) continue;
    const week = weekStart(d);
    const w = map.get(week) ?? { week, food: 0, rice: 0, other: 0, total: 0, items: [] };
    const a = p.amount ?? 0;
    if (countsToBudget(p)) w.food += a;
    else if (isRice(p)) w.rice += a;
    else w.other += a;
    w.total += a;
    w.items.push(p);
    map.set(week, w);
  }
  return map;
}

export function budgetTone(spent: number, budget = WEEKLY_BUDGET): "ok" | "warn" | "danger" {
  if (spent > budget) return "danger";
  if (spent > budget * 0.85) return "warn";
  return "ok";
}

export { WEEKLY_BUDGET, sum };
