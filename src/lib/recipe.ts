// 献立の recipe（Markdown）を、調理中に見やすい形（材料・手順・そのほか）に分ける。

import type { Block, RichText } from "./types";

export interface RecipeIngredient {
  name: string;
  amount: string;
}

export interface RecipeStep {
  rich: RichText[];
  children: Block[];
}

export interface RecipeSection {
  title: string;
  blocks: Block[];
}

export interface ParsedRecipe {
  ingredients: RecipeIngredient[];
  steps: RecipeStep[];
  /** 材料・作り方のどちらでもない節（下ごしらえ・ポイントなど）と、見出しの前の文 */
  extras: RecipeSection[];
}

const plain = (rich: RichText[] = []) => rich.map((r) => r.t).join("").trim();

const AMOUNT = /^(.+?)[\s　]+((?:[0-9０-９½¼¾]|大さじ|小さじ|少々|適量|ひとつまみ|お好み|約).*)$/;

/** 「豚こま 150g」「しょうゆ：大さじ1」を名前と分量に分ける。分けられなければ名前だけ */
export function splitAmount(text: string): RecipeIngredient {
  const t = text.trim();
  const colon = /^(.+?)\s*[:：]\s*(.+)$/.exec(t);
  if (colon) return { name: colon[1].trim(), amount: colon[2].trim() };
  const m = AMOUNT.exec(t);
  return m ? { name: m[1].trim(), amount: m[2].trim() } : { name: t, amount: "" };
}

export function parseRecipe(blocks: Block[]): ParsedRecipe {
  const out: ParsedRecipe = { ingredients: [], steps: [], extras: [] };
  let kind: "ing" | "steps" | "extra" = "extra";
  let extra: RecipeSection | null = null;
  for (const b of blocks) {
    if (b.type === "h1" || b.type === "h2" || b.type === "h3") {
      const title = plain(b.rich);
      if (/材料/.test(title)) kind = "ing";
      else if (/作り方|手順/.test(title)) kind = "steps";
      else {
        kind = "extra";
        extra = { title, blocks: [] };
        out.extras.push(extra);
      }
      continue;
    }
    if (kind === "ing" && (b.type === "ul" || b.type === "todo" || b.type === "ol")) out.ingredients.push(splitAmount(plain(b.rich)));
    else if (kind === "steps" && b.type === "ol") out.steps.push({ rich: b.rich ?? [], children: b.children ?? [] });
    else if (kind === "steps" && b.type === "ul" && out.steps.length === 0) out.steps.push({ rich: b.rich ?? [], children: b.children ?? [] });
    else if (kind === "ing" || kind === "steps") continue;
    else {
      if (!extra) {
        extra = { title: "", blocks: [] };
        out.extras.push(extra);
      }
      extra.blocks.push(b);
    }
  }
  return out;
}

/** 火加減・時間・レンジのW数。手順の中で目立たせる */
export const KEY_PHRASE = /(?:極?弱めの?火|弱火|中火|強めの?中火|強火|\d+(?:[〜~～-]\d+)?\s*分(?:間)?|\d+\s*秒|\d{3,4}\s*[Ww]|余熱)/g;

/** 手順の文を、強調する部分とそれ以外に分ける */
export function splitKeyPhrases(text: string): { text: string; key: boolean }[] {
  const parts: { text: string; key: boolean }[] = [];
  let last = 0;
  for (const m of text.matchAll(KEY_PHRASE)) {
    if (m.index! > last) parts.push({ text: text.slice(last, m.index), key: false });
    parts.push({ text: m[0], key: true });
    last = m.index! + m[0].length;
  }
  if (last < text.length) parts.push({ text: text.slice(last), key: false });
  return parts;
}
