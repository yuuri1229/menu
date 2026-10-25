import { test } from "node:test";
import assert from "node:assert/strict";
import { computeImpact, nextCheck, sameFood } from "./impact.ts";

const meal = (id: string, date: string, slot: "朝食" | "昼食" | "夕食", ingredientIds: string[], recipe = "") =>
  ({ id, title: id, date, slot, main: "", sides: "", memo: "", recipe, genre: null, minutes: null, done: false, prepAhead: false, ingredientIds });
const ing = (id: string, name: string, category: string, tripDate: string | null, bought: boolean, mealIds: string[], memo = "") =>
  ({ id, name, category, storage: "冷蔵", trip: tripDate ? "①" : null, tripDate, amount: "", estimate: 100, bought, memo, actual: null, mealIds });

test("表記ゆれは片方を含めば同じ食材とみなす", () => {
  assert.equal(sameFood("豚こま", "豚こま切れ肉（①）"), true);
  assert.equal(sameFood("卵", "卵焼き"), false);
});

test("外食の献立の食材を、買わない候補と使い切りたい物に分ける", () => {
  const meals = [meal("dinner", "2026-10-27", "夕食", ["pork", "moyashi", "egg"]), meal("next", "2026-10-28", "朝食", ["egg"])];
  const ingredients = [
    ing("pork", "豚こま", "肉", "2026-10-26", true, ["dinner"]),
    ing("moyashi", "もやし", "野菜", "2026-10-28", false, ["dinner"]),
    ing("egg", "卵", "卵・大豆製品", null, false, ["dinner", "next"], "在庫から"),
    ing("later", "うどん", "主食", "2026-10-28", false, ["next"]),
  ];
  const plans = [{ id: "p", date: "2026-10-27", slots: ["夕食" as const], kind: "外食" as const, memo: "", canceled: false, uid: null, updatedAt: null, handledAt: null }];
  const r = computeImpact({ meals, ingredients, inventory: [], plans }, "2026-10-26");
  assert.deepEqual(r.skipped.map((m) => m.id), ["dinner"]);
  assert.deepEqual(r.dontBuy.map((i) => i.id), ["moyashi"]);
  assert.deepEqual(r.useUp.map((u) => u.item.id), ["pork", "egg"]);
  assert.match(r.useUp[0].hint, /冷凍/);
  assert.equal(r.useUp[1].usedElsewhere, true);
  assert.equal(r.nextTrip, "2026-10-28");

  const canceled = computeImpact({ meals, ingredients, inventory: [], plans: [{ ...plans[0], canceled: true }] }, "2026-10-26");
  assert.equal(canceled.skipped.length + canceled.dontBuy.length + canceled.useUp.length, 0);
});

test("切れた在庫を使う献立を拾う（買う予定がある物は除く）", () => {
  const meals = [
    meal("a", "2026-10-27", "夕食", [], "1. ごま油を熱する"),
    meal("b", "2026-10-27", "朝食", ["natto"]),
    meal("c", "2026-10-28", "朝食", ["natto2"]),
  ];
  const ingredients = [ing("natto", "納豆", "卵・大豆製品", null, false, ["b"], "在庫から"), ing("natto2", "納豆", "卵・大豆製品", "2026-10-28", false, ["c"])];
  const inventory = [
    { id: "s1", name: "ごま油", category: "油", storage: null, status: "切れた" as const, remaining: "", memo: "", seafood: null, bestBefore: null, purchasedAt: null },
    { id: "s2", name: "納豆", category: null, storage: null, status: "切れた" as const, remaining: "", memo: "", seafood: null, bestBefore: null, purchasedAt: null },
  ];
  const r = computeImpact({ meals, ingredients, inventory, plans: [] }, "2026-10-26");
  assert.deepEqual(r.missing.map((x) => [x.meal.id, x.names]), [["a", ["ごま油"]], ["b", ["納豆"]]]);
});

test("次の確認は7時・12時・21時のうち次の時刻、21時を過ぎたら翌朝7時", () => {
  assert.deepEqual(nextCheck("2026-10-25", 6), { date: "2026-10-25", hour: 7 });
  assert.deepEqual(nextCheck("2026-10-25", 7), { date: "2026-10-25", hour: 12 });
  assert.deepEqual(nextCheck("2026-10-25", 18), { date: "2026-10-25", hour: 21 });
  assert.deepEqual(nextCheck("2026-10-31", 21), { date: "2026-11-01", hour: 7 });
});
