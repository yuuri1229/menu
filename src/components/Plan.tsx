"use client";

import clsx from "clsx";
import { useState } from "react";
import { Away, Check, EatingOut, Info, Undo } from "@/components/icons";
import { Chips, Field, PrimaryButton, inputClass } from "@/components/Form";
import { useData } from "@/lib/data";
import { useNow } from "@/lib/now";
import { addDays, mdw } from "@/lib/date";
import { SLOT_META, splitTitle } from "@/lib/meals";
import { PLAN_KINDS, PLAN_MEMO_MAX, SLOTS } from "@/lib/types";
import type { Plan, PlanKind, Slot } from "@/lib/types";
import { Pill, Sheet } from "./ui";

export const PLAN_ICON = { 外食: EatingOut, 不在: Away } as const satisfies Record<PlanKind, unknown>;

/** 「外食」「不在」の小さな札 */
export function PlanTag({ plan, className }: { plan: Plan; className?: string }) {
  const Icon = PLAN_ICON[plan.kind];
  return (
    <Pill tone="night" className={className}>
      <Icon className="size-3.5" />
      {plan.kind}
    </Pill>
  );
}

/** 献立に反映されたかどうか */
export function planState(plan: Plan): string {
  if (plan.canceled) return "取り消し済み（献立を戻す待ち）";
  return plan.handledAt ? "献立に反映済み" : "献立に反映待ち";
}

export type PlanPreset = { date: string; slots: Slot[] };

/** 予定の登録・書き直し・取り消し。plan があれば編集、preset なら新規 */
export function PlanSheet({ plan, preset, onClose }: { plan: Plan | null; preset: PlanPreset | null; onClose: () => void }) {
  if (!plan && !preset) return null;
  return <PlanForm key={plan?.id ?? `${preset!.date}-${preset!.slots.join()}`} plan={plan} preset={preset} onClose={onClose} />;
}

function PlanForm({ plan, preset, onClose }: { plan: Plan | null; preset: PlanPreset | null; onClose: () => void }) {
  const { meals, savePlan, cancelPlan } = useData();
  const { today } = useNow();
  const [date, setDate] = useState(plan?.date ?? preset?.date ?? today);
  const [slots, setSlots] = useState<Slot[]>(plan?.slots ?? preset?.slots ?? ["夕食"]);
  const [kind, setKind] = useState<PlanKind>(plan?.kind ?? "外食");
  const [memo, setMemo] = useState(plan?.memo ?? "");

  const toggle = (s: Slot) => setSlots((cur) => (cur.includes(s) ? cur.filter((x) => x !== s) : SLOTS.filter((x) => x === s || cur.includes(x))));
  // すでに献立がある食事（急な予定）か、これから組む食事（前もって分かる予定）か
  const planned = meals.filter((m) => m.date === date && m.slot && slots.includes(m.slot));
  const soon = date <= addDays(today, 1);

  const save = () => {
    savePlan(plan?.id ?? null, { date, slots, kind, memo });
    onClose();
  };
  const cancel = () => {
    if (!plan) return;
    const msg = plan.handledAt
      ? "予定がなくなったことにします。Claude が献立と食材を戻します。よろしいですか？"
      : "この予定を消します。よろしいですか？";
    if (!window.confirm(msg)) return;
    cancelPlan(plan);
    onClose();
  };

  return (
    <Sheet
      open
      onClose={onClose}
      title={
        <div>
          <div className="flex flex-wrap items-center gap-1.5 text-[13px] text-ink-3">
            <span>{plan ? "予定を編集" : "予定を登録"}</span>
            {plan && <Pill tone={plan.handledAt && !plan.canceled ? "ok" : "neutral"}>{planState(plan)}</Pill>}
          </div>
          <h2 className="mt-1 font-display text-[20px] leading-snug font-bold">外食・家にいない食事</h2>
        </div>
      }
      footer={
        <PrimaryButton disabled={!date || !slots.length} onClick={save}>
          <Check className="size-5" />
          {plan?.canceled ? "やっぱり予定あり（戻す）" : plan ? "保存する" : "登録する"}
        </PrimaryButton>
      }
    >
      <div className="space-y-5">
        <Field label="日付">
          <input type="date" value={date} min={plan ? undefined : today} onChange={(e) => setDate(e.target.value)} className={inputClass} />
        </Field>

        <fieldset>
          <legend className="mb-2 text-[13px] font-bold text-ink-2">食事</legend>
          <div className="grid grid-cols-3 gap-2">
            {SLOTS.map((s) => (
              <button
                key={s}
                type="button"
                aria-pressed={slots.includes(s)}
                onClick={() => toggle(s)}
                className={clsx(
                  "tap min-h-11 rounded-xl border text-[14px] font-medium",
                  slots.includes(s) ? "border-accent bg-accent text-accent-ink" : "border-line bg-surface text-ink-2",
                )}
              >
                {SLOT_META[s].label}
              </button>
            ))}
          </div>
        </fieldset>

        <Field label="種類" hint="外食：お店やお呼ばれで食べる。不在：出かけていて家で食べない（食べる物は自分で用意）。">
          <Chips label="種類" value={kind} options={PLAN_KINDS} allowEmpty={false} onChange={(k) => k && setKind(k)} />
        </Field>

        <Field label="メモ">
          <textarea
            value={memo}
            onChange={(e) => setMemo(e.target.value.slice(0, PLAN_MEMO_MAX))}
            rows={2}
            placeholder="例：会社の飲み会。翌朝は軽めにしたい"
            className={inputClass}
          />
        </Field>

        <div className="flex gap-2.5 rounded-2xl bg-surface-2 p-4 text-[13px] leading-relaxed text-ink-2">
          <Info className="mt-0.5 size-4 shrink-0 text-ink-3" />
          <div className="space-y-1.5">
            {planned.length > 0 ? (
              <p>
                {planned.map((m) => `${mdw(m.date!)} ${SLOT_META[m.slot!].label}「${splitTitle(m.title).head}」`).join("、")}
                は作らない扱いになり、使うはずだった食材は先の献立に回します（肉は冷凍、傷みやすい物から先に使う）。毎日7時・12時・21時に Claude が組み直します。
              </p>
            ) : (
              <p>日曜20時の献立づくりで、この食事の分の食材は買わずに組みます。</p>
            )}
            {slots.includes("夕食") && <p>夕食の取り分けがない翌日のお弁当は、朝にレンジで作れる簡単なものにします。</p>}
            {plan?.handledAt && <p>予定がなくなったら下の「予定がなくなった」を押してください。在庫と買い足しで献立を戻します。</p>}
            {soon && <p>今日・明日の分をすぐ組み直したいときは、チャットで Claude に伝えてください。</p>}
          </div>
        </div>

        {plan && !plan.canceled && (
          <button
            type="button"
            onClick={cancel}
            className="tap flex w-full min-h-12 items-center justify-center gap-2 rounded-2xl border border-danger/40 text-[15px] font-medium text-danger active:bg-danger-soft"
          >
            <Undo className="size-5" />
            {plan.handledAt ? "予定がなくなった（献立を戻す）" : "この予定を消す"}
          </button>
        )}
      </div>
    </Sheet>
  );
}
