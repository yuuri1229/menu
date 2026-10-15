# 公開までの設定

サイトは GitHub Pages で配信し、データは Notion → GitHub Actions → Firestore の順に流れます。
Firestore はログインしたアカウントしか読めないので、献立や買い物の記録が外から見えることはありません。

```
Notion ──(毎時 Actions)──▶ Firestore ◀──(ログインして読む)── GitHub Pages のサイト
```

## 1. Firebase

1. [Firebase コンソール](https://console.firebase.google.com/) でプロジェクトを作る（Google アナリティクスは不要）。
2. **Authentication** → 始める → ログイン方法で **メール / パスワード** を有効にする。
3. **Authentication → ユーザー → ユーザーを追加** で、自分のメールとパスワードを登録する。
4. **Authentication → 設定 → ユーザーアクション** で **「作成（登録）を有効にする」のチェックを外す**。
   これで画面以外の方法でも新規登録できなくなります（項目が見当たらなければ飛ばして大丈夫です。`ALLOWED_EMAILS` に無いアカウントはデータを読めません）。
5. **Authentication → 設定 → 承認済みドメイン** に `yuuri1229.github.io` を追加する。
6. **Firestore Database** → データベースを作成（本番モード、リージョンは `asia-northeast1` など）。
   **ルール** タブに、このリポジトリの [`firestore.rules`](../firestore.rules) の中身を貼って公開する。
7. **プロジェクトの設定 → 全般 → マイアプリ** で ウェブアプリ（`</>`）を追加し、表示される
   `apiKey` `authDomain` `projectId` `appId` を控える。
8. **プロジェクトの設定 → サービスアカウント → 新しい秘密鍵の生成** で JSON をダウンロードする。

## 2. Notion

1. [インテグレーションの管理](https://www.notion.so/profile/integrations) で内部インテグレーションを作り、
   **シークレット**（`ntn_…`）を控える。機能は「コンテンツを読み取る」だけで十分です。
2. Notion の「献立作成　Claude連携」ページ右上の `…` → **接続** から、作ったインテグレーションを追加する。
   配下のデータベースとページもまとめて読めるようになります。

## 3. GitHub

リポジトリの **Settings → Secrets and variables → Actions** に登録します。

| 種類 | 名前 | 値 |
| --- | --- | --- |
| Secret | `NOTION_TOKEN` | Notion のシークレット |
| Secret | `FIREBASE_SERVICE_ACCOUNT` | サービスアカウントの JSON（ファイルの中身をそのまま貼る） |
| Secret | `ALLOWED_EMAILS` | サイトを見てよいメール（複数はカンマ区切り） |
| Variable | `FIREBASE_API_KEY` | `apiKey` |
| Variable | `FIREBASE_AUTH_DOMAIN` | `authDomain` |
| Variable | `FIREBASE_PROJECT_ID` | `projectId` |
| Variable | `FIREBASE_APP_ID` | `appId` |

Web 用の Firebase 設定（Variable）はブラウザに配られる値なので秘密ではありません。
データを守っているのは Firestore のルールです。

続けて:

1. **Settings → Pages → Source** を **GitHub Actions** にする。
2. **Settings → General → Default branch** を `main` にする（Pages は既定ブランチからだけ公開できるため）。
3. **Actions → Notion を同期 → Run workflow** で一度手動実行する（以後は毎時自動）。
4. **Actions → サイトを公開 → Run workflow**（`main` に変更が入るたびに自動でも動きます）。

公開先は `https://yuuri1229.github.io/menu/` です。

## iPhone のホーム画面に追加する

1. iPhone の **Safari** で公開先を開く。
2. 画面下の共有ボタン → **ホーム画面に追加**。
3. ホーム画面の「こんだて帖」アイコンから開き、その中でログインする。
   ホーム画面のアプリは Safari とログイン状態を共有しないため、追加後にアプリの中で一度ログインします（以後はログインしたまま）。

## うまくいかないとき

- **ログインできるがデータが出ない**：`ALLOWED_EMAILS` に、ログインしたメールが入っているか。入れたあと「Notion を同期」を再実行する。
- **同期が 404 で失敗する**：Notion のページにインテグレーションを接続したか。
- **ログイン画面で auth/unauthorized-domain**：承認済みドメインに `yuuri1229.github.io` を追加したか。
