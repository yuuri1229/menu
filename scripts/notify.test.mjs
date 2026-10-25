import assert from "node:assert/strict";
import { test } from "node:test";
import { buildReminder, jstDate, prepTips } from "./notify.mjs";

test("日本時間の日付", () => {
  assert.equal(jstDate(new Date("2026-10-15T14:59:00Z")), "2026-10-15");
  assert.equal(jstDate(new Date("2026-10-15T15:00:00Z")), "2026-10-16");
  assert.equal(jstDate(new Date("2026-10-15T11:00:00Z"), 1), "2026-10-16");
});

test("段取りの文だけ拾う", () => {
  assert.deepEqual(prepTips("炊飯は前の晩に予約。おいしく食べる。【実績】解凍してOK。10/14変更：冷凍をやめた。"), ["炊飯は前の晩に予約。"]);
});

test("明日の買い物と段取りを1通にまとめる", () => {
  const n = buildReminder(
    {
      meals: [
        { date: "2026-10-16", slot: "夕食", title: "生姜焼き＋千切りキャベツ", memo: "" },
        { date: "2026-10-16", slot: "朝食", title: "納豆ご飯", memo: "炊飯は木曜夜に予約。" },
      ],
      ingredients: [
        { name: "もやし", trip: "③ 10/16(金)", tripDate: "2026-10-16", estimate: 40, bought: false },
        { name: "うどん", trip: "③ 10/16(金)", tripDate: "2026-10-16", estimate: 120, bought: false },
        { name: "卵", trip: "③ 10/16(金)", tripDate: "2026-10-16", estimate: 200, bought: true },
        { name: "（取りやめ）豚こま", trip: "③ 10/16(金)", tripDate: "2026-10-16", estimate: 450, bought: false },
      ],
    },
    "2026-10-16",
  );
  assert.equal(n.title, "明日 10/16(金) の準備");
  assert.equal(n.body, "買い物 ③：もやし・うどん（約160円）\n段取り：炊飯は木曜夜に予約。\n献立：朝 納豆ご飯／夜 生姜焼き");
  assert.equal(n.url, "shopping/");
});

test("買い物も段取りもない日は送らない", () => {
  assert.equal(buildReminder({ meals: [{ date: "2026-10-17", slot: "夕食", title: "カレー", memo: "" }], ingredients: [] }, "2026-10-17"), null);
});

test("外食・不在の食事は段取りを出さず、予定として知らせる", () => {
  const n = buildReminder(
    {
      meals: [
        { date: "2026-10-27", slot: "朝食", title: "納豆ご飯", memo: "" },
        { date: "2026-10-27", slot: "夕食", title: "生姜焼き", memo: "炊飯は朝に予約。" },
      ],
      ingredients: [],
      plans: [
        { date: "2026-10-27", slots: ["夕食"], kind: "外食", memo: "飲み会", canceled: false },
        { date: "2026-10-27", slots: ["朝食"], kind: "不在", memo: "", canceled: true },
      ],
    },
    "2026-10-27",
  );
  assert.equal(n.body, "予定：夜 外食（飲み会）\n献立：朝 納豆ご飯");
});
