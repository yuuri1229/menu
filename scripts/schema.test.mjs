import { test } from "node:test";
import assert from "node:assert/strict";
import { checkRefs, validate } from "./schema.mjs";

test("新規の文書は足りない項目を既定値で埋める", () => {
  const d = validate("meals", { title: "納豆ご飯", date: "2026-10-20", slot: "朝食" });
  assert.equal(d.done, false);
  assert.deepEqual(d.ingredientIds, []);
  assert.equal(d.memo, "");
  assert.equal(d.genre, null);
});

test("部分更新は渡した項目だけ返す", () => {
  assert.deepEqual(validate("inventory", { id: "x", status: "切れた" }, { partial: true }), { status: "切れた" });
});

test("型や列挙の違い・知らない項目・空の名前は日本語で止める", () => {
  assert.throws(() => validate("meals", { title: "a", slot: "おやつ" }), /slot/);
  assert.throws(() => validate("meals", { title: "a", date: "10/20" }), /YYYY-MM-DD/);
  assert.throws(() => validate("ingredients", { name: "卵", price: 200 }), /price: この項目はない/);
  assert.throws(() => validate("purchases", { amount: 100 }), /name: 空にできない/);
  assert.throws(() => validate("nope", {}), /コレクション/);
});

test("消した食材を献立や明細が指していれば知らせる", () => {
  const problems = checkRefs({
    ingredients: [{ id: "egg" }],
    meals: [{ id: "m1", title: "卵焼き", ingredientIds: ["egg", "gone"] }],
    purchases: [{ id: "p1", name: "卵", ingredientIds: ["egg"] }],
  });
  assert.equal(problems.length, 1);
  assert.match(problems[0], /gone/);
});

test("感想は選択肢とタグを決め打ちで検査する", () => {
  const d = validate("feedback", { mealId: "m1", mealTitle: "親子丼", verdict: "好み", tags: ["味が薄い"] });
  assert.equal(d.reflectedAt, null);
  assert.equal(d.text, "");
  assert.throws(() => validate("feedback", { mealId: "m1", verdict: "最高" }), /verdict/);
  assert.throws(() => validate("feedback", { mealId: "m1", verdict: "好み", tags: ["辛い"] }), /tags/);
  assert.throws(() => validate("feedback", { verdict: "好み" }), /mealId: 空にできない/);
});

test("予定は日付と食事が必要で、種類は外食か不在", () => {
  const d = validate("plans", { date: "2026-10-27", slots: ["夕食"], kind: "外食" });
  assert.equal(d.canceled, false);
  assert.equal(d.handledAt, null);
  assert.throws(() => validate("plans", { date: "2026-10-27", slots: [], kind: "外食" }), /slots/);
  assert.throws(() => validate("plans", { date: "2026-10-27", slots: ["おやつ"], kind: "外食" }), /slots/);
  assert.throws(() => validate("plans", { date: "2026-10-27", slots: ["夕食"], kind: "旅行" }), /kind/);
  assert.throws(() => validate("plans", { slots: ["夕食"], kind: "外食" }), /date: 空にできない/);
});

test("数日の予定は帰宅日が出発日より後で、帰宅日に食べない食事が要る", () => {
  const d = validate("plans", { date: "2026-11-05", slots: ["昼食", "夕食"], endDate: "2026-11-07", endSlots: ["朝食"], kind: "不在" });
  assert.deepEqual(d.endSlots, ["朝食"]);
  assert.equal(validate("plans", { date: "2026-11-05", slots: ["夕食"], kind: "外食" }).endDate, null);
  assert.throws(() => validate("plans", { date: "2026-11-05", slots: ["夕食"], endDate: "2026-11-05", endSlots: ["朝食"], kind: "不在" }), /endDate/);
  assert.throws(() => validate("plans", { date: "2026-11-05", slots: ["夕食"], endDate: "2026-11-07", kind: "不在" }), /endSlots/);
});

test("レシートは品が1つ以上と作成時刻が要り、品の形を検査する", () => {
  const item = { name: "豚こま切れ", amount: 348, inventoryId: "inv1", grams: 300, bestBefore: "2026-10-31" };
  const d = validate("receipts", { store: "マルエツ", date: "2026-10-28", total: 348, items: [item], createdAt: "2026-10-28T10:00:00Z" });
  assert.equal(d.registeredAt, null);
  assert.throws(() => validate("receipts", { items: [], createdAt: "2026-10-28T10:00:00Z" }), /items/);
  assert.throws(() => validate("receipts", { items: [item] }), /createdAt: 空にできない/);
  assert.throws(() => validate("receipts", { items: [{ ...item, grams: -1 }], createdAt: "x" }), /items/);
  assert.throws(() => validate("receipts", { items: [{ ...item, price: 1 }], createdAt: "x" }), /items/);
});

test("レシートが指す在庫が無ければ知らせる", () => {
  const problems = checkRefs({
    ingredients: [],
    inventory: [{ id: "inv1" }],
    receipts: [{ id: "r1", items: [{ name: "卵", inventoryId: "inv1" }, { name: "肉", inventoryId: "gone" }] }],
  });
  assert.equal(problems.length, 1);
  assert.match(problems[0], /gone/);
});
