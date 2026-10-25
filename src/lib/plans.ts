// 外食・不在の予定がどの食事を含むか（scripts/plans.mjs の planCovers と同じ決まり）。
import { addDays, mdw } from "./date.ts";
import { SLOTS, type Plan, type Slot } from "./types.ts";

/** 予定がその日のその食事を含むか。数日の予定は、出発日の slots・間の日の全食事・帰宅日の endSlots */
export function planCovers(p: Pick<Plan, "date" | "slots" | "endDate" | "endSlots">, date: string, slot: Slot): boolean {
  if (!p.endDate) return p.date === date && p.slots.includes(slot);
  if (date === p.date) return p.slots.includes(slot);
  if (date === p.endDate) return (p.endSlots ?? []).includes(slot);
  return date > p.date && date < p.endDate;
}

/** 予定の最後の日 */
export const planEnd = (p: Pick<Plan, "date" | "endDate">) => p.endDate ?? p.date;

/** 出発の日に食べない食事（最初に食べない食事から夜まで） */
export const slotsFrom = (first: Slot): Slot[] => SLOTS.slice(SLOTS.indexOf(first));
/** 帰宅の日に食べない食事（朝から最後に食べない食事まで） */
export const slotsUntil = (last: Slot): Slot[] => SLOTS.slice(0, SLOTS.indexOf(last) + 1);

const short = (s: Slot) => s.slice(0, 1);

/** 「11/5(水) 昼〜11/7(金) 昼」「10/27(火) 夜」のような短い表示 */
export function planWhen(p: Pick<Plan, "date" | "slots" | "endDate" | "endSlots">): string {
  const order = (list: Slot[]) => SLOTS.filter((s) => list.includes(s));
  if (!p.endDate) return `${mdw(p.date)} ${order(p.slots).map(short).join("・")}`;
  const first = order(p.slots)[0];
  const last = order(p.endSlots ?? []).at(-1);
  return `${mdw(p.date)} ${first ? short(first) : ""}〜${mdw(p.endDate)} ${last ? short(last) : ""}`;
}

/** 予定の日数（1日だけなら1） */
export function planDays(p: Pick<Plan, "date" | "endDate">): string[] {
  const days: string[] = [];
  for (let d = p.date; d <= planEnd(p); d = addDays(d, 1)) days.push(d);
  return days;
}
