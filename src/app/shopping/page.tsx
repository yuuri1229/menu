"use client";

import Link from "next/link";
import { Suspense, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import clsx from "clsx";
import { Check, ChevronLeft, ChevronRight, NotebookText, ShoppingBasket, Snowflake } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Empty, LoadingCards, Progress, Segmented } from "@/components/ui";
import { useData } from "@/lib/data";
import { useNow } from "@/lib/now";
import { md, mdw, relativeDay, weekStart } from "@/lib/date";
import { groupBy, sum, yen } from "@/lib/format";
import type { Ingredient } from "@/lib/types";

const CATEGORY_ORDER = ["野菜", "肉", "卵・大豆製品", "乳製品・果物", "主食", "その他"];
export default function ShoppingPage() {
  return (
    <Suspense fallback={<LoadingCards />}>
      <Shopping />
    </Suspense>
  );
}

interface Trip {
  label: string;
  date: string;
  week: string;
  items: Ingredient[];
}

function Shopping() {
  const params = useSearchParams();
  const { ingredients, notes, status, setBought } = useData();
  const [hideDone, setHideDone] = useState(false);
  const { today } = useNow();

  const trips = useMemo<Trip[]>(() => {
    const byLabel = groupBy(
      ingredients.filter((i) => i.trip && i.tripDate),
      (i) => i.trip!,
    );
    return [...byLabel.entries()]
      .map(([label, items]) => ({ label, date: items[0].tripDate!, week: weekStart(items[0].tripDate!), items }))
      .sort((a, b) => a.date.localeCompare(b.date) || a.label.localeCompare(b.label));
  }, [ingredients]);

  const defaultTrip = trips.find((t) => t.date >= today) ?? trips[trips.length - 1];
  const [selected, setSelected] = useState<string | null>(params.get("trip"));
  const trip = trips.find((t) => t.label === selected) ?? defaultTrip;

  const select = (label: string) => {
    setSelected(label);
    const url = new URL(window.location.href);
    url.searchParams.set("trip", label);
    window.history.replaceState(null, "", url);
  };

  if (status === "loading") {
    return (
      <>
        <PageHeader eyebrow="買い物" title="買い物リスト" />
        <LoadingCards count={5} />
      </>
    );
  }

  if (!trip) {
    return (
      <>
        <PageHeader eyebrow="買い物" title="買い物リスト" />
        <Empty icon={<ShoppingBasket className="size-6" />} title="買い物リストがありません">
          献立づくりで食材に買い物回が入ると、ここに表示されます。
        </Empty>
      </>
    );
  }

  const weekTrips = trips.filter((t) => t.week === trip.week);
  const weeks = [...new Set(trips.map((t) => t.week))];
  const wi = weeks.indexOf(trip.week);
  // チェックは「買った」として保存され、Claude もほかの端末も同じ状態を見る
  const isChecked = (i: Ingredient) => i.bought;
  const toggle = (i: Ingredient) => setBought(i.id, !i.bought);

  const done = trip.items.filter(isChecked).length;
  const estimate = sum(trip.items.map((i) => i.estimate));
  const actual = sum(trip.items.map((i) => i.actual));
  const leftEstimate = sum(trip.items.filter((i) => !isChecked(i)).map((i) => i.estimate));
  const groups = [...groupBy(trip.items, (i) => i.category ?? "その他").entries()].sort(
    (a, b) => (CATEGORY_ORDER.indexOf(a[0]) + 99) % 99 - (CATEGORY_ORDER.indexOf(b[0]) + 99) % 99,
  );
  const note = notes.find((n) => n.kind === "week" && n.start && n.end && n.start <= trip.date && trip.date <= n.end);
  const rel = relativeDay(trip.date, today);

  return (
    <>
      <PageHeader eyebrow={rel ? `${rel}の買い物` : trip.date < today ? "済んだ買い物" : "これからの買い物"} title={mdw(trip.date)}>
        <div className="mt-4 flex items-center gap-2">
          <button
            type="button"
            aria-label="前の週"
            disabled={wi <= 0}
            onClick={() => select(trips.find((t) => t.week === weeks[wi - 1])!.label)}
            className="tap grid size-10 shrink-0 place-items-center rounded-full bg-surface shadow-card disabled:opacity-40"
          >
            <ChevronLeft className="size-5" />
          </button>
          <div className="min-w-0 flex-1">
            <Segmented
              label="買い物回"
              value={trip.label}
              onChange={select}
              options={weekTrips.map((t) => ({
                value: t.label,
                label: t.label.replace(/\s*\d{1,2}\/\d{1,2}.*/, "") + " " + md(t.date),
                sub: relativeDay(t.date, today) ?? `${t.items.length}品`,
              }))}
            />
          </div>
          <button
            type="button"
            aria-label="次の週"
            disabled={wi >= weeks.length - 1}
            onClick={() => select(trips.find((t) => t.week === weeks[wi + 1])!.label)}
            className="tap grid size-10 shrink-0 place-items-center rounded-full bg-surface shadow-card disabled:opacity-40"
          >
            <ChevronRight className="size-5" />
          </button>
        </div>
      </PageHeader>

      <section className="card p-4" aria-label="この回のまとめ">
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="text-[12px] text-ink-3">チェック済み</p>
            <p className="num font-display text-2xl font-bold">
              {done}
              <span className="text-base text-ink-3"> / {trip.items.length}品</span>
            </p>
          </div>
          <div className="text-right">
            <p className="text-[12px] text-ink-3">{done < trip.items.length ? "残りの目安" : actual ? "実績" : "目安"}</p>
            <p className="num font-display text-2xl font-bold">
              {yen(done < trip.items.length ? leftEstimate : actual || estimate)}
            </p>
          </div>
        </div>
        <Progress value={done} max={trip.items.length} tone={done === trip.items.length ? "ok" : "accent"} className="mt-3" />
        <div className="num mt-2 flex flex-wrap gap-x-4 text-[12px] text-ink-3">
          <span>目安合計 {yen(estimate)}</span>
          {actual > 0 && (
            <span className={actual > estimate ? "text-danger" : "text-ok"}>
              実績 {yen(actual)}（{actual > estimate ? "+" : ""}
              {yen(actual - estimate)}）
            </span>
          )}
        </div>
      </section>

      <div className="mt-4 flex items-center gap-2">
        <button
          type="button"
          onClick={() => setHideDone((h) => !h)}
          aria-pressed={hideDone}
          className={clsx(
            "tap rounded-full px-3.5 py-1.5 text-[13px] font-medium",
            hideDone ? "bg-ink text-bg" : "bg-surface text-ink-2 shadow-card",
          )}
        >
          チェック済みを隠す
        </button>
        {note && (
          <Link href={`/notes?id=${note.id}`} className="tap ml-auto flex items-center gap-1 rounded-full px-3 py-1.5 text-[13px] text-accent">
            <NotebookText className="size-4" />
            予算メモ
          </Link>
        )}
      </div>

      <div className="mt-3 space-y-4">
        {groups.map(([category, items]) => {
          const visible = hideDone ? items.filter((i) => !isChecked(i)) : items;
          if (!visible.length) return null;
          return (
            <section key={category} aria-label={category}>
              <h2 className="mb-1.5 flex items-baseline justify-between px-1 text-[13px] font-bold text-ink-2">
                {category}
                <span className="num font-normal text-ink-3">{yen(sum(items.map((i) => i.estimate)))}</span>
              </h2>
              <ul className="card divide-y divide-line overflow-hidden">
                {visible.map((i) => {
                  const checked = isChecked(i);
                  return (
                    <li key={i.id}>
                      <button
                        type="button"
                        role="checkbox"
                        aria-checked={checked}
                        onClick={() => toggle(i)}
                        className="tap flex w-full items-center gap-3 px-4 py-3.5 text-left active:bg-surface-2"
                      >
                        <span
                          className={clsx(
                            "grid size-7 shrink-0 place-items-center rounded-full border-2 transition-all duration-200",
                            checked ? "scale-95 border-ok bg-ok text-white" : "border-line",
                          )}
                        >
                          <Check className={clsx("size-4 transition-transform", checked ? "scale-100" : "scale-0")} strokeWidth={3} />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className={clsx("block text-[16px] font-medium transition-colors", checked && "text-ink-3 line-through decoration-ink-3/60")}>
                            {i.name}
                            {i.amount && <span className="ml-2 text-[13px] font-normal text-ink-3">{i.amount}</span>}
                          </span>
                          {i.memo && <span className="block text-[12px] leading-snug text-ink-3">{i.memo}</span>}
                        </span>
                        <span className="flex shrink-0 flex-col items-end gap-0.5">
                          <span className={clsx("num text-[14px]", checked ? "text-ink-3" : "text-ink-2")}>{yen(i.actual ?? i.estimate)}</span>
                          {i.storage === "冷蔵" && <Snowflake className="size-3.5 text-night" aria-label="冷蔵" />}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
      </div>

      <p className="mt-6 text-center text-[12px] leading-relaxed text-ink-3">
        チェックすると「買った」として保存され、ほかの端末や Claude にもすぐ伝わります。
        <br />
        電波がない店内でも押せます（つながったときに送られます）。
      </p>
    </>
  );
}
