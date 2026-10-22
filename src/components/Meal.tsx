"use client";

import clsx from "clsx";
import { useState } from "react";
import { Check, ChefHat, CircleCheck, Clock, Lightbulb, MessageCircleHeart, Pencil, ShoppingBasket, Sparkles } from "lucide-react";
import { useData } from "@/lib/data";
import { mdw, wd } from "@/lib/date";
import { yen } from "@/lib/format";
import { parseMarkdown } from "@/lib/markdown";
import { isBento, memoSentences, SLOT_META, splitTitle, titleTag } from "@/lib/meals";
import { FEEDBACK_TAGS, FEEDBACK_TEXT_MAX, VERDICTS } from "@/lib/types";
import type { Feedback, FeedbackTag, Meal, Slot, Verdict } from "@/lib/types";
import { Blocks } from "./NoteBlocks";
import { Pill, Sheet } from "./ui";

const TONE_TEXT = { morning: "text-morning", noon: "text-noon", night: "text-night" } as const;

export function SlotLabel({ slot, meal, className }: { slot: Slot; meal?: Meal; className?: string }) {
  const meta = SLOT_META[slot];
  const label = meal && isBento(meal) ? "お弁当" : meta.label;
  return <Pill tone={meta.tone} className={className}>{label}</Pill>;
}

const VERDICT_MARK: Record<Verdict, string> = { 好み: "😋", ふつう: "🙂", 合わない: "😣" };

/** 一覧で使う一行の献立 */
export function MealRow({ meal, slot, onOpen, compact }: { meal?: Meal; slot: Slot; onOpen?: (m: Meal) => void; compact?: boolean }) {
  const meta = SLOT_META[slot];
  const { feedbackByMeal } = useData();
  const feedback = meal ? feedbackByMeal.get(meal.id) : undefined;
  if (!meal) {
    return (
      <div className={clsx("flex items-center gap-3 px-4", compact ? "py-2.5" : "py-3")}>
        <span className={clsx("w-5 text-center text-[13px] font-bold", TONE_TEXT[meta.tone])}>{meta.short}</span>
        <span className="text-sm text-ink-3">未定</span>
      </div>
    );
  }
  const { head, extras } = splitTitle(meal.title);
  return (
    <button
      type="button"
      onClick={() => onOpen?.(meal)}
      className={clsx("tap flex w-full items-center gap-3 px-4 text-left hover:bg-surface-2", compact ? "py-2.5" : "py-3")}
    >
      <span className={clsx("w-5 shrink-0 text-center text-[13px] font-bold", TONE_TEXT[meta.tone])}>{meta.short}</span>
      <span className="min-w-0 flex-1">
        <span className={clsx("block truncate text-[15px] font-medium", meal.done && "text-ink-2")}>
          {isBento(meal) && <span aria-label="お弁当">🍱 </span>}
          {head}
        </span>
        {!compact && (extras.length > 0 || meal.sides) && (
          <span className="block truncate text-[12px] text-ink-3">{extras.length ? `＋${extras.join("・")}` : meal.sides}</span>
        )}
      </span>
      {feedback && (
        <span className="shrink-0 text-[15px]" aria-label={`感想：${feedback.verdict}`}>
          {VERDICT_MARK[feedback.verdict]}
        </span>
      )}
      {meal.done ? (
        <CircleCheck className="size-[18px] shrink-0 text-ok" aria-label="作った" />
      ) : (
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
export function MealHero({ meal, slot, onOpen, label }: { meal?: Meal; slot: Slot; onOpen: (m: Meal) => void; label: string }) {
  if (!meal) {
    return (
      <div className="card p-5">
        <p className="text-[13px] font-medium text-ink-3">{label}</p>
        <p className="mt-2 font-display text-xl font-bold text-ink-2">まだ献立がありません</p>
        <p className="mt-1 text-sm text-ink-3">土曜の夕方に翌週分が自動で作られます</p>
      </div>
    );
  }
  const { head, extras } = splitTitle(meal.title);
  return (
    <button type="button" onClick={() => onOpen(meal)} className="tap card block w-full p-5 text-left">
      <div className="flex items-center gap-2">
        <p className="text-[13px] font-medium text-ink-3">{label}</p>
        <SlotLabel slot={slot} meal={meal} />
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
    </button>
  );
}

const MEMO_STYLE = {
  result: { icon: Sparkles, box: "bg-accent-soft text-ink", label: "実績", iconClass: "text-accent" },
  change: { icon: Pencil, box: "bg-surface-2 text-ink-2", label: "変更", iconClass: "text-ink-3" },
  prep: { icon: Lightbulb, box: "bg-warn-soft text-ink", label: "段取り", iconClass: "text-warn" },
  plain: { icon: null, box: "", label: "", iconClass: "" },
} as const;

export function MealSheet({ meal: opened, onClose }: { meal: Meal | null; onClose: () => void }) {
  const { ingredientById, mealById, setMealDone } = useData();
  // 開いている間に「作った」やほかの端末・Claude の更新が入っても、最新の内容を出す
  const meal = opened ? (mealById.get(opened.id) ?? opened) : null;
  if (!meal) return null;
  const { head, extras } = splitTitle(meal.title);
  const tag = titleTag(meal.title);
  const ingredients = meal.ingredientIds.map((id) => ingredientById.get(id)).filter((x) => x != null);
  const sentences = memoSentences(meal.memo);

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
                  {i.tripDate && <span className="num shrink-0 text-[12px] text-ink-3">{wd(i.tripDate)}曜に買う</span>}
                  {i.bought ? <Pill tone="ok">購入済み</Pill> : i.estimate != null && <span className="num text-[12px] text-ink-3">{yen(i.estimate)}</span>}
                </li>
              ))}
            </ul>
          </section>
        )}

        {meal.recipe?.trim() && (
          <section>
            <h3 className="mb-1 flex items-center gap-1.5 text-[13px] font-bold text-ink-2">
              <ChefHat className="size-4" />
              作り方
            </h3>
            <div className="text-[14px] leading-relaxed [&_h2]:mt-4 [&_h2]:text-[15px] [&_h3]:mt-3 [&_h3]:text-[14px] [&_h4]:mt-3 [&_h4]:text-[14px]">
              <Blocks blocks={parseMarkdown(meal.recipe)} />
            </div>
          </section>
        )}

        <FeedbackSection key={meal.id} meal={meal} />
      </div>
    </Sheet>
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
                  "tap rounded-xl border py-2.5 text-[14px] font-medium",
                  verdict === v ? "border-accent bg-accent text-accent-ink" : "border-line bg-surface text-ink-2",
                )}
              >
                <span className="mr-1" aria-hidden>
                  {VERDICT_MARK[v]}
                </span>
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
                <span className="num mt-1 block text-right text-[11px] text-ink-3">
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
        <span className="font-bold">
          <span className="mr-1" aria-hidden>
            {VERDICT_MARK[feedback.verdict]}
          </span>
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
