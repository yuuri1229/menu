import assert from "node:assert/strict";
import { test } from "node:test";
import { formatFeedback, pendingFeedback } from "./feedback.mjs";

const list = [
  { id: "a", mealId: "a", date: "2026-10-22", slot: "夕食", verdict: "好み", tags: [], text: "", reflectedAt: null },
  { id: "b", mealId: "b", date: "2026-10-23", slot: "朝食", verdict: "合わない", tags: [], text: "", reflectedAt: null },
  { id: "c", mealId: "c", date: "2026-10-23", slot: "夕食", verdict: "ふつう", tags: [], text: "", reflectedAt: "2026-10-24T09:00:00Z" },
];

test("反映待ちだけを新しい献立の順に並べる", () => {
  assert.deepEqual(pendingFeedback(list).map((f) => f.id), ["b", "a"]);
  assert.deepEqual(pendingFeedback(list, { all: true }).map((f) => f.id), ["c", "b", "a"]);
});

test("献立名・評価・タグ・本文・食材を1件にまとめる", () => {
  const text = formatFeedback(
    { id: "m1", mealId: "m1", mealTitle: "古い名前", date: "2026-10-23", slot: "夕食", verdict: "好み", tags: ["味が薄い", "また食べたい"], text: "塩は\nもう少し多く" },
    { meals: [{ id: "m1", title: "鶏の塩レモンソテー", ingredientIds: ["i1", "gone"] }], ingredients: [{ id: "i1", name: "鶏むね肉" }] },
  );
  assert.equal(
    text,
    "10/23(金) 夕食 鶏の塩レモンソテー 【好み】  [味が薄い・また食べたい]  (m1)\n  「塩は / もう少し多く」\n  食材: 鶏むね肉",
  );
});

test("献立が消えていても送った時点の名前で分かる", () => {
  assert.match(formatFeedback({ mealId: "x", mealTitle: "親子丼", verdict: "合わない", tags: [], text: "" }), /日付なし 親子丼 【合わない】/);
});
