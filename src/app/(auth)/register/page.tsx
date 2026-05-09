import { Suspense } from "react";
import { RegisterContent } from "./RegisterClient";
import { createServerClientFn } from "@/lib/supabase/server";

export default async function RegisterPage() {
  const supabase = await createServerClientFn();
  const { data: siteSettings } = await supabase
    .from("site_settings")
    .select("site_name, logo_url")
    .eq("id", 1)
    .maybeSingle();

  return (
    <div className="min-h-screen relative overflow-x-hidden">
      <Suspense
        fallback={
          <div className="min-h-screen flex items-center justify-center">
            <div className="glass-card p-8 flex items-center gap-4 scale-in animate-pulse">
              <div className="w-10 h-10 rounded-full border-4 border-tertiary border-t-transparent animate-spin" />
              <span className="text-on-surface font-poppins font-semibold">
                Initiating Registration…
              </span>
            </div>
          </div>
        }
      >
        <RegisterContent
          siteName={siteSettings?.site_name}
          logoUrl={siteSettings?.logo_url}
        />
      </Suspense>
    </div>
  );
}
