import { requireAdmin } from "@/lib/supabase/require-admin";
import { createServerClientFn } from "@/lib/supabase/server";
import { AccessGrantsClient } from "./access-grants-client";

export const metadata = { title: "Course Access — Admin" };

export default async function CourseAccessPage() {
  await requireAdmin();
  const supabase = await createServerClientFn();

  const { data: grants, error } = await supabase
    .from("course_access_grants")
    .select("*, profiles!course_access_grants_user_profile_fkey(full_name, email), courses(title)")
    .order("granted_at", { ascending: false });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl md:text-2xl font-poppins font-semibold text-on-surface tracking-tight">
          Course access
        </h1>
        <p className="text-sm text-on-surface-variant">
          Manage and revoke document access for specific students.
        </p>
      </div>

      <AccessGrantsClient initialGrants={grants || []} />
    </div>
  );
}
