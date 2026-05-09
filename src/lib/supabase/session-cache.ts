import "server-only";

import { cache } from "react";
import type { User } from "@supabase/supabase-js";
import { createServerClientFn } from "./server";

/**
 * Per-request cache of `supabase.auth.getUser()`.
 *
 * Why this file exists (plan-P2.5 / bug #3):
 * - Every authenticated server component that wanted the current user used
 *   to call `const { data: { user } } = await supabase.auth.getUser()`
 *   directly. Layout.tsx, a handful of child RSCs, and nested cards on the
 *   dashboard each incurred a full Supabase network round-trip (80–150 ms
 *   apiece), because `getUser()` hits `/auth/v1/user` to verify the cookie
 *   server-side — the cookie alone isn't trusted.
 * - React's `cache()` memoises a function within the lifetime of a single
 *   server request, so the first RSC to call `getCachedUser()` pays the
 *   cost and every subsequent caller gets the same Promise back. Since the
 *   auth cookie can only change between requests, this is a safe cache.
 *
 * Use `getCachedUser()` from anywhere server-side that just needs the user.
 * If you need to *mutate* auth state (sign out, refresh tokens, etc.) keep
 * using `createServerClientFn()` directly so the cache stays read-only.
 */
export const getCachedUser = cache(async (): Promise<User | null> => {
  const supabase = await createServerClientFn();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  return data.user;
});

/**
 * Convenience wrapper that returns both the user and the Supabase client
 * from a single call site. The client itself is cheap to re-instantiate
 * (it only wraps cookie accessors) so we don't cache it, but pairing it
 * with `getCachedUser` removes the two-statement pattern that was causing
 * duplicated `getUser` calls in RSCs.
 */
export async function getSessionContext() {
  const [user, supabase] = await Promise.all([
    getCachedUser(),
    createServerClientFn(),
  ]);
  return { user, supabase };
}
