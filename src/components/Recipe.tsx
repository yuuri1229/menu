"use client";

import clsx from "clsx";
import { useEffect, useMemo, useState } from "react";
import { Check, ChefHat, ChevronLeft, ChevronRight } from "@/components/icons";
import { parseMarkdown } from "@/lib/markdown";
import { parseRecipe, splitKeyPhrases } from "@/lib/recipe";
import type { RichText } from "@/lib/types";
import { Blocks, Rich } from "./NoteBlocks";

/** 手順の文。火加減・時間・レンジのW数は下地色で目立たせる */
function StepText({ rich }: { rich: RichText[] }) {
  return (
    <>
      {rich.map((r, i) =>
        r.href || r.c || r.s ? (
          <Rich key={i} rich={[r]} />
        ) : (
          splitKeyPhrases(r.t).map((p, j) =>
            p.key ? (
              <mark key={`${i}-${j}`} className="rounded-md bg-warn-soft px-1 font-bold text-warn">
                {p.text}
              </mark>
            ) : (
              <Rich key={`${i}-${j}`} rich={[{ ...r, t: p.text }]} />
            ),
          )
        ),
      )}
    </>
  );
}

/** 調理中は画面が暗くならないようにする（対応していない端末では何もしない） */
function useKeepAwake() {
  useEffect(() => {
    let lock: { release: () => Promise<void> } | null = null;
    let gone = false;
    const nav = navigator as Navigator & { wakeLock?: { request: (t: "screen") => Promise<{ release: () => Promise<void> }> } };
    nav.wakeLock
      ?.request("screen")
      .then((l) => {
        if (gone) void l.release();
        else lock = l;
      })
      .catch(() => {});
    return () => {
      gone = true;
      lock?.release().catch(() => {});
    };
  }, []);
}

/**
 * 作り方。上に手順の全体（丸い番号）と材料、下に「いまの手順」を大きく、続きを小さく出す。
 * 作り方の手順が読み取れない書き方のときは、いつもの表示に戻す。
 */
export function Recipe({ recipe }: { recipe: string }) {
  const parsed = useMemo(() => parseRecipe(parseMarkdown(recipe)), [recipe]);
  const [cur, setCur] = useState(0);
  const [have, setHave] = useState<Set<number>>(new Set());
  useKeepAwake();

  const { ingredients, steps, extras } = parsed;
  if (steps.length === 0) {
    return (
      <section>
        <h3 className="mb-1 flex items-center gap-1.5 text-[13px] font-bold text-ink-2">
          <ChefHat className="size-4" />
          作り方
        </h3>
        <div className="text-[14px] leading-relaxed [&_h2]:mt-4 [&_h2]:text-[15px] [&_h3]:mt-3 [&_h3]:text-[14px] [&_h4]:mt-3 [&_h4]:text-[14px]">
          <Blocks blocks={parseMarkdown(recipe)} />
        </div>
      </section>
    );
  }

  const step = steps[Math.min(cur, steps.length - 1)];
  const toggle = (i: number) =>
    setHave((s) => {
      const n = new Set(s);
      if (!n.delete(i)) n.add(i);
      return n;
    });

  return (
    <section className="space-y-4">
      <h3 className="flex items-center gap-1.5 text-[13px] font-bold text-ink-2">
        <ChefHat className="size-4" />
        作り方
        <span className="num ml-auto font-normal text-ink-3">
          {cur + 1} / {steps.length}
        </span>
      </h3>

      <ol className="flex items-center" aria-label="手順の全体">
        {steps.map((_, i) => (
          <li key={i} className={clsx("flex items-center", i < steps.length - 1 && "flex-1")}>
            <button
              type="button"
              onClick={() => setCur(i)}
              aria-label={`手順${i + 1}${i < cur ? "（済み）" : i === cur ? "（いま）" : ""}`}
              aria-current={i === cur ? "step" : undefined}
              className={clsx(
                "tap num grid size-8 shrink-0 place-items-center rounded-full text-[14px] font-bold",
                i === cur ? "bg-accent text-accent-ink" : i < cur ? "bg-ok-soft text-ok" : "bg-surface-3 text-ink-2",
              )}
            >
              {i < cur ? <Check className="size-4" /> : i + 1}
            </button>
            {i < steps.length - 1 && <span className="mx-1 h-0.5 flex-1 rounded bg-line" />}
          </li>
        ))}
      </ol>

      {ingredients.length > 0 && (
        <div>
          <p className="mb-1.5 text-[12px] text-ink-3">材料（タップで「そろった」）</p>
          <ul className="flex flex-wrap gap-1.5">
            {ingredients.map((g, i) => (
              <li key={i}>
                <button
                  type="button"
                  aria-pressed={have.has(i)}
                  onClick={() => toggle(i)}
                  className={clsx(
                    "tap rounded-full px-3 py-1 text-[13px]",
                    have.has(i) ? "bg-surface-3 text-ink-3 line-through" : "bg-surface-2 text-ink border border-line",
                  )}
                >
                  {g.name}
                  {g.amount && <span className="num ml-1 font-bold">{g.amount}</span>}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="rounded-2xl border-2 border-accent bg-surface p-4">
        <div className="flex gap-3">
          <span className="num grid size-9 shrink-0 place-items-center rounded-full bg-accent text-[16px] font-bold text-accent-ink">{cur + 1}</span>
          <div className="min-w-0 text-[18px] leading-[1.75]">
            <StepText rich={step.rich} />
            {step.children.length > 0 && (
              <div className="mt-2 text-[14px] text-ink-2">
                <Blocks blocks={step.children} />
              </div>
            )}
          </div>
        </div>
        <div className="mt-4 flex gap-2">
          <button
            type="button"
            disabled={cur === 0}
            onClick={() => setCur(cur - 1)}
            className="tap flex min-h-12 flex-1 items-center justify-center gap-1 rounded-xl border border-line text-[15px] font-bold text-ink-2 disabled:opacity-40"
          >
            <ChevronLeft className="size-5" />
            前へ
          </button>
          <button
            type="button"
            disabled={cur >= steps.length - 1}
            onClick={() => setCur(cur + 1)}
            className="tap flex min-h-12 flex-[2] items-center justify-center gap-1 rounded-xl bg-accent text-[15px] font-bold text-accent-ink disabled:opacity-40"
          >
            {cur >= steps.length - 1 ? "最後の手順です" : "次へ"}
            {cur < steps.length - 1 && <ChevronRight className="size-5" />}
          </button>
        </div>
      </div>

      {cur < steps.length - 1 && (
        <div>
          <p className="mb-1.5 text-[12px] font-bold text-ink-3">このあと</p>
          <ul className="divide-y divide-line overflow-hidden rounded-2xl bg-surface-2">
            {steps.slice(cur + 1).map((s, k) => (
              <li key={k}>
                <button type="button" onClick={() => setCur(cur + 1 + k)} className="tap flex w-full gap-3 px-3.5 py-2.5 text-left text-[14px] leading-relaxed text-ink-2">
                  <span className="num grid size-6 shrink-0 place-items-center rounded-full bg-surface-3 text-[12px] font-bold">{cur + 2 + k}</span>
                  <span className="min-w-0">
                    <StepText rich={s.rich} />
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {extras
        .filter((x) => x.blocks.length > 0)
        .map((x, i) => (
          <div key={i}>
            {x.title && <p className="mb-1 text-[13px] font-bold text-ink-2">{x.title}</p>}
            <div className="text-[14px] leading-relaxed">
              <Blocks blocks={x.blocks} />
            </div>
          </div>
        ))}
    </section>
  );
}
