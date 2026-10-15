"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Bell, BellOff, BookOpen, ChevronRight, LogOut, RefreshCw } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useData } from "@/lib/data";
import { timeAgo } from "@/lib/date";
import { disablePush, enablePush, getPushState, type PushState } from "@/lib/push";
import { Sheet } from "./ui";

export function SettingsSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { state, logout } = useAuth();
  const { syncedAt, meals, ingredients, purchases, inventory, demo } = useData();
  const email = state.status === "signedIn" ? state.email : null;

  return (
    <Sheet open={open} onClose={onClose} title={<h2 className="font-display text-lg font-bold">アカウント</h2>}>
      <div className="space-y-3">
        <div className="rounded-2xl bg-surface-2 p-4">
          <p className="text-[12px] text-ink-3">ログイン中</p>
          <p className="truncate font-medium">{demo ? "デモモード" : email}</p>
        </div>

        <div className="rounded-2xl bg-surface-2 p-4">
          <div className="flex items-center gap-2 text-[13px] text-ink-2">
            <RefreshCw className="size-4" />
            Claude の最終更新：<span className="font-medium text-ink">{timeAgo(syncedAt)}</span>
          </div>
          {syncedAt && (
            <p className="num mt-1 text-[12px] text-ink-3">
              {new Date(syncedAt).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo", dateStyle: "medium", timeStyle: "short" })}
            </p>
          )}
          <p className="num mt-2 text-[12px] text-ink-3">
            献立 {meals.length}・食材 {ingredients.length}・明細 {purchases.length}・在庫 {inventory.length}
          </p>
          <p className="mt-2 text-[12px] leading-relaxed text-ink-3">
            献立・買い物・在庫は Claude と同じデータを見ています。Claude が更新するとすぐ画面に反映され、ここで押した「作った」「買った」「在庫の状態」も Claude に伝わります。
          </p>
        </div>

        {!demo && <PushCard open={open} />}

        <Link
          href="/notes"
          onClick={onClose}
          className="tap flex items-center gap-3 rounded-2xl bg-surface-2 p-4 font-medium"
        >
          <BookOpen className="size-5 text-ink-2" />
          ノート（週の予算メモ・前提条件）
          <ChevronRight className="ml-auto size-5 text-ink-3" />
        </Link>

        {!demo && (
          <button
            type="button"
            onClick={() => {
              onClose();
              void logout();
            }}
            className="tap flex w-full items-center justify-center gap-2 rounded-2xl border border-line py-3.5 font-medium text-danger"
          >
            <LogOut className="size-[18px]" />
            ログアウト
          </button>
        )}
      </div>
    </Sheet>
  );
}

const PUSH_NOTE: Record<PushState, string> = {
  on: "この端末に届きます。買い物の前の晩（20時）に買う物と段取りを、Claude が献立を更新したときはそのお知らせを送ります。",
  off: "買い物の前の晩（20時）に買う物と段取りを、Claude が献立を更新したときはそのお知らせを、この端末に送ります。",
  needsInstall: "iPhone では、ホーム画面に追加したアイコンから開くと通知をオンにできます（Safari のままでは受け取れません）。",
  denied: "通知が許可されていません。端末の「設定 → 通知 → こんだて帖」で許可してから、もう一度開いてください。",
  unsupported: "このブラウザでは通知を受け取れません。",
};

function PushCard({ open }: { open: boolean }) {
  const [state, setState] = useState<PushState | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) void getPushState().then(setState, () => setState("unsupported"));
  }, [open]);

  if (!state) return null;
  const on = state === "on";
  const canToggle = state === "on" || state === "off";

  const toggle = async () => {
    setBusy(true);
    setError(null);
    try {
      setState(on ? await disablePush() : await enablePush());
    } catch (e) {
      console.error(e);
      setError("通知の設定ができませんでした。電波のよい場所でもう一度お試しください。");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-2xl bg-surface-2 p-4">
      <div className="flex items-center gap-3">
        {on ? <Bell className="size-5 text-accent" /> : <BellOff className="size-5 text-ink-3" />}
        <p className="font-medium">通知</p>
        {canToggle && (
          <button
            type="button"
            role="switch"
            aria-checked={on}
            aria-label="通知を受け取る"
            disabled={busy}
            onClick={() => void toggle()}
            className={`tap relative ml-auto h-7 w-12 shrink-0 rounded-full transition-colors disabled:opacity-60 ${on ? "bg-accent" : "bg-ink-3/40"}`}
          >
            <span className={`absolute top-0.5 left-0.5 size-6 rounded-full bg-white shadow transition-transform ${on ? "translate-x-5" : ""}`} />
          </button>
        )}
      </div>
      <p className="mt-2 text-[12px] leading-relaxed text-ink-3">{PUSH_NOTE[state]}</p>
      {error && <p className="mt-2 text-[12px] text-danger">{error}</p>}
    </div>
  );
}
