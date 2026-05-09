import { NextRequest, NextResponse } from "next/server";
import { createServerClientFn } from "@/lib/supabase/server";

// "Top winner per test" history feed. Same PostgREST-ambiguity story as
// the main leaderboard route — kept the profile embed (now explicit via
// scores_user_profile_fkey) and pulled user_preferences in a second
// batched query.
export async function GET(_req: NextRequest) {
  const supabase = await createServerClientFn();

  try {
    const { data: scores, error } = await supabase
      .from("scores")
      .select(
        `percentage,
         created_at,
         test_id,
         user_id,
         tests!scores_test_id_fkey(name),
         profiles!scores_user_profile_fkey(full_name)`
      )
      .order("percentage", { ascending: false });

    if (error) throw error;

    // Filter to the single highest-scoring row per test.
    const seen = new Set<string>();
    const winners =
      (scores ?? []).filter((s: any) => {
        if (seen.has(s.test_id)) return false;
        seen.add(s.test_id);
        return true;
      }) ?? [];

    // Batched anonymity preference lookup.
    const userIds = winners.map((w: any) => w.user_id);
    const { data: prefs } = await supabase
      .from("user_preferences")
      .select("user_id, anonymous_leaderboard")
      .in("user_id", userIds.length ? userIds : ["00000000-0000-0000-0000-000000000000"]);
    const anonMap = new Map(
      (prefs ?? []).map((p: any) => [p.user_id, Boolean(p.anonymous_leaderboard)])
    );

    const results = winners.map((row: any) => ({
      testName: row.tests?.name || "Unknown Test",
      winnerName: anonMap.get(row.user_id)
        ? `Scholar #${String(row.user_id).slice(0, 4)}`
        : row.profiles?.full_name || "Unknown",
      score: Math.round(row.percentage),
      date: row.created_at,
    }));

    return NextResponse.json(results);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
