"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useContext } from "react";
import clsx from "clsx";
import { BookOpen, CalendarDays, CircleUserRound, House, Refrigerator, ShoppingBasket, Wallet, type LucideIcon } from "lucide-react";
import { useData } from "@/lib/data";
import { timeAgo } from "@/lib/date";
import { SettingsContext } from "./PageHeader";
import { BrandMark } from "./ui";

const TABS: { href: string; label: string; icon: LucideIcon }[] = [
  { href: "/", label: "今日", icon: House },
  { href: "/week", label: "献立", icon: CalendarDays },
  { href: "/shopping", label: "買い物", icon: ShoppingBasket },
  { href: "/pantry", label: "在庫", icon: Refrigerator },
  { href: "/spending", label: "家計", icon: Wallet },
];

/** iPhone のアプリと同じく、いま開いているタブをもう一度押すと先頭へ戻る */
function scrollTopIfActive(e: React.MouseEvent, active: boolean) {
  if (!active) return;
  e.preventDefault();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function useActive() {
  const path = (usePathname() ?? "/").replace(/\/+$/, "") || "/";
  return (href: string) => (href === "/" ? path === "/" : path === href || path.startsWith(`${href}/`));
}

export function NavBar() {
  const isActive = useActive();
  const openSettings = useContext(SettingsContext);
  const { syncedAt } = useData();

  return (
    <>
      {/* スマホ：画面下のタブ。親指で届く位置に置く */}
      <nav
        aria-label="メイン"
        className="fixed inset-x-0 bottom-0 z-30 border-t border-line/70 bg-surface/85 backdrop-blur-xl pb-safe md:hidden"
      >
        <ul className="mx-auto grid max-w-md grid-cols-5">
          {TABS.map(({ href, label, icon: Icon }) => {
            const active = isActive(href);
            return (
              <li key={href}>
                <Link
                  href={href}
                  aria-current={active ? "page" : undefined}
                  onClick={(e) => scrollTopIfActive(e, active)}
                  className={clsx(
                    "tap flex flex-col items-center gap-0.5 pt-2 pb-1.5 text-[11px] font-medium",
                    active ? "text-accent-text" : "text-ink-3",
                  )}
                >
                  <span
                    className={clsx(
                      "grid h-8 w-14 place-items-center rounded-full transition-colors",
                      active && "bg-accent-soft",
                    )}
                  >
                    <Icon className="size-[22px]" strokeWidth={active ? 2.25 : 1.75} />
                  </span>
                  {label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* タブレット・PC：左のレール */}
      <nav
        aria-label="メイン"
        className="fixed inset-y-0 left-0 z-30 hidden w-24 flex-col border-r border-line bg-surface-2 py-6 md:flex lg:w-60 lg:px-4"
      >
        <Link href="/" className="mb-8 flex items-center justify-center gap-2.5 lg:justify-start lg:px-3">
          <BrandMark className="size-9" />
          <span className="hidden font-display text-lg font-bold tracking-[0.12em] lg:inline">MEGURU</span>
        </Link>
        <ul className="flex flex-col gap-1 px-3 lg:px-0">
          {[...TABS, { href: "/notes", label: "ノート", icon: BookOpen }].map(({ href, label, icon: Icon }) => {
            const active = isActive(href);
            return (
              <li key={href}>
                <Link
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={clsx(
                    "tap flex flex-col items-center gap-1 rounded-2xl py-2.5 text-[11px] font-medium lg:flex-row lg:gap-3 lg:px-3 lg:text-[15px]",
                    active ? "bg-accent-soft text-accent-text" : "text-ink-2 hover:bg-surface-3",
                  )}
                >
                  <Icon className="size-[22px]" strokeWidth={active ? 2.25 : 1.75} />
                  {label}
                </Link>
              </li>
            );
          })}
        </ul>
        <button
          type="button"
          onClick={openSettings}
          className="tap mt-auto flex flex-col items-center gap-1 rounded-2xl px-3 py-2.5 text-[11px] text-ink-3 hover:bg-surface-3 lg:flex-row lg:gap-3 lg:text-left lg:text-[13px]"
        >
          <CircleUserRound className="size-[22px] shrink-0" strokeWidth={1.75} />
          <span className="lg:hidden">設定</span>
          <span className="hidden lg:block">
            アカウント
            <span className="block text-[11px] text-ink-3">更新：{timeAgo(syncedAt)}</span>
          </span>
        </button>
      </nav>
    </>
  );
}
