import { createServerClientFn } from "@/lib/supabase/server";
import { Leaderboard } from "@/components/dashboard/Leaderboard";

export default async function LeaderboardPage() {
  const supabase = await createServerClientFn();
  const { data: { user } } = await supabase.auth.getUser();

  return (
    <div className="max-w-3xl mx-auto">
      <Leaderboard currentUserId={user?.id} />
    </div>
  );
}
