import { deleteDoc, doc, setDoc } from "firebase/firestore";
import { VAPID_PUBLIC_KEY } from "./config";
import { getFirebaseAuth, getDb } from "./firebase";

const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

export type PushState =
  | "unsupported" // この端末・ブラウザでは受け取れない
  | "needsInstall" // iPhone：ホーム画面に追加したアイコンから開けば受け取れる
  | "denied" // 通知を拒否した（端末の設定から戻す）
  | "off"
  | "on";

function isIos() {
  const nav = window.navigator;
  return /iPhone|iPad|iPod/.test(nav.userAgent) || (nav.platform === "MacIntel" && nav.maxTouchPoints > 1);
}

function isStandalone() {
  const nav = window.navigator as Navigator & { standalone?: boolean };
  return nav.standalone === true || window.matchMedia("(display-mode: standalone)").matches;
}

function supported() {
  return "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

async function registration() {
  return navigator.serviceWorker.register(`${basePath}/sw.js`, { scope: `${basePath}/` });
}

export async function getPushState(): Promise<PushState> {
  if (!supported()) return isIos() && !isStandalone() ? "needsInstall" : "unsupported";
  if (Notification.permission === "denied") return "denied";
  const reg = await navigator.serviceWorker.getRegistration(`${basePath}/`);
  const sub = await reg?.pushManager.getSubscription();
  return sub && Notification.permission === "granted" ? "on" : "off";
}

/** 端末を Firestore の pushSubscriptions に登録する。id は endpoint のハッシュ（同じ端末は上書き） */
async function subscriptionId(endpoint: string) {
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(endpoint));
  return Array.from(new Uint8Array(hash).slice(0, 16), (b) => b.toString(16).padStart(2, "0")).join("");
}

function deviceName() {
  const ua = navigator.userAgent;
  if (/iPhone/.test(ua)) return "iPhone";
  if (/iPad/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)) return "iPad";
  if (/Android/.test(ua)) return "Android";
  if (/Mac/.test(ua)) return "Mac";
  if (/Windows/.test(ua)) return "Windows";
  return "その他";
}

function keyBytes(base64url: string) {
  const b64 = (base64url + "=".repeat((4 - (base64url.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}

/** 通知をオンにする。ボタンを押したときに呼ぶ（iPhone はタップの中でないと許可を聞けない） */
export async function enablePush(): Promise<PushState> {
  const permission = await Notification.requestPermission();
  if (permission !== "granted") return permission === "denied" ? "denied" : "off";
  const reg = await registration();
  await navigator.serviceWorker.ready;
  const sub =
    (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(VAPID_PUBLIC_KEY) }));
  const json = sub.toJSON();
  const uid = getFirebaseAuth().currentUser?.uid;
  if (!uid || !json.endpoint || !json.keys) throw new Error("通知の登録に必要な情報がそろいませんでした");
  await setDoc(doc(getDb(), "pushSubscriptions", await subscriptionId(json.endpoint)), {
    uid,
    endpoint: json.endpoint,
    keys: { p256dh: json.keys.p256dh, auth: json.keys.auth },
    device: deviceName(),
    createdAt: new Date().toISOString(),
  });
  await reg.showNotification("通知をオンにしました", {
    body: "買い物の前の晩や、Claude が献立を更新したときにお知らせします。",
    icon: `${basePath}/apple-touch-icon.png`,
    tag: "push-enabled",
  });
  return "on";
}

export async function disablePush(): Promise<PushState> {
  const reg = await navigator.serviceWorker.getRegistration(`${basePath}/`);
  const sub = await reg?.pushManager.getSubscription();
  if (sub) {
    await deleteDoc(doc(getDb(), "pushSubscriptions", await subscriptionId(sub.endpoint))).catch(() => {});
    await sub.unsubscribe();
  }
  return "off";
}
