import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/supabase/require-admin";
import { createClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";

const adminClient = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY
);

/**
 * PATCH /api/admin/payments/[id]
 * Update a payment: mark as paid, pending, rejected, add notes, receipt_id.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const result = await requireAdmin({ context: "api" });
    if (result instanceof Response) return result;
    const { user } = result;
    const { id } = await params;
    const body = await req.json();
    const { status, notes, receipt_id, payment_method } = body;

    const updatePayload: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (status !== undefined) updatePayload.status = status;
    if (notes !== undefined) updatePayload.notes = notes;
    if (receipt_id !== undefined) updatePayload.receipt_id = receipt_id;
    if (payment_method !== undefined) updatePayload.payment_method = payment_method;

    if (status === "paid") {
      updatePayload.marked_paid_by = user.id;
      updatePayload.marked_paid_at = new Date().toISOString();
    }

    const { data, error } = await adminClient
      .from("payments")
      .update(updatePayload)
      .eq("id", id)
      .select("*, profiles!payments_user_profile_fkey(full_name)")
      .single();

    if (error) throw error;

    // Audit log
    await adminClient.from("admin_audit_log").insert({
      admin_id: user.id,
      action: `Updated payment ${id} → status: ${status || "unchanged"}`,
      target_user_id: data.user_id,
      metadata: { payment_id: id, changes: updatePayload },
    });

    return NextResponse.json({ success: true, payment: data });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

/**
 * DELETE /api/admin/payments/[id]
 * Remove a manually recorded payment (only for manual entries).
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const result = await requireAdmin({ context: "api" });
    if (result instanceof Response) return result;
    const { user } = result;
    const { id } = await params;

    const { data: existing, error: fetchErr } = await adminClient
      .from("payments")
      .select("user_id, amount, payment_method")
      .eq("id", id)
      .single();

    if (fetchErr || !existing) {
      return NextResponse.json({ error: "Payment not found" }, { status: 404 });
    }

    const { error } = await adminClient.from("payments").delete().eq("id", id);
    if (error) throw error;

    await adminClient.from("admin_audit_log").insert({
      admin_id: user.id,
      action: `Deleted payment record ${id}`,
      target_user_id: existing.user_id,
      metadata: { payment_id: id, amount: existing.amount },
    });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
