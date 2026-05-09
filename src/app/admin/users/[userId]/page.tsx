import "server-only";
import { requireAdmin } from "@/lib/supabase/require-admin";
import { createClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";
import { notFound } from "next/navigation";
import { UserDetailClient } from "./user-detail-client";

export const metadata = { title: "User — Admin" };
export const dynamic = "force-dynamic";

export default async function AdminUserDetailPage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  await requireAdmin();
  const { userId } = await params;

  const admin = createClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY
  );

  // Fan out — all independent selects, fetched in parallel.
  const [
    profileRes,
    academicRes,
    paymentsRes,
    sessionsRes,
    scoresRes,
    grantsRes,
  ] = await Promise.all([
    admin
      .from("profiles")
      .select(
        "user_id, full_name, email, username, cnic, whatsapp_number, city, role, status, mfa_enrolled, created_at, registration_stage, avatar_url"
      )
      .eq("user_id", userId)
      .single(),
    admin
      .from("academic_info")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle(),
    admin
      .from("payments")
      .select("id, amount, currency, status, payment_method, receipt_id, notes, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(50),
    admin
      .from("exam_sessions")
      .select("id, test_id, status, started_at, ended_at, violation_count, tests:test_id(name)")
      .eq("user_id", userId)
      .order("started_at", { ascending: false })
      .limit(50),
    admin
      .from("scores")
      .select("id, test_id, correct_count, total_count, percentage, created_at, tests:test_id(name)")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(20),
    admin
      .from("course_access_grants")
      .select("id, course_id, is_active, access_tier, granted_at, revoked_at, courses(title)")
      .eq("user_id", userId)
      .order("granted_at", { ascending: false }),
  ]);

  if (profileRes.error || !profileRes.data) {
    return notFound();
  }

  // PostgREST returns joined FKs as arrays (the canonical PostgREST shape).
  // Flatten here so the client's stricter Session/Score/Grant types hold.
  const pickFirst = <T,>(v: T | T[] | null | undefined): T | null => {
    if (Array.isArray(v)) return v[0] ?? null;
    return v ?? null;
  };

  const sessions = (sessionsRes.data ?? []).map((s: any) => ({
    ...s,
    tests: { name: pickFirst(s.tests)?.name ?? "" },
  }));
  const scores = (scoresRes.data ?? []).map((s: any) => ({
    ...s,
    tests: { name: pickFirst(s.tests)?.name ?? "" },
  }));
  const grants = (grantsRes.data ?? []).map((g: any) => ({
    ...g,
    courses: { title: pickFirst(g.courses)?.title ?? "" },
  }));

  return (
    <UserDetailClient
      profile={profileRes.data}
      academic={academicRes.data ?? null}
      payments={paymentsRes.data ?? []}
      sessions={sessions}
      scores={scores}
      grants={grants}
    />
  );
}
