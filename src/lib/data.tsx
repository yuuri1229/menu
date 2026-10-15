"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { collection, doc, onSnapshot, updateDoc } from "firebase/firestore";
import { DEMO } from "./config";
import { getDb } from "./firebase";
import { parseMarkdown } from "./markdown";
import { sampleSnapshot } from "./sample";
import type { Ingredient, InventoryItem, Meal, Note, Purchase, Snapshot, StockStatus } from "./types";

type Status = "loading" | "ready" | "error";

interface DataApi extends Snapshot {
  status: Status;
  error: string | null;
  /** アプリからの書き込みに失敗したとき（権限・通信など） */
  writeError: string | null;
  clearWriteError: () => void;
  demo: boolean;
  mealById: Map<string, Meal>;
  ingredientById: Map<string, Ingredient>;
  setMealDone: (id: string, done: boolean) => void;
  setBought: (id: string, bought: boolean) => void;
  setStock: (id: string, status: StockStatus) => void;
}

const DataContext = createContext<DataApi | null>(null);

const COLLECTIONS = ["meals", "ingredients", "purchases", "inventory", "notes"] as const;
type Name = (typeof COLLECTIONS)[number];
type Raw = { syncedAt: string | null } & Record<Name, Record<string, unknown>[]>;

const EMPTY: Raw = { syncedAt: null, meals: [], ingredients: [], purchases: [], inventory: [], notes: [] };

/** 保存されていない項目（食材の実績金額・使う献立、ノートの表示用ブロック）を計算して足す */
function derive(raw: Raw): Snapshot {
  const meals = raw.meals as unknown as Meal[];
  const purchases = raw.purchases as unknown as Purchase[];
  const spent = new Map<string, number>();
  for (const p of purchases)
    for (const id of p.ingredientIds ?? []) spent.set(id, (spent.get(id) ?? 0) + (p.amount ?? 0));
  const usedBy = new Map<string, string[]>();
  for (const m of meals) for (const id of m.ingredientIds ?? []) usedBy.set(id, [...(usedBy.get(id) ?? []), m.id]);
  return {
    syncedAt: raw.syncedAt,
    meals,
    purchases,
    inventory: raw.inventory as unknown as InventoryItem[],
    ingredients: (raw.ingredients as unknown as Ingredient[]).map((i) => ({
      ...i,
      actual: spent.has(i.id) ? spent.get(i.id)! : null,
      mealIds: usedBy.get(i.id) ?? [],
    })),
    notes: (raw.notes as unknown as Note[]).map((n) => ({ ...n, blocks: parseMarkdown(n.markdown ?? "") })),
  };
}

function toRaw(s: Snapshot): Raw {
  return { ...s } as unknown as Raw;
}

export function DataProvider({ children }: { children: ReactNode }) {
  const [raw, setRaw] = useState<Raw>(() => (DEMO ? toRaw(sampleSnapshot()) : EMPTY));
  const [loaded, setLoaded] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [writeError, setWriteError] = useState<string | null>(null);

  useEffect(() => {
    if (DEMO) return;
    const db = getDb();
    const onError = (e: { code?: string }) =>
      setError(
        e.code === "permission-denied"
          ? "データを読む権限がありません。このアカウントがメンバーに登録されているか確認してください。"
          : "データを読み込めませんでした。",
      );
    const unsubs = COLLECTIONS.map((name) =>
      onSnapshot(
        collection(db, name),
        (qs) => {
          setRaw((s) => ({ ...s, [name]: qs.docs.map((d) => ({ ...d.data(), id: d.id })) }));
          setLoaded((l) => new Set(l).add(name));
        },
        onError,
      ),
    );
    unsubs.push(
      onSnapshot(
        doc(db, "meta", "sync"),
        (d) => setRaw((s) => ({ ...s, syncedAt: (d.data()?.syncedAt as string) ?? null })),
        onError,
      ),
    );
    return () => unsubs.forEach((u) => u());
  }, []);

  /**
   * 1項目だけ書き換える。画面は端末のキャッシュですぐ変わり、電波がなくても後で送られる。
   * 許されている項目は firestore.rules を参照（作った・買った・在庫の状態）。
   */
  const write = useCallback((name: Name, id: string, field: string, value: unknown) => {
    if (DEMO) {
      setRaw((s) => ({ ...s, [name]: s[name].map((d) => (d.id === id ? { ...d, [field]: value } : d)) }));
      return;
    }
    updateDoc(doc(getDb(), name, id), { [field]: value }).catch((e: { code?: string }) =>
      setWriteError(
        e.code === "permission-denied"
          ? "変更を保存する権限がありません。メンバー登録と Firestore のルールを確認してください。"
          : "変更を保存できませんでした。通信の良いところでもう一度試してください。",
      ),
    );
  }, []);

  const value = useMemo<DataApi>(() => {
    const snap = derive(raw);
    const status: Status = error ? "error" : DEMO || loaded.size === COLLECTIONS.length ? "ready" : "loading";
    return {
      ...snap,
      status,
      error,
      writeError,
      clearWriteError: () => setWriteError(null),
      demo: DEMO,
      mealById: new Map(snap.meals.map((m) => [m.id, m])),
      ingredientById: new Map(snap.ingredients.map((i) => [i.id, i])),
      setMealDone: (id, done) => write("meals", id, "done", done),
      setBought: (id, bought) => write("ingredients", id, "bought", bought),
      setStock: (id, status) => write("inventory", id, "status", status),
    };
  }, [raw, loaded, error, writeError, write]);

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData() {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error("useData は DataProvider の中で使う");
  return ctx;
}

export type { Ingredient, InventoryItem, Meal, Note, Purchase };
