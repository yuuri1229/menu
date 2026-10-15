"use client";

import Link from "next/link";
import { BookOpen, ChevronRight, LogOut, RefreshCw } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useData } from "@/lib/data";
import { timeAgo } from "@/lib/date";
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
