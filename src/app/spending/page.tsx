"use client";

import { useMemo, useState } from "react";
import clsx from "clsx";
import { Receipt, Store } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Empty, LoadingCards, Pill, Progress, SectionTitle } from "@/components/ui";
import { useData } from "@/lib/data";
import { useNow } from "@/lib/now";
import { addDays, md, mdw, weekStart } from "@/lib/date";
import { groupBy, sum, yen } from "@/lib/format";
import { budgetTone, countsToBudget, isRice, purchaseDate, spendByWeek, WEEKLY_BUDGET } from "@/lib/spending";

export default function SpendingPage() {
  const { purchases, status } = useData();
  const { today } = useNow();
  const thisWeek = weekStart(today);
  const byWeek = useMemo(() => spendByWeek(purchases), [purchases]);
  const [week, setWeek] = useState(thisWeek);

  // 直近8週（データがある最初の週より前は出さない）
  const firstWeek = [...byWeek.keys()].sort()[0] ?? thisWeek;
  const history = Array.from({ length: 8 }, (_, i) => addDays(thisWeek, -7 * (7 - i))).filter((w) => w >= firstWeek);
  const maxBar = Math.max(WEEKLY_BUDGET * 1.2, ...history.map((w) => byWeek.get(w)?.food ?? 0));

  const w = byWeek.get(week);
  const food = w?.food ?? 0;
  const tone = budgetTone(food);
  const items = w?.items ?? [];
  const stores = [...groupBy(items, (p) => p.store ?? "不明").entries()]
    .map(([s, ps]) => ({ store: s, total: sum(ps.map((p) => p.amount)), count: ps.length }))
    .sort((a, b) => b.total - a.total);
  const days = [...groupBy(items, (p) => purchaseDate(p) ?? "").entries()].sort((a, b) => b[0].localeCompare(a[0]));

  return (
    <>
      <PageHeader eyebrow={week === thisWeek ? "今週の食費" : `${md(week)}の週の食費`} title={yen(food)} />

      {status === "loading" ? (
        <LoadingCards />
      ) : (
        <>
          <section className="card p-5" aria-label="予算">
            <div className="flex items-baseline justify-between text-[13px]">
              <span className="text-ink-2">予算 {yen(WEEKLY_BUDGET)}（米・調味料は別枠）</span>
              <span className={clsx("num font-bold", tone === "danger" ? "text-danger" : tone === "warn" ? "text-warn" : "text-ok")}>
                {food > WEEKLY_BUDGET ? `${yen(food - WEEKLY_BUDGET)} 超過` : `残り ${yen(WEEKLY_BUDGET - food)}`}
              </span>
            </div>
            <Progress value={food} max={WEEKLY_BUDGET} tone={tone} className="mt-3 h-3" />
            <dl className="mt-4 grid grid-cols-3 gap-2 text-center">
              {[
                ["食材", food],
                ["米（別枠）", w?.rice ?? 0],
                ["調味料ほか", w?.other ?? 0],
              ].map(([label, v]) => (
                <div key={label as string} className="rounded-xl bg-surface-2 py-2.5">
                  <dt className="text-[11px] text-ink-3">{label}</dt>
                  <dd className="num mt-0.5 text-[15px] font-bold">{yen(v as number)}</dd>
                </div>
              ))}
            </dl>
          </section>

          {history.length > 1 && (
            <>
              <SectionTitle>週ごとの食費</SectionTitle>
              <section className="card p-4" aria-label="週ごとの食費">
                <div className="relative flex h-40 items-end gap-2">
                  <div
                    className="pointer-events-none absolute inset-x-0 border-t border-dashed border-accent/60"
                    style={{ bottom: `${(WEEKLY_BUDGET / maxBar) * 100}%` }}
                    aria-hidden
                  >
                    <span className="absolute -top-5 right-0 text-[10px] text-accent-text">予算</span>
                  </div>
                  {history.map((hw) => {
                    const v = byWeek.get(hw)?.food ?? 0;
                    const active = hw === week;
                    return (
                      <button
                        key={hw}
                        type="button"
                        onClick={() => setWeek(hw)}
                        aria-pressed={active}
                        aria-label={`${md(hw)}の週 ${yen(v)}`}
                        className="tap group flex h-full flex-1 flex-col items-center justify-end"
                      >
                        <span className={clsx("num mb-1 text-[10px]", active ? "font-bold text-ink" : "text-ink-3")}>
                          {v ? `${(v / 1000).toFixed(1)}k` : ""}
                        </span>
                        <span
                          className={clsx(
                            "w-full max-w-10 rounded-t-lg transition-all duration-500",
                            v > WEEKLY_BUDGET ? "bg-danger" : "bg-accent",
                            active ? "opacity-100" : "opacity-35 group-hover:opacity-60",
                          )}
                          style={{ height: `${Math.max(2, (v / maxBar) * 100)}%` }}
                        />
                      </button>
                    );
                  })}
                </div>
                <div className="mt-1.5 flex gap-2">
                  {history.map((hw) => (
                    <span key={hw} className={clsx("num flex-1 text-center text-[10px]", hw === week ? "font-bold text-ink" : "text-ink-3")}>
                      {md(hw)}
                    </span>
                  ))}
                </div>
              </section>
            </>
          )}

          {items.length === 0 ? (
            <div className="mt-6">
              <Empty icon={<Receipt className="size-6" />} title="この週の記録はありません">
                レシートを Claude に渡して「記録して」と伝えると、ここに反映されます。
              </Empty>
            </div>
          ) : (
            <>
              <SectionTitle>お店ごと</SectionTitle>
              <ul className="card divide-y divide-line overflow-hidden">
                {stores.map((s) => (
                  <li key={s.store} className="flex items-center gap-3 px-4 py-3">
                    <Store className="size-[18px] text-ink-3" />
                    <span className="min-w-0 flex-1 truncate text-[15px]">{s.store}</span>
                    <span className="text-[12px] text-ink-3">{s.count}品</span>
                    <span className="num w-20 text-right font-medium">{yen(s.total)}</span>
                  </li>
                ))}
              </ul>

              <SectionTitle>明細</SectionTitle>
              <div className="space-y-4">
                {days.map(([d, ps]) => (
                  <section key={d} aria-label={d}>
                    <h3 className="mb-1.5 flex items-baseline justify-between px-1 text-[13px] font-bold text-ink-2">
                      <span className="num">{d ? mdw(d) : "日付なし"}</span>
                      <span className="num font-normal text-ink-3">{yen(sum(ps.map((p) => p.amount)))}</span>
                    </h3>
                    <ul className="card divide-y divide-line overflow-hidden">
                      {ps.map((p) => (
                        <li key={p.id} className="flex items-start gap-3 px-4 py-2.5">
                          <div className="min-w-0 flex-1">
                            <p className="text-[14px]">{p.name}</p>
                            <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] text-ink-3">
                              {p.store && <span>{p.store}</span>}
                              {isRice(p) && <Pill>米・別枠</Pill>}
                              {!countsToBudget(p) && !isRice(p) && p.category && <Pill>{p.category}</Pill>}
                              {p.carryOver && <Pill tone="night">翌週も使う</Pill>}
                              {p.memo && <span className="w-full leading-snug">{p.memo}</span>}
                            </p>
                          </div>
                          <span className="num shrink-0 text-[14px] font-medium">{yen(p.amount)}</span>
                        </li>
                      ))}
                    </ul>
                  </section>
                ))}
              </div>
            </>
          )}
        </>
      )}
    </>
  );
}
