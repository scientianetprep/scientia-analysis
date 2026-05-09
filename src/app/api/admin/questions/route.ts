import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/supabase/require-admin";
import { createServerClientFn } from "@/lib/supabase/server";
import { sanitizeObject } from "@/lib/sanitize";

export async function GET(req: NextRequest) {
  try {
    await requireAdmin({ context: "api" });
    const supabase = await createServerClientFn();
    const { searchParams } = new URL(req.url);
    const subject = searchParams.get("subject");
    
    let query = supabase
      .from("questions")
      .select("*")
      .neq("status", "retired")
      .order("created_at", { ascending: false });
    
    if (subject) query = query.eq("subject", subject);

    const { data, error } = await query;

    if (error) throw error;
    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const result = await requireAdmin({ context: "api" });
    if (result instanceof Response) return result;
    const { user: adminUser } = result;
    const body = await req.json();
    const sanitizedBody = sanitizeObject(body);
    const supabase = await createServerClientFn();

    const { data, error } = await supabase
      .from("questions")
      .insert({
        ...sanitizedBody,
        created_by: adminUser.id
      })
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
