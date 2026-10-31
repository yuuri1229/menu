"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { addDoc, collection, deleteDoc, doc, onSnapshot, setDoc, updateDoc, writeBatch } from "firebase/firestore";
import { planConsume, planRestore, type StockWrite } from "./consume";
import { DEMO } from "./config";
import { getDb, getFirebaseAuth } from "./firebase";
import { parseMarkdown } from "./markdown";
import { planCovers } from "./plans";
import { sampleSnapshot } from "./sample";
import type { Feedback, FeedbackTag, Ingredient, InventoryItem, Meal, Note, Plan, Purchase, Receipt, Slot, Snapshot, StockStatus, Verdict } from "./types";

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
  /** 「作った」の印を付ける／外す。付けるときはレシピの材料を在庫から引き、外すときは引いた分を戻す */
  setMealDone: (id: string, done: boolean) => void;
  setBought: (id: string, bought: boolean) => void;
  setStock: (id: string, status: StockStatus) => void;
  /** 在庫を登録（id なし）または編集する */
  saveInventory: (id: string | null, fields: InventoryFields) => void;
  removeInventory: (id: string) => void;
  /** 買い物リストに食材を足す／消す（献立や明細が指す食材は消さない） */
  addIngredient: (fields: IngredientFields) => void;
  removeIngredient: (id: string) => void;
  /** 献立の id → その献立への感想 */
  feedbackByMeal: Map<string, Feedback>;
  sendFeedback: (meal: Meal, input: { verdict: Verdict; tags: FeedbackTag[]; text: string }) => void;
  /** その日のその食事の外食・不在の予定（取り消し済みは除く） */
  planAt: (date: string | null, slot: Slot | null) => Plan | null;
  /** 予定を登録（id なし）または書き直す。Claude にもう一度組み直してもらうため反映済みの印は外す */
  savePlan: (id: string | null, fields: PlanFields) => void;
  /** 予定がなくなった。献立にまだ反映していなければ消し、反映済みなら取り消しとして Claude に献立を戻してもらう */
  cancelPlan: (plan: Plan) => void;
  /** 重さと期限の登録待ちのレシート（新しい順） */
  pendingReceipts: Receipt[];
  /** レシートの重さと期限を在庫に書き、登録済みの印を付ける */
  registerReceipt: (receipt: Receipt, entries: ReceiptEntry[]) => void;
}

export interface ReceiptEntry {
  inventoryId: string;
  /** 重さ（g）。入れない品は null で、在庫の残量は変えない */
  grams: number | null;
  bestBefore: string | null;
}

export type PlanFields = Pick<Plan, "date" | "slots" | "endDate" | "endSlots" | "kind" | "memo">;

/** アプリから書ける在庫の項目（魚介の確認 seafood は Claude が付ける） */
export type InventoryFields = Pick<InventoryItem, "name" | "category" | "storage" | "status" | "remaining" | "memo" | "bestBefore" | "purchasedAt">;
export type IngredientFields = Omit<Ingredient, "id" | "actual" | "mealIds">;

const DataContext = createContext<DataApi | null>(null);

const COLLECTIONS = ["meals", "ingredients", "purchases", "inventory", "notes", "feedback", "plans", "receipts"] as const;
type Name = (typeof COLLECTIONS)[number];
type Raw = { syncedAt: string | null } & Record<Name, Record<string, unknown>[]>;

const EMPTY: Raw = { syncedAt: null, meals: [], ingredients: [], purchases: [], inventory: [], notes: [], feedback: [], plans: [], receipts: [] };

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
    // 数日の予定ができる前の文書は endDate・endSlots を持たない
    plans: (raw.plans as unknown as Plan[]).map((p) => ({ ...p, endDate: p.endDate ?? null, endSlots: p.endSlots ?? [] })),
    receipts: raw.receipts as unknown as Receipt[],
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
        // 感想や予定が読めなくても（ルールの反映前など）献立や買い物は使えるようにする
        name === "feedback" || name === "plans" || name === "receipts" ? () => setLoaded((l) => new Set(l).add(name)) : onError,
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

  /**
   * 「作った」を付けると、レシピの材料のうち分量を在庫の単位で引ける物を在庫から引き、引いた物と引けなかった物を
   * 献立の consumed に残す（取り消しで戻すため、二重に引かないための印も兼ねる）。献立と在庫は1回の書き込みで一緒に変える。
   */
  const setMealDone = useCallback<DataApi["setMealDone"]>((id, done) => {
    const meal = (raw.meals as unknown as Meal[]).find((m) => m.id === id);
    if (!meal || meal.done === done) return;
    const inventory = raw.inventory as unknown as InventoryItem[];
    let writes: StockWrite[] = [];
    let consumed: Meal["consumed"] = [];
    if (done) {
      // すでに引いた記録があれば、もう引かない
      if (meal.consumed?.length) consumed = meal.consumed;
      else ({ entries: consumed, writes } = planConsume(meal, inventory));
    } else {
      writes = planRestore(meal.consumed ?? [], inventory);
    }
    if (DEMO) {
      setRaw((s) => ({
        ...s,
        meals: s.meals.map((d) => (d.id === id ? { ...d, done, consumed } : d)),
        inventory: s.inventory.map((d) => {
          const w = writes.find((x) => x.id === d.id);
          return w ? { ...d, remaining: w.remaining, ...(w.status && { status: w.status }) } : d;
        }),
      }));
      return;
    }
    const db = getDb();
    const batch = writeBatch(db);
    batch.update(doc(db, "meals", id), { done, consumed });
    for (const w of writes) batch.update(doc(db, "inventory", w.id), { remaining: w.remaining, ...(w.status && { status: w.status }) });
    batch.commit().catch(onWriteError("「作った」と在庫"));
  }, [raw.meals, raw.inventory, onWriteError]);

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

  const removeInventory = useCallback<DataApi["removeInventory"]>((id) => {
    if (DEMO) {
      setRaw((s) => ({ ...s, inventory: s.inventory.filter((d) => d.id !== id) }));
      return;
    }
    deleteDoc(doc(getDb(), "inventory", id)).catch(onWriteError("在庫"));
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

  const savePlan = useCallback<DataApi["savePlan"]>((id, fields) => {
    const data: Omit<Plan, "id"> = {
      ...fields,
      memo: fields.memo.trim(),
      canceled: false,
      uid: DEMO ? "demo" : (getFirebaseAuth().currentUser?.uid ?? null),
      updatedAt: new Date().toISOString(),
      handledAt: null,
    };
    if (DEMO) {
      setRaw((s) => ({ ...s, plans: [...s.plans.filter((p) => p.id !== id), { ...data, id: id ?? `demo-${Date.now()}` }] }));
      return;
    }
    const db = getDb();
    (id ? setDoc(doc(db, "plans", id), data) : addDoc(collection(db, "plans"), data)).catch(onWriteError("予定"));
  }, [onWriteError]);

  const cancelPlan = useCallback<DataApi["cancelPlan"]>((plan) => {
    const remove = !plan.handledAt && !plan.canceled;
    if (DEMO) {
      setRaw((s) => ({
        ...s,
        plans: remove ? s.plans.filter((p) => p.id !== plan.id) : s.plans.map((p) => (p.id === plan.id ? { ...p, canceled: true, handledAt: null } : p)),
      }));
      return;
    }
    const ref = doc(getDb(), "plans", plan.id);
    const { id: _id, ...rest } = plan;
    (remove
      ? deleteDoc(ref)
      : setDoc(ref, { ...rest, canceled: true, uid: getFirebaseAuth().currentUser?.uid ?? null, updatedAt: new Date().toISOString(), handledAt: null })
    ).catch(onWriteError("予定"));
  }, [onWriteError]);

  const registerReceipt = useCallback<DataApi["registerReceipt"]>((receipt, entries) => {
    const registeredAt = new Date().toISOString();
    if (DEMO) {
      setRaw((s) => ({
        ...s,
        inventory: s.inventory.map((d) => {
          const e = entries.find((x) => x.inventoryId === d.id);
          return e ? { ...d, ...(e.grams != null && { remaining: `${e.grams}g` }), bestBefore: e.bestBefore, status: "十分" } : d;
        }),
        receipts: s.receipts.map((r) => (r.id === receipt.id ? { ...r, registeredAt } : r)),
      }));
      return;
    }
    const db = getDb();
    const fail = onWriteError("重さと期限");
    // 在庫を全部書いてから印を付ける（途中で失敗したら印は付かず、もう一度登録できる）
    Promise.all(
      entries.map((e) =>
        updateDoc(doc(db, "inventory", e.inventoryId), {
          ...(e.grams != null && { remaining: `${e.grams}g` }),
          bestBefore: e.bestBefore,
          purchasedAt: receipt.date,
          status: "十分",
        }),
      ),
    )
      .then(() => updateDoc(doc(db, "receipts", receipt.id), { registeredAt }))
      .catch(fail);
  }, [onWriteError]);

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
      setMealDone,
      setBought: (id, bought) => write("ingredients", id, "bought", bought),
      setStock: (id, status) => write("inventory", id, "status", status),
      feedbackByMeal: new Map(snap.feedback.map((f) => [f.mealId ?? f.id, f])),
      saveInventory,
      removeInventory,
      addIngredient,
      removeIngredient,
      sendFeedback,
      planAt: (date, slot) => (date && slot ? (snap.plans.find((p) => !p.canceled && planCovers(p, date, slot)) ?? null) : null),
      savePlan,
      cancelPlan,
      pendingReceipts: snap.receipts
        .filter((r) => !r.registeredAt)
        .sort((a, b) => (b.date ?? "").localeCompare(a.date ?? "") || (b.createdAt ?? "").localeCompare(a.createdAt ?? "")),
      registerReceipt,
    };
  }, [raw, loaded, error, writeError, write, setMealDone, sendFeedback, saveInventory, removeInventory, addIngredient, removeIngredient, savePlan, cancelPlan, registerReceipt]);

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData() {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error("useData は DataProvider の中で使う");
  return ctx;
}

export type { Feedback, Ingredient, InventoryItem, Meal, Note, Plan, Purchase, Receipt };
