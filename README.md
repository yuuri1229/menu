# こんだて帖

Notion で管理している1週間の献立・買い物リスト・家の在庫・買い物の実績を、スマホで見やすく表示するサイトです。
Next.js の静的書き出しを GitHub Pages で配信し、Firebase Authentication のログイン（新規登録なし）で守ります。
iPhone のホーム画面に追加して、アプリとして使う前提の作りです（全画面表示、下タブ、安全領域の余白、開き直したときに日付を更新、タブの再タップで先頭へ）。

| 画面 | できること |
| --- | --- |
| 今日 | 次のごはん、炊飯や取り分けの段取りメモ、次の買い物、今週の食費、在庫の確認 |
| 献立 | 週ごとの朝・昼・夜。タップでメモ（【実績】・変更・段取り）と使う食材 |
| 買い物 | 買い物回ごとのリスト。店でタップしてチェック（端末に保存） |
| 在庫 | 状態（十分・残りわずか・切れた・要確認）、魚介チェック、賞味期限 |
| 家計 | 週予算に対する食費、週ごとの推移、お店ごと、明細 |
| ノート | 週の「買い物リスト・予算」ページと前提条件ページ |

## しくみ

- `scripts/sync-notion.mjs` が Notion API でデータベースとページを読み、Firestore に書き込みます（`.github/workflows/sync-notion.yml` で毎時）。
- サイトはログイン後に Firestore を読みます。Firestore のルール（`firestore.rules`）で、`ALLOWED_EMAILS` に入れたアカウント以外は読めません。
- データは GitHub Pages の公開ファイルには含まれません。

設定の手順は [docs/SETUP.md](docs/SETUP.md) にあります。

## 開発

```sh
npm install
npm run dev                       # 本番の Firebase につながる（ログインが必要）
NEXT_PUBLIC_DEMO=1 npm run dev    # ログインなしのデモデータで画面を確認
npm test        # Notion の変換のテスト
npm run build   # out/ に静的ファイルを書き出す
```

Notion の中身を手元で確かめたいときは `NOTION_TOKEN=... npm run sync -- --out data/snapshot.json`（`data/` はコミットされません）。

予算や米の扱いなど運用ルールは `src/lib/config.ts`、Notion のプロパティ名は `scripts/notion-normalize.mjs` の `PROPS` にまとめています。
