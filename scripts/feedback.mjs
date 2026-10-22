import { RATING_LABELS } from "./schema.mjs";

// 献立の感想（feedback）を Claude が読みやすい形に並べる（読み書きは scripts/db.mjs）。データを受け取って文を返すだけなので、テストできる。

const SLOT_ORDER = { 朝食: 0, 昼食: 1, 夕食: 2 };

/** 反映待ち（まだ好みの記録にまとめていない）感想。all=true なら全部。新しい献立の順 */
export function pendingFeedback(feedback = [], { all = false } = {}) {
  return feedback
    .filter((f) => all || !f.reflectedAt)
    .sort(
      (a, b) =>
        (b.date ?? "").localeCompare(a.date ?? "") ||
        (SLOT_ORDER[b.slot] ?? 9) - (SLOT_ORDER[a.slot] ?? 9) ||
        (b.updatedAt ?? "").localeCompare(a.updatedAt ?? ""),
    );
}

/**
 * 1件を数行にする。献立がまだあれば、作り方・メモの代わりに主菜と食材名を添える（何への感想か分かるように）。
 *   10/23(金) 夕食 鶏の塩レモンソテー＋千切りキャベツ 【好き 4/5】  [味が薄い・また食べたい]  (id)
 *     「塩はもう少し多くていい」
 *     食材: 鶏むね肉、レモン汁
 */
export function formatFeedback(f, { meals = [], ingredients = [] } = {}) {
  const meal = meals.find((m) => m.id === f.mealId);
  const ingName = new Map(ingredients.map((i) => [i.id, i.name]));
  const head = [
    f.date ? label(f.date) : "日付なし",
    f.slot ?? "",
    meal?.title ?? f.mealTitle ?? "（献立は消えています）",
    `【${RATING_LABELS[f.rating] ?? "？"} ${f.rating ?? "?"}/5】`,
    f.tags?.length ? ` [${f.tags.join("・")}]` : "",
    f.reflectedAt ? ` 反映済み ${f.reflectedAt.slice(0, 10)}` : "",
    ` (${f.mealId ?? f.id})`,
  ]
    .filter(Boolean)
    .join(" ");
  const lines = [head];
  if (f.text?.trim()) lines.push(`  「${f.text.trim().replace(/\s*\n\s*/g, " / ")}」`);
  const names = (meal?.ingredientIds ?? []).map((id) => ingName.get(id)).filter(Boolean);
  if (names.length) lines.push(`  食材: ${names.join("、")}`);
  return lines.join("\n");
}

const WEEKDAY = ["日", "月", "火", "水", "木", "金", "土"];
function label(date) {
  const d = new Date(`${date}T00:00:00Z`);
  return `${d.getUTCMonth() + 1}/${d.getUTCDate()}(${WEEKDAY[d.getUTCDay()]})`;
}
