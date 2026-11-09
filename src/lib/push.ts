import fs from "node:fs";
import path from "node:path";
import webpush from "web-push";
import { DATA_DIR, q, exec, getSettings } from "./db";

interface VapidKeys {
  publicKey: string;
  privateKey: string;
}

const KEYS_PATH = path.join(DATA_DIR, "vapid.json");

const globalForVapid = globalThis as unknown as { __metroVapid?: VapidKeys; __metroVapidReady?: boolean };

function ensureVapid(): VapidKeys | null {
  if (globalForVapid.__metroVapid) return globalForVapid.__metroVapid;

  let publicKey = process.env.VAPID_PUBLIC_KEY || "";
  let privateKey = process.env.VAPID_PRIVATE_KEY || "";

  if (!publicKey || !privateKey) {
    try {
      if (fs.existsSync(KEYS_PATH)) {
        const saved = JSON.parse(fs.readFileSync(KEYS_PATH, "utf8")) as VapidKeys;
        publicKey = saved.publicKey;
        privateKey = saved.privateKey;
      } else {
        const generated = webpush.generateVAPIDKeys();
        publicKey = generated.publicKey;
        privateKey = generated.privateKey;
        fs.mkdirSync(DATA_DIR, { recursive: true });
        fs.writeFileSync(KEYS_PATH, JSON.stringify({ publicKey, privateKey }, null, 2), {
          mode: 0o600,
        });
      }
    } catch (error) {
      console.warn("[push] unable to prepare VAPID keys:", error);
      return null;
    }
  }

  try {
    webpush.setVapidDetails(
      process.env.VAPID_SUBJECT || "mailto:metro-assist@example.local",
      publicKey,
      privateKey
    );
    globalForVapid.__metroVapid = { publicKey, privateKey };
    return globalForVapid.__metroVapid;
  } catch (error) {
    console.warn("[push] invalid VAPID configuration:", error);
    return null;
  }
}

export function getVapidPublicKey(): string {
  return ensureVapid()?.publicKey || "";
}

export function isPushConfigured(): boolean {
  return !!ensureVapid();
}

export async function sendPushToStation(
  stationId: number,
  payload: { title: string; body: string; tag?: string; url?: string }
) {
  if (!getSettings().pushEnabled) return;
  const keys = ensureVapid();
  if (!keys) return;

  let subs: Array<{ id: number; endpoint: string; p256dh: string; auth: string }> = [];
  try {
    subs = q(
      "SELECT id, endpoint, p256dh, auth FROM push_subscriptions WHERE station_id = ?",
      stationId
    );
  } catch {
    return;
  }
  if (!subs.length) return;

  const payloadString = JSON.stringify({
    title: payload.title,
    body: payload.body,
    tag: payload.tag,
    url: payload.url || "/dashboard",
  });

  await Promise.all(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          payloadString,
          { TTL: 3600, urgency: "high" }
        );
      } catch (error) {
        const status = (error as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) {
          exec("DELETE FROM push_subscriptions WHERE id = ?", sub.id);
        }
      }
    })
  );
}
