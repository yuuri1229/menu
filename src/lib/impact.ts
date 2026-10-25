// 外食・不在の予定や在庫の「切れた」が、次の買い物までの献立と食材にどう響くかを、アプリの中ですぐ計算する。
// 献立そのものを組み直すのは Claude（毎日7時・12時・21時）。ここは決まりだけで判断して、画面に目安を出す。

import type { Ingredient, InventoryItem, Meal, Plan } from "./types";

export interface UseUp {
  item: Ingredient;
  /** 作らなくなった献立 */
  skipped: Meal[];
  /** ほかの献立でも使う予定がある */
  usedElsewhere: boolean;
  /** 傷みやすく、次の買い物までに手を打ちたい */
  urgent: boolean;
  hint: string;
  /** 在庫に同じ名前の物があれば、その期限 */
  bestBefore: string | null;
}

export interface Missing {
  meal: Meal;
  /** 切れている在庫の名前 */
  names: string[];
}

export interface Impact {
  /** 予定（外食・不在）で作らなくなった、今日以降の献立 */
  skipped: Meal[];
  /** 作らなくなった献立にしか使わない、まだ買っていない食材 */
  dontBuy: Ingredient[];
  /** 買ってある（または在庫から使う）のに、作らなくなった献立で使うはずだった食材。傷みやすい順 */
  useUp: UseUp[];
  /** 切れた在庫を使う、今日以降の献立 */
  missing: Missing[];
  /** 次の買い物の日（今日以降で、まだ買っていない食材がある最初の日） */
  nextTrip: string | null;
}

const PERISHABLE_CATEGORY = ["肉", "野菜", "卵・大豆製品", "乳製品・果物"];

/** 名前を比べやすくする（括弧の中・回の番号・空白を除く） */
export function normalizeName(name: string): string {
  return name
    .replace(/[（(][^）)]*[）)]/g, "")
    .replace(/[①-⑳]/g, "")
    .replace(/\s+/g, "")
    .trim();
}

/** 表記ゆれ（「豚こま」と「豚こま切れ肉」など）を片方がもう片方を含むかで拾う。2文字未満は比べない */
export function sameFood(a: string, b: string): boolean {
  const x = normalizeName(a);
  const y = normalizeName(b);
  if (x.length < 2 || y.length < 2) return false;
  return x.includes(y) || y.includes(x);
}

const fromStock = (i: Ingredient) => !i.tripDate || /在庫から/.test(i.memo);

function handling(i: Ingredient, nextTrip: string | null): { urgent: boolean; hint: string } {
  const by = nextTrip ? `次の買い物（${Number(nextTrip.slice(5, 7))}/${Number(nextTrip.slice(8))}）まで` : "数日のうち";
  if (i.category === "肉") return { urgent: true, hint: "その日のうちに冷凍し、使う前日に冷蔵へ移す" };
  if (i.storage === "冷凍" || i.category === "冷凍食品") return { urgent: false, hint: "冷凍のまま先の献立で使う" };
  if (PERISHABLE_CATEGORY.includes(i.category ?? "") || i.storage === "冷蔵")
    return { urgent: true, hint: `傷みやすいので${by}に使い切る` };
  return { urgent: false, hint: "日持ちするので先の献立で使う" };
}

export function computeImpact(
  { meals, ingredients, inventory, plans }: { meals: Meal[]; ingredients: Ingredient[]; inventory: InventoryItem[]; plans: Plan[] },
  today: string,
): Impact {
  const active = plans.filter((p) => !p.canceled);
  const covered = (m: Meal) => !!m.date && !!m.slot && active.some((p) => p.date === m.date && p.slots.includes(m.slot!));
  const ahead = meals.filter((m) => m.date && m.date >= today && !m.done);
  const skipped = ahead.filter(covered);
  const skippedIds = new Set(skipped.map((m) => m.id));
  const upcoming = ahead.filter((m) => !skippedIds.has(m.id));
  const upcomingIds = new Set(upcoming.map((m) => m.id));
  const mealById = new Map(meals.map((m) => [m.id, m]));

  const nextTrip =
    ingredients
      .filter((i) => i.tripDate && i.tripDate >= today && !i.bought)
      .map((i) => i.tripDate!)
      .sort()[0] ?? null;

  const dontBuy = ingredients.filter((i) => {
    if (i.bought || fromStock(i) || i.tripDate! < today || /取りやめ/.test(i.name)) return false;
    const future = i.mealIds.filter((id) => skippedIds.has(id) || upcomingIds.has(id));
    return future.length > 0 && future.every((id) => skippedIds.has(id));
  });

  const useUp: UseUp[] = ingredients
    .filter((i) => (i.bought || fromStock(i)) && i.mealIds.some((id) => skippedIds.has(id)))
    .map((i) => {
      const stock = inventory.find((s) => sameFood(s.name, i.name));
      return {
        item: i,
        skipped: i.mealIds.filter((id) => skippedIds.has(id)).map((id) => mealById.get(id)!),
        usedElsewhere: i.mealIds.some((id) => upcomingIds.has(id)),
        bestBefore: stock?.bestBefore ?? null,
        ...handling(i, nextTrip),
      };
    })
    // 回ごとに分かれた同じ食材（千切りキャベツ①②など）は1行にまとめる
    .filter((u, i, all) => all.findIndex((v) => normalizeName(v.item.name) === normalizeName(u.item.name)) === i)
    .sort((a, b) => Number(b.urgent) - Number(a.urgent) || (a.bestBefore ?? "9").localeCompare(b.bestBefore ?? "9"));

  // 切れた在庫：献立の食材（まだ買う予定の物は除く）と、作り方・副菜に名前が出てくる調味料など
  const out = inventory.filter((s) => s.status === "切れた");
  const ingById = new Map(ingredients.map((i) => [i.id, i]));
  const missing: Missing[] = [];
  if (out.length) {
    for (const m of upcoming) {
      const own = m.ingredientIds.map((id) => ingById.get(id)).filter((i): i is Ingredient => !!i);
      const text = `${m.title}\n${m.main}\n${m.sides}\n${m.recipe}`;
      const names = out
        .filter((s) => {
          const viaIngredient = own.some((i) => sameFood(i.name, s.name));
          // 献立の食材として買う予定があれば、切れていても足りる
          if (own.some((i) => sameFood(i.name, s.name) && !fromStock(i) && !i.bought)) return false;
          const key = normalizeName(s.name);
          return viaIngredient || (key.length >= 2 && text.includes(key));
        })
        .map((s) => s.name);
      if (names.length) missing.push({ meal: m, names });
    }
  }

  return { skipped, dontBuy, useUp, missing, nextTrip };
}

/** Claude が予定と在庫を確認する時刻（日本時間。定期タスクの設定と同じにする） */
export const CHECK_HOURS = [7, 12, 21];

/** 次の確認の日付と時刻。今の時（0〜23）がその時刻ちょうどなら、もう済んだとみなして次にする */
export function nextCheck(today: string, hour: number): { date: string; hour: number } {
  const h = CHECK_HOURS.find((x) => x > hour);
  if (h != null) return { date: today, hour: h };
  const d = new Date(`${today}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return { date: d.toISOString().slice(0, 10), hour: CHECK_HOURS[0] };
}

export const hasImpact = (i: Impact) => i.dontBuy.length + i.useUp.length + i.missing.length > 0;
