// GET /api/credits/balance
// Returns the authenticated student's current credit balance.
import { NextResponse } from "next/server";
import { createServerClientFn } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createServerClientFn();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data } = await supabase
    .from("credit_accounts")
    .select("balance, updated_at")
    .eq("user_id", user.id)
    .maybeSingle();

  return NextResponse.json({
    balance: data?.balance ?? 0,
    updated_at: data?.updated_at ?? null,
  });
}
