import { NextRequest, NextResponse } from "next/server";
import { createServerClientFn } from "@/lib/supabase/server";

export async function PATCH(req: NextRequest) {
  const supabase = await createServerClientFn();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { mfa_prompt_dismissed, anonymous_leaderboard } = body;

    const updates: any = {
      user_id: user.id,
      updated_at: new Date().toISOString()
    };

    if (mfa_prompt_dismissed !== undefined) updates.mfa_prompt_dismissed = mfa_prompt_dismissed;
    if (anonymous_leaderboard !== undefined) updates.anonymous_leaderboard = anonymous_leaderboard;

    const { error } = await supabase
      .from("user_preferences")
      .upsert(updates);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  const supabase = await createServerClientFn();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { data, error } = await supabase
      .from("user_preferences")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    if (error) throw error;

    return NextResponse.json(data || { 
      mfa_prompt_dismissed: false, 
      anonymous_leaderboard: false 
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
