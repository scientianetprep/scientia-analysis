import "server-only";
import { requireAdmin } from "@/lib/supabase/require-admin";
import { createClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";
import { PaymentsClient } from "./payments-client";

export const metadata = { title: "Payment Management — Admin" };
export const dynamic = "force-dynamic";

export default async function AdminPaymentsPage() {
  await requireAdmin();

  const adminClient = createClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY
  );

  // Fetch all payments with user profile joins
  const [{ data: payments }, { data: users }] = await Promise.all([
    adminClient
      .from("payments")
      .select(
        "id, user_id, amount, currency, status, receipt_id, payment_method, notes, marked_paid_at, created_at, updated_at, is_converted, profiles!payments_user_profile_fkey(full_name, username, cnic)"
      )
      .order("created_at", { ascending: false })
      .limit(200),
    adminClient
      .from("profiles")
      .select("user_id, full_name, username")
      .eq("status", "active")
      .order("full_name", { ascending: true }),
  ]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl md:text-2xl font-poppins font-semibold text-on-surface tracking-tight">
          Payments
        </h1>
        <p className="text-sm text-on-surface-variant">
          Track, record, and manage student payments.
        </p>
      </div>

      <PaymentsClient
        initialPayments={(payments as any[]) || []}
        users={(users as any[]) || []}
      />
    </div>
  );
}
