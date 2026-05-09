import { Suspense } from "react";
import { redirect, notFound } from "next/navigation";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import SetupMfaClient from "@/app/(auth)/setup-mfa/SetupMfaClient";

export default async function SetupMfaPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
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

  if (!user) {
    redirect("/login");
  }

  const resolvedSearchParams = await searchParams;
  const uidParam = typeof resolvedSearchParams.uid === "string" ? resolvedSearchParams.uid : undefined;
  const returnTo = typeof resolvedSearchParams.returnTo === "string" ? resolvedSearchParams.returnTo : "/dashboard";

  // If uid is provided, verify it matches the logged-in user
  if (uidParam && uidParam !== user.id) {
    notFound();
  }

  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <div className="surface-card px-4 h-10 flex items-center gap-2">
            <div className="w-4 h-4 border-2 border-tertiary border-t-transparent rounded-full animate-spin" />
            <span className="text-sm text-on-surface-variant">Loading…</span>
          </div>
        </div>
      }
    >
      <SetupMfaClient userId={user.id} returnTo={returnTo} />
    </Suspense>
  );
}
