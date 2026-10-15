"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import {
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
  type User,
} from "firebase/auth";
import { DEMO } from "./config";
import { getFirebaseAuth } from "./firebase";

type AuthState =
  | { status: "loading" }
  | { status: "signedOut" }
  | { status: "signedIn"; email: string | null; demo: boolean };

interface AuthApi {
  state: AuthState;
  signIn: (email: string, password: string) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthApi | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  // 静的に書き出した HTML とずれないよう、最初は必ず「読み込み中」から始める
  const [state, setState] = useState<AuthState>({ status: "loading" });

  useEffect(() => {
    if (DEMO) {
      setState({ status: "signedIn", email: null, demo: true });
      return;
    }
    return onAuthStateChanged(getFirebaseAuth(), (user: User | null) => {
      setState(user ? { status: "signedIn", email: user.email, demo: false } : { status: "signedOut" });
    });
  }, []);

  const api: AuthApi = {
    state,
    signIn: async (email, password) => {
      await signInWithEmailAndPassword(getFirebaseAuth(), email.trim(), password);
    },
    resetPassword: async (email) => {
      await sendPasswordResetEmail(getFirebaseAuth(), email.trim());
    },
    logout: async () => {
      if (!DEMO) await signOut(getFirebaseAuth());
    },
  };

  return <AuthContext.Provider value={api}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth は AuthProvider の中で使う");
  return ctx;
}

/** Firebase のエラーコードを、画面に出す日本語にする */
export function authErrorMessage(e: unknown): string {
  const code = (e as { code?: string })?.code ?? "";
  switch (code) {
    case "auth/invalid-email":
      return "メールアドレスの形式が正しくありません。";
    case "auth/invalid-credential":
    case "auth/wrong-password":
    case "auth/user-not-found":
      return "メールアドレスかパスワードが違います。";
    case "auth/user-disabled":
      return "このアカウントは無効になっています。";
    case "auth/too-many-requests":
      return "試行回数が多すぎます。少し時間をおいてからもう一度お試しください。";
    case "auth/network-request-failed":
      return "通信できませんでした。電波のよい場所でもう一度お試しください。";
    case "auth/missing-password":
      return "パスワードを入力してください。";
    default:
      return "ログインできませんでした。もう一度お試しください。";
  }
}
