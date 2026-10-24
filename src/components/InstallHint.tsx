"use client";

import { useEffect, useState } from "react";
import { Share, SquarePlus, X } from "@/components/icons";

const KEY = "kondate:install-hint-dismissed";

/** iPhone の Safari で開いている（まだホーム画面に追加していない）か */
function shouldShow() {
  const nav = window.navigator as Navigator & { standalone?: boolean };
  const ios = /iPhone|iPad|iPod/.test(nav.userAgent) || (nav.platform === "MacIntel" && nav.maxTouchPoints > 1);
  const standalone = nav.standalone === true || window.matchMedia("(display-mode: standalone)").matches;
  if (!ios || standalone) return false;
  try {
    return localStorage.getItem(KEY) !== "1";
  } catch {
    return true;
  }
}

/** ホーム画面への追加のしかた。Safari で開いたときだけ出す */
export function InstallHint({ dismissible = true }: { dismissible?: boolean }) {
  const [show, setShow] = useState(false);
  useEffect(() => setShow(shouldShow()), []);
  if (!show) return null;

  const dismiss = () => {
    setShow(false);
    try {
      localStorage.setItem(KEY, "1");
    } catch {
      /* 保存できなくても閉じるだけ */
    }
  };

  return (
    <aside className="rise relative mt-3 rounded-[20px] bg-surface p-4 shadow-card" aria-label="ホーム画面に追加">
      {dismissible && (
        <button type="button" onClick={dismiss} aria-label="閉じる" className="tap absolute top-3 right-3 grid size-8 place-items-center rounded-full text-ink-3">
          <X className="size-4" />
        </button>
      )}
      <p className="pr-8 font-display font-bold">ホーム画面に追加すると、アプリのように使えます</p>
      <ol className="mt-2.5 space-y-2 text-[14px] text-ink-2">
        <li className="flex items-center gap-2">
          <span className="grid size-6 shrink-0 place-items-center rounded-full bg-accent-soft text-[12px] font-bold text-accent-text">1</span>
          画面下の
          <Share className="size-[18px] text-night" aria-label="共有" />
          共有ボタンを押す
        </li>
        <li className="flex items-center gap-2">
          <span className="grid size-6 shrink-0 place-items-center rounded-full bg-accent-soft text-[12px] font-bold text-accent-text">2</span>
          <SquarePlus className="size-[18px]" aria-hidden />
          「ホーム画面に追加」を選ぶ
        </li>
      </ol>
      <p className="mt-2.5 text-[12px] text-ink-3">追加したアイコンから開くと全画面で表示され、ログインもその中で一度するだけで続きます。</p>
    </aside>
  );
}
