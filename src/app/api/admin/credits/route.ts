import { NextRequest, NextResponse } from "next/server";
import { createServerClientFn } from "@/lib/supabase/server";
import { adminClient as service } from "@/lib/supabase/admin";

const PAGE_SIZE = 60;

// ─── GET — Admin ledger: all credit transactions with student & performer info ─
export async function GET(req: NextRequest) {
  const supabase = await createServerClientFn();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: p } = await supabase
    .from("profiles")
    .select("role")
    .eq("user_id", user.id)
    .single();
  if (!p || !["admin", "super_admin"].includes(p.role))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const url = new URL(req.url);
  const page = Math.max(0, parseInt(url.searchParams.get("page") ?? "0", 10));
  const search = (url.searchParams.get("search") ?? "").trim().toLowerCase();

  const from = page * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const { data: txns, count, error } = await service
    .from("admin_credit_ledger")
    .select("id, user_id, delta, reason, ref_id, ref_type, note, created_by, created_at", {
      count: "exact",
    })
    .order("created_at", { ascending: false })
    .range(from, to);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!txns?.length) return NextResponse.json({ transactions: [], total: count ?? 0 });

  // Join profiles for students + performers in one shot
  const studentIds = [...new Set(txns.map((t) => t.user_id))];
  const performerIds = [...new Set(txns.map((t) => t.created_by).filter(Boolean))] as string[];
  const allIds = [...new Set([...studentIds, ...performerIds])];

  const [{ data: profiles }, { data: accounts }] = await Promise.all([
    service
      .from("profiles")
      .select("user_id, full_name, username, email")
      .in("user_id", allIds),
    service
      .from("credit_accounts")
      .select("user_id, balance")
      .in("user_id", studentIds),
  ]);

  const profileMap: Record<string, { full_name: string; username: string; email: string }> = {};
  for (const pr of profiles ?? [])
    profileMap[pr.user_id] = { full_name: pr.full_name, username: pr.username, email: pr.email };

  const balanceMap: Record<string, number> = {};
  for (const a of accounts ?? []) balanceMap[a.user_id] = a.balance;

  const transactions = txns.map((t) => ({
    ...t,
    student: profileMap[t.user_id] ?? null,
    performer: t.created_by ? (profileMap[t.created_by] ?? null) : null,
    current_balance: balanceMap[t.user_id] ?? null,
  }));

  // In-memory search (cross-field, post-join)
  const filtered = search
    ? transactions.filter(
        (t) =>
          t.student?.full_name?.toLowerCase().includes(search) ||
          t.student?.username?.toLowerCase().includes(search) ||
          t.student?.email?.toLowerCase().includes(search) ||
          t.reason?.toLowerCase().includes(search) ||
          t.note?.toLowerCase().includes(search) ||
          t.ref_type?.toLowerCase().includes(search)
      )
    : transactions;

  return NextResponse.json({ transactions: filtered, total: count ?? 0 });
}

// ─── POST — Admin manual credit adjustment (existing handler) ─────────────────

export async function POST(req: NextRequest) {
  const supabase = await createServerClientFn();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: p } = await supabase
    .from("profiles")
    .select("role")
    .eq("user_id", user.id)
    .single();
  if (!p || !["admin", "super_admin"].includes(p.role))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { userId, delta, reason, note } = (await req.json()) as {
    userId: string;
    delta: number;
    reason: string;
    note?: string;
  };
  if (!userId || typeof delta !== "number" || delta === 0)
    return NextResponse.json(
      { error: "userId and non-zero delta required" },
      { status: 400 }
    );

  const amount = Math.abs(delta);

  if (delta > 0) {
    const { error } = await service.rpc("add_credits", {
      p_user_id: userId,
      p_amount: amount,
      p_reason: reason || "admin_adjustment",
      p_note: note ?? null,
      p_actor: user.id,
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  } else {
    const { error } = await service.rpc("spend_credits", {
      p_user_id: userId,
      p_amount: amount,
      p_ref_id: null,
      p_ref_type: null,
      p_note: `Admin deduction: ${note || reason}`,
      p_actor: user.id, // Mark as admin action
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await service.from("admin_audit_log").insert({
    admin_id: user.id,
    action: "credit_adjustment",
    target_user_id: userId,
    metadata: { delta, reason, note },
  });

  return NextResponse.json({ ok: true });
}
