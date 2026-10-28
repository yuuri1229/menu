# こんだて帖を扱う Claude へ

献立・食材（買い物リスト）・買い物明細・家の在庫・ノート・献立の感想・外食や不在の予定は **Firestore だけ** に置いています（Notion は使っていません）。
アプリ（https://yuuri1229.github.io/menu/ ）は同じデータをリアルタイムで表示するので、Claude が書けばすぐ画面に出て、
アプリで押された「作った」「買った」「在庫の状態」と、献立シートから送られた感想、献立タブで登録された予定は Claude が次に読んだときに見えます。

## 準備

```sh
npm ci
node scripts/db.mjs help
```

鍵は環境変数 `FIREBASE_CLIENT_EMAIL` と `FIREBASE_PRIVATE_KEY`（鍵ファイルの `client_email`・`private_key` を1行ずつ。
プロジェクト設定 → クラウド環境）から読みます（JSON 全体を `FIREBASE_SERVICE_ACCOUNT` に入れても可）。無ければ書き込めないので、
ユーザーに「プロジェクト設定のクラウド環境に FIREBASE_CLIENT_EMAIL と FIREBASE_PRIVATE_KEY を入れてください」と一度だけ伝えてください。
鍵をチャットに貼ってもらわないこと。

## いつも守ること

- 作業の前に `node scripts/db.mjs get notes rules` で前提条件（アレルギー・NG食材・調理環境・予算・店）を読む。これが一番の決まり。
- 献立を考えるときは、その次に `node scripts/db.mjs get notes preferences`（好みの記録）と `node scripts/db.mjs feedback`（反映待ちの感想）、`node scripts/db.mjs plans`（外食・不在の予定）も読む。
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
| `notes` | `title` `icon` `kind`（week/rules/page） `start` `end` `markdown` `editedAt` | 週のメモは id を `week-YYYY-MM-DD`（月曜の日付）、`kind: "week"`。食材のレシピ候補などは `kind: "page"`。好みの記録は id `preferences`、`kind: "page"`。本文は Markdown（見出し・箇条書き・`- [ ]`・表） |
| `plans` | `date` `slots`（朝食/昼食/夕食の配列） `endDate` `endSlots` `kind`（外食/不在） `memo` `canceled` `uid` `updatedAt` `handledAt` | アプリの献立タブで登録する外食・家にいない予定。数日家を空けるときは `endDate`（帰宅日）を付け、`date` の日は `slots`、`endDate` の日は `endSlots`、その間の日は3食とも家で食べない（例：11/5 昼食・夕食〜11/7 朝食・昼食 なら 11/5 朝と 11/7 夜は家で食べる）。Claude は書き換えず、献立を組み直したら `plans:done` で `handledAt` を付けるだけ（取り消し `canceled: true` の予定は `plans:done` で消える）。書き直されると `handledAt` が空に戻る |
| `feedback` | `mealId` `mealTitle` `date` `slot` `verdict`（好み/ふつう/合わない） `tags` `text` `uid` `updatedAt` `reflectedAt` | アプリの献立シートから届く感想。id は献立の id（1献立1件、送り直すと上書きされ `reflectedAt` が空に戻る）。Claude は書き換えず、まとめたら `feedback:done` で `reflectedAt` を付けるだけ |

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
5. `node scripts/db.mjs notify "来週の献立ができました" "買い物① は 10/19(月)。…" --url week/` で端末に知らせる。

**レシートの記録（「記録して」）**
1. 1品1件で `purchases` に入れ、対応する食材の id を `ingredientIds` に入れる。外税のレシートは税込に直す。
2. 買った食材の `bought` を `true` に、在庫に追加・更新して `status: "十分"` にする（新しい市販品は魚介の確認を `seafood` に）。
3. その週のノートの「実績と評価」に、予算との比較と対策を追記する（`markdown` を丸ごと渡して更新）。

**献立の感想を反映する（土曜のルーティンの最初、または「感想を反映して」）**
1. `node scripts/db.mjs feedback` で反映待ちの感想を読む（献立名・評価・タグ・本文・食材が出る）。
2. `notes/preferences`「好みの記録」の本文を更新する（「## 好きな味・料理」「## 苦手・控えたいもの」「## 味付けの調整」「## 量」。各行に日付と評価（好み/ふつう/合わない）を添える。無ければ id `preferences`・`kind: "page"`で作る）。
3. タグ「苦手な食材」や本文で苦手とはっきり書かれた食材は `notes/rules` の NG に足し、以後使わない。味付けや量の不満は好みの記録で調整し、1回の「合わない」だけで NG にしない。
4. `node scripts/db.mjs feedback:done <id...>` で反映済みにする。翌週の献立で直した所は献立の `memo` と週ノートの「感想の反映」節に書く。
5. 体調の異変（かゆみ・腫れなど）を思わせる感想があれば、献立より先にユーザーに確認する。

**外食・不在の予定を反映する（日曜の献立づくりの中、7時・12時・21時の確認、または「予定に合わせて組み直して」）**
1. `node scripts/db.mjs plans` で反映待ちの予定を読む（その日の献立と「← 予定の食事」が出る）。
2. まだ献立が無い週の予定：その食事は作らず、その分の食材を買わない。夕食が外食・不在で翌日が弁当の日なら、翌日の弁当は取り分けに頼らず朝にレンジで作れるもの（おにぎり・卵焼き・ちくわなど在庫中心）にする。丸一日いない日の前後は、傷みやすい物（もやし・千切りキャベツ・肉）を買う日をずらす。外食の代金は食費の予算に入れない。
3. もう献立がある食事（急な予定）：その献立は消さずに、食材を使う先の食事へ移す（`date`・`slot` を空いている先の食事に変える、または先の献立を置き換える）。肉は冷凍して後で使う、傷みやすい物から先に使う。まだ買っていない食材は量を減らすか買うのをやめる（名前に「（取りやめ）」を付ける。買い物タブは買う物だけを出すので、取りやめた物は表示されない）。翌日の弁当も直す。変えた献立の `memo` に「10/27変更：外食のため…」と書く。
4. 取り消された予定（予定がなくなった）：その食事の献立を戻す。移した献立があれば元に戻し、無ければ在庫（卵・納豆・冷凍うどん・ツナ缶など）で作れる簡単な献立を足し、足りない物は次の買い物回に足す。
5. 数日家を空ける予定（`endDate` あり）：留守の日は献立を作らず、買い物回も入れない（留守中に当たる回は出発前か帰宅後にずらす）。出発前の食事で傷みやすい物（もやし・葉物・肉・豆腐）を使い切り、使い切れない肉は冷凍する。出発の日は家で食べる最後の食事まで、帰宅の日は家で食べる最初の食事から献立を組み、帰宅日の食事は買い物に頼らず日持ちする在庫（冷凍うどん・卵・ツナ缶・冷凍ごはんなど）で作れる物にする。帰宅後の最初の買い物回は帰宅日の翌日以降にする。
6. `node scripts/db.mjs plans:done <id...>` で反映済みにし（取り消しは文書が消える）、今週分を変えたときは `notify` で「予定に合わせて献立を組み直しました」と知らせる。週ノートの補足に、予定と変えた所を一言書く。

**予定と在庫の確認（7時・12時・21時）**
アプリは予定と在庫の変更から「買わなくてよさそうな物」「使う先がなくなった物」「材料が切れている献立」をその場で表示する（`src/lib/impact.ts`、決まりで計算した目安）。
Claude は毎日7時・12時・21時に、反映待ちの予定（上の手順）と同じ観点で次の買い物までの献立を直す：在庫が「切れた」の物を今日以降の献立（食材・作り方）が使っていれば、ほかの在庫で代える・作り方から外す・次の買い物回に足すのどれかにし、`memo` に「10/27変更：○○が切れたため…」と書く。直してよいのはその回より後の食事だけ（7時なら当日の昼・夜以降、12時なら当日の夜以降、21時なら翌日以降）。`done` の献立と買い物済みの物は変えない。何もなければ何もしない。

**「○○が切れた」「○○は食べられた」などの連絡**
在庫は `status` を変える。食べた結果は該当する献立の `memo` に【実績】として足し、ルールが変わるなら `notes/rules` の本文も直す。

## プッシュ通知

アプリの「アカウント」で通知をオンにした端末（iPhone はホーム画面に追加したアイコンから開いたときだけ）に届きます。
- `node scripts/db.mjs notify <タイトル> [本文] [--url パス]` … 全端末に送る。ユーザーに知らせたい更新をしたときに使う（送りすぎない）。
- `node scripts/db.mjs notify:remind` … 明日の買い物（未購入の食材）と献立メモの段取りを1通にまとめて送る。毎晩20時に GitHub Actions（notify.yml）が実行する。
- クラウド環境から Apple の通知サーバー（web.push.apple.com）に届かず「送れませんでした」と出たら、GitHub の Actions「プッシュ通知を送る」（notify.yml）を title・body・url を入れて workflow_dispatch で実行する（GitHub MCP の actions_run_trigger）。
- `node scripts/db.mjs push` で受け取る端末の一覧。秘密鍵は Firestore の `secrets/webpush`（アプリからは読めない）。

## コードを変えるとき

データの項目を増やすときは `scripts/schema.mjs`・`src/lib/types.ts` をそろえ、アプリから書く項目を変えるなら
`firestore.rules` と `MEMBER_WRITABLE` も直して `node scripts/db.mjs rules:deploy`（`main` に入ると GitHub Actions でも反映）。

画面には絵文字を使わない（ユーザーの決まり）。アイコンはマテリアルデザインのもの（`src/components/icons.tsx`、react-icons の Outlined）だけを使い、
新しいアイコンもそこに足す。ノートの `icon` や本文の絵文字は画面では表示しない。通知の文面にも絵文字を入れない。
