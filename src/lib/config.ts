// 運用ルールに合わせた設定。予算などが変わったらここを直す。

/** 米以外の食材の週予算（円） */
export const WEEKLY_BUDGET = 5000;

/** 予算とは別枠で数える米の品名 */
export const RICE_PATTERN = /(^|[\s　（(])米|こしいぶき|コシヒカリ|あきたこまち|ひとめぼれ|ななつぼし|無洗米/;

/** 献立メモから「段取り」として拾う言葉 */
export const PREP_KEYWORDS = ["炊飯", "予約", "取り分け", "冷凍", "解凍", "冷蔵庫に移", "仕込み", "前日", "朝は"];

export const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? "",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ?? "",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? "",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID ?? "",
};

/** Firebase の設定が無いビルド（ローカル開発など）はデモデータで動かす */
export const DEMO = !firebaseConfig.apiKey || !firebaseConfig.projectId;
