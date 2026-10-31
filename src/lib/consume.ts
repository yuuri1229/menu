// 「作った」を押したとき、レシピの材料の分量を在庫から引く計算。
// 引けるのは、在庫の数量（remaining）が「200g」「3個」のように数と単位で書かれていて、
// レシピの分量も同じ単位のものだけ。それ以外（大さじ・少々・単位違い・在庫に無い物）は引かずに一覧に残す。

import { parseMarkdown } from "./markdown.ts";
import { sameFood, normalizeName } from "./impact.ts";
import { parseRecipe } from "./recipe.ts";
import type { ConsumedEntry, InventoryItem, Meal, StockStatus } from "./types";

export type { ConsumedEntry };

export const STOCK_UNITS = ["個", "g", "本", "袋", "パック", "枚", "ml"] as const;
export type StockUnit = (typeof STOCK_UNITS)[number];

export interface Qty {
  num: number;
  unit: StockUnit;
}

const ZEN = "０１２３４５６７８９";
const FRACTION: Record<string, number> = { "½": 0.5, "¼": 0.25, "¾": 0.75 };

/** 「200g」「3個」「約1/2個」「1.5kg」を数と在庫の単位にする。読めなければ null */
export function parseQty(text: string): Qty | null {
  const t = text
    .replace(/[０-９]/g, (c) => String(ZEN.indexOf(c)))
    .replace(/[．]/g, ".")
    .replace(/[／]/g, "/")
    .replace(/^[約およそ]+/, "")
    .trim();
  const m = t.match(/^(\d+(?:\.\d+)?)(?:\s*\/\s*(\d+))?\s*([½¼¾])?\s*(kg|KG|Kg|キロ|g|ｇ|グラム|ml|mL|ＭＬ|L|l|リットル|個|本|袋|パック|枚)/);
  if (!m) {
    const f = t.match(/^([½¼¾])\s*(個|本|袋|パック|枚)/);
    return f ? { num: FRACTION[f[1]], unit: f[2] as StockUnit } : null;
  }
  let num = Number(m[1]);
  if (m[2]) num = Number(m[1]) / Number(m[2]);
  if (m[3]) num += FRACTION[m[3]];
  let unit = m[4];
  if (/^(kg|KG|Kg|キロ)$/.test(unit)) return { num: num * 1000, unit: "g" };
  if (/^(L|l|リットル)$/.test(unit)) return { num: num * 1000, unit: "ml" };
  if (/^(g|ｇ|グラム)$/.test(unit)) unit = "g";
  if (/^(ml|mL|ＭＬ)$/.test(unit)) unit = "ml";
  if (!(num > 0)) return null;
  return { num, unit: unit as StockUnit };
}

export const showQty = (q: Qty) => `${Math.round(q.num * 100) / 100}${q.unit}`;

export interface StockWrite {
  id: string;
  remaining: string;
  /** 変えるときだけ */
  status?: StockStatus;
}

export interface ConsumePlan {
  entries: ConsumedEntry[];
  writes: StockWrite[];
}

function findStock(name: string, inventory: InventoryItem[], unit: StockUnit | null): InventoryItem | null {
  const key = normalizeName(name);
  // 「卵」のような1文字の名前は、同じ名前のときだけ同じ物とみなす
  const hits = inventory.filter((i) => normalizeName(i.name) === key || sameFood(name, i.name));
  if (!hits.length) return null;
  const exact = hits.filter((i) => normalizeName(i.name) === key);
  const pool = exact.length ? exact : hits;
  return pool.find((i) => unit && parseQty(i.remaining)?.unit === unit) ?? pool[0];
}

/** レシピの材料を在庫から引く計画を立てる。在庫は変えない */
export function planConsume(meal: Meal, inventory: InventoryItem[]): ConsumePlan {
  const items = parseRecipe(parseMarkdown(meal.recipe ?? "")).ingredients.filter((x) => x.name);
  const entries: ConsumedEntry[] = [];
  const need = new Map<string, { item: InventoryItem; qty: Qty; name: string }>();
  const skip = (name: string, amount: string, reason: string) =>
    entries.push({ name: amount ? `${name} ${amount}` : name, inventoryId: null, qty: null, unit: null, before: null, prevStatus: null, reason });

  for (const x of items) {
    const q = x.amount ? parseQty(x.amount) : null;
    const stock = findStock(x.name, inventory, q?.unit ?? null);
    if (!stock) {
      skip(x.name, x.amount, "在庫にない");
      continue;
    }
    if (!q) {
      skip(x.name, x.amount, x.amount ? "分量を数と単位で読めない" : "分量がない");
      continue;
    }
    const have = parseQty(stock.remaining);
    if (!have) {
      skip(x.name, x.amount, "在庫の数量が数と単位で入っていない");
      continue;
    }
    if (have.unit !== q.unit) {
      skip(x.name, x.amount, `在庫は${have.unit}で数えている`);
      continue;
    }
    const prev = need.get(stock.id);
    need.set(stock.id, { item: stock, qty: { num: (prev?.qty.num ?? 0) + q.num, unit: q.unit }, name: prev?.name ?? x.name });
  }

  const writes: StockWrite[] = [];
  for (const { item, qty, name } of need.values()) {
    const have = parseQty(item.remaining)!;
    const left = Math.max(0, Math.round((have.num - qty.num) * 100) / 100);
    const out = left === 0 && item.status !== "切れた";
    writes.push({ id: item.id, remaining: `${left}${have.unit}`, ...(out && { status: "切れた" as const }) });
    entries.push({
      name,
      inventoryId: item.id,
      qty: Math.min(qty.num, have.num),
      unit: have.unit,
      before: item.remaining,
      prevStatus: out ? item.status : null,
      reason: null,
    });
  }
  // 引けた物を先に、引けなかった物をあとに
  entries.sort((a, b) => Number(b.inventoryId != null) - Number(a.inventoryId != null));
  return { entries, writes };
}

/** 「作った」を取り消すとき、引いた分を在庫に戻す計画。在庫が消えていたり、単位が変わっていたら戻さない */
export function planRestore(consumed: ConsumedEntry[], inventory: InventoryItem[]): StockWrite[] {
  const byId = new Map(inventory.map((i) => [i.id, i]));
  const writes: StockWrite[] = [];
  for (const e of consumed) {
    if (!e.inventoryId || !e.qty || !e.unit) continue;
    const item = byId.get(e.inventoryId);
    if (!item) continue;
    const have = parseQty(item.remaining);
    if (have && have.unit !== e.unit) continue;
    const num = Math.round(((have?.num ?? 0) + e.qty) * 100) / 100;
    const back = e.prevStatus && item.status === "切れた";
    writes.push({ id: item.id, remaining: `${num}${e.unit}`, ...(back && { status: e.prevStatus! }) });
  }
  return writes;
}
