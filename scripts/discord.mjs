// ルーティン（週間献立・在庫更新のお知らせ・予定と在庫の確認）の完了報告を Discord の Webhook へ送る。
// アプリ向けのプッシュ通知（db.mjs notify）とは別の経路。Webhook の URL は秘密なので、
// 環境変数 DISCORD_WEBHOOK_URL からだけ読み、リポジトリや出力には書かない。

const LIMITS = { title: 256, description: 4000 };

const clip = (s, n) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

/** タイトルと本文から Discord の embed を1つ持つ本文を作る */
export function buildDiscordPayload(title, body = "", url = "") {
  const embed = { title: clip(title, LIMITS.title), color: 0xc8402f };
  if (body) embed.description = clip(body, LIMITS.description);
  if (url) embed.url = url;
  return { username: "MEGURU", embeds: [embed], allowed_mentions: { parse: [] } };
}

/** 送る。URL が無ければ何もせず "skipped"、送れたら "sent"、失敗したら例外（URL は含めない） */
export async function sendDiscord(title, body = "", url = "", env = process.env, fetchImpl = fetch) {
  const hook = env.DISCORD_WEBHOOK_URL?.trim();
  if (!hook) return "skipped";
  const res = await fetchImpl(hook, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(buildDiscordPayload(title, body, url)),
  });
  if (!res.ok) throw new Error(`Discord が ${res.status} を返しました`);
  return "sent";
}

/** HTTPS_PROXY があるのに Node がそれを使わない設定なら true（NODE_USE_ENV_PROXY=1 で入れ直す目印） */
export function needsEnvProxy(env = process.env) {
  const proxy = env.HTTPS_PROXY || env.https_proxy;
  return Boolean(proxy) && !env.NODE_USE_ENV_PROXY;
}
