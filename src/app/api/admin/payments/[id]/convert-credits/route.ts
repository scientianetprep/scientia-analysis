import { NextRequest, NextResponse } from "next/server";
import { createServerClientFn } from "@/lib/supabase/server";
import { adminClient as service } from "@/lib/supabase/admin";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createServerClientFn();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("user_id", user.id)
    .single();
  if (!profile || !["admin", "super_admin"].includes(profile.role))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { data: payment } = await service
    .from("payments")
    .select("id, user_id, amount, status, is_converted")
    .eq("id", id)
    .single();
  if (!payment)
    return NextResponse.json({ error: "Payment not found" }, { status: 404 });
  if (payment.status === "refunded")
    return NextResponse.json(
      { error: "Cannot convert a refunded payment" },
      { status: 400 }
    );

  const { data: rateSetting } = await service
    .from("platform_settings")
    .select("value")
    .eq("key", "credit_exchange_rate")
    .single();
  const pkrPerCredit: number = rateSetting?.value?.pkr_per_credit ?? 100;

  const body = await req.json().catch(() => ({}));
  const credits =
    typeof body.creditOverride === "number"
      ? body.creditOverride
      : Math.floor(Number(payment.amount) / pkrPerCredit);

  if (credits <= 0)
    return NextResponse.json(
      { error: "Credit amount must be positive" },
      { status: 400 }
    );

  if (payment.is_converted) {
    return NextResponse.json(
      { error: "Credits have already been issued for this payment" },
      { status: 400 }
    );
  }

  if (payment.status !== "paid") {
    await service
      .from("payments")
      .update({
        status: "paid",
        marked_paid_by: user.id,
        marked_paid_at: new Date().toISOString(),
        is_converted: true,
      })
      .eq("id", id);
  } else {
    await service
      .from("payments")
      .update({ is_converted: true })
      .eq("id", id);
  }

  const { error: creditErr } = await service.rpc("add_credits", {
    p_user_id: payment.user_id,
    p_amount: credits,
    p_reason: "payment_conversion",
    p_ref_id: payment.id,
    p_ref_type: "payment",
    p_note: `${payment.amount} PKR @ ${pkrPerCredit} PKR/credit`,
    p_actor: user.id,
  });
  if (creditErr)
    return NextResponse.json({ error: creditErr.message }, { status: 500 });

  await service.from("admin_audit_log").insert({
    admin_id: user.id,
    action: "payment_to_credits",
    target_user_id: payment.user_id,
    metadata: {
      payment_id: id,
      amount: payment.amount,
      credits_issued: credits,
    },
  });

  return NextResponse.json({ ok: true, credits_issued: credits });
}
