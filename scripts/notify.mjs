// プッシュ通知の中身を組み立てる（送るのは scripts/db.mjs）。データを受け取って文を返すだけなので、テストできる。

/** 献立メモから段取りとして拾う言葉。src/lib/config.ts の PREP_KEYWORDS と同じにする */
export const PREP_KEYWORDS = ["炊飯", "予約", "取り分け", "冷凍", "解凍", "冷蔵庫に移", "仕込み", "前日", "朝は"];

const SLOT_ORDER = { 朝食: 0, 昼食: 1, 夕食: 2 };
const SLOT_SHORT = { 朝食: "朝", 昼食: "昼", 夕食: "夜" };
const WEEKDAY = ["日", "月", "火", "水", "木", "金", "土"];

/** 日本時間の日付（YYYY-MM-DD）。offset 日ずらせる */
export function jstDate(now = new Date(), offset = 0) {
  return new Date(now.getTime() + 9 * 3600_000 + offset * 86400_000).toISOString().slice(0, 10);
}

function label(date) {
  const d = new Date(`${date}T00:00:00Z`);
  return `${d.getUTCMonth() + 1}/${d.getUTCDate()}(${WEEKDAY[d.getUTCDay()]})`;
}

/** メモの中の段取りの文（src/lib/meals.ts の prepTips と同じ分け方） */
export function prepTips(memo = "") {
  return memo
    .split(/(?<=。)|(?=【)/)
    .map((s) => s.trim())
    .filter((s) => s && !/^【実績】/.test(s) && !/^\d{1,2}\/\d{1,2}変更/.test(s))
    .filter((s) => PREP_KEYWORDS.some((k) => s.includes(k)));
}

const shortTitle = (t = "") => t.replace(/^【[^】]*】/, "").split("＋")[0].trim();

/**
 * 夜のリマインド。明日の買い物（まだ買っていない食材）と、明日の献立の段取り・外食や不在の予定を1通にまとめる。
 * どれも無い日は null（送らない）。予定のある食事の段取りは出さない。
 */
export function buildReminder({ meals = [], ingredients = [], plans = [] }, tomorrow) {
  const lines = [];

  const toBuy = ingredients.filter((i) => i.tripDate === tomorrow && !i.bought && !/取りやめ/.test(i.name));
  if (toBuy.length) {
    const trip = toBuy[0].trip ?? "";
    const total = toBuy.reduce((s, i) => s + (i.estimate ?? 0), 0);
    const names = toBuy.slice(0, 4).map((i) => i.name).join("・");
    lines.push(`買い物${trip ? ` ${trip.split(/\s/)[0]}` : ""}：${names}${toBuy.length > 4 ? ` ほか${toBuy.length - 4}品` : ""}${total ? `（約${total.toLocaleString("ja-JP")}円）` : ""}`);
  }

  const dayPlans = plans.filter((p) => !p.canceled && p.date === tomorrow);
  const away = new Set(dayPlans.flatMap((p) => p.slots ?? []));
  const dayMeals = meals
    .filter((m) => m.date === tomorrow && !away.has(m.slot))
    .sort((a, b) => (SLOT_ORDER[a.slot] ?? 9) - (SLOT_ORDER[b.slot] ?? 9));
  const tips = [...new Set(dayMeals.flatMap((m) => prepTips(m.memo)))];
  for (const t of tips.slice(0, 3)) lines.push(`段取り：${t}`);
  for (const p of dayPlans) {
    const slots = [...p.slots].sort((a, b) => SLOT_ORDER[a] - SLOT_ORDER[b]).map((s) => SLOT_SHORT[s]).join("・");
    lines.push(`予定：${slots} ${p.kind}${p.memo?.trim() ? `（${p.memo.trim().split("\n")[0]}）` : ""}`);
  }

  if (!lines.length) return null;
  const menu = dayMeals.map((m) => `${SLOT_SHORT[m.slot] ?? ""} ${shortTitle(m.title)}`).join("／");
  if (menu) lines.push(`献立：${menu}`);
  return {
    title: `明日 ${label(tomorrow)} の準備`,
    body: lines.join("\n"),
    url: toBuy.length ? "shopping/" : "",
    tag: `remind-${tomorrow}`,
  };
}
