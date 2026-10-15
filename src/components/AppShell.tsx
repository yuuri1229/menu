"use client";

import { useState, type ReactNode } from "react";
import { AuthProvider, useAuth } from "@/lib/auth";
import { DataProvider, useData } from "@/lib/data";
import { NowProvider } from "@/lib/now";
import { LoginScreen } from "./LoginScreen";
import { NavBar } from "./NavBar";
import { SettingsSheet } from "./SettingsSheet";
import { BrandMark } from "./ui";
import { SettingsContext } from "./PageHeader";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <Gate>{children}</Gate>
    </AuthProvider>
  );
}

function Gate({ children }: { children: ReactNode }) {
  const { state } = useAuth();
  if (state.status === "loading") return <Splash />;
  if (state.status === "signedOut") return <LoginScreen />;
  return (
    <DataProvider>
      <NowProvider>
        <Frame>{children}</Frame>
      </NowProvider>
    </DataProvider>
  );
}

function Frame({ children }: { children: ReactNode }) {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const { demo, error } = useData();
  return (
    <SettingsContext.Provider value={() => setSettingsOpen(true)}>
      <div className="min-h-dvh md:pl-24 lg:pl-60">
        <NavBar />
        <main className="mx-auto w-full max-w-3xl px-4 pb-32 md:px-8 md:pb-16 pt-safe">
          {demo && (
            <div className="mt-3 rounded-2xl bg-warn-soft px-4 py-2.5 text-[13px] text-warn">
              デモデータを表示しています（Firebase が未設定のビルド）
            </div>
          )}
          {error && (
            <div role="alert" className="mt-3 rounded-2xl bg-danger-soft px-4 py-3 text-sm text-danger">
              {error}
            </div>
          )}
          {children}
        </main>
      </div>
      <SettingsSheet open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </SettingsContext.Provider>
  );
}

function Splash() {
  return (
    <div className="grid min-h-dvh place-items-center">
      <div className="flex flex-col items-center gap-4 fade-in">
        <BrandMark className="size-16 animate-pulse" />
        <p className="font-display text-sm text-ink-3">こんだて帖</p>
      </div>
    </div>
  );
}
