// Firebase を設定していないとき（ローカル開発・画面確認）に表示するデモデータ。
// 今日を含む週の献立として毎回作り直す。実データは含めない。

import { addDays, md, todayJST, wd, weekStart } from "./date";
import type { Ingredient, InventoryItem, Meal, Purchase, Slot, Snapshot } from "./types";

const SAMPLE_RECIPE = `## 材料（1人分）
- 豚こま切れ肉 150g
- 玉ねぎ 1/2個
- しょうゆ 大さじ1
- みりん 大さじ1
- おろし生姜（チューブ） 小さじ1
- 千切りキャベツ 1袋

## 作り方
1. 玉ねぎを薄切りにする。しょうゆ・みりん・生姜を小皿で混ぜておく。
2. フライパンに油を入れて中火で熱する。
3. 豚肉と玉ねぎを入れ、3分炒める。
4. 肉の色が変わったら、混ぜたたれを回し入れ、強めの中火で2分、絡めながら炒める。
5. 皿に千切りキャベツを広げ、焼き上がりをのせる。

## ポイント
- たれは火を止める直前に足すと焦げにくい。`;

type MealSeed = [title: string, main: string, sides: string, minutes: number, genre: string, memo: string];

const WEEK: Record<Slot, MealSeed>[] = [
  {
    朝食: ["納豆ご飯＋マグカップみそ汁", "納豆ご飯", "マグカップみそ汁（わかめ・ねぎ）", 4, "和食", "みそ汁は味噌＋わかめで手作り（魚だし不使用）"],
    昼食: ["カレー弁当（日曜の残り）", "チキンカレー", "", 5, "その他", "朝は温め直して詰めるだけ"],
    夕食: ["鶏むね照り焼き＆ピーマン＋千切りキャベツ", "鶏むね肉の照り焼き", "ピーマン、千切りキャベツ", 25, "和食", "照り焼きの半分とピーマンは火曜の弁当用に冷蔵。寝る前に米2合を予約炊飯。"],
  },
  {
    朝食: ["バナナヨーグルト", "ヨーグルト＋バナナ", "", 2, "洋食", "器1つで完結"],
    昼食: ["照り焼きチキン弁当", "鶏むね照り焼き（月曜夜の取り分け）", "ピーマン、ゆで卵", 5, "和食", "朝は温め直して詰めるだけ"],
    夕食: ["豚の生姜焼き＋千切りキャベツ", "豚こま生姜焼き（玉ねぎ入り）", "千切りキャベツ", 15, "和食", "【実績】量が足りなかったので、次回から夕食のご飯は0.75合に。"],
  },
  {
    朝食: ["トースト＋バナナヨーグルト", "バタートースト", "バナナヨーグルト", 4, "洋食", "フライパンで焼いてもよい"],
    昼食: ["里芋とねぎの卵とじ丼", "里芋と玉ねぎの卵とじ丼", "", 15, "和食", "休みの日なので作りたてを。家にある卵・里芋・玉ねぎだけで作れる"],
    夕食: ["鶏むね塩レモンソテー＋千切りキャベツ", "鶏むね肉の塩レモン焼き", "ピーマン、千切りキャベツ", 15, "洋食", "鶏むね2枚を今夜どちらも調理。2枚目はそぎ切りで焼いて冷凍。半量を木曜の弁当用に冷蔵。"],
  },
  {
    朝食: ["納豆卵かけご飯", "納豆卵かけご飯", "", 2, "和食", "茶碗1つで完結"],
    昼食: ["塩レモンチキン弁当", "鶏むね塩レモンソテー（水曜夜の取り分け）", "ピーマン、ゆで卵", 5, "洋食", "朝は温め直して詰めるだけ"],
    夕食: ["豚バラと里芋の味噌炒め＋千切りキャベツ", "豚バラと里芋の味噌炒め", "千切りキャベツ", 20, "和食", "1/3を金曜の弁当用に冷蔵。寝る前に米1.25合を予約炊飯。"],
  },
  {
    朝食: ["バナナヨーグルト", "ヨーグルト＋バナナ", "", 2, "洋食", "きな粉があれば足してもよい"],
    昼食: ["豚バラ味噌炒め弁当", "豚バラの味噌炒め（木曜夜の取り分け）", "玉ねぎ・にんじん", 5, "和食", "朝は温め直して詰めるだけ"],
    夕食: ["豚バラともやしの塩炒め＋千切りキャベツ", "豚バラ・もやし・にんじんの塩炒め", "千切りキャベツ", 10, "中華", "脂が出るので油はごく少なめに。土曜昼の鶏1個を冷凍庫から冷蔵庫に移しておく。"],
  },
  {
    朝食: ["目玉焼きトースト＋ヨーグルト", "目玉焼きのせトースト", "ヨーグルト", 6, "洋食", "フライパン1つでパンと目玉焼きを同時に"],
    昼食: ["焼きうどん", "鶏むねと野菜の焼きうどん", "", 12, "和食", "冷凍した鶏むねは解凍せず、最後に入れて温める"],
    夕食: ["レンジ鶏豆腐（卵落とし）＋千切りキャベツ", "鶏むねと豆腐の煮物（電子レンジ）", "千切りキャベツ", 12, "和食", "耐熱丼1つ・コンロ不使用。作る前に米1.5合を炊飯。"],
  },
  {
    朝食: ["トースト＋バナナヨーグルト", "バタートースト", "バナナヨーグルト", 5, "洋食", ""],
    昼食: ["わかめと卵のとじうどん", "卵とじうどん", "", 8, "和食", "つゆは鶏がらスープの素＋醤油（かつおだし不使用）"],
    夕食: ["里芋入りチキンカレー＋千切りキャベツ", "鶏むねと里芋のカレー", "千切りキャベツ", 25, "その他", "2食分作り、残り1食は冷蔵して月曜の弁当に。"],
  },
];

type IngSeed = [name: string, category: string, storage: string, amount: string, estimate: number, trip: 0 | 1 | 2, memo?: string];

const INGREDIENTS: IngSeed[] = [
  ["鶏むね肉", "肉", "冷蔵", "1枚（約300g）", 300, 0],
  ["卵", "卵・大豆製品", "冷蔵", "6個", 200, 0],
  ["納豆", "卵・大豆製品", "冷蔵", "3パック", 100, 0],
  ["千切りキャベツ", "野菜", "冷蔵", "2袋", 170, 0, "スーパーが安い"],
  ["ピーマン", "野菜", "冷蔵", "1袋", 150, 0],
  ["玉ねぎ", "野菜", "常温", "3個", 180, 0],
  ["ヨーグルト（無糖）", "乳製品・果物", "冷蔵", "400g", 180, 0],
  ["バナナ", "乳製品・果物", "常温", "2本", 80, 0],
  ["食パン 6枚切", "主食", "常温", "1袋", 150, 0],
  ["鶏むね肉", "肉", "冷蔵", "2枚", 460, 1, "2枚目は当日に焼いて冷凍"],
  ["豚バラ切り落とし", "肉", "冷蔵", "約260g", 450, 1],
  ["千切りキャベツ", "野菜", "冷蔵", "2袋", 170, 1],
  ["里芋", "野菜", "常温", "1袋", 200, 1],
  ["千切りキャベツ", "野菜", "冷蔵", "3袋", 255, 2],
  ["もやし", "野菜", "冷蔵", "1袋", 40, 2],
  ["ゆでうどん", "主食", "冷蔵", "3玉", 120, 2],
  ["カレールウ", "その他", "常温", "1箱", 230, 2, "ドラッグストアでも可"],
];

const INVENTORY: [string, string, InventoryItem["status"], InventoryItem["seafood"], string, string?][] = [
  ["醤油", "調味料", "十分", "問題なし", "常温"],
  ["みりん風調味料", "調味料", "十分", "問題なし", "常温"],
  ["だし入り味噌", "調味料", "要確認", "要確認", "冷蔵", "原材料に魚介だしが入っていないか確認"],
  ["鶏がらスープの素", "調味料", "十分", "問題なし", "常温"],
  ["ごま油", "調味料", "切れた", "問題なし", "常温"],
  ["片栗粉", "乾物・粉", "残りわずか", "問題なし", "常温"],
  ["乾燥わかめ", "乾物・粉", "十分", "問題なし", "常温"],
  ["米", "主食", "十分", "問題なし", "常温", "5kg袋・残り約25合"],
  ["豆腐", "卵・大豆・乳製品", "十分", "問題なし", "冷蔵"],
  ["生姜チューブ", "調味料", "残りわずか", "問題なし", "冷蔵"],
  ["ラップ", "消耗品", "十分", null, "常温"],
];

export function sampleSnapshot(): Snapshot {
  const today = todayJST();
  const mon = weekStart(today);
  const trips = [0, 2, 4].map((d, i) => {
    const date = addDays(mon, d);
    return { date, label: `${"①②③"[i]} ${md(date)}(${wd(date)})` };
  });

  const meals: Meal[] = WEEK.flatMap((day, i) =>
    (Object.entries(day) as [Slot, MealSeed][]).map(([slot, [title, main, sides, minutes, genre, memo]]) => ({
      id: `m-${i}-${slot}`,
      title,
      date: addDays(mon, i),
      slot,
      main,
      sides,
      memo,
      recipe: title.startsWith("豚の生姜焼き") ? SAMPLE_RECIPE : "",
      genre,
      minutes,
      done: addDays(mon, i) < today,
      prepAhead: false,
      ingredientIds: [],
    })),
  );

  const ingredients: Ingredient[] = INGREDIENTS.map(([name, category, storage, amount, estimate, trip, memo], i) => ({
    id: `i-${i}`,
    name,
    category,
    storage,
    trip: trips[trip].label,
    tripDate: trips[trip].date,
    amount,
    estimate,
    actual: trips[trip].date < today ? Math.round(estimate * 1.08) : null,
    bought: trips[trip].date < today,
    memo: memo ?? "",
    mealIds: [],
  }));

  // 食材と献立を名前でゆるくつなぐ（デモ用）
  for (const ing of ingredients) {
    const key = ing.name.replace(/（.*|\s.*/, "").slice(0, 3);
    for (const m of meals) {
      if (m.date && ing.tripDate && m.date >= ing.tripDate && `${m.main}${m.sides}${m.title}`.includes(key)) {
        if (!m.ingredientIds.includes(ing.id)) m.ingredientIds.push(ing.id);
        ing.mealIds.push(m.id);
      }
    }
  }

  const purchases: Purchase[] = ingredients
    .filter((i) => i.bought)
    .map((i, n) => ({
      id: `p-${n}`,
      name: i.name,
      amount: i.actual,
      store: i.category === "その他" ? "ドラッグストア" : "スーパー",
      trip: i.trip,
      tripDate: i.tripDate,
      category: "食材",
      date: i.tripDate,
      carryOver: false,
      memo: "",
      receiptNo: "",
      ingredientIds: [i.id],
    }));
  purchases.push({
    id: "p-rice",
    name: "米 5kg",
    amount: 2419,
    store: "スーパー",
    trip: trips[0].label,
    tripDate: trips[0].date,
    category: "食材",
    date: trips[0].date,
    carryOver: true,
    memo: "数週間もつ",
    receiptNo: "",
    ingredientIds: [],
  });
  purchases.push({
    id: "p-season",
    name: "おろし生姜",
    amount: 130,
    store: "ドラッグストア",
    trip: trips[0].label,
    tripDate: trips[0].date,
    category: "調味料・消耗品",
    date: trips[0].date,
    carryOver: true,
    memo: "",
    receiptNo: "",
    ingredientIds: [],
  });
  // 先週分の実績（家計グラフ用）
  [4870, 5320, 4610].forEach((amount, i) => {
    const d = addDays(mon, -7 * (i + 1));
    purchases.push({
      id: `p-past-${i}`,
      name: "食材まとめ（デモ）",
      amount,
      store: "スーパー",
      trip: null,
      tripDate: d,
      category: "食材",
      date: d,
      carryOver: false,
      memo: "",
      receiptNo: "",
      ingredientIds: [],
    });
  });

  const inventory: InventoryItem[] = INVENTORY.map(([name, category, status, seafood, storage, remaining], i) => ({
    id: `s-${i}`,
    name,
    category,
    storage,
    status,
    remaining: remaining ?? "",
    memo: "",
    seafood,
    bestBefore: name === "豆腐" ? addDays(today, 2) : null,
    purchasedAt: null,
  }));

  const weekNote = [
    "## 予算",
    "- 週の予算：5,000円（米・調味料は別枠）",
    "- 試算額：4,640円 → 予備費 360円",
    "## 回ごとの予算と試算",
    ...trips.map((t, i) => `- ${t.label}：試算 ${[1510, 1280, 645][i].toLocaleString()}円`),
    "## 炊飯スケジュール",
    "- 月曜夜：2合 → 月曜夜〜火曜の4食",
    "- 水曜朝：3合（火曜夜に予約） → 水曜〜木曜の5食",
    "> 炊いたご飯は1食分ずつラップで包み、冷蔵して翌日中に食べ切る",
    `## ${trips[2].label} の買い物`,
    "- [ ] 千切りキャベツ 3袋 … 255円",
    "- [ ] もやし 1袋 … 40円",
    "- [ ] ~~豚こま切れ肉~~ → 買わない（水曜の豚バラの残りを使う）",
  ].join("\n");

  const rules = [
    "## 食材の制約（厳守）",
    "- **食物アレルギー：いか** → 絶対に使わない",
    "- NG：魚の切り身、貝類、さば缶、はんぺん",
    "- OK：ツナ、ちくわ、えび、たこ、かまぼこ",
    "## キッチン環境",
    "- IH 1口コンロ、グリルなし、電子レンジあり",
    "- 冷蔵・冷凍庫が狭く、まとめ買い・大量の作り置きは不可",
  ].join("\n");

  return {
    syncedAt: new Date(Date.now() - 42 * 60000).toISOString(),
    meals,
    ingredients,
    purchases,
    inventory,
    notes: [
      { id: "n-week", title: `買い物リスト・予算（${md(mon)}〜${md(addDays(mon, 6))}）`, icon: null, kind: "week", start: mon, end: addDays(mon, 6), markdown: weekNote, blocks: [], editedAt: null },
      { id: "n-rules", title: "前提条件・調理環境・買い物計画", icon: null, kind: "rules", start: null, end: null, markdown: rules, blocks: [], editedAt: null },
    ],
    feedback: [],
    receipts: [],
    plans: [
      { id: "pl-1", date: addDays(mon, 3), slots: ["夕食"], endDate: null, endSlots: [], kind: "外食", memo: "会社の飲み会", canceled: false, uid: "demo", updatedAt: null, handledAt: null },
      { id: "pl-2", date: addDays(mon, 9), slots: ["昼食", "夕食"], endDate: addDays(mon, 11), endSlots: ["朝食", "昼食"], kind: "不在", memo: "実家に帰省", canceled: false, uid: "demo", updatedAt: null, handledAt: null },
    ],
  };
}
