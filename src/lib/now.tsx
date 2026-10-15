"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { hourJST, todayJST } from "./date";

interface Now {
  today: string;
  hour: number;
}

const read = (): Now => ({ today: todayJST(), hour: hourJST() });
const NowContext = createContext<Now | null>(null);

/**
 * ホーム画面のアプリは閉じずに裏で残るので、開き直したときに「今日」を更新する。
 * 前面に戻ったとき（visibilitychange）と、開いている間は1分ごとに見直す。
 */
export function NowProvider({ children }: { children: ReactNode }) {
  const [now, setNow] = useState<Now>(read);
  useEffect(() => {
    const refresh = () => {
      const next = read();
      setNow((prev) => (prev.today === next.today && prev.hour === next.hour ? prev : next));
    };
    const onVisible = () => document.visibilityState === "visible" && refresh();
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("pageshow", refresh);
    const timer = window.setInterval(refresh, 60_000);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("pageshow", refresh);
      window.clearInterval(timer);
    };
  }, []);
  return <NowContext.Provider value={now}>{children}</NowContext.Provider>;
}

export function useNow(): Now {
  return useContext(NowContext) ?? read();
}
