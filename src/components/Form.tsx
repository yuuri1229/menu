"use client";

import type { ReactNode } from "react";
import clsx from "clsx";

/** シートの入力欄。ラベル・入力・補足を縦に並べる */
export function Field({ label, hint, children, className }: { label: string; hint?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <label className={clsx("block", className)}>
      <span className="mb-1.5 block text-[13px] font-bold text-ink-2">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[12px] leading-snug text-ink-3">{hint}</span>}
    </label>
  );
}

export const inputClass =
  "w-full min-h-11 rounded-xl border border-line bg-surface px-3.5 py-2.5 text-[16px] text-ink outline-none placeholder:text-ink-3 focus:border-accent focus:ring-2 focus:ring-accent/30";

/** 選択肢を丸いボタンで並べる（もう一度押すと外れる） */
export function Chips<T extends string>({
  value,
  options,
  onChange,
  label,
  allowEmpty = true,
}: {
  value: T | null;
  options: readonly T[];
  onChange: (v: T | null) => void;
  label: string;
  allowEmpty?: boolean;
}) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-2">
      {options.map((o) => (
        <button
          key={o}
          type="button"
          aria-pressed={value === o}
          onClick={() => onChange(value === o && allowEmpty ? null : o)}
          className={clsx(
            "tap min-h-9 rounded-full px-3.5 py-1.5 text-[13px] font-medium",
            value === o ? "bg-ink text-bg" : "bg-surface-3 text-ink-2",
          )}
        >
          {o}
        </button>
      ))}
    </div>
  );
}

export function PrimaryButton({ children, disabled, onClick }: { children: ReactNode; disabled?: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="tap flex w-full min-h-12 items-center justify-center gap-2 rounded-2xl bg-accent py-3 font-bold text-accent-ink shadow-card disabled:opacity-40"
    >
      {children}
    </button>
  );
}
