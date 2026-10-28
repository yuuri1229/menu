"use client";

import Link from "next/link";
import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Check, ChevronLeft, ChevronRight, ReceiptText } from "@/components/icons";
import { Field, inputClass, PrimaryButton } from "@/components/Form";
import { PageHeader } from "@/components/PageHeader";
import { Empty, LoadingCards, Pill } from "@/components/ui";
import { useData } from "@/lib/data";
import type { Receipt } from "@/lib/data";
import { md } from "@/lib/date";
import { yen } from "@/lib/format";

export default function ReceiptsPage() {
  return (
    <Suspense fallback={<LoadingCards />}>
      <Receipts />
    </Suspense>
  );
}

function Receipts() {
  const id = useSearchParams().get("id");
  const { receipts, status } = useData();
  if (status === "loading") return <LoadingCards />;
  const receipt = id ? receipts.find((r) => r.id === id) : null;
  if (receipt) return <ReceiptForm key={receipt.id} receipt={receipt} />;
  return <ReceiptList receipts={receipts} missing={!!id} />;
}

const dateLabel = (r: Receipt) => (r.date ? md(r.date) : "日付なし");

function ReceiptList({ receipts, missing }: { receipts: Receipt[]; missing: boolean }) {
  const sorted = [...receipts].sort((a, b) => Number(!!a.registeredAt) - Number(!!b.registeredAt) || (b.date ?? "").localeCompare(a.date ?? ""));
  return (
    <>
      <PageHeader eyebrow="重さと期限の登録" title="レシート" />
      {missing && <p className="mb-3 text-[13px] text-ink-3">指定されたレシートが見つかりませんでした。</p>}
      {sorted.length === 0 ? (
        <Empty icon={<ReceiptText className="size-6" />} title="登録待ちのレシートはありません">
          レシートの写真を Claude に送ると、品を読み取って、ここに重さと期限の登録が届きます。
        </Empty>
      ) : (
        <ul className="card divide-y divide-line overflow-hidden">
          {sorted.map((r) => (
            <li key={r.id}>
              <Link href={`/receipts?id=${r.id}`} className="tap flex min-h-14 items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">
                    {dateLabel(r)} {r.store ?? ""}
                  </p>
                  <p className="num text-[12px] text-ink-3">
                    {r.items.length}品{r.total != null ? `・${yen(r.total)}` : ""}
                  </p>
                </div>
                <Pill tone={r.registeredAt ? "neutral" : "accent"}>{r.registeredAt ? "登録済み" : "登録待ち"}</Pill>
                <ChevronRight className="size-5 text-ink-3" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

function ReceiptForm({ receipt }: { receipt: Receipt }) {
  const { registerReceipt, inventory } = useData();
  // 重さは数値の品だけ、期限は全品。初期値は Claude が入れた目安
  const [rows, setRows] = useState(() =>
    receipt.items.map((it) => ({ grams: it.grams != null ? String(it.grams) : "", bestBefore: it.bestBefore ?? "" })),
  );
  const set = (i: number, patch: Partial<(typeof rows)[number]>) => setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const registered = !!receipt.registeredAt;
  const targets = receipt.items.filter((it) => it.inventoryId && inventory.some((d) => d.id === it.inventoryId)).length;

  const submit = () =>
    registerReceipt(
      receipt,
      receipt.items.flatMap((it, i) => {
        if (!it.inventoryId || !inventory.some((d) => d.id === it.inventoryId)) return [];
        const g = Number(rows[i].grams);
        return [{ inventoryId: it.inventoryId, grams: it.grams != null && g > 0 ? g : null, bestBefore: rows[i].bestBefore || null }];
      }),
    );

  return (
    <>
      <PageHeader eyebrow={`${dateLabel(receipt)} ${receipt.store ?? ""}`} title={registered ? "登録しました" : "重さと期限を入れる"}>
        <Link href="/receipts" className="tap mt-2 inline-flex items-center gap-1 text-[13px] text-accent-text">
          <ChevronLeft className="size-4" />
          レシートの一覧
        </Link>
      </PageHeader>

      {registered ? (
        <div className="card flex flex-col items-center gap-3 p-6 text-center">
          <span className="grid size-12 place-items-center rounded-full bg-ok-soft text-ok">
            <Check className="size-7" />
          </span>
          <p className="font-medium">在庫に重さと期限を登録しました</p>
          <Link href="/pantry" className="tap min-h-11 rounded-full bg-surface-3 px-5 py-2.5 text-[14px] font-bold">
            在庫を見る
          </Link>
        </div>
      ) : (
        <>
          <p className="mb-3 text-[13px] leading-relaxed text-ink-3">
            在庫の残量と、期限の通知に使います。品名から入れた目安なので、包装の表示に合わせて直してください。
          </p>
          <ul className="card divide-y divide-line">
            {receipt.items.map((it, i) => (
              <li key={i} className="space-y-3 px-4 py-3.5">
                <div className="flex items-baseline justify-between gap-3">
                  <p className="min-w-0 font-medium">{it.name}</p>
                  {it.amount != null && <span className="num shrink-0 text-[13px] text-ink-3">{yen(it.amount)}</span>}
                </div>
                {it.inventoryId && inventory.some((d) => d.id === it.inventoryId) ? (
                  <div className="grid grid-cols-2 gap-3">
                    {it.grams != null ? (
                      <Field label="重さ（g）">
                        <input
                          type="number"
                          inputMode="numeric"
                          min={1}
                          step={10}
                          value={rows[i].grams}
                          onChange={(e) => set(i, { grams: e.target.value })}
                          className={`${inputClass} num`}
                        />
                      </Field>
                    ) : (
                      <div />
                    )}
                    <Field label="期限">
                      <input type="date" value={rows[i].bestBefore} onChange={(e) => set(i, { bestBefore: e.target.value })} className={inputClass} />
                    </Field>
                  </div>
                ) : (
                  <p className="text-[12px] text-ink-3">在庫に無い品なので、登録は不要です。</p>
                )}
              </li>
            ))}
          </ul>
          <div className="mt-4">
            <PrimaryButton disabled={targets === 0} onClick={submit}>
              <Check className="size-5" />
              在庫に登録する
            </PrimaryButton>
          </div>
        </>
      )}
    </>
  );
}
