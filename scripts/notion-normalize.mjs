// Notion API のページ・ブロックを、サイトで使う形（src/lib/types.ts と同じ形）に変換する。
// 副作用のない関数だけを置き、notion-normalize.test.mjs でテストする。

/** Notion のプロパティ名。Notion 側で名前を変えたらここを合わせる。 */
export const PROPS = {
  meal: {
    title: "メニュー名",
    date: "日付",
    slot: "食事区分",
    main: "主菜",
    sides: "副菜・汁物",
    memo: "メモ",
    genre: "ジャンル",
    minutes: "調理時間(分)",
    done: "作った",
    prepAhead: "作り置き",
    ingredients: "使う食材",
  },
  ingredient: {
    name: "食材名",
    category: "区分",
    storage: "保存",
    trip: "買い物回",
    amount: "購入量",
    estimate: "金額目安",
    actual: "実績金額",
    diff: "予定との差",
    bought: "購入済み",
    memo: "メモ",
    meals: "使う献立",
  },
  purchase: {
    name: "品名",
    amount: "金額",
    store: "店舗",
    trip: "買い物回",
    category: "費目",
    date: "購入日",
    carryOver: "繰り越し",
    memo: "メモ",
    receiptNo: "レシートNo",
    ingredients: "対応食材",
  },
  inventory: {
    name: "品名",
    category: "区分",
    storage: "保管",
    status: "状態",
    remaining: "残量メモ",
    memo: "メモ",
    seafood: "魚介チェック",
    bestBefore: "賞味期限",
    purchasedAt: "購入日",
  },
};

export function plainText(richText) {
  return (richText ?? []).map((r) => r.plain_text ?? r.text?.content ?? "").join("");
}

/** プロパティの値を、型に応じて素の値（文字列・数値・真偽・配列）にする。 */
export function propValue(page, name) {
  const p = page?.properties?.[name];
  if (!p) return null;
  switch (p.type) {
    case "title":
      return plainText(p.title) || "";
    case "rich_text":
      return plainText(p.rich_text) || "";
    case "number":
      return p.number ?? null;
    case "select":
      return p.select?.name ?? null;
    case "status":
      return p.status?.name ?? null;
    case "multi_select":
      return (p.multi_select ?? []).map((o) => o.name);
    case "checkbox":
      return Boolean(p.checkbox);
    case "date":
      return p.date?.start ?? null;
    case "relation":
      return (p.relation ?? []).map((r) => r.id);
    case "rollup":
      return rollupValue(p.rollup);
    case "formula":
      return formulaValue(p.formula);
    case "url":
      return p.url ?? null;
    default:
      return null;
  }
}

function rollupValue(r) {
  if (!r) return null;
  if (r.type === "number") return r.number ?? null;
  if (r.type === "date") return r.date?.start ?? null;
  if (r.type === "array") return r.array?.length ?? 0;
  return null;
}

function formulaValue(f) {
  if (!f) return null;
  if (f.type === "number") return f.number ?? null;
  if (f.type === "string") return f.string ?? null;
  if (f.type === "boolean") return f.boolean ?? null;
  if (f.type === "date") return f.date?.start ?? null;
  return null;
}

const str = (v) => (typeof v === "string" ? v : "");
const num = (v) => (typeof v === "number" && Number.isFinite(v) ? v : null);
const ids = (v) => (Array.isArray(v) ? v : []);
const dateOnly = (v) => (typeof v === "string" ? v.slice(0, 10) : null);

/**
 * 「① 10/12(月)」のような月/日だけのラベルを YYYY-MM-DD にする。
 * 年は基準日（同期した日）にいちばん近い年を選ぶ（年末年始をまたいでも正しくなる）。
 */
export function parseMonthDay(label, now = new Date()) {
  const m = /(\d{1,2})\s*\/\s*(\d{1,2})/.exec(label ?? "");
  if (!m) return null;
  const month = Number(m[1]);
  const day = Number(m[2]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const y = now.getUTCFullYear();
  let best = null;
  for (const year of [y - 1, y, y + 1]) {
    const t = Date.UTC(year, month - 1, day);
    const d = Math.abs(t - now.getTime());
    if (!best || d < best.d) best = { year, d };
  }
  return `${best.year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** 「買い物リスト・予算（10/12〜10/18）」から期間を取り出す。 */
export function parseRange(title, now = new Date()) {
  const m = /(\d{1,2}\/\d{1,2})\s*[〜~～\-–]\s*(\d{1,2}\/\d{1,2})/.exec(title ?? "");
  if (!m) return { start: null, end: null };
  const start = parseMonthDay(m[1], now);
  let end = parseMonthDay(m[2], now);
  if (start && end && end < start) {
    // 12/28〜1/3 のように年をまたぐ場合
    end = `${Number(end.slice(0, 4)) + 1}${end.slice(4)}`;
  }
  return { start, end };
}

export function normalizeMeal(page) {
  const P = PROPS.meal;
  const v = (k) => propValue(page, P[k]);
  return {
    id: page.id,
    title: str(v("title")),
    date: dateOnly(v("date")),
    slot: v("slot") ?? null,
    main: str(v("main")),
    sides: str(v("sides")),
    memo: str(v("memo")),
    genre: v("genre") ?? null,
    minutes: num(v("minutes")),
    done: Boolean(v("done")),
    prepAhead: Boolean(v("prepAhead")),
    ingredientIds: ids(v("ingredients")),
    editedAt: page.last_edited_time ?? null,
  };
}

export function normalizeIngredient(page, now = new Date()) {
  const P = PROPS.ingredient;
  const v = (k) => propValue(page, P[k]);
  const trip = v("trip") ?? null;
  return {
    id: page.id,
    name: str(v("name")),
    category: v("category") ?? null,
    storage: v("storage") ?? null,
    trip,
    tripDate: trip ? parseMonthDay(trip, now) : null,
    amount: str(v("amount")),
    estimate: num(v("estimate")),
    actual: num(v("actual")),
    bought: Boolean(v("bought")),
    memo: str(v("memo")),
    mealIds: ids(v("meals")),
    editedAt: page.last_edited_time ?? null,
  };
}

export function normalizePurchase(page, now = new Date()) {
  const P = PROPS.purchase;
  const v = (k) => propValue(page, P[k]);
  const trip = v("trip") ?? null;
  return {
    id: page.id,
    name: str(v("name")),
    amount: num(v("amount")),
    store: v("store") ?? null,
    trip,
    tripDate: trip ? parseMonthDay(trip, now) : null,
    category: v("category") ?? null,
    date: dateOnly(v("date")),
    carryOver: Boolean(v("carryOver")),
    memo: str(v("memo")),
    receiptNo: str(v("receiptNo")),
    ingredientIds: ids(v("ingredients")),
    editedAt: page.last_edited_time ?? null,
  };
}

export function normalizeInventory(page) {
  const P = PROPS.inventory;
  const v = (k) => propValue(page, P[k]);
  return {
    id: page.id,
    name: str(v("name")),
    category: v("category") ?? null,
    storage: v("storage") ?? null,
    status: v("status") ?? null,
    remaining: str(v("remaining")),
    memo: str(v("memo")),
    seafood: v("seafood") ?? null,
    bestBefore: dateOnly(v("bestBefore")),
    purchasedAt: dateOnly(v("purchasedAt")),
    editedAt: page.last_edited_time ?? null,
  };
}

/** Notion のリッチテキストを、表示に必要な装飾だけ残した形にする。 */
export function normalizeRichText(richText) {
  return (richText ?? [])
    .map((r) => {
      const a = r.annotations ?? {};
      const out = { t: r.plain_text ?? r.text?.content ?? "" };
      if (a.bold) out.b = true;
      if (a.italic) out.i = true;
      if (a.strikethrough) out.s = true;
      if (a.code) out.c = true;
      if (a.underline) out.u = true;
      if (a.color && a.color !== "default") out.color = a.color;
      const href = r.href ?? r.text?.link?.url;
      if (href) out.href = href;
      return out;
    })
    .filter((r) => r.t !== "");
}

const BLOCK_TYPES = {
  heading_1: "h1",
  heading_2: "h2",
  heading_3: "h3",
  paragraph: "p",
  bulleted_list_item: "ul",
  numbered_list_item: "ol",
  to_do: "todo",
  quote: "quote",
  callout: "callout",
  toggle: "toggle",
  divider: "divider",
  table: "table",
  child_page: "page",
  child_database: "database",
  code: "code",
};

/**
 * ブロック（children を再帰的に付けたもの）を表示用に変換する。
 * 対応していない種類（画像・埋め込みなど）は落とす。
 */
export function normalizeBlocks(blocks) {
  const out = [];
  for (const b of blocks ?? []) {
    const type = BLOCK_TYPES[b.type];
    if (!type) continue;
    const body = b[b.type] ?? {};
    const node = { type };
    if (type === "table") {
      node.rows = (b.children ?? [])
        .filter((r) => r.type === "table_row")
        .map((r) => (r.table_row?.cells ?? []).map((cell) => normalizeRichText(cell)));
      node.header = Boolean(body.has_column_header);
      out.push(node);
      continue;
    }
    if (type === "page" || type === "database") {
      node.rich = [{ t: body.title ?? "" }];
      node.ref = b.id;
    } else if (type !== "divider") {
      node.rich = normalizeRichText(body.rich_text);
    }
    if (type === "todo") node.checked = Boolean(body.checked);
    if (type === "callout" && body.icon?.type === "emoji") node.icon = body.icon.emoji;
    if (b.children?.length) node.children = normalizeBlocks(b.children);
    out.push(node);
  }
  return out;
}

/** 親ページ直下の子ページから、ノートの種類を決める。 */
export function classifyNote(title) {
  if (/買い物リスト|予算/.test(title)) return "week";
  if (/前提条件|調理環境/.test(title)) return "rules";
  return "page";
}

export function normalizeNote(page, blocks, now = new Date()) {
  const title = pageTitle(page);
  const kind = classifyNote(title);
  const { start, end } = kind === "week" ? parseRange(title, now) : { start: null, end: null };
  return {
    id: page.id,
    title,
    icon: page.icon?.type === "emoji" ? page.icon.emoji : null,
    kind,
    start,
    end,
    blocks: normalizeBlocks(blocks),
    editedAt: page.last_edited_time ?? null,
  };
}

export function pageTitle(page) {
  for (const p of Object.values(page?.properties ?? {})) {
    if (p?.type === "title") return plainText(p.title);
  }
  return "";
}
