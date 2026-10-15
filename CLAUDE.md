# こんだて帖を扱う Claude へ

献立・食材（買い物リスト）・買い物明細・家の在庫・ノートは **Firestore だけ** に置いています（Notion は使っていません）。
アプリ（https://yuuri1229.github.io/menu/ ）は同じデータをリアルタイムで表示するので、Claude が書けばすぐ画面に出て、
アプリで押された「作った」「買った」「在庫の状態」は Claude が次に読んだときに見えます。

## 準備

```sh
npm ci
node scripts/db.mjs help
```

鍵は環境変数 `FIREBASE_SERVICE_ACCOUNT`（プロジェクト設定 → クラウド環境）から読みます。無ければ書き込めないので、
ユーザーに「プロジェクト設定のクラウド環境に FIREBASE_SERVICE_ACCOUNT を入れてください」と一度だけ伝えてください。鍵をチャットに貼ってもらわないこと。

## いつも守ること

- 作業の前に `node scripts/db.mjs get notes rules` で前提条件（アレルギー・NG食材・調理環境・予算・店）を読む。これが一番の決まり。
- 書き出したデータや作業用の JSON はリポジトリに置かない（公開リポジトリのため）。スクラッチや共有フォルダに置く。
- 書き込みは `upsert` に JSON を渡す。まず `--dry-run` で確かめてから本番。形が違えば CLI が日本語で止める。
- 献立や明細が指す食材を消さない（CLI が参照切れを止める）。

## データの形（詳しくは scripts/schema.mjs）

| コレクション | 主な項目 | 書き方の決まり |
| --- | --- | --- |
| `meals` | `title` `date` `slot`（朝食/昼食/夕食） `main` `sides` `memo` `recipe` `genre` `minutes` `done` `prepAhead` `ingredientIds` | `recipe` は Markdown で「## 材料（分量つき）」「## 作り方」（番号付き）「## ポイント」。`title` の「＋」で主菜と副菜を分けて表示。食べた結果は `memo` に「【実績】…」、変更は「10/14変更：…」で始める。炊飯・予約・取り分け・解凍などの段取りは文に入れると「段取りメモ」に出る |
| `ingredients` | `name` `category` `storage` `trip` `tripDate` `amount` `estimate` `bought` `memo` | `trip` は「① 10/12(月)」の形、`tripDate` はその日付。同じ回の食材は同じ `trip` にする。実績金額は明細から自動で計算されるので書かない |
| `purchases` | `name` `amount`（税込） `store` `trip` `tripDate` `category`（食材/調味料・消耗品） `date` `carryOver` `memo` `receiptNo` `ingredientIds` | 米は `category: "食材"` で記録し、名前に米の銘柄を入れる（週予算から自動で除く） |
| `inventory` | `name` `category` `storage` `status`（十分/残りわずか/切れた/要確認） `remaining` `memo` `seafood`（問題なし/要確認/NG） `bestBefore` `purchasedAt` | |
| `notes` | `title` `icon` `kind`（week/rules/page） `start` `end` `markdown` `editedAt` | 週のメモは id を `week-YYYY-MM-DD`（月曜の日付）、`kind: "week"`。食材のレシピ候補などは `kind: "page"`。本文は Markdown（見出し・箇条書き・`- [ ]`・表） |

新しい文書は `id` を付けずに渡すと CLI が作り、作った id を表示します。既存の文書は `id` と変える項目だけ渡せば部分更新になります。

```json
{
  "ingredients": [{ "name": "もやし", "category": "野菜", "storage": "冷蔵", "trip": "① 10/19(月)", "tripDate": "2026-10-19", "amount": "1袋", "estimate": 40 }],
  "inventory": [{ "id": "既存のid", "status": "十分" }]
}
```

献立から新しい食材を指すときは、先に食材を作って id を受け取り、次の `upsert` で献立の `ingredientIds` に入れます。

## よくある作業

**翌週の献立づくり（毎週土曜のルーティン）**
1. `node scripts/db.mjs export --out /tmp/kondate.json` で今のデータを読む。
2. 在庫（`status` が十分の物は買わない・余り物を優先）、今週の明細の実際の価格、`memo` の【実績】を見て、前提条件に沿って翌週分を考える。
3. 食材（買い物回ごと）→ 献立 → 週のノート（予算・回ごとの試算・炊飯スケジュール・買い物リスト）の順に `upsert` する。
4. `node scripts/db.mjs check` で確かめ、アプリの献立タブに出ることを伝える。

**レシートの記録（「記録して」）**
1. 1品1件で `purchases` に入れ、対応する食材の id を `ingredientIds` に入れる。外税のレシートは税込に直す。
2. 買った食材の `bought` を `true` に、在庫に追加・更新して `status: "十分"` にする（新しい市販品は魚介の確認を `seafood` に）。
3. その週のノートの「実績と評価」に、予算との比較と対策を追記する（`markdown` を丸ごと渡して更新）。

**「○○が切れた」「○○は食べられた」などの連絡**
在庫は `status` を変える。食べた結果は該当する献立の `memo` に【実績】として足し、ルールが変わるなら `notes/rules` の本文も直す。

## コードを変えるとき

データの項目を増やすときは `scripts/schema.mjs`・`src/lib/types.ts` をそろえ、アプリから書く項目を変えるなら
`firestore.rules` と `MEMBER_WRITABLE` も直して `node scripts/db.mjs rules:deploy`（`main` に入ると GitHub Actions でも反映）。
