import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/supabase/require-admin";
import { createClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";

const adminClient = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY
);

/**
 * GET /api/admin/payments
 * Fetch all payments with user profile joins. Supports ?user_id= filter.
 */
export async function GET(req: NextRequest) {
  try {
    await requireAdmin({ context: "api" });
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("user_id");
    const status = searchParams.get("status");
    const page = parseInt(searchParams.get("page") || "1");
    const pageSize = 50;
    const from = (page - 1) * pageSize;

    let query = adminClient
      .from("payments")
      .select(
        "id, user_id, amount, currency, status, receipt_id, payment_method, notes, marked_paid_at, created_at, updated_at, profiles!payments_user_profile_fkey(full_name, username, cnic)",
        { count: "exact" }
      )
      .order("created_at", { ascending: false })
      .range(from, from + pageSize - 1);

    if (userId) query = query.eq("user_id", userId);
    if (status) query = query.eq("status", status);

    const { data, error, count } = await query;
    if (error) throw error;

    return NextResponse.json({ payments: data, total: count });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

/**
 * POST /api/admin/payments
 * Manually record a payment for a student.
 * Body: { user_id, amount, currency?, receipt_id?, payment_method, notes? }
 */
export async function POST(req: NextRequest) {
  try {
    const result = await requireAdmin({ context: "api" });
    if (result instanceof Response) return result;
    const { user } = result;
    const body = await req.json();
    const { user_id, amount, currency = "PKR", receipt_id, payment_method = "manual", notes } = body;

    if (!user_id || !amount) {
      return NextResponse.json({ error: "user_id and amount are required" }, { status: 400 });
    }

    const { data, error } = await adminClient
      .from("payments")
      .insert({
        user_id,
        amount: parseFloat(amount),
        currency,
        status: "paid",
        receipt_id: receipt_id || null,
        payment_method,
        notes: notes || null,
        marked_paid_by: user.id,
        marked_paid_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) throw error;

    // Log to audit trail
    await adminClient.from("admin_audit_log").insert({
      admin_id: user.id,
      action: `Manually recorded payment of ${amount} ${currency} for user ${user_id}`,
      target_user_id: user_id,
      metadata: { payment_id: data.id, amount, currency, payment_method, receipt_id },
    });

    return NextResponse.json({ success: true, payment: data });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
