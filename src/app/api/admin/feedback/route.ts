import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/supabase/require-admin";
import { createServerClientFn } from "@/lib/supabase/server";

export async function GET() {
  try {
    await requireAdmin({ context: "api" });
    const supabase = await createServerClientFn();
    const { data: feedback, error } = await supabase
      .from("feedback")
      .select("*, profiles!feedback_user_id_fkey(full_name, email)")
      .order("created_at", { ascending: false });

    if (error) throw error;
    return NextResponse.json(feedback);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
