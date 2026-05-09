import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { env } from "@/lib/env";
import PendingClient from "./PendingClient";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Application Status | Scientia Prep",
  description: "Check the current status of your Scientia Prep application.",
};

export default async function PendingPage() {
  const cookieStore = await cookies();

  const supabase = createServerClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        },
      },
    }
  );

  // Fetch site settings for branding
  const { data: siteSettings } = await supabase
    .from("site_settings")
    .select("site_name, logo_url")
    .eq("id", 1)
    .maybeSingle();

  // Layer 1: Auth validation
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    // Instant server-side redirect prevents any content flash.
    // 'redirect' search param tells the login page which page we were trying to access.
    redirect("/login?redirect=pending");
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("status, registration_stage")
    .eq("user_id", user.id)
    .single();

  if (profileError || !profile) {
    // If profile is missing but user is logged in, something is wrong with the account.
    redirect("/login?error=account_issue");
  }

  // If already active, don't show pending page, go to dashboard.
  if (profile.status === "active") {
    redirect("/dashboard");
  }

  // Double-lock: If they enter pending manually but haven't finished verifying phone (stage 4)
  if (profile.registration_stage < 4) {
    if (profile.registration_stage === 1) {
      redirect(`/register?resume=stage-2&uid=${user.id}`);
    } else {
      redirect(`/register?resume=stage-3&uid=${user.id}`);
    }
  }

  return (
    <PendingClient 
      initialStatus={profile.status as "pending" | "rejected"} 
      userId={user.id} 
      siteName={siteSettings?.site_name}
      logoUrl={siteSettings?.logo_url}
    />
  );
}