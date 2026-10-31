"use client";

import clsx from "clsx";
import { useState } from "react";
import { CalendarEdit, Check, ChefHat, TriangleAlert, CircleCheck, Clock, Lightbulb, MessageCircleHeart, Minus, Pencil, Repeat, ShoppingBasket, Sparkles, ThumbsDown, ThumbsUp, Bento, Refrigerator } from "@/components/icons";
import { useData } from "@/lib/data";
import { carriedOver, shortName } from "@/lib/impact";
import { useNow } from "@/lib/now";
import { mdw, wd } from "@/lib/date";
import { yen } from "@/lib/format";
import { parseMarkdown } from "@/lib/markdown";
import { isBento, memoSentences, SLOT_META, splitTitle, titleTag } from "@/lib/meals";
import { FEEDBACK_TAGS, FEEDBACK_TEXT_MAX, VERDICTS } from "@/lib/types";
import type { Feedback, FeedbackTag, Ingredient, Meal, Plan, Slot, Verdict } from "@/lib/types";
import { Recipe } from "./Recipe";
import { NextCheck, useImpact } from "./Impact";
import { PLAN_ICON, PlanSheet, planState, PlanTag, type PlanPreset } from "./Plan";
import { Pill, Sheet } from "./ui";

const TONE_TEXT = { morning: "text-morning", noon: "text-noon", night: "text-night" } as const;

export function SlotLabel({ slot, meal, className }: { slot: Slot; meal?: Meal; className?: string }) {
  const meta = SLOT_META[slot];
  const label = meal && isBento(meal) ? "お弁当" : meta.label;
  return <Pill tone={meta.tone} className={className}>{label}</Pill>;
}

/** 感想の評価のアイコン（絵文字は使わない） */
const VERDICT_ICON = { 好み: ThumbsUp, ふつう: Minus, 合わない: ThumbsDown } as const satisfies Record<Verdict, unknown>;
const VERDICT_COLOR = { 好み: "text-accent-text", ふつう: "text-ink-3", 合わない: "text-danger" } as const satisfies Record<Verdict, string>;

function VerdictIcon({ verdict, className }: { verdict: Verdict; className?: string }) {
  const Icon = VERDICT_ICON[verdict];
  return <Icon className={className} aria-hidden />;
}

/** 一覧で使う一行の献立。date を渡すと、献立がなくても外食・不在の予定を出す */
export function MealRow({ meal, slot, date, onOpen, compact }: { meal?: Meal; slot: Slot; date?: string; onOpen?: (m: Meal) => void; compact?: boolean }) {
  const meta = SLOT_META[slot];
  const { feedbackByMeal, planAt, meals, ingredients } = useData();
  const [editing, setEditing] = useState<Plan | null>(null);
  const feedback = meal ? feedbackByMeal.get(meal.id) : undefined;
  const plan = planAt(date ?? meal?.date ?? null, slot);
  const missing = useImpact().missing.find((x) => x.meal.id === meal?.id);
  if (!meal && plan) {
    const Icon = PLAN_ICON[plan.kind];
    return (
      <>
        <button
          type="button"
          onClick={() => setEditing(plan)}
          className={clsx("tap flex w-full items-center gap-3 px-4 text-left hover:bg-surface-2", compact ? "py-2.5" : "py-3")}
        >
          <span className={clsx("w-5 shrink-0 text-center text-[13px] font-bold", TONE_TEXT[meta.tone])}>{meta.short}</span>
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-1.5 text-[15px] font-medium text-ink-2">
              <Icon className="size-4 text-night" />
              {plan.kind}
            </span>
            {!compact && plan.memo && <span className="block truncate text-[12px] text-ink-3">{plan.memo}</span>}
          </span>
        </button>
        <PlanSheet plan={editing} preset={null} onClose={() => setEditing(null)} />
      </>
    );
  }
  if (!meal) {
    return (
      <div className={clsx("flex items-center gap-3 px-4", compact ? "py-2.5" : "py-3")}>
        <span className={clsx("w-5 text-center text-[13px] font-bold", TONE_TEXT[meta.tone])}>{meta.short}</span>
        <span className="text-sm text-ink-3">未定</span>
      </div>
    );
  }
  const { head, extras } = splitTitle(meal.title);
  const carried = meal.done ? [] : carriedOver(meal, meals, ingredients);
  return (
    <button
      type="button"
      onClick={() => onOpen?.(meal)}
      className={clsx("tap flex w-full items-center gap-3 px-4 text-left hover:bg-surface-2", compact ? "py-2.5" : "py-3")}
    >
      <span className={clsx("w-5 shrink-0 text-center text-[13px] font-bold", TONE_TEXT[meta.tone])}>{meta.short}</span>
      <span className="min-w-0 flex-1">
        <span className={clsx("block truncate text-[15px] font-medium", (meal.done || plan) && "text-ink-2", plan && "line-through decoration-ink-3")}>
          {isBento(meal) && <Bento className="mr-1 inline size-4 -translate-y-px align-middle text-ink-3" aria-label="お弁当" />}
          {head}
        </span>
        {!compact && (extras.length > 0 || meal.sides) && (
          <span className="block truncate text-[12px] text-ink-3">{extras.length ? `＋${extras.join("・")}` : meal.sides}</span>
        )}
      </span>
      {plan && <PlanTag plan={plan} className="shrink-0" />}
      {carried.length > 0 && <CarryOver items={carried} short />}
      {missing && (
        <span className="shrink-0 text-danger" role="img" aria-label={`${missing.names.join("・")}が切れています`}>
          <TriangleAlert className="size-[18px]" />
        </span>
      )}
      {feedback && (
        <span className={clsx("shrink-0", VERDICT_COLOR[feedback.verdict])} role="img" aria-label={`感想：${feedback.verdict}`}>
          <VerdictIcon verdict={feedback.verdict} className="size-[18px]" />
        </span>
      )}
      {meal.done ? (
        <CircleCheck className="size-[18px] shrink-0 text-ok" aria-label="作った" />
      ) : (
        !plan &&
        meal.minutes != null && (
          <span className="num flex shrink-0 items-center gap-1 text-[12px] text-ink-3">
            <Clock className="size-3.5" />
            {meal.minutes}分
          </span>
        )
      )}
    </button>
  );
}

/** 大きく見せる「次のごはん」 */
export function MealHero({ meal, slot, date, onOpen, label }: { meal?: Meal; slot: Slot; date: string; onOpen: (m: Meal) => void; label: string }) {
  const { planAt, meals, ingredients } = useData();
  const plan = planAt(date, slot);
  const [editing, setEditing] = useState<Plan | null>(null);
  if (plan && !meal) {
    const Icon = PLAN_ICON[plan.kind];
    return (
      <>
        <button type="button" onClick={() => setEditing(plan)} className="tap card block w-full p-5 text-left">
          <p className="text-[13px] font-medium text-ink-3">{label}</p>
          <p className="mt-2 flex items-center gap-2 font-display text-[22px] leading-snug font-bold">
            <Icon className="size-6 text-night" />
            {plan.kind}の予定
          </p>
          {plan.memo && <p className="mt-1 text-sm text-ink-2">{plan.memo}</p>}
        </button>
        <PlanSheet plan={editing} preset={null} onClose={() => setEditing(null)} />
      </>
    );
  }
  if (!meal) {
    return (
      <div className="card p-5">
        <p className="text-[13px] font-medium text-ink-3">{label}</p>
        <p className="mt-2 font-display text-xl font-bold text-ink-2">まだ献立がありません</p>
        <p className="mt-1 text-sm text-ink-3">日曜の20時に翌週分が自動で作られます</p>
      </div>
    );
  }
  const { head, extras } = splitTitle(meal.title);
  const carried = meal.done ? [] : carriedOver(meal, meals, ingredients);
  return (
    <button type="button" onClick={() => onOpen(meal)} className="tap card block w-full p-5 text-left">
      <div className="flex items-center gap-2">
        <p className="text-[13px] font-medium text-ink-3">{label}</p>
        <SlotLabel slot={slot} meal={meal} />
        {plan && <PlanTag plan={plan} />}
        {meal.done && (
          <Pill tone="ok">
            <CircleCheck className="size-3" />
            作った
          </Pill>
        )}
      </div>
      <p className="mt-2 font-display text-[22px] leading-snug font-bold">{head}</p>
      {extras.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {extras.map((e) => (
            <span key={e} className="rounded-full bg-surface-3 px-2.5 py-0.5 text-[12px] text-ink-2">
              ＋{e}
            </span>
          ))}
        </div>
      )}
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-ink-2">
        {meal.minutes != null && (
          <span className="num flex items-center gap-1">
            <Clock className="size-4 text-ink-3" />
            {meal.minutes}分
          </span>
        )}
        {meal.sides && <span className="truncate">副菜：{meal.sides}</span>}
      </div>
      {carried.length > 0 && <CarryOver items={carried} className="mt-3" />}
    </button>
  );
}

/** 翌日の献立でも使う食材の目印。一覧では印だけ、大きい表示では食材名も出す */
function CarryOver({ items, short, className }: { items: Ingredient[]; short?: boolean; className?: string }) {
  const names = items.map((i) => shortName(i.name)).join("・");
  if (short) {
    return (
      <Pill tone="warn" className="shrink-0 px-2" aria-label={`${names}は明日も使います`}>
        <Repeat className="size-3.5" />
        明日も
      </Pill>
    );
  }
  return (
    <p className={clsx("flex items-center gap-1.5 rounded-xl bg-warn-soft px-3 py-2 text-[13px] text-ink", className)}>
      <Repeat className="size-4 shrink-0 text-warn" aria-hidden />
      <span className="min-w-0">
        <span className="font-bold">{names}</span>は明日も使います
      </span>
    </p>
  );
}

/** 「作った」で在庫から引いた材料と、引けなかった材料（在庫のページで直す目安） */
function ConsumedSection({ meal }: { meal: Meal }) {
  const all = meal.consumed ?? [];
  if (!meal.done || all.length === 0) return null;
  const used = all.filter((e) => e.inventoryId);
  const left = all.filter((e) => !e.inventoryId);
  return (
    <section>
      <h3 className="mb-2 flex items-center gap-1.5 text-[13px] font-bold text-ink-2">
        <Refrigerator className="size-4" />
        在庫から引いた材料
      </h3>
      {used.length > 0 ? (
        <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line">
          {used.map((e) => (
            <li key={e.inventoryId} className="flex items-center gap-3 px-3.5 py-2.5 text-[14px]">
              <span className="min-w-0 flex-1 truncate">{e.name}</span>
              <span className="num shrink-0 text-[13px] text-ink-2">
                {e.before} から {e.qty}
                {e.unit}
              </span>
              {e.prevStatus && <Pill tone="warn">切れた</Pill>}
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded-xl bg-surface-2 px-3 py-2.5 text-[13px] text-ink-2">引ける材料がありませんでした</p>
      )}
      {left.length > 0 && (
        <div className="mt-2 rounded-xl bg-surface-2 px-3 py-2.5 text-[13px] text-ink-2">
          <p className="font-bold">引けなかった材料（在庫のページで確認してください）</p>
          <ul className="mt-1 space-y-0.5">
            {left.map((e, i) => (
              <li key={i}>
                {e.name}
                <span className="ml-1.5 text-[12px] text-ink-3">{e.reason}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      <p className="mt-2 text-[12px] text-ink-3">「作った」を取り消すと、引いた分は在庫に戻ります</p>
    </section>
  );
}

const MEMO_STYLE = {
  result: { icon: Sparkles, box: "bg-accent-soft text-ink", label: "実績", iconClass: "text-accent-text" },
  change: { icon: Pencil, box: "bg-surface-2 text-ink-2", label: "変更", iconClass: "text-ink-3" },
  prep: { icon: Lightbulb, box: "bg-warn-soft text-ink", label: "段取り", iconClass: "text-warn" },
  plain: { icon: null, box: "", label: "", iconClass: "" },
} as const;

export function MealSheet({ meal: opened, onClose }: { meal: Meal | null; onClose: () => void }) {
  const { ingredientById, mealById, setMealDone, meals, ingredients: allIngredients } = useData();
  // 開いている間に「作った」やほかの端末・Claude の更新が入っても、最新の内容を出す
  const meal = opened ? (mealById.get(opened.id) ?? opened) : null;
  if (!meal) return null;
  const { head, extras } = splitTitle(meal.title);
  const tag = titleTag(meal.title);
  const ingredients = meal.ingredientIds.map((id) => ingredientById.get(id)).filter((x) => x != null);
  const sentences = memoSentences(meal.memo);
  const carriedIds = new Set(carriedOver(meal, meals, allIngredients).map((i) => i.id));

  return (
    <Sheet
      open
      onClose={onClose}
      title={
        <div>
          <div className="flex flex-wrap items-center gap-1.5 text-[13px] text-ink-3">
            {meal.date && <span className="num">{mdw(meal.date)}</span>}
            {meal.slot && <SlotLabel slot={meal.slot} meal={meal} />}
            {tag && <Pill>{tag}</Pill>}
            {meal.genre && <Pill>{meal.genre}</Pill>}
          </div>
          <h2 className="mt-1.5 font-display text-[22px] leading-snug font-bold">{head}</h2>
        </div>
      }
      footer={
        <button
          type="button"
          aria-pressed={meal.done}
          onClick={() => setMealDone(meal.id, !meal.done)}
          className={clsx(
            "tap flex w-full items-center justify-center gap-2 rounded-2xl py-3.5 font-bold",
            meal.done ? "bg-ok-soft text-ok" : "bg-accent text-accent-ink shadow-card",
          )}
        >
          <Check className="size-5" strokeWidth={2.5} />
          {meal.done ? "作った（もう一度押すと取り消し）" : "作った"}
        </button>
      }
    >
      <div className="space-y-5">
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 rounded-2xl bg-surface-2 p-4 text-[14px]">
          {meal.main && (
            <>
              <dt className="text-ink-3">主菜</dt>
              <dd>{meal.main}</dd>
            </>
          )}
          {(meal.sides || extras.length > 0) && (
            <>
              <dt className="text-ink-3">副菜</dt>
              <dd>{meal.sides || extras.join("、")}</dd>
            </>
          )}
          {meal.minutes != null && (
            <>
              <dt className="text-ink-3">時間</dt>
              <dd className="num">約{meal.minutes}分</dd>
            </>
          )}
        </dl>

        {sentences.length > 0 && (
          <section>
            <h3 className="mb-2 text-[13px] font-bold text-ink-2">メモ</h3>
            <ul className="space-y-2">
              {sentences.map((s, i) => {
                const st = MEMO_STYLE[s.kind];
                const Icon = st.icon;
                return (
                  <li key={i} className={clsx("flex gap-2.5 text-[14px] leading-relaxed", st.box && `rounded-xl px-3 py-2.5 ${st.box}`)}>
                    {Icon && <Icon className={clsx("mt-0.5 size-4 shrink-0", st.iconClass)} aria-label={st.label} />}
                    <span>{s.text}</span>
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        <PlanSection meal={meal} />

        {ingredients.length > 0 && (
          <section>
            <h3 className="mb-2 flex items-center gap-1.5 text-[13px] font-bold text-ink-2">
              <ShoppingBasket className="size-4" />
              使う食材
            </h3>
            <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line">
              {ingredients.map((i) => (
                <li key={i.id} className="flex items-center gap-3 px-3.5 py-2.5 text-[14px]">
                  <span className="min-w-0 flex-1 truncate">
                    {i.name}
                    {i.amount && <span className="ml-1.5 text-[12px] text-ink-3">{i.amount}</span>}
                  </span>
                  {carriedIds.has(i.id) && (
                    <Pill tone="warn">
                      <Repeat className="size-3" />
                      明日も使う
                    </Pill>
                  )}
                  {i.tripDate && <span className="num shrink-0 text-[12px] text-ink-3">{wd(i.tripDate)}曜に買う</span>}
                  {i.bought ? <Pill tone="ok">購入済み</Pill> : i.estimate != null && <span className="num text-[12px] text-ink-3">{yen(i.estimate)}</span>}
                </li>
              ))}
            </ul>
          </section>
        )}

        <ConsumedSection meal={meal} />

        {meal.recipe?.trim() && <Recipe key={meal.id} recipe={meal.recipe} />}

        <FeedbackSection key={meal.id} meal={meal} />
      </div>
    </Sheet>
  );
}

/** 急に外食・不在になったとき（または予定がなくなったとき）の入口 */
function PlanSection({ meal }: { meal: Meal }) {
  const { planAt } = useData();
  const { today } = useNow();
  const plan = planAt(meal.date, meal.slot);
  const [open, setOpen] = useState<{ plan: Plan | null; preset: PlanPreset | null } | null>(null);
  // 済んだ日の食事には新しく予定を付けない
  if (!meal.date || !meal.slot || (!plan && meal.date < today)) return null;
  return (
    <section>
      {plan ? (
        <button type="button" onClick={() => setOpen({ plan, preset: null })} className="tap flex w-full items-center gap-3 rounded-2xl bg-night-soft p-4 text-left">
          <CalendarEdit className="size-5 shrink-0 text-night" />
          <span className="min-w-0 flex-1 text-[14px]">
            <span className="block font-bold">{plan.kind}の予定があります</span>
            <span className="block text-[12px] text-ink-2">
              {plan.memo ? `${plan.memo}・` : ""}
              {planState(plan)}
              {!plan.handledAt && (
                <>
                  ・次の確認 <NextCheck />
                </>
              )}
            </span>
          </span>
          <span className="shrink-0 rounded-full bg-surface px-3 py-1 text-[12px] text-ink-2">変更・取り消し</span>
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setOpen({ plan: null, preset: { date: meal.date!, slots: [meal.slot!] } })}
          className="tap flex w-full min-h-11 items-center justify-center gap-2 rounded-2xl border border-line text-[14px] text-ink-2"
        >
          <CalendarEdit className="size-[18px]" />
          この食事は外食・家にいないことになった
        </button>
      )}
      <PlanSheet plan={open?.plan ?? null} preset={open?.preset ?? null} onClose={() => setOpen(null)} />
    </section>
  );
}

/**
 * 献立の感想。好みに合ったかを選び、必要ならタグとテキストを足して送る。
 * Firestore の feedback に1献立1件で残り、Claude が「好みの記録」にまとめて次の献立づくりで読む。
 */
function FeedbackSection({ meal }: { meal: Meal }) {
  const { feedbackByMeal, sendFeedback } = useData();
  const saved = feedbackByMeal.get(meal.id);
  const [editing, setEditing] = useState(!saved);
  const [verdict, setVerdict] = useState<Verdict | null>(saved?.verdict ?? null);
  const [tags, setTags] = useState<FeedbackTag[]>(saved?.tags ?? []);
  const [text, setText] = useState(saved?.text ?? "");

  const toggleTag = (t: FeedbackTag) => setTags((cur) => (cur.includes(t) ? cur.filter((x) => x !== t) : [...cur, t]));
  const submit = () => {
    if (!verdict) return;
    // 選んだ順ではなく決まった順で残す（読み返しやすいように）
    sendFeedback(meal, { verdict, tags: FEEDBACK_TAGS.filter((t) => tags.includes(t)), text });
    setEditing(false);
  };

  return (
    <section>
      <h3 className="mb-2 flex items-center gap-1.5 text-[13px] font-bold text-ink-2">
        <MessageCircleHeart className="size-4" />
        感想
      </h3>
      {saved && !editing ? (
        <SavedFeedback feedback={saved} onEdit={() => setEditing(true)} />
      ) : (
        <div className="space-y-3 rounded-2xl bg-surface-2 p-4">
          <p className="text-[13px] text-ink-2">好みに合いましたか？ 次の献立づくりの参考にします。</p>
          <div role="radiogroup" aria-label="好みに合ったか" className="grid grid-cols-3 gap-2">
            {VERDICTS.map((v) => (
              <button
                key={v}
                type="button"
                role="radio"
                aria-checked={verdict === v}
                onClick={() => setVerdict(v)}
                className={clsx(
                  "tap flex items-center justify-center gap-1.5 rounded-xl border py-2.5 text-[14px] font-medium",
                  verdict === v ? "border-accent bg-accent text-accent-ink" : "border-line bg-surface text-ink-2",
                )}
              >
                <VerdictIcon verdict={v} className="size-4" />
                {v}
              </button>
            ))}
          </div>
          {verdict && (
            <>
              <div className="flex flex-wrap gap-1.5" aria-label="当てはまるもの">
                {FEEDBACK_TAGS.map((t) => (
                  <button
                    key={t}
                    type="button"
                    aria-pressed={tags.includes(t)}
                    onClick={() => toggleTag(t)}
                    className={clsx(
                      "tap rounded-full border px-3 py-1 text-[13px]",
                      tags.includes(t) ? "border-accent bg-accent-soft text-ink" : "border-line bg-surface text-ink-2",
                    )}
                  >
                    {t}
                  </button>
                ))}
              </div>
              <label className="block">
                <span className="sr-only">感想（任意）</span>
                <textarea
                  value={text}
                  onChange={(e) => setText(e.target.value.slice(0, FEEDBACK_TEXT_MAX))}
                  rows={3}
                  placeholder="味の好み・風味・苦手な食材・調味料など（任意）"
                  className="block w-full resize-none rounded-xl border border-line bg-surface px-3 py-2 text-[16px] leading-relaxed outline-none placeholder:text-ink-3 focus:border-accent"
                />
                <span className="num mt-1 block text-right text-[12px] text-ink-3">
                  {text.length}/{FEEDBACK_TEXT_MAX}
                </span>
              </label>
              <div className="flex gap-2">
                {saved && (
                  <button type="button" onClick={() => setEditing(false)} className="tap rounded-xl bg-surface-3 px-4 py-2.5 text-[14px] text-ink-2">
                    やめる
                  </button>
                )}
                <button type="button" onClick={submit} className="tap flex-1 rounded-xl bg-ink py-2.5 text-[14px] font-bold text-surface">
                  {saved ? "送り直す" : "感想を送る"}
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </section>
  );
}

function SavedFeedback({ feedback, onEdit }: { feedback: Feedback; onEdit: () => void }) {
  return (
    <div className="rounded-2xl bg-surface-2 p-4 text-[14px]">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="mr-1 flex items-center gap-1.5 font-bold">
          <VerdictIcon verdict={feedback.verdict} className={clsx("size-4", VERDICT_COLOR[feedback.verdict])} />
          {feedback.verdict}
        </span>
        {feedback.tags.map((t) => (
          <Pill key={t}>{t}</Pill>
        ))}
      </div>
      {feedback.text && <p className="mt-2 leading-relaxed whitespace-pre-wrap">{feedback.text}</p>}
      <div className="mt-3 flex items-center justify-between gap-3 text-[12px] text-ink-3">
        <span>{feedback.reflectedAt ? "好みの記録に反映済み" : "次の献立づくりで読みます"}</span>
        <button type="button" onClick={onEdit} className="tap rounded-full bg-surface-3 px-3 py-1 text-ink-2">
          書き直す
        </button>
      </div>
    </div>
  );
}
