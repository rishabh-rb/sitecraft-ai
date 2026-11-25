import { randomUUID } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";

const COOKIE = "sitecraft-visitor";
const ACTIVE_WINDOW_MS = 45_000;
const MAX_SESSIONS = 20_000;
const presence = globalThis as typeof globalThis & { sitecraftHomeVisitors?: Map<string, number> };
const visitors = presence.sitecraftHomeVisitors ??= new Map<string, number>();

export function POST(request: NextRequest) {
  if (request.headers.get("sec-fetch-site") === "cross-site") {
    return NextResponse.json({ error: "Same-site requests only." }, { status: 403 });
  }

  const now = Date.now();
  for (const [id, seen] of visitors) {
    if (now - seen >= ACTIVE_WINDOW_MS) visitors.delete(id);
  }

  const cookie = request.cookies.get(COOKIE)?.value;
  const valid = cookie && /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(cookie);
  const session = valid ? cookie : randomUUID();
  if (!visitors.has(session) && visitors.size >= MAX_SESSIONS) {
    return NextResponse.json({ error: "Visitor tracking is busy." }, { status: 503 });
  }
  visitors.set(session, now);

  const response = NextResponse.json({ activeVisitors: visitors.size }, {
    headers: { "Cache-Control": "no-store" }
  });
  if (!valid) {
    response.cookies.set(COOKIE, session, {
      path: "/api/visitors",
      httpOnly: true,
      sameSite: "strict",
      secure: request.nextUrl.protocol === "https:"
    });
  }
  return response;
}
