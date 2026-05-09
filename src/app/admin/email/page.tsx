import "server-only";
import { requireAdmin } from "@/lib/supabase/require-admin";
import { createClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";
import { EmailComposerClient } from "./email-composer-client";

export const metadata = { title: "Email Composer — Admin" };
export const dynamic = "force-dynamic";

export default async function AdminEmailPage() {
  await requireAdmin();
  
  const adminClient = createClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY
  );

  const { data: users } = await adminClient
    .from("profiles")
    .select("user_id, full_name, email")
    .eq("role", "student")
    .eq("status", "active")
    .order("full_name")
    .limit(500);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl md:text-2xl font-poppins font-semibold text-on-surface tracking-tight">
          Email composer
        </h1>
        <p className="text-sm text-on-surface-variant">
          Send official communications and updates via email.
        </p>
      </div>

      <EmailComposerClient users={users || []} />
    </div>
  );
}
