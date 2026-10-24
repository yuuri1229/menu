"use client";

import { Suspense, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import clsx from "clsx";
import { Check, ChevronRight, Fish, Minus, Plus, Refrigerator, Search, Snowflake, TriangleAlert, X } from "@/components/icons";
import { Chips, Field, PrimaryButton, inputClass } from "@/components/Form";
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
  const [creating, setCreating] = useState(false);
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
                        aria-label={`${i.name}の在庫を編集する`}
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
      <button
        type="button"
        onClick={() => setCreating(true)}
        className="tap fixed right-4 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-30 flex min-h-14 items-center gap-2 rounded-2xl bg-accent px-5 text-[15px] font-bold text-accent-ink shadow-float md:right-8 md:bottom-8"
      >
        <Plus className="size-6" />
        在庫を登録
      </button>
      {/* 右下の登録ボタンで最後の行が隠れないように */}
      <div className="h-20" aria-hidden />
      <StockSheet
        item={inventory.find((i) => i.id === editing) ?? null}
        creating={creating}
        onClose={() => {
          setEditing(null);
          setCreating(false);
        }}
      />
    </>
  );
}

const UNITS = ["個", "g", "本", "袋", "パック", "枚", "ml"] as const;
type Unit = (typeof UNITS)[number];
const STORAGES = ["冷蔵", "冷凍", "常温"] as const;
const CATEGORIES = ["野菜", "肉", "卵・大豆製品", "乳製品・果物", "主食", "調味料", "その他"];

/** 「200g」「3個」を数と単位に分ける。それ以外の書き方（「半分」など）は文字のまま扱う */
function parseRemaining(text: string): { num: string; unit: Unit | null; free: string } {
  const m = text.trim().match(/^(\d+(?:\.\d+)?)\s*(個|g|本|袋|パック|枚|ml)$/);
  return m ? { num: m[1], unit: m[2] as Unit, free: "" } : { num: "", unit: null, free: text };
}

/**
 * 在庫の登録・編集シート。状態はすぐ保存、それ以外は「保存」で Firestore に書く。
 * Claude の献立づくりも同じ在庫を読む（魚介の確認だけは Claude が付ける）。
 */
function StockSheet({ item, creating, onClose }: { item: InventoryItem | null; creating: boolean; onClose: () => void }) {
  if (!item && !creating) return null;
  return <StockForm key={item?.id ?? "new"} item={item} onClose={onClose} />;
}

function StockForm({ item, onClose }: { item: InventoryItem | null; onClose: () => void }) {
  const { saveInventory, inventory } = useData();
  const { today } = useNow();
  const parsed = parseRemaining(item?.remaining ?? "");
  const [name, setName] = useState(item?.name ?? "");
  const [category, setCategory] = useState(item?.category ?? "");
  const [storage, setStorage] = useState<string | null>(item?.storage ?? null);
  const [status, setStatus] = useState<StockStatus | null>(item?.status ?? "十分");
  const [num, setNum] = useState(parsed.num);
  const [unit, setUnit] = useState<Unit | null>(parsed.unit ?? (item ? null : "個"));
  const [free, setFree] = useState(parsed.free);
  const [bestBefore, setBestBefore] = useState(item?.bestBefore ?? "");
  const [purchasedAt, setPurchasedAt] = useState(item?.purchasedAt ?? (item ? "" : today));
  const [memo, setMemo] = useState(item?.memo ?? "");

  const categories = [...new Set([...CATEGORIES, ...inventory.map((i) => i.category).filter((c): c is string => !!c)])];
  const remaining = num && unit ? `${num}${unit}` : free.trim();
  const step = unit === "g" || unit === "ml" ? 50 : 1;
  const bump = (d: number) => {
    const n = Math.max(0, (Number(num) || 0) + d * step);
    setNum(String(n));
    setFree("");
    if (!unit) setUnit("個");
  };

  const save = () => {
    saveInventory(item?.id ?? null, {
      name: name.trim(),
      category: category.trim() || null,
      storage,
      status,
      remaining,
      memo: memo.trim(),
      bestBefore: bestBefore || null,
      purchasedAt: purchasedAt || null,
    });
    onClose();
  };

  return (
    <Sheet
      open
      onClose={onClose}
      title={
        <div>
          <p className="text-[13px] text-ink-3">{item ? "在庫を編集" : "在庫を登録"}</p>
          <h2 className="mt-1 font-display text-[20px] leading-snug font-bold">{item ? item.name : "新しい在庫"}</h2>
        </div>
      }
      footer={
        <PrimaryButton disabled={!name.trim()} onClick={save}>
          <Check className="size-5" />
          {item ? "保存する" : "登録する"}
        </PrimaryButton>
      }
    >
      <div className="space-y-5">
        {item?.seafood && item.seafood !== "問題なし" && (
          <p className="flex items-center gap-2 rounded-2xl bg-warn-soft p-3 text-[13px] text-warn">
            <Fish className="size-4 shrink-0" />
            魚介の確認：{item.seafood}（Claude が確かめて付けます）
          </p>
        )}
        <Field label="品名">
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} placeholder="例：豚こま切れ" className={inputClass} />
        </Field>

        <fieldset>
          <legend className="mb-2 text-[13px] font-bold text-ink-2">いまの状態</legend>
          <div className="grid grid-cols-2 gap-2">
            {STATUS_HELP.map(([value, help]) => {
              const active = status === value;
              return (
                <button
                  key={value}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setStatus(value)}
                  className={clsx(
                    "tap relative rounded-2xl border-2 px-3.5 py-3 text-left",
                    active ? "border-accent bg-accent-soft" : "border-line bg-surface",
                  )}
                >
                  <Pill tone={STATUS_TONE[value]}>{value}</Pill>
                  <span className="mt-1.5 block text-[13px] leading-snug text-ink-2">{help}</span>
                  {active && <Check className="absolute top-3 right-3 size-4 text-accent-text" />}
                </button>
              );
            })}
          </div>
        </fieldset>

        <fieldset>
          <legend className="mb-2 text-[13px] font-bold text-ink-2">残っている量</legend>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => bump(-1)} aria-label="減らす" className="tap grid size-11 shrink-0 place-items-center rounded-full bg-surface-3 text-ink-2">
              <Minus className="size-5" />
            </button>
            <input
              inputMode="decimal"
              value={num}
              onChange={(e) => {
                setNum(e.target.value.replace(/[^\d.]/g, ""));
                setFree("");
                if (!unit) setUnit("個");
              }}
              placeholder="数"
              aria-label="数"
              className={clsx(inputClass, "num text-center")}
            />
            <button type="button" onClick={() => bump(1)} aria-label="増やす" className="tap grid size-11 shrink-0 place-items-center rounded-full bg-surface-3 text-ink-2">
              <Plus className="size-5" />
            </button>
          </div>
          <div className="mt-2">
            <Chips label="単位" value={unit} options={UNITS} allowEmpty={false} onChange={(u) => setUnit(u)} />
          </div>
          <input
            value={free}
            onChange={(e) => {
              setFree(e.target.value);
              setNum("");
              setUnit(null);
            }}
            maxLength={60}
            placeholder="数で書けないとき（例：半分くらい）"
            aria-label="量を文字で書く"
            className={clsx(inputClass, "mt-2")}
          />
        </fieldset>

        <div className="grid grid-cols-2 gap-3">
          <Field label="消費・賞味期限">
            <input type="date" value={bestBefore} onChange={(e) => setBestBefore(e.target.value)} className={inputClass} />
          </Field>
          <Field label="買った日">
            <input type="date" value={purchasedAt} onChange={(e) => setPurchasedAt(e.target.value)} className={inputClass} />
          </Field>
        </div>

        <Field label="保存場所">
          <Chips label="保存場所" value={storage as (typeof STORAGES)[number] | null} options={STORAGES} onChange={setStorage} />
        </Field>

        <Field label="分類">
          <input value={category} onChange={(e) => setCategory(e.target.value)} list="inventory-categories" placeholder="例：肉" className={inputClass} />
          <datalist id="inventory-categories">
            {categories.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </Field>

        <Field label="メモ">
          <textarea value={memo} onChange={(e) => setMemo(e.target.value)} maxLength={300} rows={2} placeholder="例：半分は冷凍済み" className={inputClass} />
        </Field>
      </div>
    </Sheet>
  );
}
