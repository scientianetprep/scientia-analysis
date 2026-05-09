import { Sidebar } from "@/components/dashboard/Sidebar";
import { MobileNav } from "@/components/dashboard/MobileNav";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getSessionContext } from "@/lib/supabase/session-cache";
import { PlatformNotifier } from "@/components/dashboard/PlatformNotifier";
import { BrowserWarningBanner } from "@/components/dashboard/BrowserWarningBanner";
import { ActivityPing } from "@/components/dashboard/ActivityPing";
import { PageTransition } from "@/components/PageTransition";
import { DeletionWarningBanner } from "@/components/dashboard/DeletionWarningBanner";
import { AcademicInfoBanner } from "@/components/dashboard/AcademicInfoBanner";

const ADMIN_ROLES = ["admin", "super_admin", "examiner"];

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Plan task 2.5 — pull user + supabase from the per-request cache so any
  // downstream RSC (the test page, analytics page, etc.) that also calls
  // `getCachedUser()` reuses the same /auth/v1/user verification instead
  // of firing a fresh round-trip per component.
  const cookieStore = await cookies();
  const { user, supabase } = await getSessionContext();
  if (!user) redirect("/login");

  // Check for student view override cookie (set when admin clicks "Return to Student View")
  const forceStudentView = cookieStore.get("force_student_view")?.value === "1";
  const { data: profile } = await supabase
    .from("profiles")
    .select("role, registration_stage, full_name")
    .eq("user_id", user.id)
    .single();
  const role = profile?.role ?? "student";

  // Root-cause gate: block any session that hasn't finished Stage 3 of
  // registration. This catches the OAuth-callback / stale-cookie path where
  // /api/auth/login was never called (which was why partial accounts could
  // appear in the dashboard with name "__").
  const stage = profile?.registration_stage ?? 0;
  if (!ADMIN_ROLES.includes(role) && stage < 4) {
    await supabase.auth.signOut();
    const resumeStage = stage === 1 ? "stage-2" : "stage-3";
    redirect(`/register?uid=${user.id}&resume=${resumeStage}`);
  }

  // Fetch site settings for branding
  const { data: siteSettings } = await supabase
    .from("site_settings")
    .select("site_name, logo_url")
    .eq("id", 1)
    .maybeSingle();

  // Admins should land on /admin by default; only stay on /dashboard when explicitly forced.
  if (ADMIN_ROLES.includes(role) && !forceStudentView) {
    redirect("/admin");
  }

  return (
    <div className="min-h-screen bg-surface">
      <Sidebar 
        role={role} 
        siteName={siteSettings?.site_name} 
        logoUrl={siteSettings?.logo_url} 
      />
      <MobileNav 
        role={role} 
        siteName={siteSettings?.site_name} 
        logoUrl={siteSettings?.logo_url} 
      />
      <main 
        className="min-h-screen flex flex-col pb-16 lg:pb-0 text-on-surface transition-[padding-left] duration-300 ease-in-out"
        style={{ paddingLeft: "var(--sidebar-offset)" }}
      >
        <div className="flex-1 flex flex-col mx-auto w-full max-w-[1600px] px-2 md:px-4 py-4 md:py-5">
          <ActivityPing />
          <BrowserWarningBanner />
          <DeletionWarningBanner userId={user.id} />
          <AcademicInfoBanner userId={user.id} />
          <PlatformNotifier userId={user.id} />
          <PageTransition>{children}</PageTransition>
        </div>
      </main>
    </div>
  );
}
