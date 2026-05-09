import "server-only";

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getSessionContext } from "@/lib/supabase/session-cache";

// A password-gated test sets `tests.access_password` to a plain-text
// passcode (this is an exam-room share code, not a user credential —
// hashing it would make it impossible to display back in the admin
// builder). When a student opens a gated test page we render a small
// prompt instead of the quiz shell; this endpoint validates the code
// and drops a short-lived HttpOnly cookie so the student isn't asked
// again for the rest of the day.
//
// Cookie shape:
//   name:    exam_unlock_<testId>
//   value:   "1" (we don't store the password, just the fact of unlock)
//   path:    /dashboard/tests/<testId>  (scoped so one unlock doesn't
//                                        leak across tests)
//   maxAge:  24 h                       (covers a typical exam window
//                                        without persisting forever)
//   httpOnly + sameSite=lax + secure    (standard production defaults)
export async function POST(req: NextRequest) {
  const { user, supabase } = await getSessionContext();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { test_id?: string; password?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const testId = body?.test_id?.trim();
  const password = body?.password?.trim();
  if (!testId || typeof password !== "string") {
    return NextResponse.json(
      { error: "test_id and password are required" },
      { status: 400 }
    );
  }

  const { data: test, error } = await supabase
    .from("tests")
    .select("id, access_password")
    .eq("id", testId)
    .maybeSingle();

  if (error) {
    console.error("[v0] unlock: fetch failed", error);
    return NextResponse.json({ error: "Test lookup failed" }, { status: 500 });
  }
  if (!test) {
    return NextResponse.json({ error: "Test not found" }, { status: 404 });
  }

  // A test with no password shouldn't normally hit this endpoint at all
  // (the page wouldn't render the prompt). If a stale tab does post to
  // it anyway, respond with "already unlocked" rather than erroring.
  if (!test.access_password) {
    return NextResponse.json({ unlocked: true, reason: "no-password-set" });
  }

  // Constant-time comparison isn't strictly necessary for a shared
  // classroom code but it's trivial to add and defuses any future
  // timing-attack paranoia in security review.
  const a = Buffer.from(test.access_password);
  const b = Buffer.from(password);
  const matched = a.length === b.length && timingSafeEqual(a, b);

  if (!matched) {
    return NextResponse.json({ error: "Incorrect password" }, { status: 403 });
  }

  const jar = await cookies();
  jar.set(`exam_unlock_${testId}`, "1", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: `/dashboard/tests/${testId}`,
    maxAge: 60 * 60 * 24,
  });

  return NextResponse.json({ unlocked: true });
}

// Minimal constant-time buffer comparison. Kept local so the route has
// no additional dependency surface.
function timingSafeEqual(a: Buffer, b: Buffer): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}
