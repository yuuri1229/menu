// Firestore に置くデータの形。Claude の CLI（scripts/db.mjs）はここで書き込みを検査し、
// アプリ（src/lib/types.ts）も同じ形で読む。項目を増やすときは両方を直す。

const SLOT = ["朝食", "昼食", "夕食"];
const STOCK = ["十分", "残りわずか", "切れた", "要確認"];
const SEAFOOD = ["問題なし", "要確認", "NG"];
const NOTE_KIND = ["week", "rules", "page"];
/** 献立の感想。アプリの献立シートで選ぶ（src/lib/types.ts・firestore.rules と同じにする） */
export const VERDICTS = ["好み", "ふつう", "合わない"];
export const FEEDBACK_TAGS = ["味が濃い", "味が薄い", "量が多い", "量が少ない", "手間だった", "また食べたい", "苦手な食材"];

/**
 * 型の書き方
 *   "string"   文字列（空文字可、null 不可）
 *   "string?"  文字列か null
 *   "number?"  数値か null
 *   "bool"     true / false
 *   "date?"    "YYYY-MM-DD" か null
 *   "ids"      文字列の配列（ほかの文書の id）
 *   [..]       列挙のどれか（null も可）
 *   {many:[..]} 列挙から選んだ配列（空も可）
 */
export const SCHEMA = {
  meals: {
    title: "string",
    date: "date?",
    slot: SLOT,
    main: "string",
    sides: "string",
    memo: "string",
    recipe: "string",
    genre: "string?",
    minutes: "number?",
    done: "bool",
    prepAhead: "bool",
    ingredientIds: "ids",
  },
  ingredients: {
    name: "string",
    category: "string?",
    storage: "string?",
    trip: "string?",
    tripDate: "date?",
    amount: "string",
    estimate: "number?",
    bought: "bool",
    memo: "string",
  },
  purchases: {
    name: "string",
    amount: "number?",
    store: "string?",
    trip: "string?",
    tripDate: "date?",
    category: "string?",
    date: "date?",
    carryOver: "bool",
    memo: "string",
    receiptNo: "string",
    ingredientIds: "ids",
  },
  inventory: {
    name: "string",
    category: "string?",
    storage: "string?",
    status: STOCK,
    remaining: "string",
    memo: "string",
    seafood: SEAFOOD,
    bestBefore: "date?",
    purchasedAt: "date?",
  },
  notes: {
    title: "string",
    icon: "string?",
    kind: NOTE_KIND,
    start: "date?",
    end: "date?",
    markdown: "string",
    editedAt: "string?",
  },
  // 献立ごとの感想。id は献立の id と同じ（1献立1件、送り直すと上書き）。アプリが書き、
  // Claude は好みの記録（notes/preferences）にまとめたら reflectedAt を付ける
  feedback: {
    mealId: "string",
    mealTitle: "string",
    date: "date?",
    slot: SLOT,
    verdict: VERDICTS,
    tags: { many: FEEDBACK_TAGS },
    text: "string",
    uid: "string?",
    updatedAt: "string?",
    reflectedAt: "string?",
  },
};

export const COLLECTIONS = Object.keys(SCHEMA);

/** アプリ（ログインしたメンバー）が書き換えてよい項目。firestore.rules と同じにする */
export const MEMBER_WRITABLE = {
  meals: ["done"],
  // 買い物リストは「買った」に加えて、項目の追加と（献立・明細が指していなければ）削除
  ingredients: ["bought"],
  // 在庫は新規登録と、魚介の確認（seafood）以外の項目の編集
  inventory: ["name", "category", "storage", "status", "remaining", "memo", "bestBefore", "purchasedAt"],
  // 感想は文書ごと書く（reflectedAt は空に戻すことだけできる）
  feedback: ["mealId", "mealTitle", "date", "slot", "verdict", "tags", "text", "uid", "updatedAt", "reflectedAt"],
};

/** 感想の本文の上限（firestore.rules と同じ） */
export const FEEDBACK_TEXT_MAX = 500;

const DATE = /^\d{4}-\d{2}-\d{2}$/;

function checkValue(type, v) {
  if (type?.many)
    return Array.isArray(v) && v.every((x) => type.many.includes(x)) ? null : `${type.many.join(" / ")} から選んだ配列`;
  if (Array.isArray(type)) return v === null || type.includes(v) ? null : `${type.join(" / ")} のどれか`;
  switch (type) {
    case "string":
      return typeof v === "string" ? null : "文字列";
    case "string?":
      return v === null || typeof v === "string" ? null : "文字列か null";
    case "number?":
      return v === null || (typeof v === "number" && Number.isFinite(v)) ? null : "数値か null";
    case "bool":
      return typeof v === "boolean" ? null : "true か false";
    case "date?":
      return v === null || (typeof v === "string" && DATE.test(v)) ? null : "YYYY-MM-DD か null";
    case "ids":
      return Array.isArray(v) && v.every((x) => typeof x === "string" && x) ? null : "id の配列";
    default:
      throw new Error(`未知の型 ${type}`);
  }
}

function defaultFor(type) {
  if (type?.many) return [];
  if (Array.isArray(type)) return null;
  return { string: "", "string?": null, "number?": null, bool: false, "date?": null, ids: [] }[type];
}

/**
 * 書き込む前に検査する。partial=true なら渡された項目だけ（部分更新）、
 * false なら足りない項目を既定値で埋めた完全な文書を返す。
 */
export function validate(collection, data, { partial = false } = {}) {
  const fields = SCHEMA[collection];
  if (!fields) throw new Error(`コレクション「${collection}」はありません（${COLLECTIONS.join(", ")}）`);
  if (data === null || typeof data !== "object" || Array.isArray(data)) throw new Error(`${collection}: 文書はオブジェクトで渡す`);
  const errors = [];
  const out = {};
  for (const [k, v] of Object.entries(data)) {
    if (k === "id") continue;
    if (!(k in fields)) {
      errors.push(`${k}: この項目はない（${Object.keys(fields).join(", ")}）`);
      continue;
    }
    const msg = checkValue(fields[k], v);
    if (msg) errors.push(`${k}: ${msg}にする（今は ${JSON.stringify(v)}）`);
    else out[k] = v;
  }
  if (!partial) {
    for (const [k, type] of Object.entries(fields)) if (!(k in out)) out[k] = defaultFor(type);
    const required = { meals: "title", ingredients: "name", purchases: "name", inventory: "name", notes: "title", feedback: "mealId" }[collection];
    if (!out[required]) errors.push(`${required}: 空にできない`);
  }
  if (errors.length) throw new Error(`${collection}${data.id ? `/${data.id}` : ""}: ${errors.join("; ")}`);
  return out;
}

/** id がほかの文書を正しく指しているか（食材を消したのに献立が参照している、などを防ぐ） */
export function checkRefs(snapshot) {
  const ingredientIds = new Set((snapshot.ingredients ?? []).map((d) => d.id));
  const problems = [];
  for (const c of ["meals", "purchases"]) {
    for (const d of snapshot[c] ?? []) {
      for (const id of d.ingredientIds ?? []) {
        if (!ingredientIds.has(id)) problems.push(`${c}/${d.id}（${d.title ?? d.name}）が存在しない食材 ${id} を指している`);
      }
    }
  }
  return problems;
}
