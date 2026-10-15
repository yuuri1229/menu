"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { collection, doc, onSnapshot } from "firebase/firestore";
import { DEMO } from "./config";
import { getDb } from "./firebase";
import { sampleSnapshot } from "./sample";
import type { Ingredient, InventoryItem, Meal, Note, Purchase, Snapshot } from "./types";

type Status = "loading" | "ready" | "error";

interface DataApi extends Snapshot {
  status: Status;
  error: string | null;
  demo: boolean;
  mealById: Map<string, Meal>;
  ingredientById: Map<string, Ingredient>;
}

const DataContext = createContext<DataApi | null>(null);

const EMPTY: Snapshot = { syncedAt: null, meals: [], ingredients: [], purchases: [], inventory: [], notes: [] };
const COLLECTIONS = ["meals", "ingredients", "purchases", "inventory", "notes"] as const;

export function DataProvider({ children }: { children: ReactNode }) {
  const [snap, setSnap] = useState<Snapshot>(DEMO ? sampleSnapshot() : EMPTY);
  const [loaded, setLoaded] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (DEMO) return;
    const db = getDb();
    const onError = (e: { code?: string }) =>
      setError(
        e.code === "permission-denied"
          ? "データを読む権限がありません。同期の設定（ALLOWED_EMAILS）にこのアカウントのメールが入っているか確認してください。"
          : "データを読み込めませんでした。",
      );
    const unsubs = COLLECTIONS.map((name) =>
      onSnapshot(
        collection(db, name),
        (qs) => {
          const docs = qs.docs.map((d) => {
            const data = d.data();
            if (name === "notes") {
              const { blocksJson, ...rest } = data as { blocksJson?: string };
              return { id: d.id, ...rest, blocks: blocksJson ? JSON.parse(blocksJson) : [] } as Note;
            }
            return { id: d.id, ...data };
          });
          setSnap((s) => ({ ...s, [name]: docs }));
          setLoaded((l) => new Set(l).add(name));
        },
        onError,
      ),
    );
    unsubs.push(
      onSnapshot(
        doc(db, "meta", "sync"),
        (d) => setSnap((s) => ({ ...s, syncedAt: (d.data()?.syncedAt as string) ?? null })),
        onError,
      ),
    );
    return () => unsubs.forEach((u) => u());
  }, []);

  const value = useMemo<DataApi>(() => {
    const status: Status = error ? "error" : DEMO || loaded.size === COLLECTIONS.length ? "ready" : "loading";
    return {
      ...snap,
      status,
      error,
      demo: DEMO,
      mealById: new Map(snap.meals.map((m) => [m.id, m])),
      ingredientById: new Map(snap.ingredients.map((i) => [i.id, i])),
    };
  }, [snap, loaded, error]);

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData() {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error("useData は DataProvider の中で使う");
  return ctx;
}

export type { Ingredient, InventoryItem, Meal, Note, Purchase };
