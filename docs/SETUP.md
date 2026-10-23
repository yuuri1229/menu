# 公開までの設定

サイトは GitHub Pages で配信し、データは Firestore に置きます。Claude は `scripts/db.mjs` で Firestore を読み書きし、
サイトはログインしたアカウントだけが読めます。献立や買い物の記録が外から見えることはありません。

```
Claude ──(scripts/db.mjs)──▶ Firestore ◀──(ログインして読み書き)── GitHub Pages のサイト
```

## 1. Firebase

1. プロジェクト `menu-webapps` は作成済み（ウェブアプリの設定は `src/lib/config.ts` に入れてあります）。
2. **Authentication** → 始める → ログイン方法で **メール / パスワード** を有効にする。
3. **Authentication → ユーザー → ユーザーを追加** で、自分のメールとパスワードを登録する。
4. **Authentication → 設定 → ユーザーアクション** で **「作成（登録）を有効にする」のチェックを外す**（見当たらなければ飛ばして大丈夫です。メンバー以外はデータを読めません）。
5. **Authentication → 設定 → 承認済みドメイン** に `yuuri1229.github.io` を追加する。
6. **Firestore Database** → データベースを作成（本番モード、リージョンは `asia-northeast1` など）。
7. **プロジェクトの設定 → サービスアカウント → 新しい秘密鍵の生成** で JSON をダウンロードする。
   この鍵はリポジトリやチャットに貼らないでください。

## 2. 鍵を渡す（Claude と GitHub）

ダウンロードした JSON の中身を、そのまま次の2か所に入れます。

| 場所 | 名前 | 用途 |
| --- | --- | --- |
| Claude のプロジェクト設定 → クラウド環境 → 環境変数 | `FIREBASE_CLIENT_EMAIL` と `FIREBASE_PRIVATE_KEY`（鍵ファイルの `client_email`・`private_key` の値を1行ずつ。入力欄が1行ずつ読むため） | Claude が献立・レシート・在庫を書き込む |
| GitHub の Settings → Secrets and variables → Actions | `FIREBASE_SERVICE_ACCOUNT` | `firestore.rules` を変更したときに自動で反映する |

Web 用の Firebase 設定（`apiKey` など）はブラウザに配られる値なので秘密ではなく、コードに入れてあります。
データを守っているのは Firestore のルールとメンバー登録です。

鍵が入ったら、Claude が次を行います（手元で行う場合も同じコマンドです）。

```sh
npm ci
node scripts/db.mjs rules:deploy                 # firestore.rules を反映
node scripts/db.mjs members add あなたのメール      # サイトを使えるようにする
node scripts/db.mjs import 移行データ.json          # 最初のデータを入れる
node scripts/db.mjs check
```

## 3. GitHub Pages

1. **Settings → Pages → Source** を **GitHub Actions** にする。
2. **Settings → General → Default branch** を `main` にする。
3. **Settings → Environments → github-pages** の Deployment branches に `main` を入れる。
4. `main` に変更が入るたびに **サイトを公開** が動きます。

公開先は `https://yuuri1229.github.io/menu/` です。

## iPhone のホーム画面に追加する

1. iPhone の **Safari** で公開先を開く。
2. 画面下の共有ボタン → **ホーム画面に追加**。
3. ホーム画面の「MEGURU」アイコンから開き、その中でログインする（以後はログインしたまま）。

## うまくいかないとき

- **ログインできるがデータが出ない**：`node scripts/db.mjs members` にログインしたメールが出るか。なければ `members add`。
- **「変更を保存する権限がありません」**：`rules:deploy` でルールを反映したか。
- **ログイン画面で auth/unauthorized-domain**：承認済みドメインに `yuuri1229.github.io` を追加したか。

## プッシュ通知

通知の鍵は `node scripts/db.mjs push:keys` で一度だけ作ってあります（秘密鍵は Firestore の `secrets/webpush`、公開鍵は `src/lib/config.ts`）。
受け取る側は、iPhone ならホーム画面に追加したアイコンからアプリを開き、右上のアカウント →「通知」をオンにします（iOS 16.4 以降）。
毎晩20時のリマインド（`.github/workflows/notify.yml`）は、GitHub の Secrets に `FIREBASE_SERVICE_ACCOUNT` があるときだけ動きます。
