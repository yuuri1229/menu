"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { addDoc, collection, deleteDoc, doc, onSnapshot, setDoc, updateDoc } from "firebase/firestore";
import { DEMO } from "./config";
import { getDb, getFirebaseAuth } from "./firebase";
import { parseMarkdown } from "./markdown";
import { sampleSnapshot } from "./sample";
import type { Feedback, FeedbackTag, Ingredient, InventoryItem, Meal, Note, Purchase, Snapshot, StockStatus, Verdict } from "./types";

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
  /** 在庫を登録（id なし）または編集する */
  saveInventory: (id: string | null, fields: InventoryFields) => void;
  /** 買い物リストに食材を足す／消す（献立や明細が指す食材は消さない） */
  addIngredient: (fields: IngredientFields) => void;
  removeIngredient: (id: string) => void;
  /** 献立の id → その献立への感想 */
  feedbackByMeal: Map<string, Feedback>;
  sendFeedback: (meal: Meal, input: { verdict: Verdict; tags: FeedbackTag[]; text: string }) => void;
}

/** アプリから書ける在庫の項目（魚介の確認 seafood は Claude が付ける） */
export type InventoryFields = Pick<InventoryItem, "name" | "category" | "storage" | "status" | "remaining" | "memo" | "bestBefore" | "purchasedAt">;
export type IngredientFields = Omit<Ingredient, "id" | "actual" | "mealIds">;

const DataContext = createContext<DataApi | null>(null);

const COLLECTIONS = ["meals", "ingredients", "purchases", "inventory", "notes", "feedback"] as const;
type Name = (typeof COLLECTIONS)[number];
type Raw = { syncedAt: string | null } & Record<Name, Record<string, unknown>[]>;

const EMPTY: Raw = { syncedAt: null, meals: [], ingredients: [], purchases: [], inventory: [], notes: [], feedback: [] };

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
    feedback: raw.feedback as unknown as Feedback[],
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
        // 感想が読めなくても（ルールの反映前など）献立や買い物は使えるようにする
        name === "feedback" ? () => setLoaded((l) => new Set(l).add(name)) : onError,
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

  const onWriteError = useCallback((what: string) => (e: { code?: string }) =>
    setWriteError(
      e.code === "permission-denied"
        ? `${what}を保存する権限がありません。Firestore のルールが反映されているか確認してください。`
        : `${what}を保存できませんでした。通信の良いところでもう一度試してください。`,
    ), []);

  const saveInventory = useCallback<DataApi["saveInventory"]>((id, fields) => {
    if (DEMO) {
      setRaw((s) => ({
        ...s,
        inventory: id
          ? s.inventory.map((d) => (d.id === id ? { ...d, ...fields } : d))
          : [...s.inventory, { ...fields, seafood: null, id: `demo-${Date.now()}` }],
      }));
      return;
    }
    const db = getDb();
    (id ? updateDoc(doc(db, "inventory", id), fields) : addDoc(collection(db, "inventory"), { ...fields, seafood: null })).catch(onWriteError("在庫"));
  }, [onWriteError]);

  const addIngredient = useCallback<DataApi["addIngredient"]>((fields) => {
    if (DEMO) {
      setRaw((s) => ({ ...s, ingredients: [...s.ingredients, { ...fields, id: `demo-${Date.now()}` }] }));
      return;
    }
    addDoc(collection(getDb(), "ingredients"), fields).catch(onWriteError("買い物リスト"));
  }, [onWriteError]);

  const removeIngredient = useCallback<DataApi["removeIngredient"]>((id) => {
    if (DEMO) {
      setRaw((s) => ({ ...s, ingredients: s.ingredients.filter((d) => d.id !== id) }));
      return;
    }
    deleteDoc(doc(getDb(), "ingredients", id)).catch(onWriteError("買い物リスト"));
  }, [onWriteError]);

  /** 感想は献立ごとに1件。文書ごと書き直し、反映済みの印は外して Claude にもう一度読んでもらう */
  const sendFeedback = useCallback<DataApi["sendFeedback"]>((meal, { verdict, tags, text }) => {
    const data: Omit<Feedback, "id"> = {
      mealId: meal.id,
      mealTitle: meal.title,
      date: meal.date,
      slot: meal.slot,
      verdict,
      tags,
      text: text.trim(),
      uid: DEMO ? "demo" : (getFirebaseAuth().currentUser?.uid ?? null),
      updatedAt: new Date().toISOString(),
      reflectedAt: null,
    };
    if (DEMO) {
      setRaw((s) => ({ ...s, feedback: [...s.feedback.filter((f) => f.id !== meal.id), { ...data, id: meal.id }] }));
      return;
    }
    setDoc(doc(getDb(), "feedback", meal.id), data).catch((e: { code?: string }) =>
      setWriteError(
        e.code === "permission-denied"
          ? "感想を保存する権限がありません。Firestore のルールが反映されているか確認してください。"
          : "感想を保存できませんでした。通信の良いところでもう一度試してください。",
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
      feedbackByMeal: new Map(snap.feedback.map((f) => [f.mealId ?? f.id, f])),
      saveInventory,
      addIngredient,
      removeIngredient,
      sendFeedback,
    };
  }, [raw, loaded, error, writeError, write, sendFeedback, saveInventory, addIngredient, removeIngredient]);

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData() {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error("useData は DataProvider の中で使う");
  return ctx;
}

export type { Feedback, Ingredient, InventoryItem, Meal, Note, Purchase };
