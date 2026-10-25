import assert from "node:assert/strict";
import { test } from "node:test";
import { formatPlan, pendingPlans, planAt } from "./plans.mjs";

const plans = [
  { id: "b", date: "2026-10-28", slots: ["昼食", "夕食"], kind: "不在", memo: "", canceled: false, handledAt: null },
  { id: "a", date: "2026-10-27", slots: ["夕食"], kind: "外食", memo: "飲み会", canceled: false, handledAt: "2026-10-25T11:00:00Z" },
  { id: "c", date: "2026-10-26", slots: ["夕食"], kind: "外食", memo: "", canceled: true, handledAt: null },
  { id: "old", date: "2026-10-20", slots: ["夕食"], kind: "外食", memo: "", canceled: false, handledAt: null },
];

test("取り消した予定はその食事の予定にしない", () => {
  assert.equal(planAt(plans, "2026-10-27", "夕食")?.id, "a");
  assert.equal(planAt(plans, "2026-10-26", "夕食"), null);
  assert.equal(planAt(plans, "2026-10-27", "昼食"), null);
});

test("反映待ちは今日以降の未反映（取り消しも含む）を日付の順に", () => {
  assert.deepEqual(pendingPlans(plans, "2026-10-25").map((p) => p.id), ["c", "b"]);
  assert.deepEqual(pendingPlans(plans, "2026-10-25", { all: true }).map((p) => p.id), ["c", "a", "b"]);
});

test("その日の献立を添えて1件を数行にする", () => {
  const text = formatPlan(plans[1], {
    meals: [
      { date: "2026-10-27", slot: "夕食", title: "生姜焼き" },
      { date: "2026-10-27", slot: "朝食", title: "納豆ご飯" },
    ],
  });
  assert.equal(text, "10/27(火) 夕食 外食「飲み会」 反映済み 2026-10-25 (a)\n  この日の献立: 朝 納豆ご飯／夜 生姜焼き（← 予定の食事）");
  assert.match(formatPlan(plans[2]), /取り消し（献立を戻す）/);
});
