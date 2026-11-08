"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import clsx from "clsx";
import { CalendarDays, CalendarEdit, ChevronLeft, ChevronRight, Clock, GridView, ViewList } from "@/components/icons";
import { MealRow, MealSheet } from "@/components/Meal";
import { ImpactCard } from "@/components/Impact";
import { PageHeader } from "@/components/PageHeader";
import { PLAN_ICON, PlanSheet, type PlanPreset } from "@/components/Plan";
import { Empty, LoadingCards, Progress } from "@/components/ui";
import { useData } from "@/lib/data";
import { useNow } from "@/lib/now";
import { addDays, md, mdw, wd, weekDays, weekStart } from "@/lib/date";
import { sum } from "@/lib/format";
import { mealsOn, SLOT_META, splitTitle } from "@/lib/meals";
import { planEnd, planWhen } from "@/lib/plans";
import { SLOTS, type Meal, type Plan } from "@/lib/types";

export default function WeekPage() {
  return (
    <Suspense fallback={<LoadingCards />}>
      <Week />
    </Suspense>
  );
}

function Week() {
  const params = useSearchParams();
  const { meals, plans, status } = useData();
  const { today } = useNow();
  const thisWeek = weekStart(today);
  const initial = params.get("w");
  const [start, setStart] = useState(initial && /^\d{4}-\d{2}-\d{2}$/.test(initial) ? weekStart(initial) : thisWeek);
  const [open, setOpen] = useState<Meal | null>(null);
  const [planOpen, setPlanOpen] = useState<{ plan: Plan | null; preset: PlanPreset | null } | null>(null);
  const todayRef = useRef<HTMLElement>(null);

  const go = (s: string) => {
    setStart(s);
    const url = new URL(window.location.href);
    if (s === thisWeek) url.searchParams.delete("w");
    else url.searchParams.set("w", s);
    window.history.replaceState(null, "", url);
  };

  const days = weekDays(start);
  const weekMeals = useMemo(() => meals.filter((m) => m.date && m.date >= days[0] && m.date <= days[6]), [meals, days]);
  const totalMinutes = sum(weekMeals.map((m) => m.minutes));
  const doneCount = weekMeals.filter((m) => m.done).length;
  const [view, setView] = useState<"list" | "grid">("list");
  // 取り消し済み（献立を戻す待ち）も出して、やっぱり予定ありに戻せるようにする
  const weekPlans = useMemo(
    () => plans.filter((p) => p.date <= days[6] && planEnd(p) >= days[0]).sort((a, b) => a.date.localeCompare(b.date)),
    [plans, days],
  );

  // 献立がある週の範囲（前後の移動の上限に使う）
  const dated = meals.map((m) => m.date).filter((d): d is string => !!d).sort();
  const minWeek = dated.length ? weekStart(dated[0]) : thisWeek;
  // 来週の予定は献立ができる前（日曜23時30分より前）に登録したいので、来週までは進める
  const maxWeek = [dated.length ? weekStart(dated[dated.length - 1]) : thisWeek, addDays(thisWeek, 7), ...plans.map((p) => weekStart(planEnd(p)))].sort().pop()!;

  useEffect(() => {
    if (status === "ready" && start === thisWeek) todayRef.current?.scrollIntoView({ block: "center", behavior: "smooth" });
    // 初回表示のときだけ
  }, [status]);

  return (
    <>
      <PageHeader eyebrow={start === thisWeek ? "今週の献立" : start < thisWeek ? "過去の献立" : "来週以降の献立"} title={`${md(days[0])} – ${md(days[6])}`}>
        <div className="mt-4 flex items-center gap-2">
          <button
            type="button"
            onClick={() => go(addDays(start, -7))}
            disabled={start <= minWeek}
            aria-label="前の週"
            className="tap grid size-10 place-items-center rounded-full bg-surface shadow-card disabled:opacity-40"
          >
            <ChevronLeft className="size-5" />
          </button>
          <button
            type="button"
            onClick={() => go(thisWeek)}
            disabled={start === thisWeek}
            className="tap h-10 rounded-full bg-surface px-4 text-[13px] font-medium shadow-card disabled:text-ink-3"
          >
            今週
          </button>
          <button
            type="button"
            onClick={() => go(addDays(start, 7))}
            disabled={start >= maxWeek}
            aria-label="次の週"
            className="tap grid size-10 place-items-center rounded-full bg-surface shadow-card disabled:opacity-40"
          >
            <ChevronRight className="size-5" />
          </button>
          <button
            type="button"
            onClick={() => setPlanOpen({ plan: null, preset: { date: start > today ? start : today, slots: ["夕食"] } })}
            disabled={days[6] < today}
            className="tap flex h-10 items-center gap-1.5 rounded-full bg-surface px-3.5 text-[13px] font-medium shadow-card disabled:opacity-40"
          >
            <CalendarEdit className="size-[18px]" />
            予定
          </button>
          {weekMeals.length > 0 && (
            <span className="num ml-auto flex items-center gap-1 text-[13px] text-ink-3">
              <Clock className="size-4" />
              調理 計{Math.round(totalMinutes / 6) / 10}時間
            </span>
          )}
        </div>
        {weekMeals.length > 0 && (
          <div className="card mt-4 p-4">
            <div className="flex items-baseline justify-between gap-3">
              <p className="num">
                <span className="font-display text-xl font-bold">{doneCount}</span>
                <span className="text-[13px] text-ink-3"> / {weekMeals.length}食 作った</span>
              </p>
              <div role="tablist" aria-label="表示" className="flex gap-0.5 rounded-xl bg-surface-3 p-0.5">
                {(
                  [
                    ["list", "一覧", ViewList],
                    ["grid", "マス表", GridView],
                  ] as const
                ).map(([v, label, Icon]) => (
                  <button
                    key={v}
                    role="tab"
                    type="button"
                    aria-selected={view === v}
                    onClick={() => setView(v)}
                    className={clsx("tap flex min-h-9 items-center gap-1 rounded-lg px-2.5 text-[13px] font-medium", view === v ? "bg-surface text-ink shadow-card" : "text-ink-2")}
                  >
                    <Icon className="size-4" />
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <Progress value={doneCount} max={weekMeals.length} tone="ok" className="mt-3" />
          </div>
        )}
        {weekPlans.length > 0 && (
          <ul className="mt-4 flex flex-wrap gap-2" aria-label="この週の外食・不在の予定">
            {weekPlans.map((p) => {
              const Icon = PLAN_ICON[p.kind];
              return (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => setPlanOpen({ plan: p, preset: null })}
                    className={clsx("tap flex items-center gap-1.5 rounded-full bg-night-soft px-3 py-1.5 text-[13px]", p.canceled && "opacity-60")}
                  >
                    <Icon className="size-4 text-night" />
                    <span className={clsx("num", p.canceled && "line-through")}>
                      {planWhen(p)} {p.kind}
                    </span>
                    {(p.canceled || !p.handledAt) && <span className="text-[11px] text-ink-3">{p.canceled ? "取り消し" : "反映待ち"}</span>}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </PageHeader>

      {status === "loading" ? (
        <LoadingCards count={4} />
      ) : weekMeals.length === 0 && weekPlans.length === 0 ? (
        <Empty icon={<CalendarDays className="size-6" />} title="この週の献立はありません">
          毎週日曜の23時30分に、Claude が翌週分を自動で作ります。外食や家にいない予定は、先に「予定」から登録してください。
        </Empty>
      ) : (
        <div className={clsx("grid gap-3 lg:grid-cols-2", view === "grid" && "hidden")}>
          {days[6] >= today && <ImpactCard className="lg:col-span-2" />}
          {days.map((d, i) => {
            const list = mealsOn(meals, d);
            const isToday = d === today;
            const past = d < today;
            return (
              <section
                key={d}
                ref={isToday ? todayRef : undefined}
                aria-label={`${md(d)}（${wd(d)}）`}
                className={clsx("rise card scroll-mt-24 overflow-hidden", isToday && "ring-2 ring-accent", past && "opacity-75")}
                style={{ animationDelay: `${i * 30}ms` }}
              >
                <header className="flex items-center gap-3 border-b border-line px-4 py-2.5">
                  <span
                    className={clsx(
                      "num grid size-10 place-items-center rounded-xl font-display text-lg font-bold",
                      isToday ? "bg-accent text-accent-ink" : wd(d) === "日" ? "bg-danger-soft text-danger" : wd(d) === "土" ? "bg-night-soft text-night" : "bg-surface-3",
                    )}
                  >
                    {Number(d.slice(8))}
                  </span>
                  <span className="font-display font-bold">{wd(d)}曜日</span>
                  {isToday && <span className="rounded-full bg-accent-soft px-2 py-0.5 text-[12px] font-bold text-accent-text">今日</span>}
                  <span className="num ml-auto text-[12px] text-ink-3">{list.length ? `計${sum(list.map((m) => m.minutes))}分` : ""}</span>
                </header>
                <div className="divide-y divide-line">
                  {SLOTS.map((s) => (
                    <MealRow key={s} slot={s} date={d} meal={list.find((m) => m.slot === s)} onOpen={setOpen} />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}

      {view === "grid" && status !== "loading" && weekMeals.length + weekPlans.length > 0 && (
        <WeekGrid days={days} today={today} onOpen={setOpen} />
      )}

      <MealSheet meal={open} onClose={() => setOpen(null)} />
      <PlanSheet plan={planOpen?.plan ?? null} preset={planOpen?.preset ?? null} onClose={() => setPlanOpen(null)} />
    </>
  );
}

const SLOT_TEXT = { morning: "text-morning", noon: "text-noon", night: "text-night" } as const;

/** 1週間を朝昼夜×7日のマスで見る。作った＝緑、外食・不在＝青、今日＝朱の枠 */
function WeekGrid({ days, today, onOpen }: { days: string[]; today: string; onOpen: (m: Meal) => void }) {
  const { meals, planAt } = useData();
  return (
    <section className="card p-3" aria-label="1週間のマス表">
      <div className="grid grid-cols-[2.25rem_repeat(3,minmax(0,1fr))] gap-1">
        <span />
        {SLOTS.map((s) => (
          <span key={s} className={clsx("pb-1 text-center text-[12px] font-bold", SLOT_TEXT[SLOT_META[s].tone])}>
            {SLOT_META[s].label}
          </span>
        ))}
        {days.map((d) => {
          const list = mealsOn(meals, d);
          const isToday = d === today;
          return [
            <span key={d} className={clsx("num flex flex-col items-center justify-center text-[12px] leading-tight font-bold", isToday ? "text-accent-text" : wd(d) === "日" ? "text-danger" : wd(d) === "土" ? "text-night" : "text-ink")}>
              {Number(d.slice(8))}
              <span className="text-[11px] font-normal">{wd(d)}</span>
            </span>,
            ...SLOTS.map((s) => {
              const meal = list.find((m) => m.slot === s);
              const plan = !meal ? planAt(d, s) : null;
              const cell = clsx(
                "flex min-h-14 w-full items-center rounded-lg p-1.5 text-left text-[11px] leading-tight break-words",
                meal?.done ? "bg-ok-soft text-ink-2" : plan ? "bg-night-soft font-bold text-night" : "bg-surface-2",
                isToday && "ring-2 ring-accent",
              );
              if (meal)
                return (
                  <button key={d + s} type="button" onClick={() => onOpen(meal)} className={clsx("tap", cell)}>
                    <span className="line-clamp-3">{splitTitle(meal.title).head}</span>
                  </button>
                );
              return (
                <span key={d + s} className={cell}>
                  {plan ? plan.kind : <span className="text-ink-3">未定</span>}
                </span>
              );
            }),
          ];
        })}
      </div>
      <p className="mt-2 flex flex-wrap gap-x-3 text-[11px] text-ink-3">
        <span className="flex items-center gap-1"><i className="size-2.5 rounded-sm bg-ok-soft ring-1 ring-ok" />作った</span>
        <span className="flex items-center gap-1"><i className="size-2.5 rounded-sm bg-night-soft ring-1 ring-night" />外食・不在</span>
        <span className="flex items-center gap-1"><i className="size-2.5 rounded-sm ring-2 ring-accent" />今日</span>
      </p>
    </section>
  );
}
