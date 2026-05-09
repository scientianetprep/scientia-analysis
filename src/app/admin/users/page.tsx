import "server-only";
import { requireAdmin } from "@/lib/supabase/require-admin";
import { createClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";
import { UsersClient } from "./users-client";

export const metadata = { title: "User Management — Admin" };
export const revalidate = 3600; // ISR: revalidate every hour
export const dynamic = "force-dynamic";

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; status?: string; role?: string; mfa?: string; q?: string }>;
}) {
  await requireAdmin();
  const { page = "1", status, role, mfa, q } = await searchParams;
  const pageNum = Math.max(1, parseInt(page));
  const pageSize = 30;
  const from = (pageNum - 1) * pageSize;

  // Must use service role — anon key RLS blocks cross-user profile reads
  const adminClient = createClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY
  );

  let query = adminClient
    .from("profiles")
    .select(
      "user_id, full_name, email, phone, cnic, city, whatsapp_number, username, role, status, created_at, mfa_enrolled, registration_stage, course_tier",
      { count: "exact" }
    )
    .order("created_at", { ascending: false });

  if (status && status !== "all") query = query.eq("status", status);
  if (role && role !== "all") query = query.eq("role", role);
  if (mfa === "enabled") query = query.eq("mfa_enrolled", true);
  if (mfa === "disabled") query = query.eq("mfa_enrolled", false);
  if (q) {
    const term = `*${q}*`;
    query = query.or(`full_name.ilike.${term},email.ilike.${term},cnic.ilike.${term},username.ilike.${term},phone.ilike.${term}`);
  }

  query = query.range(from, from + pageSize - 1);

  const [{ data: users, count }, { data: tiers }] = await Promise.all([
    query,
    adminClient.from("saved_course_tiers").select("tier").order("tier")
  ]);

  const totalPages = Math.ceil((count || 0) / pageSize);
  const savedTiers = (tiers || []).map(t => t.tier);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl md:text-2xl font-poppins font-semibold text-on-surface tracking-tight">
          Users
        </h1>
        <p className="text-sm text-on-surface-variant">
          Manage users, roles, approvals, and access. {count ?? 0} total.
        </p>
      </div>

      <UsersClient
        initialUsers={users || []}
        totalPages={totalPages}
        currentPage={pageNum}
        totalCount={count ?? 0}
        savedTiers={savedTiers}
        initialFilters={{
          q: q ?? "",
          status: status ?? "all",
          role: role ?? "all",
          mfa: mfa ?? "all",
        }}
      />
    </div>
  );
}
