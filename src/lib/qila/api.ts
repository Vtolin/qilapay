import { NextResponse } from "next/server";
import { HttpError } from "./session";

export function ok<T>(data: T, init?: ResponseInit) {
  return NextResponse.json({ ok: true, data }, init);
}

export function fail(message: string, status = 400, extra?: Record<string, unknown>) {
  return NextResponse.json({ ok: false, error: message, ...extra }, { status });
}

export function handleError(e: unknown) {
  if (e instanceof HttpError) return fail(e.message, e.status);
  const message = e instanceof Error ? e.message : String(e);
  console.error("[api]", message);
  return fail(message, 500);
}

export function jsonSafe<T>(value: T): T {
  return JSON.parse(
    JSON.stringify(value, (_k, v) => (typeof v === "bigint" ? v.toString() : v)),
  );
}
