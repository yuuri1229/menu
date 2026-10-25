import assert from "node:assert/strict";
import { test } from "node:test";
import { buildDiscordPayload, sendDiscord } from "./discord.mjs";

test("タイトルと本文を embed にする", () => {
  const p = buildDiscordPayload("来週の献立ができました", "買い物① は 10/26(月)", "https://example.com/week/");
  assert.equal(p.embeds[0].title, "来週の献立ができました");
  assert.equal(p.embeds[0].description, "買い物① は 10/26(月)");
  assert.equal(p.embeds[0].url, "https://example.com/week/");
  assert.deepEqual(p.allowed_mentions, { parse: [] });
});

test("長すぎる本文は切る", () => {
  assert.equal(buildDiscordPayload("t", "あ".repeat(5000)).embeds[0].description.length, 4000);
});

test("URL が未設定なら送らずスキップ", async () => {
  const f = async () => assert.fail("送ってはいけない");
  assert.equal(await sendDiscord("t", "b", "", {}, f), "skipped");
});

test("設定されていれば POST し、失敗時の例外に URL を含めない", async () => {
  const secret = "https://discord.example/api/webhooks/1/SECRET";
  let seen;
  const ok = async (u, init) => ((seen = { u, init }), { ok: true });
  assert.equal(await sendDiscord("t", "b", "", { DISCORD_WEBHOOK_URL: secret }, ok), "sent");
  assert.equal(seen.u, secret);
  assert.equal(seen.init.method, "POST");
  const ng = async () => ({ ok: false, status: 404 });
  await assert.rejects(sendDiscord("t", "", "", { DISCORD_WEBHOOK_URL: secret }, ng), (e) => !e.message.includes("SECRET"));
});
