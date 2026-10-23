"use client";

import { useState, type FormEvent } from "react";
import clsx from "clsx";
import { ArrowRight, Eye, EyeOff, LoaderCircle, Lock, Mail } from "lucide-react";
import { authErrorMessage, useAuth } from "@/lib/auth";
import { InstallHint } from "./InstallHint";
import { BrandMark } from "./ui";

export function LoginScreen() {
  const { signIn, resetPassword } = useAuth();
  const [mode, setMode] = useState<"login" | "reset">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      if (mode === "login") {
        await signIn(email, password);
      } else {
        await resetPassword(email);
        setNotice("再設定用のメールを送りました。メールのリンクから新しいパスワードを決めてください。");
        setMode("login");
      }
    } catch (err) {
      // 再設定でアカウントの有無を漏らさないよう、見つからなくても送った扱いにする
      if (mode === "reset" && (err as { code?: string })?.code === "auth/user-not-found") {
        setNotice("再設定用のメールを送りました。メールのリンクから新しいパスワードを決めてください。");
        setMode("login");
      } else {
        setError(authErrorMessage(err));
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative flex min-h-dvh flex-col overflow-hidden">
      {/* 背景：あたたかい湯気のようなグラデーション */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute -top-40 left-1/2 size-[640px] -translate-x-1/2 rounded-full bg-accent/25 blur-3xl" />
        <div className="absolute top-40 -left-32 size-80 rounded-full bg-morning/20 blur-3xl" />
        <div className="absolute top-60 -right-24 size-72 rounded-full bg-noon/15 blur-3xl" />
      </div>

      <div className="relative mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-6 py-12 pt-safe">
        <div className="rise mb-10 flex flex-col items-center text-center">
          <BrandMark className="mb-5 size-20 drop-shadow-xl" />
          <h1 className="font-display text-[30px] font-bold tracking-[0.12em]">MEGURU</h1>
          <p className="mt-1.5 text-sm text-ink-2">献立がめぐる、暮らしが整う</p>
        </div>

        <form onSubmit={submit} className="rise card space-y-4 p-6" style={{ animationDelay: "80ms" }} noValidate>
          <div>
            <h2 className="font-display text-lg font-bold">{mode === "login" ? "ログイン" : "パスワードの再設定"}</h2>
            {mode === "reset" && (
              <p className="mt-1 text-[13px] text-ink-2">登録しているメールアドレスに、再設定用のリンクを送ります。</p>
            )}
          </div>

          <Field icon={<Mail className="size-[18px]" />} label="メールアドレス">
            <input
              type="email"
              inputMode="email"
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full bg-transparent py-3 text-[16px] outline-none placeholder:text-ink-3"
            />
          </Field>

          {mode === "login" && (
            <Field icon={<Lock className="size-[18px]" />} label="パスワード">
              <input
                type={show ? "text" : "password"}
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-transparent py-3 text-[16px] outline-none placeholder:text-ink-3"
              />
              <button
                type="button"
                onClick={() => setShow((s) => !s)}
                aria-label={show ? "パスワードを隠す" : "パスワードを表示"}
                aria-pressed={show}
                className="tap -mr-1 grid size-9 place-items-center rounded-full text-ink-3 hover:text-ink"
              >
                {show ? <EyeOff className="size-[18px]" /> : <Eye className="size-[18px]" />}
              </button>
            </Field>
          )}

          {error && (
            <p role="alert" className="fade-in rounded-xl bg-danger-soft px-3.5 py-2.5 text-[13px] text-danger">
              {error}
            </p>
          )}
          {notice && (
            <p role="status" className="fade-in rounded-xl bg-ok-soft px-3.5 py-2.5 text-[13px] text-ok">
              {notice}
            </p>
          )}

          <button
            type="submit"
            disabled={busy || !email || (mode === "login" && !password)}
            className={clsx(
              "tap flex w-full items-center justify-center gap-2 rounded-2xl bg-accent py-3.5 font-bold text-accent-ink shadow-card",
              "disabled:opacity-50 disabled:active:scale-100",
            )}
          >
            {busy ? (
              <LoaderCircle className="size-5 animate-spin" />
            ) : (
              <>
                {mode === "login" ? "ログイン" : "メールを送る"}
                <ArrowRight className="size-[18px]" />
              </>
            )}
          </button>

          <button
            type="button"
            onClick={() => {
              setMode(mode === "login" ? "reset" : "login");
              setError(null);
            }}
            className="w-full text-center text-[13px] text-ink-2 underline-offset-4 hover:underline"
          >
            {mode === "login" ? "パスワードを忘れた場合" : "ログインに戻る"}
          </button>
        </form>

        <InstallHint dismissible={false} />

        <p className="rise mt-6 text-center text-[12px] text-ink-3" style={{ animationDelay: "160ms" }}>
          このサイトは招待されたアカウントだけが使えます
        </p>
      </div>
    </div>
  );
}

function Field({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[13px] font-medium text-ink-2">{label}</span>
      <span className="flex items-center gap-2.5 rounded-2xl border border-line bg-surface-2 px-3.5 transition-colors focus-within:border-accent focus-within:bg-surface">
        <span className="text-ink-3">{icon}</span>
        {children}
      </span>
    </label>
  );
}
