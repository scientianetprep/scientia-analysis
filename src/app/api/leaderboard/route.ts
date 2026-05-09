import { NextRequest, NextResponse } from "next/server";
import { createServerClientFn } from "@/lib/supabase/server";

// Fetches a leaderboard (per-test if ?testId=, otherwise overall by
// aggregate_marks). The previous implementation chained implicit PostgREST
// embeds across three tables that share `user_id` but have no direct FK
// path between them (scores/academic_info → profiles and
// scores/academic_info → user_preferences). After migration 019 added
// explicit profiles FKs, those embeds either became ambiguous or never
// resolved at all — which is what caused the student-panel leaderboard
// crash tracked as plan-P5.1.
//
// Strategy here: keep the explicit profile embed for names (unambiguous
// via the new `*_user_profile_fkey` constraints) and pull user_preferences
// in a second `.in()` query, merging in JS. Still only two round-trips.
export async function GET(req: NextRequest) {
  const supabase = await createServerClientFn();
  const { searchParams } = new URL(req.url);
  const testId = searchParams.get("testId");
  const limit = Math.min(parseInt(searchParams.get("limit") || "100", 10) || 100, 500);

  try {
    type Row = {
      user_id: string;
      score: number;
      name: string | null;
    };

    let rows: Row[] = [];

    if (testId) {
      // Per-test leaderboard.
      const { data, error } = await supabase
        .from("scores")
        .select("percentage, user_id, profiles!scores_user_profile_fkey(full_name)")
        .eq("test_id", testId)
        .order("percentage", { ascending: false })
        .limit(limit);
      if (error) throw error;
      rows = (data ?? []).map((r: any) => ({
        user_id: r.user_id,
        score: Math.round(r.percentage),
        name: r.profiles?.full_name ?? null,
      }));
    } else {
      // Overall leaderboard by aggregate. academic_info has no FK to
      // profiles so we do an explicit 2nd fetch for names instead of
      // an embed.
      const { data, error } = await supabase
        .from("academic_info")
        .select("aggregate_marks, user_id")
        .not("aggregate_marks", "is", null)
        .order("aggregate_marks", { ascending: false })
        .limit(limit);
      if (error) throw error;
      const userIds = (data ?? []).map((r: any) => r.user_id);
      const { data: profs } = await supabase
        .from("profiles")
        .select("user_id, full_name")
        .in("user_id", userIds.length ? userIds : ["00000000-0000-0000-0000-000000000000"]);
      const nameMap = new Map((profs ?? []).map((p: any) => [p.user_id, p.full_name]));
      rows = (data ?? []).map((r: any) => ({
        user_id: r.user_id,
        score: Math.round(r.aggregate_marks),
        name: nameMap.get(r.user_id) ?? null,
      }));
    }

    // Pull preferences in bulk (anonymous leaderboard opt-in). Single
    // round-trip regardless of leaderboard length.
    const userIds = rows.map((r) => r.user_id);
    const { data: prefs } = await supabase
      .from("user_preferences")
      .select("user_id, anonymous_leaderboard")
      .in("user_id", userIds.length ? userIds : ["00000000-0000-0000-0000-000000000000"]);
    const anonMap = new Map(
      (prefs ?? []).map((p: any) => [p.user_id, Boolean(p.anonymous_leaderboard)])
    );

    const results = rows.map((row, idx) => ({
      rank: idx + 1,
      name: anonMap.get(row.user_id)
        ? `Scholar #${row.user_id.slice(0, 4)}`
        : row.name || "Unknown",
      score: row.score,
      isCurrent: false, // client decorates with current-user flag
    }));

    return NextResponse.json(results);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
