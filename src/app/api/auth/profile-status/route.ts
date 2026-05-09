import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { env } from "@/lib/env";

// Resume-registration probe.
//
// This endpoint used to hard-require a Supabase session, but the email
// registration flow creates users via `admin.createUser()` — which never
// issues a browser session. Six different places in the app redirect
// mid-flow users to `/register?resume=stage-N&uid=X`, so for every email
// registrant those redirects always hit a "session expired" wall even
// though nothing has actually expired. Google/OAuth users have a real
// session (from exchangeCodeForSession) and don't have that problem.
//
// The right authorization model for "continue a registration you already
// started" is token-like: a valid uid (UUIDv4, unguessable) that maps to
// an in-progress profile within its 24h window is sufficient proof. All
// stage-2/stage-3 POST routes re-validate via admin.getUserById and their
// own uniqueness checks, so exposing `{ stage }` for a known uid doesn't
// grant any new write capability.
export async function GET(request: NextRequest) {
  const cookieStore = await cookies();
  const url = new URL(request.url);
  const requestedUid = url.searchParams.get("uid");

  const supabase = createServerClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();

  const admin = createClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY
  );

  // Decide which user id we trust for this probe.
  //   * If the browser has a session, we always trust the session's uid.
  //     If the URL also has `uid`, we verify they match (session mismatch
  //     would be an indicator someone tried to hijack a resume link).
  //   * If there's no session, we fall back to the URL's `uid`. That path
  //     is the one the email-registration flow depends on.
  let effectiveUid: string | null = null;

  if (user) {
    if (requestedUid && requestedUid !== user.id) {
      return NextResponse.json({
        error: "invalid_session",
        message: "Session mismatch. Please log in to continue.",
        stage: null,
      });
    }
    effectiveUid = user.id;
  } else if (requestedUid) {
    // Format-check so a random ?uid=foo doesn't hit the DB with garbage.
    const uuidLike = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidLike.test(requestedUid)) {
      return NextResponse.json({
        error: "invalid_uid",
        message: "Your registration link is invalid. Please start a fresh registration.",
        stage: null,
      });
    }
    effectiveUid = requestedUid;
  } else {
    // Nothing to resume from — tell the client to render Stage 1 fresh.
    return NextResponse.json({ stage: 1, userId: null });
  }

  const { data: profile } = await admin
    .from("profiles")
    .select("user_id, registration_stage, registration_expires_at, status")
    .eq("user_id", effectiveUid)
    .single();

  // No profile yet → start fresh. Don't treat as an error; the client just
  // drops the stale uid and renders Stage 1.
  if (!profile) {
    return NextResponse.json({ stage: 1, userId: null });
  }

  // Hard expiry: a profile stuck below stage 4 past its expires_at is
  // purged so the email can be reused. This is the *only* error path the
  // client ever needs to handle for a resume flow.
  if (profile.registration_stage < 4 && profile.registration_expires_at) {
    const expiresAt = new Date(profile.registration_expires_at);
    if (new Date() > expiresAt) {
      // Only purge when we're acting on the server's verified session —
      // admin-deleting a user from an anonymous uid-only request would be
      // an abuse vector. Stage-2 / stage-3 POST handlers also guard and
      // will delete on their next write, so leaving the row here is safe.
      if (user) {
        await admin.auth.admin.deleteUser(effectiveUid);
      }
      return NextResponse.json({
        error: "registration_expired",
        message: "Your registration window has ended. Please start a fresh registration.",
        stage: null,
      });
    }
  }

  // Anonymous (no-session) probes are only meaningful for *incomplete*
  // registrations. If the profile is already complete, return a neutral
  // response — the client will route the user to login on its own.
  if (!user && profile.registration_stage >= 4) {
    return NextResponse.json({
      stage: profile.registration_stage,
      userId: null,
      status: profile.status,
      requiresLogin: true,
    });
  }

  return NextResponse.json({
    stage: profile.registration_stage,
    userId: profile.user_id,
    status: profile.status,
  });
}
