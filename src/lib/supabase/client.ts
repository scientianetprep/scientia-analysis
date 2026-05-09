import { createBrowserClient as _createSupabaseBrowserClient } from "@supabase/ssr";
import { clientEnv } from "@/lib/env";

function buildClient() {
  return _createSupabaseBrowserClient(
    clientEnv.NEXT_PUBLIC_SUPABASE_URL,
    clientEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}

/** Original name kept for backward compatibility */
export function createBrowserClientFn() {
  return buildClient();
}

/** Conventional alias for Next.js app router */
export function createBrowserClient() {
  return buildClient();
}

/** Standard alias used throughout the app */
export function createClient() {
  return buildClient();
}