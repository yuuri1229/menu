// 外食・不在の予定（plans）を Claude が読みやすい形に並べる（読み書きは scripts/db.mjs）。データを受け取って文を返すだけなので、テストできる。

const SLOT_ORDER = { 朝食: 0, 昼食: 1, 夕食: 2 };
const WEEKDAY = ["日", "月", "火", "水", "木", "金", "土"];

/** その日のその食事に外食・不在の予定があるか（取り消し済みは除く） */
export function planAt(plans = [], date, slot) {
  return plans.find((p) => !p.canceled && p.date === date && p.slots?.includes(slot)) ?? null;
}

/**
 * 献立にまだ反映していない予定（新しく入った・書き直された・取り消された）。今日より前は除く。
 * all=true なら反映済みも。日付の順
 */
export function pendingPlans(plans = [], today, { all = false } = {}) {
  return plans
    .filter((p) => (all || !p.handledAt) && (!today || (p.date ?? "") >= today))
    .sort((a, b) => (a.date ?? "").localeCompare(b.date ?? "") || firstSlot(a) - firstSlot(b));
}

const firstSlot = (p) => Math.min(...(p.slots ?? []).map((s) => SLOT_ORDER[s] ?? 9), 9);

/**
 * 1件を数行にする。その日の献立も添えて、何を組み直すか分かるようにする。
 *   10/27(火) 夕食 外食「会社の飲み会」 反映待ち (id)
 *     この日の献立: 朝 納豆ご飯／昼 弁当／夜 生姜焼き＋千切りキャベツ（← 予定の食事）
 */
export function formatPlan(p, { meals = [] } = {}) {
  const state = p.canceled ? "取り消し（献立を戻す）" : p.handledAt ? `反映済み ${p.handledAt.slice(0, 10)}` : "反映待ち";
  const slots = [...(p.slots ?? [])].sort((a, b) => SLOT_ORDER[a] - SLOT_ORDER[b]).join("・");
  const head = [p.date ? label(p.date) : "日付なし", slots, `${p.kind ?? "？"}${p.memo?.trim() ? `「${p.memo.trim().replace(/\s*\n\s*/g, " / ")}」` : ""}`, state, `(${p.id})`].join(" ");
  const day = meals
    .filter((m) => m.date === p.date)
    .sort((a, b) => (SLOT_ORDER[a.slot] ?? 9) - (SLOT_ORDER[b.slot] ?? 9))
    .map((m) => `${{ 朝食: "朝", 昼食: "昼", 夕食: "夜" }[m.slot] ?? ""} ${m.title}${p.slots?.includes(m.slot) ? "（← 予定の食事）" : ""}`);
  return day.length ? `${head}\n  この日の献立: ${day.join("／")}` : `${head}\n  この日の献立: なし`;
}

function label(date) {
  const d = new Date(`${date}T00:00:00Z`);
  return `${d.getUTCMonth() + 1}/${d.getUTCDate()}(${WEEKDAY[d.getUTCDay()]})`;
}
