"use client";

import { useMemo } from "react";
import clsx from "clsx";
import { Snowflake, TriangleAlert } from "@/components/icons";
import { useData } from "@/lib/data";
import { useNow } from "@/lib/now";
import { md, mdw, relativeDay } from "@/lib/date";
import { computeImpact, hasImpact, nextCheck, type Impact } from "@/lib/impact";
import { SLOT_META, splitTitle } from "@/lib/meals";
import type { Meal } from "@/lib/types";
import { Pill } from "./ui";

/** 予定・在庫の変更が献立と買い物に与える影響（決まりで計算した目安。組み直しは Claude が毎日7時・12時・21時） */
export function useImpact(): Impact {
  const { meals, ingredients, inventory, plans } = useData();
  const { today } = useNow();
  return useMemo(() => computeImpact({ meals, ingredients, inventory, plans }, today), [meals, ingredients, inventory, plans, today]);
}

const mealLabel = (m: Meal) => `${mdw(m.date!)} ${m.slot ? SLOT_META[m.slot].short : ""} ${splitTitle(m.title).head}`;

/** 「今日 12:00」のような次の確認の時刻 */
export function NextCheck() {
  const { today, hour } = useNow();
  const next = nextCheck(today, hour);
  const day = next.date === today ? "今日" : relativeDay(next.date, today) ?? mdw(next.date);
  return (
    <span className="num font-bold text-ink-2">
      {day} {next.hour}:00
    </span>
  );
}

/** 今日・献立の画面に出す「予定・在庫の変更による影響」 */
export function ImpactCard({ className }: { className?: string }) {
  const impact = useImpact();
  if (!hasImpact(impact)) return null;
  return (
    <section className={clsx("card space-y-3 p-4", className)} aria-label="予定・在庫の変更による影響">
      <div>
        <h2 className="flex items-center gap-1.5 text-[13px] font-bold text-warn">
          <TriangleAlert className="size-4" />
          予定・在庫の変更による影響
        </h2>
        <p className="mt-1 text-[12px] leading-snug text-ink-3">
          次は <NextCheck /> に Claude が献立を組み直します（毎日7時・12時・21時）。それまでの目安です。
          {impact.nextTrip && ` 次の買い物は${mdw(impact.nextTrip)}。`}
        </p>
      </div>

      {impact.dontBuy.length > 0 && (
        <div>
          <h3 className="mb-1.5 text-[13px] font-bold text-ink-2">買わなくてよさそうな物</h3>
          <ul className="flex flex-wrap gap-1.5">
            {impact.dontBuy.map((i) => (
              <li key={i.id}>
                <Pill>
                  {i.name}
                  {i.tripDate && <span className="num text-ink-3">{md(i.tripDate)}</span>}
                </Pill>
              </li>
            ))}
          </ul>
        </div>
      )}

      {impact.useUp.length > 0 && (
        <div>
          <h3 className="mb-1.5 text-[13px] font-bold text-ink-2">使う先がなくなった物</h3>
          <ul className="space-y-1.5">
            {impact.useUp.map((u) => (
              <li key={u.item.id} className="flex gap-2 text-[13px] leading-snug">
                {u.item.category === "肉" ? (
                  <Snowflake className="mt-0.5 size-4 shrink-0 text-night" aria-label="冷凍" />
                ) : (
                  <span className={clsx("mt-1.5 size-2 shrink-0 rounded-full", u.urgent ? "bg-warn" : "bg-ink-3")} aria-hidden />
                )}
                <span>
                  <span className="font-medium">{u.item.name}</span>
                  <span className="text-ink-2">：{u.hint}</span>
                  {u.bestBefore && <span className="num text-ink-3">（期限 {md(u.bestBefore)}）</span>}
                  {u.usedElsewhere && <span className="text-ink-3">（ほかの献立でも使う）</span>}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {impact.missing.length > 0 && (
        <div>
          <h3 className="mb-1.5 text-[13px] font-bold text-ink-2">材料が切れている献立</h3>
          <ul className="space-y-1 text-[13px] leading-snug">
            {impact.missing.map((x) => (
              <li key={x.meal.id}>
                <span className="num">{mealLabel(x.meal)}</span>
                <span className="text-danger">：{x.names.join("・")}が切れています</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
