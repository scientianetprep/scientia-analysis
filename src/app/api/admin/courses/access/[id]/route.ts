import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/supabase/require-admin";
import { createServerClientFn } from "@/lib/supabase/server";

const ALLOWED_TIERS = ["free", "basic", "premium", "all"] as const;

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin({ context: "api" });
    const { id } = await params;
    const { is_active, access_tier } = await req.json();
    const supabase = await createServerClientFn();

    const update: Record<string, unknown> = {};

    if (typeof is_active === "boolean") {
      update.is_active = is_active;
      update.revoked_at = is_active ? null : new Date().toISOString();
    }

    if (access_tier !== undefined) {
      if (!ALLOWED_TIERS.includes(access_tier)) {
        return NextResponse.json(
          { error: `access_tier must be one of ${ALLOWED_TIERS.join(", ")}` },
          { status: 400 }
        );
      }
      update.access_tier = access_tier;
    }

    if (Object.keys(update).length === 0) {
      return NextResponse.json({ error: "No updatable fields provided" }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("course_access_grants")
      .update(update)
      .eq("id", id)
      .select("*, profiles!course_access_grants_user_profile_fkey(full_name, email), courses(title)")
      .single();

    if (error) throw error;
    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
