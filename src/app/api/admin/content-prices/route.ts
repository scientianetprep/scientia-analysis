import { NextRequest, NextResponse } from "next/server";
import { createServerClientFn } from "@/lib/supabase/server";
import { adminClient as service } from "@/lib/supabase/admin";

async function requireAdmin() {
  const supabase = await createServerClientFn();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { user: null, supabase };
  const { data: p } = await supabase
    .from("profiles")
    .select("role")
    .eq("user_id", user.id)
    .single();
  if (!p || !["admin", "super_admin"].includes(p.role))
    return { user: null, supabase };
  return { user, supabase };
}

export async function GET(req: NextRequest) {
  const { user, supabase } = await requireAdmin();
  if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const type = req.nextUrl.searchParams.get("type");
  let q = supabase
    .from("content_prices")
    .select("id, content_type, content_id, credit_cost, is_free, updated_at");
  if (type) q = q.eq("content_type", type);

  const { data, error } = await q.order("updated_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

export async function POST(req: NextRequest) {
  const { user } = await requireAdmin();
  if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { contentType, contentId, creditCost, isFree } = await req.json();
  if (!contentType || !contentId || creditCost == null)
    return NextResponse.json(
      { error: "contentType, contentId, creditCost required" },
      { status: 400 }
    );

  const { data, error } = await service
    .from("content_prices")
    .upsert(
      {
        content_type: contentType,
        content_id: contentId,
        credit_cost: creditCost,
        is_free: isFree ?? false,
        updated_by: user.id,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "content_type,content_id" }
    )
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
