import { NextRequest, NextResponse } from "next/server";
import { createServerClientFn } from "@/lib/supabase/server";
import { adminClient as service } from "@/lib/supabase/admin";

async function requireAdmin() {
  const supabase = await createServerClientFn();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: p } = await supabase
    .from("profiles")
    .select("role")
    .eq("user_id", user.id)
    .single();
  return p && ["admin", "super_admin"].includes(p.role) ? user : null;
}

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const supabase = await createServerClientFn();
  const { data } = await supabase
    .from("platform_settings")
    .select("value")
    .eq("key", "credit_exchange_rate")
    .single();
  return NextResponse.json({ pkr_per_credit: data?.value?.pkr_per_credit ?? 100 });
}

export async function PATCH(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { pkr_per_credit } = await req.json();
  if (typeof pkr_per_credit !== "number" || pkr_per_credit <= 0)
    return NextResponse.json(
      { error: "pkr_per_credit must be a positive number" },
      { status: 400 }
    );
  await service.from("platform_settings").upsert(
    {
      key: "credit_exchange_rate",
      value: { pkr_per_credit },
      updated_at: new Date().toISOString(),
    },
    { onConflict: "key" }
  );
  return NextResponse.json({ ok: true });
}
