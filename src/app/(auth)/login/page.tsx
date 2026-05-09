import { Suspense } from "react";
import { Loader2 } from "lucide-react";
import { LoginContent } from "./LoginClient";
import { createServerClientFn } from "@/lib/supabase/server";

export default async function LoginPage() {
  const supabase = await createServerClientFn();
  const { data: siteSettings } = await supabase
    .from("site_settings")
    .select("site_name, logo_url")
    .eq("id", 1)
    .maybeSingle();

  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <div className="surface-card px-4 h-10 flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin text-tertiary" />
            <span className="text-sm text-on-surface-variant">Loading…</span>
          </div>
        </div>
      }
    >
      <LoginContent 
        siteName={siteSettings?.site_name} 
        logoUrl={siteSettings?.logo_url} 
      />
    </Suspense>
  );
}
