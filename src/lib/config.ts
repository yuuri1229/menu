// 運用ルールに合わせた設定。予算などが変わったらここを直す。

/** 米以外の食材の週予算（円） */
export const WEEKLY_BUDGET = 5000;

/** 予算とは別枠で数える米の品名 */
export const RICE_PATTERN = /(^|[\s　（(])米|こしいぶき|コシヒカリ|あきたこまち|ひとめぼれ|ななつぼし|無洗米/;

/** 献立メモから「段取り」として拾う言葉 */
export const PREP_KEYWORDS = ["炊飯", "予約", "取り分け", "冷凍", "解凍", "冷蔵庫に移", "仕込み", "前日", "朝は"];

/**
 * Firebase のウェブアプリ設定。ブラウザに配られる公開前提の値なので、ここに書いてよい
 * （データを守っているのは Firestore のルールと、ログインできるアカウントの限定）。
 * 環境変数があればそちらを優先する。
 */
export const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "AIzaSyCMLf1tCpfTFMVmEd90qmqkBg0W6nOpBiI",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "menu-webapps.firebaseapp.com",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "menu-webapps",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "1:320332688991:web:0c3bf99feb57c287d075ea",
};

/** NEXT_PUBLIC_DEMO=1 でビルドすると、ログインなしのデモデータで動く（画面の確認用） */
export const DEMO = process.env.NEXT_PUBLIC_DEMO === "1";
