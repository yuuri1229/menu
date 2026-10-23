"use client";

import { Suspense, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import clsx from "clsx";
import { Check, ChevronRight, Fish, Refrigerator, Search, Snowflake, TriangleAlert, X } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Empty, LoadingCards, Pill, Sheet, type Tone } from "@/components/ui";
import { useData } from "@/lib/data";
import { useNow } from "@/lib/now";
import { diffDays, mdw } from "@/lib/date";
import { groupBy } from "@/lib/format";
import type { InventoryItem, StockStatus } from "@/lib/types";

const STATUS_TONE: Record<StockStatus, Tone> = { 十分: "ok", 残りわずか: "warn", 切れた: "danger", 要確認: "neutral" };
const STATUS_RANK: Record<string, number> = { 切れた: 0, 残りわずか: 1, 要確認: 2, 十分: 3 };
const STATUS_HELP: [StockStatus, string][] = [
  ["十分", "家にある。買わない"],
  ["残りわずか", "次の買い物で買う"],
  ["切れた", "すぐ買う"],
  ["要確認", "家で確かめてから決める"],
];
const NEEDS_ACTION = (i: InventoryItem) => i.status === "切れた" || i.status === "残りわずか" || i.status === "要確認";

type Filter = "all" | "action" | "seafood";

export default function PantryPage() {
  return (
    <Suspense fallback={<LoadingCards />}>
      <Pantry />
    </Suspense>
  );
}

function Pantry() {
  const params = useSearchParams();
  const { inventory, status } = useData();
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>((params.get("filter") as Filter) ?? "all");
  const { today } = useNow();

  const counts = {
    all: inventory.length,
    action: inventory.filter(NEEDS_ACTION).length,
    seafood: inventory.filter((i) => i.seafood === "要確認" || i.seafood === "NG").length,
  };

  const list = useMemo(() => {
    const query = q.trim();
    return inventory
      .filter((i) => (filter === "action" ? NEEDS_ACTION(i) : filter === "seafood" ? i.seafood === "要確認" || i.seafood === "NG" : true))
      .filter((i) => !query || `${i.name}${i.memo}${i.remaining}${i.category ?? ""}`.includes(query))
      .sort((a, b) => (STATUS_RANK[a.status ?? ""] ?? 4) - (STATUS_RANK[b.status ?? ""] ?? 4) || a.name.localeCompare(b.name, "ja"));
  }, [inventory, q, filter]);

  const groups = [...groupBy(list, (i) => i.category ?? "その他").entries()];

  return (
    <>
      <PageHeader eyebrow="家の在庫" title="在庫">
        <div className="mt-4 flex items-center gap-2.5 rounded-2xl bg-surface px-3.5 shadow-card focus-within:ring-2 focus-within:ring-accent">
          <Search className="size-[18px] text-ink-3" />
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="品名で探す"
            aria-label="品名で探す"
            className="w-full bg-transparent py-3 text-[16px] outline-none placeholder:text-ink-3 [&::-webkit-search-cancel-button]:hidden"
          />
          {q && (
            <button type="button" onClick={() => setQ("")} aria-label="検索をクリア" className="text-ink-3">
              <X className="size-[18px]" />
            </button>
          )}
        </div>
        <div className="no-scrollbar -mx-4 mt-3 flex gap-2 overflow-x-auto px-4">
          {(
            [
              ["all", "すべて"],
              ["action", "買い足し・確認"],
              ["seafood", "魚介の確認"],
            ] as [Filter, string][]
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setFilter(key)}
              aria-pressed={filter === key}
              className={clsx(
                "tap flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[13px] font-medium",
                filter === key ? "bg-ink text-bg" : "bg-surface text-ink-2 shadow-card",
              )}
            >
              {label}
              <span className={clsx("num text-[12px]", filter === key ? "opacity-70" : "text-ink-3")}>{counts[key]}</span>
            </button>
          ))}
        </div>
      </PageHeader>

      {status === "loading" ? (
        <LoadingCards count={5} />
      ) : list.length === 0 ? (
        <Empty icon={<Refrigerator className="size-6" />} title={q ? "見つかりませんでした" : "該当するものはありません"}>
          {filter === "action" && !q ? "買い足しや確認が必要な物はありません。" : null}
        </Empty>
      ) : (
        <div className="space-y-4">
          {groups.map(([category, items]) => (
            <section key={category} aria-label={category}>
              <h2 className="mb-1.5 px-1 text-[13px] font-bold text-ink-2">{category}</h2>
              <ul className="card divide-y divide-line overflow-hidden">
                {items.map((i) => {
                  const days = i.bestBefore ? diffDays(i.bestBefore, today) : null;
                  return (
                    <li key={i.id}>
                      <button
                        type="button"
                        onClick={() => setEditing(i.id)}
                        aria-label={`${i.name}の在庫の状態を変える`}
                        className="tap flex w-full items-start gap-3 px-4 py-3 text-left active:bg-surface-2"
                      >
                        <span
                          className={clsx(
                            "mt-2 size-2.5 shrink-0 rounded-full",
                            i.status === "切れた" ? "bg-danger" : i.status === "残りわずか" ? "bg-warn" : i.status === "十分" ? "bg-ok" : "bg-ink-3",
                          )}
                          aria-hidden
                        />
                        <span className="block min-w-0 flex-1">
                          <span className="flex flex-wrap items-center gap-1.5">
                            <span className="text-[15px] font-medium">{i.name}</span>
                            {i.storage === "冷蔵" && <Snowflake className="size-3.5 text-night" aria-label="冷蔵" />}
                            {i.seafood === "NG" && (
                              <Pill tone="danger">
                                <Fish className="size-3" />
                                魚介NG
                              </Pill>
                            )}
                            {i.seafood === "要確認" && (
                              <Pill tone="warn">
                                <Fish className="size-3" />
                                魚介を確認
                              </Pill>
                            )}
                          </span>
                          {(i.remaining || i.memo) && (
                            <span className="mt-0.5 block text-[12px] leading-snug text-ink-3">{[i.remaining, i.memo].filter(Boolean).join("・")}</span>
                          )}
                          {days != null && (
                            <span className={clsx("num mt-0.5 flex items-center gap-1 text-[12px]", days <= 1 ? "text-danger" : days <= 3 ? "text-warn" : "text-ink-3")}>
                              {days <= 3 && <TriangleAlert className="size-3" />}
                              賞味期限 {mdw(i.bestBefore!)}
                              {days < 0 ? "（切れています）" : days === 0 ? "（今日まで）" : days <= 3 ? `（あと${days}日）` : ""}
                            </span>
                          )}
                        </span>
                        <span className="flex shrink-0 items-center gap-0.5">
                          {i.status && <Pill tone={STATUS_TONE[i.status]}>{i.status}</Pill>}
                          <ChevronRight className="size-4 text-ink-3" />
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}
      <StockSheet item={inventory.find((i) => i.id === editing) ?? null} onClose={() => setEditing(null)} />
    </>
  );
}

/** 在庫の状態を変えるシート。押すとすぐ保存され、Claude の献立づくりにも反映される */
function StockSheet({ item, onClose }: { item: InventoryItem | null; onClose: () => void }) {
  const { setStock } = useData();
  if (!item) return null;
  return (
    <Sheet
      open
      onClose={onClose}
      title={
        <div>
          <p className="text-[13px] text-ink-3">{[item.category, item.storage].filter(Boolean).join("・") || "在庫"}</p>
          <h2 className="mt-1 font-display text-[20px] leading-snug font-bold">{item.name}</h2>
        </div>
      }
    >
      <div className="space-y-4">
        {(item.remaining || item.memo) && (
          <p className="rounded-2xl bg-surface-2 p-4 text-[14px] leading-relaxed text-ink-2">{[item.remaining, item.memo].filter(Boolean).join("・")}</p>
        )}
        <fieldset>
          <legend className="mb-2 text-[13px] font-bold text-ink-2">いまの状態</legend>
          <div className="grid grid-cols-2 gap-2">
            {STATUS_HELP.map(([value, help]) => {
              const active = item.status === value;
              return (
                <button
                  key={value}
                  type="button"
                  aria-pressed={active}
                  onClick={() => {
                    setStock(item.id, value);
                    onClose();
                  }}
                  className={clsx(
                    "tap relative rounded-2xl border-2 px-3.5 py-3 text-left",
                    active ? "border-accent bg-accent-soft" : "border-line bg-surface",
                  )}
                >
                  <Pill tone={STATUS_TONE[value]}>{value}</Pill>
                  <span className="mt-1.5 block text-[13px] leading-snug text-ink-2">{help}</span>
                  {active && <Check className="absolute top-3 right-3 size-4 text-accent-text" strokeWidth={3} />}
                </button>
              );
            })}
          </div>
        </fieldset>
        <p className="text-[12px] leading-relaxed text-ink-3">品名や賞味期限を直したいときは、Claude に「○○の賞味期限は10/20」のように伝えてください。</p>
      </div>
    </Sheet>
  );
}
