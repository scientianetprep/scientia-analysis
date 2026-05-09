import { NextRequest, NextResponse } from "next/server";
import { createServerClientFn } from "@/lib/supabase/server";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const { userId } = await params;
  const supabase = await createServerClientFn();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: p } = await supabase
    .from("profiles")
    .select("role")
    .eq("user_id", user.id)
    .single();
  if (!p || !["admin", "super_admin"].includes(p.role))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { data: account } = await supabase
    .from("credit_accounts")
    .select("balance, updated_at")
    .eq("user_id", userId)
    .maybeSingle();

  const { data: transactions } = await supabase
    .from("credit_transactions")
    .select("id, delta, reason, ref_id, ref_type, note, created_at, created_by")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(50);

  return NextResponse.json({
    balance: account?.balance ?? 0,
    updated_at: account?.updated_at ?? null,
    transactions: transactions ?? [],
  });
}
