"use client";

import Link from "next/link";
import { ChevronRight, ReceiptText } from "@/components/icons";
import { useData } from "@/lib/data";

/** 重さと期限の登録を待つレシートがあれば知らせる（通知を見逃したときの入り口） */
export function ReceiptBanner() {
  const { pendingReceipts } = useData();
  if (!pendingReceipts.length) return null;
  const next = pendingReceipts[0];
  return (
    <Link
      href={pendingReceipts.length === 1 ? `/receipts?id=${next.id}` : "/receipts"}
      className="card tap mb-4 flex min-h-14 items-center gap-3 px-4 py-3"
    >
      <span className="grid size-9 shrink-0 place-items-center rounded-full bg-accent-soft text-accent-text">
        <ReceiptText className="size-5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-medium">レシート {pendingReceipts.length} 件の登録待ち</p>
        <p className="text-[12px] text-ink-3">重さと期限を入れると、在庫に反映されます</p>
      </div>
      <ChevronRight className="size-5 text-ink-3" />
    </Link>
  );
}
