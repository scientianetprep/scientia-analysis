import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, PieChart } from "lucide-react";
import { env } from "@/lib/env";
import { PerformanceAnalytics } from "@/components/dashboard/PerformanceAnalytics";

// Mobile nav links "Analytics" → /dashboard/analytics. Before this page
// existed that link produced a 404 because the actual analytics UI was
// nested inside /dashboard/profile. This dedicated route surfaces the
// same PerformanceAnalytics component with none of the profile chrome,
// so the tab is reachable on its own from desktop and mobile.

export const dynamic = "force-dynamic";
export const metadata = { title: "Analytics — Scientia Prep" };

export default async function StudentAnalyticsPage() {
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

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: scores } = await supabase
    .from("test_scores")
    .select("created_at, percentage, test_id, total_questions, correct_answers")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true });

  return (
    <div className="space-y-5 animate-fade-in">
      <header className="flex flex-col gap-1">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1 text-xs font-poppins text-on-surface-variant hover:text-on-surface transition-colors w-fit"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
          Back to dashboard
        </Link>
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-md bg-tertiary/10 grid place-items-center">
            <PieChart className="w-4 h-4 text-tertiary" />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-poppins font-semibold tracking-tight">
              Your analytics
            </h1>
            <p className="text-sm text-on-surface-variant">
              Trends, weak areas and test performance over time.
            </p>
          </div>
        </div>
      </header>

      <PerformanceAnalytics data={(scores as any) || []} />
    </div>
  );
}
