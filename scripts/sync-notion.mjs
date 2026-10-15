#!/usr/bin/env node
// Notion の献立関連データベースとページを読み、Firestore に書き込む。
// GitHub Actions（.github/workflows/sync-notion.yml）から定期実行する。
//
// 環境変数
//   NOTION_TOKEN               Notion のインテグレーションのトークン（必須）
//   FIREBASE_SERVICE_ACCOUNT   Firebase のサービスアカウント鍵（JSON 文字列）。無ければ Firestore に書かない
//   ALLOWED_EMAILS             サイトを見てよいアカウントのメール（カンマ区切り）。Firestore のルールで使う
//   NOTION_PARENT_PAGE_ID ほか  ID を変えたいときだけ（下の DEFAULT_IDS を参照）
//
// 使い方
//   node scripts/sync-notion.mjs              Notion → Firestore
//   node scripts/sync-notion.mjs --out data/snapshot.json   取得結果を JSON に保存（Firestore には書かない）

import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import {
  normalizeIngredient,
  normalizeInventory,
  normalizeMeal,
  normalizeNote,
  normalizePurchase,
} from "./notion-normalize.mjs";

const DEFAULT_IDS = {
  parentPage: "3f65301e-ff0c-805e-a1b2-fd3d7f280458",
  meals: "e932566d-86c6-42b7-beaf-580bea555aac",
  ingredients: "c8cf3a5b-b63e-4dc9-a480-222c77457349",
  purchases: "2817d396-2b0a-4db0-95c9-b4f9333644e0",
  inventory: "a10d8035-a78e-496a-8b26-3400b85451df",
};

const IDS = {
  parentPage: process.env.NOTION_PARENT_PAGE_ID || DEFAULT_IDS.parentPage,
  meals: process.env.NOTION_MEALS_DS_ID || DEFAULT_IDS.meals,
  ingredients: process.env.NOTION_INGREDIENTS_DS_ID || DEFAULT_IDS.ingredients,
  purchases: process.env.NOTION_PURCHASES_DS_ID || DEFAULT_IDS.purchases,
  inventory: process.env.NOTION_INVENTORY_DS_ID || DEFAULT_IDS.inventory,
};

const NOTION_VERSION = "2025-09-03";
const token = process.env.NOTION_TOKEN;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function notion(path, { method = "GET", body } = {}) {
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(`https://api.notion.com/v1/${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        "Notion-Version": NOTION_VERSION,
        "Content-Type": "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (res.ok) return res.json();
    // レート制限（平均 3 リクエスト/秒）と一時的なエラーは待ってやり直す
    if ((res.status === 429 || res.status >= 500) && attempt < 5) {
      const wait = Number(res.headers.get("retry-after")) * 1000 || 1000 * 2 ** attempt;
      await sleep(wait);
      continue;
    }
    const text = await res.text();
    let hint = "";
    if (res.status === 401) hint = "（NOTION_TOKEN が正しいか確認してください）";
    if (res.status === 404) hint = "（インテグレーションを「献立作成　Claude連携」ページに接続したか確認してください）";
    throw new Error(`Notion API ${method} ${path} → ${res.status} ${hint}\n${text}`);
  }
}

async function queryDataSource(id) {
  const pages = [];
  let cursor;
  do {
    const res = await notion(`data_sources/${id}/query`, {
      method: "POST",
      body: { page_size: 100, ...(cursor ? { start_cursor: cursor } : {}) },
    });
    pages.push(...res.results.filter((r) => r.object === "page" && !r.in_trash && !r.archived));
    cursor = res.has_more ? res.next_cursor : undefined;
  } while (cursor);
  return pages;
}

async function listChildren(blockId) {
  const blocks = [];
  let cursor;
  do {
    const q = new URLSearchParams({ page_size: "100", ...(cursor ? { start_cursor: cursor } : {}) });
    const res = await notion(`blocks/${blockId}/children?${q}`);
    blocks.push(...res.results);
    cursor = res.has_more ? res.next_cursor : undefined;
  } while (cursor);
  return blocks;
}

/** ブロックを子孫まで読む（子ページ・子データベースの中身は読まない）。 */
async function readBlockTree(blockId, depth = 0) {
  const blocks = await listChildren(blockId);
  if (depth < 3) {
    for (const b of blocks) {
      if (b.has_children && b.type !== "child_page" && b.type !== "child_database") {
        b.children = await readBlockTree(b.id, depth + 1);
      }
    }
  }
  return blocks;
}

async function readNotes(now) {
  const children = await listChildren(IDS.parentPage);
  const notes = [];
  for (const child of children) {
    if (child.type !== "child_page") continue;
    const page = await notion(`pages/${child.id}`);
    const blocks = await readBlockTree(child.id);
    notes.push(normalizeNote(page, blocks, now));
  }
  // 親ページ本文も「メモ」として残す
  const parent = await notion(`pages/${IDS.parentPage}`);
  const parentBlocks = children.filter((b) => b.type !== "child_page" && b.type !== "child_database");
  for (const b of parentBlocks) {
    if (b.has_children) b.children = await readBlockTree(b.id, 1);
  }
  const top = normalizeNote(parent, parentBlocks, now);
  if (top.blocks.length) notes.push({ ...top, kind: "page" });
  return notes;
}

export async function fetchSnapshot(now = new Date()) {
  const [meals, ingredients, purchases, inventory] = await Promise.all([
    queryDataSource(IDS.meals).then((ps) => ps.map((p) => normalizeMeal(p))),
    queryDataSource(IDS.ingredients).then((ps) => ps.map((p) => normalizeIngredient(p, now))),
    queryDataSource(IDS.purchases).then((ps) => ps.map((p) => normalizePurchase(p, now))),
    queryDataSource(IDS.inventory).then((ps) => ps.map((p) => normalizeInventory(p))),
  ]);
  const notes = await readNotes(now);
  return { syncedAt: now.toISOString(), meals, ingredients, purchases, inventory, notes };
}

async function writeFirestore(snapshot) {
  const { initializeApp, cert } = await import("firebase-admin/app");
  const { getFirestore } = await import("firebase-admin/firestore");
  const { getAuth } = await import("firebase-admin/auth");

  const credentials = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  const app = initializeApp({ credential: cert(credentials) });
  const db = getFirestore(app);
  const writer = db.bulkWriter();

  const collections = {
    meals: snapshot.meals,
    ingredients: snapshot.ingredients,
    purchases: snapshot.purchases,
    inventory: snapshot.inventory,
    // ブロックは入れ子の配列を含むので、Firestore には JSON 文字列で入れる
    notes: snapshot.notes.map(({ blocks, ...rest }) => ({ ...rest, blocksJson: JSON.stringify(blocks) })),
  };

  for (const [name, docs] of Object.entries(collections)) {
    const keep = new Set(docs.map((d) => d.id));
    for (const { id, ...data } of docs) writer.set(db.collection(name).doc(id), data);
    // Notion で消したものは Firestore からも消す
    const existing = await db.collection(name).listDocuments();
    for (const ref of existing) if (!keep.has(ref.id)) writer.delete(ref);
  }

  // 見てよいアカウントの一覧（Firestore のルールが members/{uid} の有無で判定する）
  const emails = (process.env.ALLOWED_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim())
    .filter(Boolean);
  if (emails.length) {
    const auth = getAuth(app);
    const allowed = new Set();
    for (const email of emails) {
      try {
        const user = await auth.getUserByEmail(email);
        allowed.add(user.uid);
        writer.set(db.collection("members").doc(user.uid), { email, updatedAt: snapshot.syncedAt });
      } catch (e) {
        console.warn(`⚠ ${email} のアカウントが Firebase Authentication に見つかりません。先にコンソールで作成してください。`);
      }
    }
    const existing = await db.collection("members").listDocuments();
    for (const ref of existing) if (!allowed.has(ref.id)) writer.delete(ref);
  } else {
    console.warn("⚠ ALLOWED_EMAILS が未設定のため、members を更新しませんでした（ログインしてもデータを読めません）。");
  }

  writer.set(db.collection("meta").doc("sync"), {
    syncedAt: snapshot.syncedAt,
    counts: Object.fromEntries(Object.entries(collections).map(([k, v]) => [k, v.length])),
  });

  await writer.close();
}

async function main() {
  if (!token) {
    console.error("NOTION_TOKEN が設定されていません。");
    process.exit(1);
  }
  const outIndex = process.argv.indexOf("--out");
  const snapshot = await fetchSnapshot();
  const summary = ["meals", "ingredients", "purchases", "inventory", "notes"]
    .map((k) => `${k}: ${snapshot[k].length}`)
    .join(", ");
  console.log(`Notion から取得しました（${summary}）`);

  if (outIndex !== -1) {
    const out = process.argv[outIndex + 1] ?? "data/snapshot.json";
    await mkdir(dirname(out), { recursive: true });
    await writeFile(out, JSON.stringify(snapshot, null, 2));
    console.log(`${out} に保存しました`);
    return;
  }
  if (!process.env.FIREBASE_SERVICE_ACCOUNT) {
    console.error("FIREBASE_SERVICE_ACCOUNT が設定されていません。--out で JSON に保存するか、鍵を設定してください。");
    process.exit(1);
  }
  await writeFirestore(snapshot);
  console.log("Firestore に書き込みました");
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
