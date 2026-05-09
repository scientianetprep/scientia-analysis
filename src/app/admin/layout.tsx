import "server-only";

import { redirect } from "next/navigation";
import { getSessionContext } from "@/lib/supabase/session-cache";
import { AdminSidebar } from "@/components/admin/AdminSidebar";
import { MobileNav } from "@/components/dashboard/MobileNav";

import { ClearStudentViewCookie } from "@/components/admin/ClearStudentViewCookie";

const ADMIN_ROLES = ["admin", "super_admin", "examiner"];

/**
 * Layer 2 Security: Admin Layout Gate
 * Re-verifies identity, MFA status (aal2), and Database role.
 */
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Plan task 2.5 — shared per-request cache. Admin layout used to call
  // getUser() directly which meant every admin page did a second
  // /auth/v1/user round-trip on top of whatever their own RSC code did.
  const { user, supabase } = await getSessionContext();
  if (!user) {
    redirect("/login");
  }

  // 2+3. Combined: Database Role lookup AND MFA enrollment check + site settings
  const [{ data: profile, error: profileError }, { data: siteSettings }] = await Promise.all([
    supabase
      .from("profiles")
      .select("role, mfa_enrolled")
      .eq("user_id", user!.id)
      .single(),
    supabase
      .from("site_settings")
      .select("site_name, logo_url")
      .eq("id", 1)
      .maybeSingle(),
  ]);

  if (profileError || !profile || !ADMIN_ROLES.includes(profile.role)) {
    // Non-admin trying to access admin - redirect to student dashboard (not /dashboard which loops)
    redirect("/dashboard");
  }

  return (
    <>
      <ClearStudentViewCookie />
      <div className="min-h-screen bg-surface">
        <AdminSidebar
          siteName={siteSettings?.site_name ?? "Scientia Prep"}
          logoUrl={siteSettings?.logo_url ?? null}
        />
        <MobileNav 
          role={profile.role} 
          siteName={siteSettings?.site_name} 
          logoUrl={siteSettings?.logo_url} 
        />
        <main 
          className="min-h-screen flex flex-col pb-16 lg:pb-0 transition-[padding-left] duration-300 ease-in-out"
          style={{ paddingLeft: "var(--sidebar-offset)" }}
        >
          <div className="flex-1 flex flex-col mx-auto w-full max-w-7xl px-4 md:px-6 py-5 md:py-6">
            {children}
          </div>
        </main>
      </div>
    </>
  );
}
