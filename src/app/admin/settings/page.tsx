export const metadata = { title: "Settings — Admin" };
export const revalidate = 3600; // ISR: revalidate every hour

import { AggregateFormulaBuilder } from "@/components/admin/AggregateFormulaBuilder";
import { createServerClientFn } from "@/lib/supabase/server";
import { BrandingClient } from "./branding-client";
import { CreditRateCard } from "@/components/admin/CreditRateCard";
import Link from "next/link";

export default async function AdminSettingsPage() {
  const supabase = await createServerClientFn();
  const { data: settings } = await supabase
    .from("site_settings")
    .select("*")
    .eq("id", 1)
    .maybeSingle();

  return (
    <div className="space-y-4 max-w-4xl">
      <header>
        <h1 className="text-xl md:text-2xl font-poppins font-semibold text-on-surface tracking-tight">
          Settings
        </h1>
        <p className="text-sm text-on-surface-variant">
          Configure global platform behavior and metrics.
        </p>
      </header>

      <section>
        <BrandingClient
          initialSettings={
            settings ?? {
              id: 1,
              site_name: "Scientia Prep",
              logo_url: null,
              favicon_url: null,
              support_email: null,
              primary_color: null,
            }
          }
        />
      </section>

      <section>
        <AggregateFormulaBuilder />
      </section>

      <section className="space-y-2">
        <div>
          <h2 className="text-base font-poppins font-semibold text-on-surface">Credits</h2>
          <p className="text-sm text-outline">Manage the credit economy.</p>
        </div>
        <CreditRateCard />
        <Link
          href="/admin/settings/content-prices"
          className="inline-flex items-center gap-1.5 h-9 px-3 rounded-md bg-surface-container-high text-sm text-on-surface hover:bg-outline/10"
        >
          Manage Content Prices →
        </Link>
      </section>
    </div>
  );
}
