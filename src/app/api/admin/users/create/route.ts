import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/supabase/require-admin";
import { createClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";

export async function POST(req: NextRequest) {
  try {
    const result = await requireAdmin({ context: "api" });
    if (result instanceof Response) return result;
    const { user: adminSession } = result;
    const { email, password, fullName, phone, role } = await req.json();

    if (!email || !password || !fullName || !role) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Use service role key to manage users
    const supabaseAdmin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Create user in auth schema
    const { data: userData, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: fullName,
        whatsapp_number: phone || null,
      },
    });

    if (createError) throw createError;

    // The trigger auto-creates the profile with status 'pending'. We need to update it.
    if (userData.user) {
      const { error: updateError } = await supabaseAdmin
        .from("profiles")
        .update({
          role: role,
          status: "active", // Manually added users are active by default
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", userData.user.id);
        
      if (updateError) throw updateError;
    }

    // Log the action
    await supabaseAdmin.from("admin_audit_log").insert({
      admin_id: adminSession.id,
      action: `Manually created user: ${email} with role: ${role}`,
      ip_address: req.headers.get("x-forwarded-for"),
    });

    return NextResponse.json({ success: true, user: userData.user });

  } catch (error: any) {
    console.error("Admin Create User Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
