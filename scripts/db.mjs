#!/usr/bin/env node
// こんだて帖のデータ（Firestore）を読み書きする CLI。Claude はこれで献立・買い物・在庫を更新し、
// アプリは同じデータをリアルタイムで表示する。使い方は `node scripts/db.mjs help`。
//
// 認証：環境変数 FIREBASE_CLIENT_EMAIL と FIREBASE_PRIVATE_KEY（鍵ファイルの client_email・private_key）、
// FIREBASE_SERVICE_ACCOUNT（鍵の JSON 文字列）、GOOGLE_APPLICATION_CREDENTIALS（鍵ファイルのパス）のどれか。
// 鍵はリポジトリに置かない。

import { readFileSync, writeFileSync } from "node:fs";
import { COLLECTIONS, checkRefs, validate } from "./schema.mjs";
import { formatFeedback, pendingFeedback } from "./feedback.mjs";
import { buildReminder, jstDate } from "./notify.mjs";

const HELP = `使い方: node scripts/db.mjs <コマンド> [引数]

読む
  export [--out ファイル]          全データを JSON で出す（id 付き）
  get <コレクション> [id]          1件、または全件を JSON で出す
  check                            全文書の形と参照（献立→食材など）を検査する

感想（アプリの献立シートから届く。まとめ先は notes/preferences「好みの記録」）
  feedback [--all] [--json]        反映待ちの感想を新しい献立の順に出す（--all は反映済みも）
  feedback:done <id...|--pending>  好みの記録にまとめた感想に反映済みの印を付ける
                                   （--pending は今の反映待ちを全部）

書く（--dry-run で内容だけ確認、--force で参照切れを無視）
  upsert <ファイル|->              {"meals":[{...}], ...} を書き込む。
                                   id があり既存なら渡した項目だけ更新、なければ新規作成
  delete <コレクション> <id...>    文書を消す
  import <ファイル> [--replace]    丸ごと書き込む。--replace はファイルにない文書を消す

管理
  members                          アプリを使えるメンバーの一覧
  members add <メール>             メンバーに加える（Firebase Authentication に登録済みのメール）
  members remove <メール>          メンバーから外す
  rules:deploy                     firestore.rules を本番に反映する

通知（アプリの「アカウント」で通知をオンにした端末に届く）
  notify <タイトル> [本文] [--url パス]  全端末にプッシュ通知を送る（--url はアプリ内のパス。例 shopping/）
  notify:remind [--date YYYY-MM-DD]      明日の買い物と段取りの通知を送る（無ければ送らない。毎晩 Actions が実行）
  push                                   通知を受け取る端末の一覧
  push:keys                              通知の鍵（VAPID）を作る。初回だけ。公開鍵を src/lib/config.ts に書く

コレクション: ${COLLECTIONS.join(", ")}`;

const args = process.argv.slice(2);
const flags = new Set(args.filter((a) => a.startsWith("--")));
const positional = [];
for (let i = 0; i < args.length; i++) {
  if (args[i] === "--out" || args[i] === "--url" || args[i] === "--date") i++;
  else if (!args[i].startsWith("--")) positional.push(args[i]);
}
const [cmd, ...rest] = positional;
const DRY = flags.has("--dry-run");
const FORCE = flags.has("--force");
const option = (name) => (args.includes(name) ? args[args.indexOf(name) + 1] : undefined);

if (!cmd || cmd === "help" || flags.has("--help")) {
  console.log(HELP);
  process.exit(0);
}

const { initializeApp, cert, applicationDefault } = await import("firebase-admin/app");
const { getFirestore, FieldValue } = await import("firebase-admin/firestore");

/** 環境変数の値の前後に付いた引用符を外す（鍵ファイルから "…" ごとコピーしても読めるように） */
const unquote = (s) => s.trim().replace(/^"(.*)",?$/s, "$1");

function credential() {
  // 改行を入れられない入力欄向け：鍵ファイルの client_email と private_key を1行ずつ
  const email = process.env.FIREBASE_CLIENT_EMAIL;
  const key = process.env.FIREBASE_PRIVATE_KEY;
  if (email && key) {
    return cert({
      projectId: process.env.FIREBASE_PROJECT_ID || "menu-webapps",
      clientEmail: unquote(email),
      privateKey: unquote(key).replace(/\\n/g, "\n"),
    });
  }
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (raw) {
    try {
      return cert(JSON.parse(raw));
    } catch {
      fail("FIREBASE_SERVICE_ACCOUNT が JSON として読めません。鍵ファイルの中身をそのまま入れてください。");
    }
  }
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) return applicationDefault();
  fail(
    "Firebase の鍵がありません。サービスアカウント鍵（JSON）の client_email と private_key を、環境変数\n" +
      "FIREBASE_CLIENT_EMAIL と FIREBASE_PRIVATE_KEY に1行ずつ入れてください（JSON 全体を FIREBASE_SERVICE_ACCOUNT に入れても可）。\n" +
      "Claude のプロジェクトでは「プロジェクト設定 → クラウド環境 → 環境変数」、GitHub では Secrets に設定します。",
  );
}

function fail(msg) {
  console.error(`エラー: ${msg}`);
  process.exit(1);
}

// エミュレーター（FIRESTORE_EMULATOR_HOST）で試すときは鍵なしで動かす
const app = process.env.FIRESTORE_EMULATOR_HOST
  ? initializeApp({ projectId: process.env.GCLOUD_PROJECT ?? "demo-kondate" })
  : initializeApp({ credential: credential() });
const db = getFirestore(app);

async function loadAll() {
  const snap = {};
  await Promise.all(
    COLLECTIONS.map(async (c) => {
      const qs = await db.collection(c).get();
      snap[c] = qs.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => a.id.localeCompare(b.id));
    }),
  );
  return snap;
}

function readInput(path) {
  const text = path === "-" ? readFileSync(0, "utf8") : readFileSync(path, "utf8");
  try {
    return JSON.parse(text);
  } catch (e) {
    fail(`JSON として読めません: ${e.message}`);
  }
}

/** 書き込み（set / delete）をまとめて実行し、最後に更新時刻を残す */
async function commit(ops) {
  if (DRY) {
    for (const op of ops) console.log(op.type === "delete" ? `- ${op.c}/${op.id}` : `${op.merge ? "~" : "+"} ${op.c}/${op.id} ${JSON.stringify(op.data)}`);
    console.log(`（--dry-run のため書き込んでいません。${ops.length}件）`);
    return;
  }
  for (let i = 0; i < ops.length; i += 400) {
    const batch = db.batch();
    for (const op of ops.slice(i, i + 400)) {
      const ref = db.collection(op.c).doc(op.id);
      if (op.type === "delete") batch.delete(ref);
      else batch.set(ref, op.data, { merge: op.merge });
    }
    await batch.commit();
  }
  await db.doc("meta/sync").set({ syncedAt: new Date().toISOString(), by: "claude" }, { merge: true });
  console.log(`書き込みました（${ops.length}件）`);
}

/** 書き込み後の状態で参照切れがないか確かめる */
function guardRefs(snap, ops) {
  const next = structuredClone(snap);
  for (const op of ops) {
    const list = next[op.c];
    const idx = list.findIndex((d) => d.id === op.id);
    if (op.type === "delete") {
      if (idx >= 0) list.splice(idx, 1);
    } else if (idx >= 0) list[idx] = { ...list[idx], ...op.data };
    else list.push({ id: op.id, ...op.data });
  }
  const problems = checkRefs(next);
  if (problems.length && !FORCE) fail(`参照切れになります（--force で無視）:\n  ${problems.join("\n  ")}`);
  return problems;
}

function newId(c) {
  return db.collection(c).doc().id;
}

async function upsert(input, { replace = false, full = false } = {}) {
  const unknown = Object.keys(input).filter((c) => !COLLECTIONS.includes(c));
  if (unknown.length) fail(`知らないコレクション: ${unknown.join(", ")}（${COLLECTIONS.join(", ")}）`);
  const snap = await loadAll();
  const ops = [];
  const created = [];
  for (const [c, docs] of Object.entries(input)) {
    if (!Array.isArray(docs)) fail(`${c} は配列で渡してください`);
    const existing = new Map(snap[c].map((d) => [d.id, d]));
    for (const d of docs) {
      const exists = d.id && existing.has(d.id);
      if (exists && !full) {
        ops.push({ type: "set", c, id: d.id, data: validate(c, d, { partial: true }), merge: true });
      } else {
        const id = d.id || newId(c);
        ops.push({ type: "set", c, id, data: validate(c, d), merge: false });
        if (!exists) created.push(`${c}/${id}`);
      }
    }
    if (replace) {
      const keep = new Set(docs.map((d) => d.id));
      for (const id of existing.keys()) if (!keep.has(id)) ops.push({ type: "delete", c, id });
    }
  }
  guardRefs(snap, ops);
  await commit(ops);
  if (created.length > 20) console.log(`新しく作った文書: ${created.length}件`);
  else if (created.length) console.log(`新しく作った文書:\n  ${created.join("\n  ")}`);
}

// 通知の鍵は secrets/webpush に置く（firestore.rules でアプリからは読めない）。公開鍵だけ src/lib/config.ts にも書く
async function webpush() {
  const wp = (await import("web-push")).default;
  const keys = (await db.doc("secrets/webpush").get()).data();
  if (!keys) fail("通知の鍵がありません。先に `node scripts/db.mjs push:keys` を実行してください。");
  wp.setVapidDetails(keys.subject, keys.publicKey, keys.privateKey);
  return wp;
}

/** 全端末に送る。もう使われていない端末（410/404）は一覧から消す */
async function sendPush(payload) {
  const qs = await db.collection("pushSubscriptions").get();
  if (DRY) {
    console.log(`（--dry-run）${qs.size}台に送ります:\n${JSON.stringify(payload, null, 1)}`);
    return;
  }
  if (!qs.size) {
    console.log("通知を受け取る端末がありません（アプリの「アカウント」で通知をオンにする）");
    return;
  }
  const wp = await webpush();
  let sent = 0;
  for (const d of qs.docs) {
    const { endpoint, keys } = d.data();
    try {
      await wp.sendNotification({ endpoint, keys }, JSON.stringify(payload), { TTL: 12 * 3600, urgency: "normal" });
      sent++;
    } catch (e) {
      if (e.statusCode === 404 || e.statusCode === 410) {
        await d.ref.delete();
        console.log(`使われていない端末を外しました（${d.data().device ?? d.id}）`);
      } else console.error(`送れませんでした（${d.data().device ?? d.id}）: ${e.statusCode ?? ""} ${e.body ?? e.message}`);
    }
  }
  console.log(`${sent}/${qs.size}台に送りました: ${payload.title}`);
}

// 検査で止めたときなどは、スタックではなく理由だけを見せる
try {
  switch (cmd) {
    case "export": {
      const snap = await loadAll();
      const sync = (await db.doc("meta/sync").get()).data() ?? null;
      const json = JSON.stringify({ exportedAt: new Date().toISOString(), sync, ...snap }, null, 1);
      const outIdx = args.indexOf("--out");
      if (outIdx >= 0) {
        writeFileSync(args[outIdx + 1], json);
        console.log(`${args[outIdx + 1]} に書き出しました（${COLLECTIONS.map((c) => `${c} ${snap[c].length}`).join("・")}）`);
      } else console.log(json);
      break;
    }
    case "get": {
      const [c, id] = rest;
      if (!COLLECTIONS.includes(c)) fail(`コレクションを指定してください（${COLLECTIONS.join(", ")}）`);
      if (id) {
        const d = await db.collection(c).doc(id).get();
        if (!d.exists) fail(`${c}/${id} はありません`);
        console.log(JSON.stringify({ id: d.id, ...d.data() }, null, 1));
      } else {
        const qs = await db.collection(c).get();
        console.log(JSON.stringify(qs.docs.map((d) => ({ id: d.id, ...d.data() })), null, 1));
      }
      break;
    }
    case "check": {
      const snap = await loadAll();
      const problems = [];
      for (const c of COLLECTIONS)
        for (const d of snap[c]) {
          try {
            validate(c, d);
          } catch (e) {
            problems.push(e.message);
          }
        }
      problems.push(...checkRefs(snap));
      if (problems.length) fail(`問題があります:\n  ${problems.join("\n  ")}`);
      console.log(`問題なし（${COLLECTIONS.map((c) => `${c} ${snap[c].length}`).join("・")}）`);
      break;
    }
    case "feedback": {
      const snap = await loadAll();
      const list = pendingFeedback(snap.feedback, { all: flags.has("--all") });
      if (flags.has("--json")) console.log(JSON.stringify(list, null, 1));
      else if (!list.length) console.log(flags.has("--all") ? "感想はまだありません" : "反映待ちの感想はありません");
      else {
        for (const f of list) console.log(formatFeedback(f, snap));
        console.log(`\n${list.length}件。まとめたら feedback:done <id...> で反映済みにする`);
      }
      break;
    }
    case "feedback:done": {
      const snap = await loadAll();
      const ids = flags.has("--pending") ? pendingFeedback(snap.feedback).map((f) => f.id) : rest;
      if (!ids.length) fail(flags.has("--pending") ? "反映待ちの感想はありません" : "feedback:done <id...> か --pending で指定してください");
      const missing = ids.filter((id) => !snap.feedback.some((f) => f.id === id));
      if (missing.length) fail(`feedback に見つかりません: ${missing.join(", ")}`);
      const reflectedAt = new Date().toISOString();
      await commit(ids.map((id) => ({ type: "set", c: "feedback", id, data: { reflectedAt }, merge: true })));
      break;
    }
    case "upsert": {
      if (!rest[0]) fail("ファイル（または - で標準入力）を指定してください");
      await upsert(readInput(rest[0]));
      break;
    }
    case "import": {
      if (!rest[0]) fail("ファイルを指定してください");
      const input = readInput(rest[0]);
      const data = Object.fromEntries(Object.entries(input).filter(([k]) => COLLECTIONS.includes(k)));
      await upsert(data, { replace: flags.has("--replace"), full: true });
      break;
    }
    case "delete": {
      const [c, ...ids] = rest;
      if (!COLLECTIONS.includes(c) || !ids.length) fail("delete <コレクション> <id...> の形で指定してください");
      const snap = await loadAll();
      const missing = ids.filter((id) => !snap[c].some((d) => d.id === id));
      if (missing.length) fail(`${c} に見つかりません: ${missing.join(", ")}`);
      const ops = ids.map((id) => ({ type: "delete", c, id }));
      guardRefs(snap, ops);
      await commit(ops);
      break;
    }
    case "members": {
      const { getAuth } = await import("firebase-admin/auth");
      const auth = getAuth(app);
      const [sub, email] = rest;
      if (!sub) {
        const qs = await db.collection("members").get();
        if (!qs.size) console.log("メンバーはいません（members add <メール> で加える）");
        for (const d of qs.docs) console.log(`${d.data().email ?? "?"}  (${d.id})`);
        break;
      }
      if (!email) fail(`members ${sub} <メール> の形で指定してください`);
      let user;
      try {
        user = await auth.getUserByEmail(email);
      } catch {
        fail(`${email} は Firebase Authentication に登録されていません。先にコンソールの「Authentication → ユーザーを追加」で作ってください。`);
      }
      if (DRY) {
        console.log(`（--dry-run）members/${user.uid} を${sub === "add" ? "作ります" : "消します"}`);
        break;
      }
      if (sub === "add") {
        await db.collection("members").doc(user.uid).set({ email, addedAt: FieldValue.serverTimestamp() });
        console.log(`${email} をメンバーに加えました`);
      } else if (sub === "remove") {
        await db.collection("members").doc(user.uid).delete();
        console.log(`${email} をメンバーから外しました`);
      } else fail(`members の後は add か remove`);
      break;
    }
    case "rules:deploy": {
      const { getSecurityRules } = await import("firebase-admin/security-rules");
      const source = readFileSync(new URL("../firestore.rules", import.meta.url), "utf8");
      if (DRY) {
        console.log(source);
        break;
      }
      const ruleset = await getSecurityRules(app).releaseFirestoreRulesetFromSource(source);
      console.log(`firestore.rules を反映しました（${ruleset.name}）`);
      break;
    }
    case "notify": {
      const [title, body = ""] = rest;
      if (!title) fail("notify <タイトル> [本文] の形で指定してください");
      await sendPush({ title, body, url: option("--url") ?? "", tag: undefined });
      break;
    }
    case "notify:remind": {
      const tomorrow = option("--date") ?? jstDate(new Date(), 1);
      const snap = await loadAll();
      const payload = buildReminder(snap, tomorrow);
      if (!payload) {
        console.log(`${tomorrow} は買い物も段取りもないので送りません`);
        break;
      }
      await sendPush(payload);
      break;
    }
    case "push": {
      const qs = await db.collection("pushSubscriptions").get();
      if (!qs.size) console.log("通知を受け取る端末はありません");
      for (const d of qs.docs) console.log(`${d.data().device ?? "?"}  ${d.data().createdAt ?? ""}  (${d.id})`);
      break;
    }
    case "push:keys": {
      const ref = db.doc("secrets/webpush");
      let keys = (await ref.get()).data();
      if (!keys) {
        const wp = (await import("web-push")).default;
        keys = { ...wp.generateVAPIDKeys(), subject: "https://yuuri1229.github.io/menu/" };
        if (DRY) fail("（--dry-run）鍵はまだありません。--dry-run を外すと作ります");
        await ref.set(keys);
        console.log("通知の鍵を作りました");
      }
      const config = readFileSync(new URL("../src/lib/config.ts", import.meta.url), "utf8");
      console.log(`公開鍵: ${keys.publicKey}`);
      if (!config.includes(keys.publicKey)) console.log("→ src/lib/config.ts の VAPID_PUBLIC_KEY をこの値にしてください");
      break;
    }
    default:
      fail(`知らないコマンド「${cmd}」\n\n${HELP}`);
  }
} catch (e) {
  fail(e instanceof Error ? e.message : String(e));
}
