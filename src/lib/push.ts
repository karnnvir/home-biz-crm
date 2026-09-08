import { doc, setDoc } from "firebase/firestore";
import { getToken, getMessaging, isSupported } from "firebase/messaging";
import { app, db } from "../firebase";

const SW_URL = "/firebase-messaging-sw.js";
const SW_SCOPE = "/firebase-cloud-messaging-push-scope";
const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY;

export async function isPushSupported(): Promise<boolean> {
  if (!("Notification" in window) || !("serviceWorker" in navigator)) return false;
  return isSupported();
}

async function getOrCreateToken(): Promise<string | null> {
  if (!VAPID_KEY) {
    console.error("VITE_FIREBASE_VAPID_KEY is not set.");
    return null;
  }
  const registration = await navigator.serviceWorker.register(SW_URL, { scope: SW_SCOPE });
  const messaging = getMessaging(app);
  return getToken(messaging, { vapidKey: VAPID_KEY, serviceWorkerRegistration: registration });
}

async function saveToken(token: string): Promise<void> {
  await setDoc(doc(db, "deviceTokens", token), {
    token,
    createdAt: new Date().toISOString(),
  });
}

/** Called from a user gesture (button tap) — prompts for permission if not yet decided. */
export async function enablePush(): Promise<"granted" | "denied" | "unsupported" | "error"> {
  if (!(await isPushSupported())) return "unsupported";
  try {
    const permission = await Notification.requestPermission();
    if (permission !== "granted") return "denied";
    const token = await getOrCreateToken();
    if (!token) return "error";
    await saveToken(token);
    return "granted";
  } catch (err) {
    console.error("enablePush failed", err);
    return "error";
  }
}

/** Called silently on app load — re-registers if permission was already granted earlier. */
export async function ensurePushRegistered(): Promise<void> {
  if (Notification.permission !== "granted") return;
  if (!(await isPushSupported())) return;
  try {
    const token = await getOrCreateToken();
    if (token) await saveToken(token);
  } catch (err) {
    console.error("ensurePushRegistered failed", err);
  }
}
