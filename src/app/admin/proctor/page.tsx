import "server-only";
import { requireAdmin } from "@/lib/supabase/require-admin";
import { createClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";
import { ProctorDashboard } from "@/components/admin/ProctorDashboard";

export const metadata = { title: "Live Proctoring — Admin" };
export const dynamic = "force-dynamic";

export default async function AdminProctorPage() {
  await requireAdmin();

  const adminClient = createClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY
  );

  const { data: sessions } = await adminClient
    .from("exam_sessions")
    .select(
      `id, user_id, test_id, status, started_at, ended_at, violation_count,
       profiles!exam_sessions_user_profile_fkey(full_name),
       tests!exam_sessions_test_id_fkey(name)`
    )
    .order("started_at", { ascending: false })
    .limit(100);

  const mapped = (sessions || []).map((s: any) => ({
    ...s,
    candidate_name: s.profiles?.full_name ?? "Unknown",
    test_name: s.tests?.name ?? s.test_id?.slice(0, 8),
  }));

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl md:text-2xl font-poppins font-semibold text-on-surface tracking-tight">
          Live proctoring
        </h1>
        <p className="text-sm text-on-surface-variant">
          Real-time monitoring of active exam sessions. Violations highlighted automatically.
        </p>
      </div>
      <ProctorDashboard initialSessions={mapped} />
    </div>
  );
}
