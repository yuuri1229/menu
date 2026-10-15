import { getApp, getApps, initializeApp, type FirebaseApp } from "firebase/app";
import { browserLocalPersistence, connectAuthEmulator, initializeAuth, type Auth } from "firebase/auth";
import {
  connectFirestoreEmulator,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  type Firestore,
} from "firebase/firestore";
import { firebaseConfig } from "./config";

let app: FirebaseApp | undefined;
let auth: Auth | undefined;
let db: Firestore | undefined;

// 手元で Firebase エミュレーターにつなぐとき（NEXT_PUBLIC_EMULATOR=1）。本番のビルドでは使わない
const EMULATOR = process.env.NEXT_PUBLIC_EMULATOR === "1";

function getFirebaseApp() {
  app ??= getApps().length ? getApp() : initializeApp(firebaseConfig);
  return app;
}

export function getFirebaseAuth() {
  // ログイン状態は端末に残す（買い物中に毎回ログインしなくてよいように）
  if (!auth) {
    auth = initializeAuth(getFirebaseApp(), { persistence: browserLocalPersistence });
    if (EMULATOR) connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
  }
  return auth;
}

export function getDb() {
  // 端末にキャッシュして、電波の弱い店内でも前回のデータを表示できるようにする
  if (!db) {
    db = initializeFirestore(getFirebaseApp(), {
      localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
    });
    if (EMULATOR) connectFirestoreEmulator(db, "127.0.0.1", 8085);
  }
  return db;
}
