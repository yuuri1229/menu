// scripts/notion-normalize.mjs が作る形と同じ。

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
  actual: number | null;
  bought: boolean;
  memo: string;
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
}
