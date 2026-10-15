"use client";

import { Suspense, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import clsx from "clsx";
import { Fish, Refrigerator, Search, Snowflake, TriangleAlert, X } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Empty, LoadingCards, Pill, type Tone } from "@/components/ui";
import { useData } from "@/lib/data";
import { useNow } from "@/lib/now";
import { diffDays, mdw } from "@/lib/date";
import { groupBy } from "@/lib/format";
import type { InventoryItem, StockStatus } from "@/lib/types";

const STATUS_TONE: Record<StockStatus, Tone> = { 十分: "ok", 残りわずか: "warn", 切れた: "danger", 要確認: "neutral" };
const STATUS_RANK: Record<string, number> = { 切れた: 0, 残りわずか: 1, 要確認: 2, 十分: 3 };
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
                    <li key={i.id} className="flex items-start gap-3 px-4 py-3">
                      <span
                        className={clsx(
                          "mt-2 size-2.5 shrink-0 rounded-full",
                          i.status === "切れた" ? "bg-danger" : i.status === "残りわずか" ? "bg-warn" : i.status === "十分" ? "bg-ok" : "bg-ink-3",
                        )}
                        aria-hidden
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
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
                        </div>
                        {(i.remaining || i.memo) && (
                          <p className="mt-0.5 text-[12px] leading-snug text-ink-3">{[i.remaining, i.memo].filter(Boolean).join("・")}</p>
                        )}
                        {days != null && (
                          <p className={clsx("num mt-0.5 flex items-center gap-1 text-[12px]", days <= 1 ? "text-danger" : days <= 3 ? "text-warn" : "text-ink-3")}>
                            {days <= 3 && <TriangleAlert className="size-3" />}
                            賞味期限 {mdw(i.bestBefore!)}
                            {days < 0 ? "（切れています）" : days === 0 ? "（今日まで）" : days <= 3 ? `（あと${days}日）` : ""}
                          </p>
                        )}
                      </div>
                      {i.status && <Pill tone={STATUS_TONE[i.status]}>{i.status}</Pill>}
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}
    </>
  );
}
