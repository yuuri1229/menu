// 外食・不在の予定（plans）を Claude が読みやすい形に並べる（読み書きは scripts/db.mjs）。データを受け取って文を返すだけなので、テストできる。

const SLOT_ORDER = { 朝食: 0, 昼食: 1, 夕食: 2 };
const WEEKDAY = ["日", "月", "火", "水", "木", "金", "土"];

/** 予定がその日のその食事を含むか。数日の予定は、出発日の slots・間の日の全食事・帰宅日の endSlots（src/lib/plans.ts と同じ） */
export function planCovers(p, date, slot) {
  if (!p.endDate) return p.date === date && !!p.slots?.includes(slot);
  if (date === p.date) return !!p.slots?.includes(slot);
  if (date === p.endDate) return !!p.endSlots?.includes(slot);
  return date > p.date && date < p.endDate;
}

/** その日のその食事に外食・不在の予定があるか（取り消し済みは除く） */
export function planAt(plans = [], date, slot) {
  return plans.find((p) => !p.canceled && planCovers(p, date, slot)) ?? null;
}

const lastDate = (p) => p.endDate ?? p.date ?? "";

/**
 * 献立にまだ反映していない予定（新しく入った・書き直された・取り消された）。今日より前は除く。
 * all=true なら反映済みも。日付の順
 */
export function pendingPlans(plans = [], today, { all = false } = {}) {
  return plans
    .filter((p) => (all || !p.handledAt) && (!today || lastDate(p) >= today))
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
  const sorted = (list = []) => [...list].sort((a, b) => SLOT_ORDER[a] - SLOT_ORDER[b]);
  const when = p.endDate
    ? `${label(p.date)} ${sorted(p.slots)[0] ?? ""}〜${label(p.endDate)} ${sorted(p.endSlots).at(-1) ?? ""}`
    : `${p.date ? label(p.date) : "日付なし"} ${sorted(p.slots).join("・")}`;
  const head = [when, `${p.kind ?? "？"}${p.memo?.trim() ? `「${p.memo.trim().replace(/\s*\n\s*/g, " / ")}」` : ""}`, state, `(${p.id})`].join(" ");
  // 期間中の各日の献立（前後の日は、帰宅日の弁当や出発前の使い切りを考えるために含めない）
  const lines = [head];
  for (let d = p.date; d && d <= lastDate(p); d = nextDay(d)) {
    const day = meals
      .filter((m) => m.date === d)
      .sort((a, b) => (SLOT_ORDER[a.slot] ?? 9) - (SLOT_ORDER[b.slot] ?? 9))
      .map((m) => `${{ 朝食: "朝", 昼食: "昼", 夕食: "夜" }[m.slot] ?? ""} ${m.title}${planCovers(p, d, m.slot) ? "（← 予定の食事）" : ""}`);
    lines.push(`  ${p.endDate ? label(d) : "この日"}の献立: ${day.length ? day.join("／") : "なし"}`);
  }
  return lines.join("\n");
}

function nextDay(date) {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

function label(date) {
  const d = new Date(`${date}T00:00:00Z`);
  return `${d.getUTCMonth() + 1}/${d.getUTCDate()}(${WEEKDAY[d.getUTCDay()]})`;
}
