// レシートの登録待ち（receipts）を Claude が読みやすい形に並べる（読み書きは scripts/db.mjs）。データを受け取って文を返すだけなので、テストできる。

/** 重さと期限をまだアプリで登録していないレシート。all=true なら登録済みも。新しい順 */
export function pendingReceipts(receipts = [], { all = false } = {}) {
  return receipts
    .filter((r) => all || !r.registeredAt)
    .sort((a, b) => (b.date ?? "").localeCompare(a.date ?? "") || (b.createdAt ?? "").localeCompare(a.createdAt ?? ""));
}

const WEEKDAY = ["日", "月", "火", "水", "木", "金", "土"];
function label(date) {
  const d = new Date(`${date}T00:00:00Z`);
  return `${d.getUTCMonth() + 1}/${d.getUTCDate()}(${WEEKDAY[d.getUTCDay()]})`;
}

/**
 *   10/28(水) マルエツ 3品 ¥666  登録待ち  (id)
 *     豚こま切れ ¥348 300g 期限 10/31
 */
export function formatReceipt(r) {
  const head = [
    r.date ? label(r.date) : "日付なし",
    r.store ?? "",
    `${r.items?.length ?? 0}品`,
    r.total != null ? `¥${r.total.toLocaleString("ja-JP")}` : "",
    r.registeredAt ? `登録済み ${r.registeredAt.slice(0, 10)}` : "登録待ち",
    `(${r.id})`,
  ]
    .filter(Boolean)
    .join(" ");
  const lines = (r.items ?? []).map((it) =>
    [
      " ",
      it.name,
      it.amount != null ? `¥${it.amount.toLocaleString("ja-JP")}` : "",
      it.grams != null ? `${it.grams}g` : "",
      it.bestBefore ? `期限 ${it.bestBefore.slice(5).replace("-", "/").replace(/^0/, "").replace("/0", "/")}` : "",
    ]
      .filter(Boolean)
      .join(" "),
  );
  return [head, ...lines].join("\n");
}
