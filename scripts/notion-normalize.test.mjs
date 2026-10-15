import { test } from "node:test";
import assert from "node:assert/strict";
import {
  normalizeBlocks,
  normalizeIngredient,
  normalizeMeal,
  normalizeNote,
  parseMonthDay,
  parseRange,
} from "./notion-normalize.mjs";

const rt = (text, annotations = {}) => [{ plain_text: text, annotations }];

test("parseMonthDay は基準日にいちばん近い年を選ぶ", () => {
  const oct = new Date("2026-10-15T00:00:00Z");
  assert.equal(parseMonthDay("① 10/12(月)", oct), "2026-10-12");
  const dec = new Date("2026-12-30T00:00:00Z");
  assert.equal(parseMonthDay("② 1/4(月)", dec), "2027-01-04");
  assert.equal(parseMonthDay("予定外", oct), null);
});

test("parseRange は週ページのタイトルから期間を取る", () => {
  const now = new Date("2026-10-15T00:00:00Z");
  assert.deepEqual(parseRange("買い物リスト・予算（10/12〜10/18）", now), { start: "2026-10-12", end: "2026-10-18" });
  const dec = new Date("2026-12-27T00:00:00Z");
  assert.deepEqual(parseRange("買い物リスト・予算（12/28〜1/3）", dec), { start: "2026-12-28", end: "2027-01-03" });
});

test("normalizeMeal はプロパティを素の値にする", () => {
  const page = {
    id: "m1",
    last_edited_time: "2026-10-14T00:00:00.000Z",
    properties: {
      メニュー名: { type: "title", title: rt("照り焼きチキン弁当") },
      日付: { type: "date", date: { start: "2026-10-13" } },
      食事区分: { type: "select", select: { name: "昼食" } },
      主菜: { type: "rich_text", rich_text: rt("鶏むね照り焼き") },
      副菜・汁物: { type: "rich_text", rich_text: [] },
      メモ: { type: "rich_text", rich_text: rt("朝は詰めるだけ") },
      ジャンル: { type: "select", select: null },
      "調理時間(分)": { type: "number", number: 5 },
      作った: { type: "checkbox", checkbox: true },
      作り置き: { type: "checkbox", checkbox: false },
      使う食材: { type: "relation", relation: [{ id: "i1" }, { id: "i2" }] },
    },
  };
  assert.deepEqual(normalizeMeal(page), {
    id: "m1",
    title: "照り焼きチキン弁当",
    date: "2026-10-13",
    slot: "昼食",
    main: "鶏むね照り焼き",
    sides: "",
    memo: "朝は詰めるだけ",
    genre: null,
    minutes: 5,
    done: true,
    prepAhead: false,
    ingredientIds: ["i1", "i2"],
    editedAt: "2026-10-14T00:00:00.000Z",
  });
});

test("normalizeIngredient はロールアップと買い物回の日付を読む", () => {
  const page = {
    id: "i1",
    properties: {
      食材名: { type: "title", title: rt("もやし") },
      買い物回: { type: "select", select: { name: "③ 10/16(金)" } },
      金額目安: { type: "number", number: 40 },
      実績金額: { type: "rollup", rollup: { type: "number", number: 38 } },
      購入済み: { type: "checkbox", checkbox: false },
    },
  };
  const i = normalizeIngredient(page, new Date("2026-10-15T00:00:00Z"));
  assert.equal(i.tripDate, "2026-10-16");
  assert.equal(i.actual, 38);
  assert.equal(i.estimate, 40);
  assert.equal(i.category, null);
});

test("normalizeBlocks は装飾・チェック・入れ子・表を残し、未対応の種類を落とす", () => {
  const blocks = [
    { type: "heading_2", heading_2: { rich_text: rt("予算") } },
    { type: "to_do", to_do: { checked: true, rich_text: rt("鶏むね肉") } },
    {
      type: "bulleted_list_item",
      bulleted_list_item: { rich_text: rt("豚こま", { strikethrough: true }) },
      children: [{ type: "paragraph", paragraph: { rich_text: rt("買わない") } }],
    },
    { type: "image", image: {} },
    {
      type: "table",
      table: { has_column_header: true },
      children: [{ type: "table_row", table_row: { cells: [rt("品目"), rt("金額")] } }],
    },
  ];
  assert.deepEqual(normalizeBlocks(blocks), [
    { type: "h2", rich: [{ t: "予算" }] },
    { type: "todo", rich: [{ t: "鶏むね肉" }], checked: true },
    { type: "ul", rich: [{ t: "豚こま", s: true }], children: [{ type: "p", rich: [{ t: "買わない" }] }] },
    { type: "table", rows: [[[{ t: "品目" }], [{ t: "金額" }]]], header: true },
  ]);
});

test("normalizeNote は週ページを見分ける", () => {
  const page = {
    id: "n1",
    icon: { type: "emoji", emoji: "🧾" },
    properties: { title: { type: "title", title: rt("買い物リスト・予算（10/12〜10/18）") } },
  };
  const n = normalizeNote(page, [], new Date("2026-10-15T00:00:00Z"));
  assert.equal(n.kind, "week");
  assert.equal(n.start, "2026-10-12");
  assert.equal(n.icon, "🧾");
});
