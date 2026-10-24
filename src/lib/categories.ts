/**
 * 在庫・買い物リストの分類の選択肢（表示順）。Claude の献立づくり（scripts/db.mjs）で使ってきた値に合わせ、
 * データにこれ以外の分類があれば画面側で後ろに足して選べるようにする。
 */
export const CATEGORIES = [
  "野菜",
  "肉",
  "卵・大豆製品",
  "乳製品・果物",
  "主食",
  "冷凍食品",
  "練り物・加工品",
  "レトルト・料理の素",
  "乾物・粉",
  "調味料",
  "油",
  "飲料",
  "消耗品",
  "その他",
] as const;

/** 決まった分類に、データにある分類（空でない物）を後ろに足す */
export function categoryOptions(used: (string | null)[]): string[] {
  return [...new Set<string>([...CATEGORIES, ...used.filter((c): c is string => !!c)])];
}
