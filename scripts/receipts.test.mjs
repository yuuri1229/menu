import { test } from "node:test";
import assert from "node:assert/strict";
import { formatReceipt, pendingReceipts } from "./receipts.mjs";

const r1 = { id: "a", date: "2026-10-27", createdAt: "2026-10-27T10:00:00Z", registeredAt: null, items: [] };
const r2 = { id: "b", date: "2026-10-28", createdAt: "2026-10-28T10:00:00Z", registeredAt: null, items: [] };
const r3 = { id: "c", date: "2026-10-29", createdAt: "x", registeredAt: "2026-10-29T01:00:00Z", items: [] };

test("登録待ちだけを新しい順に並べる", () => {
  assert.deepEqual(pendingReceipts([r1, r3, r2]).map((r) => r.id), ["b", "a"]);
  assert.deepEqual(pendingReceipts([r1, r3, r2], { all: true }).map((r) => r.id), ["c", "b", "a"]);
});

test("1件を見出しと品の行にする", () => {
  const text = formatReceipt({
    id: "b",
    store: "マルエツ",
    date: "2026-10-28",
    total: 666,
    registeredAt: null,
    items: [{ name: "豚こま切れ", amount: 348, grams: 300, bestBefore: "2026-10-31" }, { name: "卵" }],
  });
  assert.match(text, /^10\/28\(水\) マルエツ 2品 ¥666 登録待ち \(b\)/);
  assert.match(text, /豚こま切れ ¥348 300g 期限 10\/31/);
  assert.match(text, /\n {2}卵$/);
});
