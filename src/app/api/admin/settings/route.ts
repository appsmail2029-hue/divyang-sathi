import { NextRequest } from "next/server";
import { assertSameOrigin, handle, HttpError, json, readJson, requireAdmin } from "@/lib/api";
import { audit, getSettings, saveSettings } from "@/lib/db";
import { broadcast } from "@/lib/events";
import { isPushConfigured } from "@/lib/push";
import type { AppSettings } from "@/lib/types";

export async function GET(req: NextRequest) {
  return handle(async () => {
    requireAdmin(req);
    return json({ settings: getSettings(), pushConfigured: isPushConfigured() });
  });
}

export async function PUT(req: NextRequest) {
  return handle(async () => {
    assertSameOrigin(req);
    const admin = requireAdmin(req);
    const body = await readJson<Partial<AppSettings>>(req);

    const num = (value: unknown, field: string, min: number, max: number, integer = true) => {
      const n = Number(value);
      if (!Number.isFinite(n) || n < min || n > max || (integer && !Number.isInteger(n))) {
        throw new HttpError(`${field} must be between ${min} and ${max}.`, 400);
      }
      return n;
    };

    const secondsPerStation = num(body.secondsPerStation, "Seconds per station", 30, 900);
    const alarmVolume = num(body.alarmVolume, "Alarm volume", 0, 1, false);
    const alarmRepeatSeconds = num(body.alarmRepeatSeconds, "Alarm repeat interval", 2, 120);
    const autoCloseNoticeDays = num(body.autoCloseNoticeDays, "Auto-close notices", 1, 365);
    const organizationName = String(body.organizationName || "").trim();
    if (organizationName.length < 2 || organizationName.length > 80) {
      throw new HttpError("Organisation name must be 2–80 characters.", 400);
    }

    saveSettings({
      seconds_per_station: String(secondsPerStation),
      alarm_volume: String(alarmVolume),
      alarm_repeat_seconds: String(alarmRepeatSeconds),
      browser_notifications: body.browserNotifications ? "true" : "false",
      push_enabled: body.pushEnabled ? "true" : "false",
      auto_close_notice_days: String(autoCloseNoticeDays),
      demo_mode: body.demoMode ? "true" : "false",
      organization_name: organizationName,
    });
    audit({
      actorUserId: admin.id,
      actorName: admin.displayName,
      action: "SETTINGS_UPDATED",
      entity: "settings",
      entityId: null,
      details: `Alarm volume ${alarmVolume}, repeat ${alarmRepeatSeconds}s, ${secondsPerStation}s/station, push ${body.pushEnabled ? "on" : "off"}.`,
    });
    broadcast({ type: "settings.updated" });
    return json({ settings: getSettings() });
  });
}

export const dynamic = "force-dynamic";
