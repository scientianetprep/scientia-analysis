import { NextRequest, NextResponse } from "next/server";
import { createServerClientFn } from "@/lib/supabase/server";
import { adminClient as service } from "@/lib/supabase/admin";

export async function POST(req: NextRequest) {
  const supabase = await createServerClientFn();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { contentType, contentId } = (await req.json()) as {
    contentType: "lesson" | "test" | "course";
    contentId: string;
  };
  if (!contentType || !contentId)
    return NextResponse.json(
      { error: "contentType and contentId required" },
      { status: 400 }
    );

  // Idempotent: if already unlocked, skip the charge.
  const { data: existing } = await service
    .from("content_unlocks")
    .select("id")
    .eq("user_id", user.id)
    .eq("content_type", contentType)
    .eq("content_id", contentId)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ ok: true, message: "Already unlocked" });
  }

  // Look up the price.
  const { data: price } = await service
    .from("content_prices")
    .select("credit_cost, is_free")
    .eq("content_type", contentType)
    .eq("content_id", contentId)
    .maybeSingle();

  // Free content — record unlock at 0 cost so subsequent checks are instant.
  if (!price || price.is_free || price.credit_cost === 0) {
    await service.from("content_unlocks").upsert(
      {
        user_id: user.id,
        content_type: contentType,
        content_id: contentId,
        credits_spent: 0,
      },
      { onConflict: "user_id,content_type,content_id", ignoreDuplicates: true }
    );
    return NextResponse.json({ ok: true, message: "Free content" });
  }

  // Atomically deduct credits.
  const { error } = await service.rpc("spend_credits", {
    p_user_id: user.id,
    p_amount: price.credit_cost,
    p_ref_id: contentId,
    p_ref_type: contentType,
    p_note: `Unlocked ${contentType}`,
  });

  if (error) {
    const insufficient = error.message.includes("Insufficient");
    return NextResponse.json(
      { error: insufficient ? "Insufficient credits" : error.message },
      { status: insufficient ? 402 : 500 }
    );
  }

  // Record the permanent unlock.
  await service.from("content_unlocks").upsert(
    {
      user_id: user.id,
      content_type: contentType,
      content_id: contentId,
      credits_spent: price.credit_cost,
    },
    { onConflict: "user_id,content_type,content_id", ignoreDuplicates: true }
  );

  return NextResponse.json({ ok: true, credits_deducted: price.credit_cost });
}
