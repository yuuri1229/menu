import { test } from "node:test";
import assert from "node:assert/strict";
import { parseMarkdown } from "./markdown.ts";
import { parseRecipe, splitAmount, splitKeyPhrases } from "./recipe.ts";

test("材料の名前と分量を分ける", () => {
  assert.deepEqual(splitAmount("豚こま切れ肉 150g"), { name: "豚こま切れ肉", amount: "150g" });
  assert.deepEqual(splitAmount("しょうゆ：大さじ1"), { name: "しょうゆ", amount: "大さじ1" });
  assert.deepEqual(splitAmount("塩 少々"), { name: "塩", amount: "少々" });
  assert.deepEqual(splitAmount("千切りキャベツ"), { name: "千切りキャベツ", amount: "" });
});

test("材料・手順・ポイントに分ける", () => {
  const r = parseRecipe(
    parseMarkdown("## 材料（1人分）\n- 豚こま 150g\n- みりん 大さじ1\n\n## 作り方\n1. 油を中火で熱する\n2. 3分炒める\n\n## ポイント\n- 焦がさない"),
  );
  assert.equal(r.ingredients.length, 2);
  assert.equal(r.steps.length, 2);
  assert.equal(r.extras[0].title, "ポイント");
  assert.equal(r.extras[0].blocks.length, 1);
});

test("火加減・時間・W数を強調する部分に分ける", () => {
  assert.deepEqual(
    splitKeyPhrases("中火で3分炒め、600Wで1分半").filter((p) => p.key).map((p) => p.text),
    ["中火", "3分", "600W", "1分"],
  );
  assert.equal(splitKeyPhrases("混ぜる").length, 1);
});
