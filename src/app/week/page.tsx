"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import clsx from "clsx";
import { CalendarDays, CalendarEdit, ChevronLeft, ChevronRight, Clock } from "@/components/icons";
import { MealRow, MealSheet } from "@/components/Meal";
import { ImpactCard } from "@/components/Impact";
import { PageHeader } from "@/components/PageHeader";
import { PLAN_ICON, PlanSheet, type PlanPreset } from "@/components/Plan";
import { Empty, LoadingCards } from "@/components/ui";
import { useData } from "@/lib/data";
import { useNow } from "@/lib/now";
import { addDays, md, mdw, wd, weekDays, weekStart } from "@/lib/date";
import { sum } from "@/lib/format";
import { mealsOn } from "@/lib/meals";
import { SLOTS, type Meal, type Plan } from "@/lib/types";

const GENRE_COLOR: Record<string, string> = {
  和食: "bg-[#b07a4a]",
  洋食: "bg-morning",
  中華: "bg-danger",
  その他: "bg-ink-3",
};

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
  const genres = useMemo(() => {
    const c = new Map<string, number>();
    for (const m of weekMeals) if (m.genre) c.set(m.genre, (c.get(m.genre) ?? 0) + 1);
    return [...c.entries()].sort((a, b) => b[1] - a[1]);
  }, [weekMeals]);
  const genreTotal = sum(genres.map(([, n]) => n));
  // 取り消し済み（献立を戻す待ち）も出して、やっぱり予定ありに戻せるようにする
  const weekPlans = useMemo(
    () => plans.filter((p) => p.date >= days[0] && p.date <= days[6]).sort((a, b) => a.date.localeCompare(b.date)),
    [plans, days],
  );

  // 献立がある週の範囲（前後の移動の上限に使う）
  const dated = meals.map((m) => m.date).filter((d): d is string => !!d).sort();
  const minWeek = dated.length ? weekStart(dated[0]) : thisWeek;
  // 来週の予定は献立ができる前（日曜20時より前）に登録したいので、来週までは進める
  const maxWeek = [dated.length ? weekStart(dated[dated.length - 1]) : thisWeek, addDays(thisWeek, 7), ...plans.map((p) => weekStart(p.date))].sort().pop()!;

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
        {genreTotal > 0 && (
          <div className="mt-4">
            <div className="flex h-2 overflow-hidden rounded-full bg-surface-3" aria-hidden>
              {genres.map(([g, n]) => (
                <div key={g} className={clsx("h-full", GENRE_COLOR[g] ?? "bg-ink-3")} style={{ width: `${(n / genreTotal) * 100}%` }} />
              ))}
            </div>
            <p className="mt-1.5 flex flex-wrap gap-x-3 text-[12px] text-ink-3">
              {genres.map(([g, n]) => (
                <span key={g} className="flex items-center gap-1">
                  <span className={clsx("size-2 rounded-full", GENRE_COLOR[g] ?? "bg-ink-3")} />
                  {g} {n}
                </span>
              ))}
            </p>
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
                    <span className="num">{mdw(p.date)}</span>
                    <span className={clsx(p.canceled && "line-through")}>
                      {SLOTS.filter((s) => p.slots.includes(s)).map((s) => s.slice(0, 1)).join("・")} {p.kind}
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
          毎週日曜の20時に、Claude が翌週分を自動で作ります。外食や家にいない予定は、先に「予定」から登録してください。
        </Empty>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
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

      <MealSheet meal={open} onClose={() => setOpen(null)} />
      <PlanSheet plan={planOpen?.plan ?? null} preset={planOpen?.preset ?? null} onClose={() => setPlanOpen(null)} />
    </>
  );
}
