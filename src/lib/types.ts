// Firestore の形（scripts/schema.mjs）に、アプリが計算して足す項目（※）を加えたもの。

export type Slot = "朝食" | "昼食" | "夕食";
export const SLOTS: Slot[] = ["朝食", "昼食", "夕食"];

export interface Meal {
  id: string;
  title: string;
  date: string | null;
  slot: Slot | null;
  main: string;
  sides: string;
  memo: string;
  /** 材料・作り方・ポイント（Markdown） */
  recipe: string;
  genre: string | null;
  minutes: number | null;
  done: boolean;
  prepAhead: boolean;
  ingredientIds: string[];
}

export interface Ingredient {
  id: string;
  name: string;
  category: string | null;
  storage: string | null;
  trip: string | null;
  tripDate: string | null;
  amount: string;
  estimate: number | null;
  bought: boolean;
  memo: string;
  /** ※ この食材につながる買い物明細の合計（なければ null） */
  actual: number | null;
  /** ※ この食材を使う献立 */
  mealIds: string[];
}

export interface Purchase {
  id: string;
  name: string;
  amount: number | null;
  store: string | null;
  trip: string | null;
  tripDate: string | null;
  category: string | null;
  date: string | null;
  carryOver: boolean;
  memo: string;
  receiptNo: string;
  ingredientIds: string[];
}

export type StockStatus = "十分" | "残りわずか" | "切れた" | "要確認";

export interface InventoryItem {
  id: string;
  name: string;
  category: string | null;
  storage: string | null;
  status: StockStatus | null;
  remaining: string;
  memo: string;
  seafood: "問題なし" | "要確認" | "NG" | null;
  bestBefore: string | null;
  purchasedAt: string | null;
}

/** 献立の感想。選択肢は scripts/schema.mjs・firestore.rules と同じにする。評価は 1〜5 */
export const RATINGS = [1, 2, 3, 4, 5] as const;
export type Rating = (typeof RATINGS)[number];
export const RATING_LABELS: Record<Rating, string> = { 1: "苦手", 2: "いまいち", 3: "ふつう", 4: "好き", 5: "大好き" };
export const FEEDBACK_TAGS = ["味が濃い", "味が薄い", "量が多い", "量が少ない", "手間だった", "また食べたい", "苦手な食材"] as const;
export type FeedbackTag = (typeof FEEDBACK_TAGS)[number];
export const FEEDBACK_TEXT_MAX = 500;

export interface Feedback {
  /** 献立の id と同じ */
  id: string;
  mealId: string;
  /** 送った時点の献立名・日付・朝昼夜（献立が組み直されても何への感想か分かるように） */
  mealTitle: string;
  date: string | null;
  slot: Slot | null;
  rating: Rating;
  tags: FeedbackTag[];
  text: string;
  uid: string | null;
  updatedAt: string | null;
  /** Claude が好みの記録にまとめた時刻（まだなら null） */
  reflectedAt: string | null;
}

export interface RichText {
  t: string;
  b?: boolean;
  i?: boolean;
  s?: boolean;
  c?: boolean;
  u?: boolean;
  color?: string;
  href?: string;
}

export interface Block {
  type: "h1" | "h2" | "h3" | "p" | "ul" | "ol" | "todo" | "quote" | "callout" | "toggle" | "divider" | "table" | "page" | "database" | "code";
  rich?: RichText[];
  checked?: boolean;
  icon?: string;
  children?: Block[];
  rows?: RichText[][][];
  header?: boolean;
  ref?: string;
}

export interface Note {
  id: string;
  title: string;
  icon: string | null;
  kind: "week" | "rules" | "page";
  start: string | null;
  end: string | null;
  markdown: string;
  /** ※ markdown を表示用に変換したもの */
  blocks: Block[];
  editedAt: string | null;
}

export interface Snapshot {
  syncedAt: string | null;
  meals: Meal[];
  ingredients: Ingredient[];
  purchases: Purchase[];
  inventory: InventoryItem[];
  notes: Note[];
  feedback: Feedback[];
}
