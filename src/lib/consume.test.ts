import { test } from "node:test";
import assert from "node:assert/strict";
import { parseQty, planConsume, planRestore } from "./consume.ts";

const stock = (id: string, name: string, remaining: string, status: "十分" | "切れた" = "十分") =>
  ({ id, name, category: null, storage: null, status, remaining, memo: "", seafood: null, bestBefore: null, purchasedAt: null });
const meal = (recipe: string, consumed?: any[]) =>
  ({ id: "m", title: "t", date: null, slot: null, main: "", sides: "", memo: "", recipe, genre: null, minutes: null, done: false, prepAhead: false, ingredientIds: [], consumed });

const RECIPE = "## 材料\n- 豚こま切れ肉 150g\n- 卵 2個\n- しょうゆ 大さじ1\n- キャベツ 1/4個\n- 玉ねぎ 1玉\n\n## 作り方\n1. 焼く\n";

test("分量の読み取り", () => {
  assert.deepEqual(parseQty("150g"), { num: 150, unit: "g" });
  assert.deepEqual(parseQty("約２個"), { num: 2, unit: "個" });
  assert.deepEqual(parseQty("1/4個"), { num: 0.25, unit: "個" });
  assert.deepEqual(parseQty("1.5kg"), { num: 1500, unit: "g" });
  assert.equal(parseQty("大さじ1"), null);
  assert.equal(parseQty("半分"), null);
});

test("単位が合う材料だけ引き、残りは理由つきで残す", () => {
  const inv = [stock("pork", "豚こま", "300g"), stock("egg", "卵", "6個"), stock("sho", "しょうゆ", "1本"), stock("cab", "キャベツ", "200g")];
  const { entries, writes } = planConsume(meal(RECIPE), inv);
  assert.deepEqual(writes, [{ id: "pork", remaining: "150g" }, { id: "egg", remaining: "4個" }]);
  assert.deepEqual(entries.filter((e) => e.inventoryId).map((e) => [e.name, e.qty, e.unit]), [["豚こま切れ肉", 150, "g"], ["卵", 2, "個"]]);
  const reasons = Object.fromEntries(entries.filter((e) => !e.inventoryId).map((e) => [e.name, e.reason]));
  assert.match(reasons["しょうゆ 大さじ1"]!, /読めない/);
  assert.match(reasons["キャベツ 1/4個"]!, /gで数えている/);
  assert.equal(reasons["玉ねぎ 1玉"], "在庫にない");
});

test("在庫が足りなければ0にして切れたにする。取り消しで戻る", () => {
  const inv = [stock("egg", "卵", "1個")];
  const { entries, writes } = planConsume(meal("## 材料\n- 卵 2個\n"), inv);
  assert.deepEqual(writes, [{ id: "egg", remaining: "0個", status: "切れた" }]);
  assert.equal(entries[0].qty, 1);
  const after = [stock("egg", "卵", "0個", "切れた")];
  assert.deepEqual(planRestore(entries, after), [{ id: "egg", remaining: "1個", status: "十分" }]);
});

test("同じ在庫を2行で使うときは合算して1回で引く。在庫が消えていれば戻さない", () => {
  const inv = [stock("onion", "玉ねぎ", "3個")];
  const { entries, writes } = planConsume(meal("## 材料\n- 玉ねぎ 1個\n- 玉ねぎ（薄切り） 1個\n"), inv);
  assert.deepEqual(writes, [{ id: "onion", remaining: "1個" }]);
  assert.deepEqual(planRestore(entries, []), []);
  assert.deepEqual(planRestore(entries, [stock("onion", "玉ねぎ", "1個")]), [{ id: "onion", remaining: "3個" }]);
});
