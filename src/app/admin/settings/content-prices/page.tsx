import { createServerClientFn } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { PricesClient } from "./prices-client";

export const metadata = { title: "Content Prices | Admin" };

export default async function ContentPricesPage() {
  const supabase = await createServerClientFn();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("user_id", user.id)
    .single();
  if (!profile || !["admin", "super_admin"].includes(profile.role))
    redirect("/admin");

  const { data: prices } = await supabase
    .from("content_prices")
    .select("id, content_type, content_id, credit_cost, is_free, updated_at")
    .order("content_type", { ascending: true });

  // Lessons with their parent course name for categorization
  const { data: lessons } = await supabase
    .from("lessons")
    .select("id, title, course_id, sequence_order, courses(title, subject)")
    .order("sequence_order", { ascending: true });

  // Tests with subject
  const { data: tests } = await supabase
    .from("tests")
    .select("id, name, subject, is_mock")
    .order("subject", { ascending: true });

  // Courses with subject
  const { data: courses } = await supabase
    .from("courses")
    .select("id, title, subject")
    .order("subject", { ascending: true });

  return (
    <div className="space-y-4 max-w-5xl">
      <div>
        <h1 className="text-xl font-poppins font-bold text-on-surface">
          Content Prices
        </h1>
        <p className="text-sm text-outline mt-0.5">
          Set credit cost for lessons, tests, and courses. Items without a price
          are free by default.
        </p>
      </div>
      <PricesClient
        initialPrices={prices ?? []}
        lessons={(lessons ?? []) as any}
        tests={(tests ?? []) as any}
        courses={(courses ?? []) as any}
      />
    </div>
  );
}
