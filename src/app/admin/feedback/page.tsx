import "server-only";
import { requireAdmin } from "@/lib/supabase/require-admin";
import { createClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";
import { FeedbackClient } from "./feedback-client";

export const metadata = { title: "Feedback — Admin" };
export const dynamic = "force-dynamic";

export default async function AdminFeedbackPage() {
  await requireAdmin();
  
  const adminClient = createClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY
  );

  const { data: feedback, error } = await adminClient
    .from("feedback")
    .select("*, profiles!feedback_user_id_fkey(full_name, email)")
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl md:text-2xl font-poppins font-semibold text-on-surface tracking-tight">
          Feedback
        </h1>
        <p className="text-sm text-on-surface-variant">
          Review ratings and messages from students.
        </p>
      </div>

      <FeedbackClient initialFeedback={feedback || []} />
    </div>
  );
}
