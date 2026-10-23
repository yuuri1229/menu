"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import clsx from "clsx";
import { ChevronRight, Lightbulb, Refrigerator, ShoppingBasket, TriangleAlert, Wallet } from "lucide-react";
import { MealHero, MealRow, MealSheet } from "@/components/Meal";
import { InstallHint } from "@/components/InstallHint";
import { PageHeader } from "@/components/PageHeader";
import { LoadingCards, Progress, SectionTitle } from "@/components/ui";
import { useData } from "@/lib/data";
import { useNow } from "@/lib/now";
import { addDays, mdJa, mdw, relativeDay, wd, weekStart } from "@/lib/date";
import { sum, yen } from "@/lib/format";
import { currentSlot, mealsOn, prepTips, SLOT_META } from "@/lib/meals";
import { budgetTone, spendByWeek, WEEKLY_BUDGET } from "@/lib/spending";
import { SLOTS, type Meal, type Slot } from "@/lib/types";

function greeting(hour: number) {
  if (hour < 5) return "おつかれさまです";
  if (hour < 11) return "おはようございます";
  if (hour < 17) return "こんにちは";
  return "こんばんは";
}

export default function TodayPage() {
  const { meals, ingredients, inventory, purchases, status } = useData();
  const [open, setOpen] = useState<Meal | null>(null);

  const { today, hour } = useNow();
  const tomorrow = addDays(today, 1);

  const todayMeals = useMemo(() => mealsOn(meals, today), [meals, today]);
  const tomorrowMeals = useMemo(() => mealsOn(meals, tomorrow), [meals, tomorrow]);
  const bySlot = (list: Meal[], s: Slot) => list.find((m) => m.slot === s);

  // 21時を過ぎたら「明日の朝」を主役にする
  const late = hour >= 21;
  const heroSlot: Slot = late ? "朝食" : currentSlot(hour);
  const heroMeal = bySlot(late ? tomorrowMeals : todayMeals, heroSlot);
  const heroLabel = late ? "明日の朝" : `次は${SLOT_META[heroSlot].label}`;

  // 段取り：これからの今日の献立と、明日の朝・昼のメモから拾う
  const tips = useMemo(() => {
    const idx = SLOTS.indexOf(currentSlot(hour));
    const upcoming = [
      ...todayMeals.filter((m) => m.slot && SLOTS.indexOf(m.slot) >= idx && !late),
      ...tomorrowMeals.filter((m) => m.slot !== "夕食"),
    ];
    return upcoming.flatMap((m) => prepTips(m.memo).map((text) => ({ meal: m, text })));
  }, [todayMeals, tomorrowMeals, hour, late]);

  const nextTrip = useMemo(() => {
    const upcoming = ingredients.filter((i) => i.tripDate && i.tripDate >= today && i.trip);
    if (!upcoming.length) return null;
    const date = upcoming.map((i) => i.tripDate!).sort()[0];
    const items = upcoming.filter((i) => i.tripDate === date);
    return { date, label: items[0].trip!, items, estimate: sum(items.map((i) => i.estimate)), left: items.filter((i) => !i.bought).length };
  }, [ingredients, today]);

  const alerts = inventory.filter((i) => i.status === "切れた" || i.status === "残りわずか" || i.status === "要確認");
  const spent = spendByWeek(purchases).get(weekStart(today))?.food ?? 0;
  const tone = budgetTone(spent);

  return (
    <>
      <PageHeader eyebrow={greeting(hour)} title={`${mdJa(today)}（${wd(today)}）`} />
      <div className="-mt-1 mb-3 empty:hidden">
        <InstallHint />
      </div>

      {status === "loading" ? (
        <LoadingCards />
      ) : (
        <div className="space-y-3">
          <div className="rise">
            <MealHero meal={heroMeal} slot={heroSlot} onOpen={setOpen} label={heroLabel} />
          </div>

          {tips.length > 0 && (
            <section className="rise card p-4" style={{ animationDelay: "60ms" }} aria-label="段取り">
              <h2 className="mb-2 flex items-center gap-1.5 text-[13px] font-bold text-warn">
                <Lightbulb className="size-4" />
                段取りメモ
              </h2>
              <ul className="space-y-2">
                {tips.slice(0, 4).map(({ meal, text }, i) => (
                  <li key={i} className="flex gap-2.5 text-[14px] leading-relaxed">
                    <span
                      className={clsx(
                        "mt-0.5 shrink-0 rounded-md px-1.5 text-[11px] font-bold leading-5",
                        meal.date === today ? "bg-surface-3 text-ink-2" : "bg-accent-soft text-accent-text",
                      )}
                    >
                      {meal.date === today ? "今日" : "明日"}
                      {meal.slot ? SLOT_META[meal.slot].short : ""}
                    </span>
                    <span>{text}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}

      {status !== "loading" && (
        <>
          <SectionTitle action={<Link href="/week" className="text-[13px] text-accent-text">1週間を見る</Link>}>今日の献立</SectionTitle>
          <div className="card divide-y divide-line overflow-hidden">
            {SLOTS.map((s) => (
              <MealRow key={s} slot={s} meal={bySlot(todayMeals, s)} onOpen={setOpen} />
            ))}
          </div>

          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {nextTrip ? (
              <Link href={`/shopping?trip=${encodeURIComponent(nextTrip.label)}`} className="tap card flex flex-col p-4">
                <span className="flex items-center gap-1.5 text-[13px] font-bold text-ink-2">
                  <ShoppingBasket className="size-4 text-accent-text" />
                  次の買い物
                  <ChevronRight className="ml-auto size-4 text-ink-3" />
                </span>
                <span className="mt-2 font-display text-xl font-bold">
                  {relativeDay(nextTrip.date, today) ?? mdw(nextTrip.date)}
                  {relativeDay(nextTrip.date, today) && <span className="num ml-1.5 text-sm font-medium text-ink-3">{mdw(nextTrip.date)}</span>}
                </span>
                <span className="num mt-1 text-[13px] text-ink-2">
                  {nextTrip.left}品・目安 {yen(nextTrip.estimate)}
                </span>
              </Link>
            ) : (
              <div className="card p-4 text-[13px] text-ink-3">
                <span className="flex items-center gap-1.5 font-bold text-ink-2">
                  <ShoppingBasket className="size-4" />
                  次の買い物
                </span>
                <p className="mt-2">予定はまだありません</p>
              </div>
            )}

            <Link href="/spending" className="tap card flex flex-col p-4">
              <span className="flex items-center gap-1.5 text-[13px] font-bold text-ink-2">
                <Wallet className="size-4 text-accent-text" />
                今週の食費
                <ChevronRight className="ml-auto size-4 text-ink-3" />
              </span>
              <span className="num mt-2 font-display text-xl font-bold">
                {yen(spent)}
                <span className="ml-1.5 text-sm font-medium text-ink-3">/ {yen(WEEKLY_BUDGET)}</span>
              </span>
              <Progress value={spent} max={WEEKLY_BUDGET} tone={tone} className="mt-2.5" />
              <span className={clsx("num mt-1.5 text-[12px]", tone === "danger" ? "text-danger" : "text-ink-3")}>
                {spent > WEEKLY_BUDGET ? `${yen(spent - WEEKLY_BUDGET)} 超過` : `残り ${yen(WEEKLY_BUDGET - spent)}`}
              </span>
            </Link>

            {alerts.length > 0 && (
              <Link href="/pantry?filter=action" className="tap card flex flex-col p-4 sm:col-span-2">
                <span className="flex items-center gap-1.5 text-[13px] font-bold text-ink-2">
                  <Refrigerator className="size-4 text-accent-text" />
                  在庫の確認
                  <ChevronRight className="ml-auto size-4 text-ink-3" />
                </span>
                <span className="mt-2 flex flex-wrap gap-1.5">
                  {alerts.slice(0, 6).map((i) => (
                    <span
                      key={i.id}
                      className={clsx(
                        "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[12px] font-medium",
                        i.status === "切れた" ? "bg-danger-soft text-danger" : i.status === "残りわずか" ? "bg-warn-soft text-warn" : "bg-surface-3 text-ink-2",
                      )}
                    >
                      {i.status === "切れた" && <TriangleAlert className="size-3" />}
                      {i.name}
                    </span>
                  ))}
                  {alerts.length > 6 && <span className="px-1 py-1 text-[12px] text-ink-3">ほか{alerts.length - 6}件</span>}
                </span>
              </Link>
            )}
          </div>

          <SectionTitle>明日の献立</SectionTitle>
          <div className="card divide-y divide-line overflow-hidden">
            {SLOTS.map((s) => (
              <MealRow key={s} slot={s} meal={bySlot(tomorrowMeals, s)} onOpen={setOpen} compact />
            ))}
          </div>
        </>
      )}

      <MealSheet meal={open} onClose={() => setOpen(null)} />
    </>
  );
}
