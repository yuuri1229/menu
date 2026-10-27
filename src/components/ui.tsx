"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import clsx from "clsx";
import { X } from "@/components/icons";

export function BrandMark({ className }: { className?: string }) {
  // 上から見た朱の器と墨の箸。色は配色トークンに追従してライト/ダークで切り替わる
  return (
    <svg viewBox="0 0 512 512" className={className} aria-hidden>
      <rect width="512" height="512" rx="128" fill="var(--surface)" />
      <circle cx="236" cy="290" r="120" fill="var(--accent)" />
      <path
        d="M276 120L404 248M316 92L436 212"
        fill="none"
        stroke="var(--leaf)"
        strokeWidth="26"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** スマホでは下から出るシート、広い画面では中央のダイアログ */
export function Sheet({
  open,
  onClose,
  title,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const startY = useRef<number | null>(null);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    const lastFocus = document.activeElement as HTMLElement | null;
    panelRef.current?.focus();
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
      lastFocus?.focus?.();
    };
  }, [open, onClose]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center md:items-center md:p-6">
      <div className="fade-in absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={onClose} aria-hidden />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        tabIndex={-1}
        className="sheet-in relative flex max-h-[92dvh] w-full flex-col rounded-t-[28px] bg-surface shadow-float outline-none md:max-w-lg md:rounded-[28px]"
        onTouchStart={(e) => (startY.current = e.touches[0].clientY)}
        onTouchEnd={(e) => {
          // 上部をつかんで下に払うと閉じる
          if (startY.current != null && e.changedTouches[0].clientY - startY.current > 90 && (panelRef.current?.querySelector("[data-scroll]")?.scrollTop ?? 0) <= 0) onClose();
          startY.current = null;
        }}
      >
        <div className="flex justify-center pt-2.5 pb-1 md:hidden" aria-hidden>
          <span className="h-1.5 w-10 rounded-full bg-line" />
        </div>
        <div className="flex items-start gap-3 px-5 pt-2 pb-3 md:pt-5">
          <div id={titleId} className="min-w-0 flex-1">
            {title}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="閉じる"
            className="tap -mr-1 grid size-11 shrink-0 place-items-center rounded-full bg-surface-3 text-ink-2"
          >
            <X className="size-[18px]" />
          </button>
        </div>
        <div data-scroll className="overflow-y-auto overscroll-contain px-5 pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
          {children}
        </div>
        {footer && <div className="border-t border-line px-5 py-3 pb-safe">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mt-8 mb-3 flex items-baseline justify-between gap-3">
      <h2 className="font-display text-[18px] font-bold">{children}</h2>
      {action}
    </div>
  );
}

export function Segmented<T extends string>({
  value,
  onChange,
  options,
  label,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: ReactNode; sub?: ReactNode }[];
  label: string;
}) {
  return (
    <div role="tablist" aria-label={label} className="flex gap-1 rounded-2xl bg-surface-3 p-1">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            role="tab"
            type="button"
            aria-selected={active}
            onClick={() => onChange(o.value)}
            className={clsx(
              "tap min-w-0 flex-1 min-h-11 rounded-xl px-2 py-2 text-center text-[14px] font-medium transition-all",
              active ? "bg-surface text-ink shadow-card" : "text-ink-2",
            )}
          >
            <span className="block truncate">{o.label}</span>
            {o.sub && <span className="block truncate text-[12px] font-normal text-ink-3">{o.sub}</span>}
          </button>
        );
      })}
    </div>
  );
}

export function Progress({ value, max, tone = "accent", className }: { value: number; max: number; tone?: "accent" | "ok" | "danger" | "warn"; className?: string }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  const color = { accent: "bg-accent", ok: "bg-ok", danger: "bg-danger", warn: "bg-warn" }[tone];
  return (
    <div className={clsx("h-2 overflow-hidden rounded-full bg-surface-3", className)} role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={max}>
      <div className={clsx("h-full rounded-full transition-[width] duration-500 ease-out", color)} style={{ width: `${pct}%` }} />
    </div>
  );
}

export function Empty({ icon, title, children }: { icon: ReactNode; title: string; children?: ReactNode }) {
  return (
    <div className="card flex flex-col items-center px-6 py-10 text-center">
      <div className="mb-3 grid size-14 place-items-center rounded-full bg-surface-3 text-ink-3">{icon}</div>
      <p className="font-display font-bold">{title}</p>
      {children && <div className="mt-1 text-sm text-ink-2">{children}</div>}
    </div>
  );
}

const TONES = {
  neutral: "bg-surface-3 text-ink-2",
  accent: "bg-accent-soft text-accent-text",
  ok: "bg-ok-soft text-ok",
  warn: "bg-warn-soft text-warn",
  danger: "bg-danger-soft text-danger",
  morning: "bg-morning-soft text-morning",
  noon: "bg-noon-soft text-noon",
  night: "bg-night-soft text-night",
} as const;
export type Tone = keyof typeof TONES;

export function Pill({ tone = "neutral", children, className, ...rest }: { tone?: Tone; children: ReactNode; className?: string; "aria-label"?: string }) {
  return (
    <span {...rest} className={clsx("inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[12px] font-medium whitespace-nowrap", TONES[tone], className)}>
      {children}
    </span>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={clsx("skeleton", className)} aria-hidden />;
}

export function LoadingCards({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-3" aria-busy="true" aria-label="読み込み中">
      {Array.from({ length: count }, (_, i) => (
        <Skeleton key={i} className="h-20" />
      ))}
    </div>
  );
}
