import { redirect } from "next/navigation";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { env } from "@/lib/env";

export default async function Home() {
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

  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("status, whatsapp_number, username, cnic, registration_stage, registration_expires_at")
    .eq("user_id", user.id)
    .single();

  if (!profile) redirect("/login");

  // Check expiration for incomplete registrations
  if (profile.registration_stage < 4 && profile.registration_expires_at) {
    const expiresAt = new Date(profile.registration_expires_at);
    if (new Date() > expiresAt) {
      // Expired - delete user (cascade removes profile). Note: RLS allows this if they are deleting their own account? Actually, deleting user requires admin auth hook or edge function, but for now we'll have to use the admin client just for the deletion, or we can skip it and let a cron job handle purges.
      // Since we want to remove service role from page.tsx entirely, we will just redirect to expired. A background cron job should be used to purge expired users.
      redirect("/register?error=expired");
    }
  }

  // State Machine: redirect based on registration stage
  switch (profile.registration_stage) {
    case 1:
      redirect(`/register?resume=stage-2&uid=${user.id}`);
    case 2:
      redirect(`/register?resume=stage-3&uid=${user.id}`);
    case 3:
    case 4:
      // For stages 3 and 4, check status
      if (profile.status === "pending" || profile.status === "payment_pending") {
        redirect("/pending");
      } else if (profile.status === "suspended" || profile.status === "expired") {
        redirect("/login?suspended=true");
      } else if (profile.status === "rejected") {
        redirect("/login?rejected=true");
      } else if (profile.status === "active") {
        // Only allow dashboard access for active users
        redirect("/dashboard");
      }
      // If somehow we get here with no valid status, go to login
      redirect("/login");
    default:
      redirect("/login");
  }
}