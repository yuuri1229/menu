// 日付はすべて日本時間の「YYYY-MM-DD」文字列で扱う。

const WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"];

/** 日本時間の今日 */
export function todayJST(now = new Date()): string {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Tokyo" }).format(now);
}

export function hourJST(now = new Date()): number {
  return Number(new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Tokyo", hour: "numeric", hourCycle: "h23" }).format(now));
}

const toUTC = (d: string) => {
  const [y, m, day] = d.split("-").map(Number);
  return Date.UTC(y, m - 1, day);
};
const fromUTC = (t: number) => new Date(t).toISOString().slice(0, 10);

export function addDays(d: string, n: number): string {
  return fromUTC(toUTC(d) + n * 86400000);
}

export function diffDays(a: string, b: string): number {
  return Math.round((toUTC(a) - toUTC(b)) / 86400000);
}

export function weekday(d: string): number {
  return new Date(toUTC(d)).getUTCDay();
}

/** その日を含む週の月曜日 */
export function weekStart(d: string): string {
  const w = weekday(d);
  return addDays(d, w === 0 ? -6 : 1 - w);
}

export function weekDays(start: string): string[] {
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

export function wd(d: string): string {
  return WEEKDAYS[weekday(d)];
}

/** 10/15 */
export function md(d: string): string {
  const [, m, day] = d.split("-").map(Number);
  return `${m}/${day}`;
}

/** 10/15(木) */
export function mdw(d: string): string {
  return `${md(d)}(${wd(d)})`;
}

/** 10月15日 */
export function mdJa(d: string): string {
  const [, m, day] = d.split("-").map(Number);
  return `${m}月${day}日`;
}

export function relativeDay(d: string, today: string): string | null {
  const n = diffDays(d, today);
  if (n === 0) return "今日";
  if (n === 1) return "明日";
  if (n === 2) return "あさって";
  if (n === -1) return "昨日";
  return null;
}

export function timeAgo(iso: string | null, now = new Date()): string {
  if (!iso) return "未同期";
  const sec = Math.max(0, (now.getTime() - new Date(iso).getTime()) / 1000);
  if (sec < 60) return "たった今";
  if (sec < 3600) return `${Math.floor(sec / 60)}分前`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}時間前`;
  return `${Math.floor(sec / 86400)}日前`;
}
