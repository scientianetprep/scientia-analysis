import { createServerClientFn } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function POST() {
  const supabase = await createServerClientFn();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const today = new Date().toISOString().split("T")[0];

  try {
    // We use a service role client or a RPC to handle streak logic safely
    // Actually, we can do it with the user's client if we have a proper RLS policy or RPC.
    // Let's use RPC for atomicity if possible, or just standard insert/update.
    
    const { data: streak } = await supabase
      .from("student_streaks")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!streak) {
      // First time
      await supabase.from("student_streaks").insert({
        user_id: user.id,
        current_streak: 1,
        longest_streak: 1,
        last_active_date: today,
      });
      return NextResponse.json({ success: true, current_streak: 1 });
    }

    const lastDate = streak.last_active_date;
    const diffDays = lastDate
      ? Math.floor((new Date(today).getTime() - new Date(lastDate).getTime()) / (1000 * 60 * 60 * 24))
      : 999;

    let newStreak = streak.current_streak;
    if (diffDays === 1) {
      newStreak += 1;
    } else if (diffDays > 1) {
      newStreak = 1;
    }
    // if diffDays === 0, keep same streak

    await supabase.from("student_streaks").update({
      current_streak: newStreak,
      longest_streak: Math.max(streak.longest_streak, newStreak),
      last_active_date: today,
      updated_at: new Date().toISOString(),
    }).eq("user_id", user.id);

    return NextResponse.json({ success: true, current_streak: newStreak });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
