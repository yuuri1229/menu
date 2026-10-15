import { getApp, getApps, initializeApp, type FirebaseApp } from "firebase/app";
import { browserLocalPersistence, initializeAuth, type Auth } from "firebase/auth";
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  type Firestore,
} from "firebase/firestore";
import { firebaseConfig } from "./config";

let app: FirebaseApp | undefined;
let auth: Auth | undefined;
let db: Firestore | undefined;

function getFirebaseApp() {
  app ??= getApps().length ? getApp() : initializeApp(firebaseConfig);
  return app;
}

export function getFirebaseAuth() {
  // ログイン状態は端末に残す（買い物中に毎回ログインしなくてよいように）
  auth ??= initializeAuth(getFirebaseApp(), { persistence: browserLocalPersistence });
  return auth;
}

export function getDb() {
  // 端末にキャッシュして、電波の弱い店内でも前回のデータを表示できるようにする
  db ??= initializeFirestore(getFirebaseApp(), {
    localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
  });
  return db;
}
