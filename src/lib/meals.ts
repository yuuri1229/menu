import { PREP_KEYWORDS } from "./config";
import type { Meal, Slot } from "./types";

export const SLOT_META: Record<Slot, { short: string; label: string; tone: "morning" | "noon" | "night"; emoji: string }> = {
  朝食: { short: "朝", label: "朝ごはん", tone: "morning", emoji: "🌅" },
  昼食: { short: "昼", label: "昼ごはん", tone: "noon", emoji: "☀️" },
  夕食: { short: "夜", label: "夜ごはん", tone: "night", emoji: "🌙" },
};

const SLOT_ORDER: Record<string, number> = { 朝食: 0, 昼食: 1, 夕食: 2 };

export function sortMeals(meals: Meal[]): Meal[] {
  return [...meals].sort(
    (a, b) => (a.date ?? "").localeCompare(b.date ?? "") || (SLOT_ORDER[a.slot ?? ""] ?? 9) - (SLOT_ORDER[b.slot ?? ""] ?? 9),
  );
}

export function mealsOn(meals: Meal[], date: string): Meal[] {
  return sortMeals(meals.filter((m) => m.date === date));
}

export const isBento = (m: Meal) => m.slot === "昼食" && /弁当/.test(m.title);

/** 時刻から「次に食べるごはん」を決める */
export function currentSlot(hour: number): Slot {
  if (hour < 10) return "朝食";
  if (hour < 15) return "昼食";
  return "夕食";
}

/** 献立名の「＋千切りキャベツ」などの添え物を分けて、見出しを短くする */
export function splitTitle(title: string): { head: string; extras: string[] } {
  const clean = title.replace(/^【[^】]*】/, "");
  const [head, ...extras] = clean.split("＋");
  return { head: head.trim(), extras: extras.map((e) => e.trim()).filter(Boolean) };
}

/** 献立名の先頭の【翌週】などのラベル */
export function titleTag(title: string): string | null {
  return /^【([^】]+)】/.exec(title)?.[1] ?? null;
}

/** メモを文に分け、【実績】や変更メモを見分ける */
export function memoSentences(memo: string): { text: string; kind: "result" | "change" | "prep" | "plain" }[] {
  if (!memo) return [];
  const parts = memo
    .split(/(?<=。)|(?=【)/)
    .map((s) => s.trim())
    .filter(Boolean);
  return parts.map((text) => {
    if (/^【実績】/.test(text)) return { text: text.replace(/^【実績】/, ""), kind: "result" as const };
    if (/^\d{1,2}\/\d{1,2}変更/.test(text)) return { text, kind: "change" as const };
    if (PREP_KEYWORDS.some((k) => text.includes(k))) return { text, kind: "prep" as const };
    return { text, kind: "plain" as const };
  });
}

/** 段取り（炊飯・取り分け・冷凍など）に関する文だけを拾う */
export function prepTips(memo: string): string[] {
  return memoSentences(memo)
    .filter((s) => s.kind === "prep")
    .map((s) => s.text);
}
