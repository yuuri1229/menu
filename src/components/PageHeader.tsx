"use client";

import { createContext, useContext, type ReactNode } from "react";
import { CircleUserRound } from "@/components/icons";

export const SettingsContext = createContext<() => void>(() => {});

/** 各ページの大きな見出し。右上にアカウント（設定）ボタン。 */
export function PageHeader({ eyebrow, title, children }: { eyebrow?: ReactNode; title: ReactNode; children?: ReactNode }) {
  const openSettings = useContext(SettingsContext);
  return (
    <header className="pt-6 pb-4 md:pt-10">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          {eyebrow && <p className="text-[13px] text-ink-2">{eyebrow}</p>}
          <h1 className="font-display text-[28px] leading-tight font-black tracking-tight md:text-[32px]">{title}</h1>
        </div>
        <button
          type="button"
          onClick={openSettings}
          aria-label="アカウントと同期の状態"
          className="tap -mr-1 grid size-11 shrink-0 place-items-center rounded-full text-ink-2 hover:bg-surface-3 md:hidden"
        >
          <CircleUserRound className="size-6" strokeWidth={1.75} />
        </button>
      </div>
      {children}
    </header>
  );
}
