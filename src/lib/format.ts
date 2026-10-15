export const yen = (n: number | null | undefined) =>
  n == null ? "—" : `${Math.round(n).toLocaleString("ja-JP")}円`;

export const sum = (xs: (number | null | undefined)[]) => xs.reduce<number>((a, b) => a + (b ?? 0), 0);

export function groupBy<T, K extends string>(xs: T[], key: (x: T) => K): Map<K, T[]> {
  const m = new Map<K, T[]>();
  for (const x of xs) {
    const k = key(x);
    const arr = m.get(k);
    if (arr) arr.push(x);
    else m.set(k, [x]);
  }
  return m;
}
