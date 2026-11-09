import { NextRequest, NextResponse } from "next/server";
import { userFromRequest } from "./auth";
import type { SessionUser } from "./types";

export class HttpError extends Error {
  status: number;
  details?: unknown;
  constructor(message: string, status = 400, details?: unknown) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

export function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status });
}

export async function handle(fn: () => Promise<Response> | Response): Promise<Response> {
  try {
    return await fn();
  } catch (error) {
    if (error instanceof HttpError) {
      return NextResponse.json(
        { error: error.message, details: error.details ?? undefined },
        { status: error.status }
      );
    }
    const message = error instanceof Error ? error.message : String(error);
    console.error("[api]", error);
    return NextResponse.json({ error: "Internal server error", details: message }, { status: 500 });
  }
}

export function requireUser(req: NextRequest): SessionUser {
  const user = userFromRequest(req);
  if (!user) throw new HttpError("You must sign in to continue.", 401);
  return user;
}

export function requireStaff(req: NextRequest): SessionUser {
  const user = requireUser(req);
  if (user.role !== "station" || user.stationId == null) {
    throw new HttpError("This action is restricted to station staff.", 403);
  }
  return user;
}

export function requireAdmin(req: NextRequest): SessionUser {
  const user = requireUser(req);
  if (user.role !== "admin") throw new HttpError("Administrator access required.", 403);
  return user;
}

export function assertSameOrigin(req: NextRequest) {
  const origin = req.headers.get("origin");
  if (!origin) return;
  const host = req.headers.get("host");
  try {
    if (new URL(origin).host !== host) throw new HttpError("Invalid request origin.", 403);
  } catch {
    throw new HttpError("Invalid request origin.", 403);
  }
}

export async function readJson<T = Record<string, unknown>>(req: NextRequest): Promise<T> {
  try {
    return (await req.json()) as T;
  } catch {
    throw new HttpError("Invalid JSON body.", 400);
  }
}

export function requireString(value: unknown, field: string, max = 500): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new HttpError(`${field} is required.`, 400);
  }
  const trimmed = value.trim();
  if (trimmed.length > max) throw new HttpError(`${field} is too long.`, 400);
  return trimmed;
}

export function requireInt(value: unknown, field: string, min: number, max: number): number {
  const n = typeof value === "number" ? value : Number.parseInt(String(value), 10);
  if (!Number.isFinite(n) || !Number.isInteger(n) || n < min || n > max) {
    throw new HttpError(`${field} must be a whole number between ${min} and ${max}.`, 400);
  }
  return n;
}
