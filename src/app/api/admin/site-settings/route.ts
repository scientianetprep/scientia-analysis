import "server-only";

import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/supabase/require-admin";
import { createServerClientFn } from "@/lib/supabase/server";

/**
 * GET  /api/admin/site-settings  — returns the singleton row.
 * PATCH /api/admin/site-settings — updates logo_url, favicon_url, site_name,
 * support_email, primary_color. Admin only.
 */

export async function GET() {
  try {
    await requireAdmin({ context: "api" });
    const supabase = await createServerClientFn();
    const { data, error } = await supabase
      .from("site_settings")
      .select("*")
      .eq("id", 1)
      .maybeSingle();
    if (error) throw error;
    // Fall back to a stub when the singleton row has not been seeded yet,
    // so the admin UI never renders with a blank/error state.
    return NextResponse.json(
      data ?? {
        id: 1,
        site_name: "Scientia Prep",
        logo_url: null,
        favicon_url: null,
        support_email: null,
        primary_color: null,
      }
    );
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

const ALLOWED_FIELDS = [
  "site_name",
  "logo_url",
  "favicon_url",
  "support_email",
  "primary_color",
] as const;

export async function PATCH(req: NextRequest) {
  try {
    const result = await requireAdmin({ context: "api" });
    if (result instanceof Response) return result;
    const { user } = result;

    const body = await req.json();
    const update: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
      updated_by: user.id,
    };

    for (const key of ALLOWED_FIELDS) {
      if (body[key] !== undefined) {
        const value = body[key];
        // Treat "" as clearing the field (except site_name which is NOT NULL).
        if (key === "site_name") {
          if (typeof value !== "string" || !value.trim()) {
            return NextResponse.json(
              { error: "site_name must be a non-empty string" },
              { status: 400 }
            );
          }
          update[key] = value.trim();
        } else {
          update[key] = typeof value === "string" && value.trim() ? value.trim() : null;
        }
      }
    }

    const supabase = await createServerClientFn();
    // Upsert on the singleton id guarantees the row exists even in a fresh
    // environment where migration 094 hasn't run yet — the old `.update()`
    // path would fail with "Cannot coerce the result to a single JSON
    // object" when site_settings was empty (bug #19 on the live site).
    const { data, error } = await supabase
      .from("site_settings")
      .upsert({ id: 1, ...update }, { onConflict: "id" })
      .select("*")
      .single();
    if (error) throw error;
    return NextResponse.json(data);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
