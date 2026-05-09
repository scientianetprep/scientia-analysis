import "server-only";

import Link from "next/link";
import { createClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";
import { cn } from "@/lib/utils";

/**
 * <Branding /> — site-wide logo + name loaded from public.site_settings.
 * Falls back to the text logo when `logo_url` is empty.
 * Uses the anon key (the `site_settings public read` RLS policy allows this).
 */
async function loadSettings() {
  const supabase = createClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      auth: { persistSession: false },
    }
  );
  const { data } = await supabase
    .from("site_settings")
    .select("site_name, logo_url")
    .eq("id", 1)
    .maybeSingle();
  return {
    siteName: data?.site_name ?? "Scientia Prep",
    logoUrl: data?.logo_url ?? null,
  };
}

type Props = {
  /** Target href for the clickable brand wordmark. Defaults to `/`. */
  href?: string | null;
  /** Tailwind size class for the logo image. */
  size?: "sm" | "md" | "lg";
  /** Show the site name text next to the logo. Defaults to `true`. */
  showName?: boolean;
  /** Extra classes for the outer wrapper. */
  className?: string;
  /** Explicit text tone — default follows `text-on-surface`. */
  textClassName?: string;
};

const SIZE_PX: Record<NonNullable<Props["size"]>, number> = {
  sm: 20,
  md: 28,
  lg: 40,
};

export async function Branding({
  href = "/",
  size = "md",
  showName = true,
  className,
  textClassName,
}: Props) {
  const { siteName, logoUrl } = await loadSettings();
  const px = SIZE_PX[size];

  const inner = (
    <>
      {logoUrl ? (
        // Remote asset from our `branding` public bucket.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={logoUrl}
          alt={`${siteName} logo`}
          width={px}
          height={px}
          className="rounded-md object-contain"
          style={{ width: px, height: px }}
          loading="eager"
          // eslint-disable-next-line @typescript-eslint/ban-ts-comment
          // @ts-ignore fetchpriority is a valid HTML attribute not yet in TS types
          fetchpriority="high"
        />
      ) : (
        <span
          aria-hidden
          className="rounded-md bg-tertiary text-white font-poppins font-semibold grid place-items-center"
          style={{ width: px, height: px, fontSize: px * 0.45 }}
        >
          {siteName.slice(0, 1).toUpperCase()}
        </span>
      )}
      {showName && (
        <span
          className={cn(
            "font-poppins font-semibold text-on-surface",
            size === "sm" ? "text-sm" : size === "lg" ? "text-lg" : "text-base",
            textClassName
          )}
        >
          {siteName}
        </span>
      )}
    </>
  );

  if (!href) {
    return <span className={cn("inline-flex items-center gap-2", className)}>{inner}</span>;
  }

  return (
    <Link
      href={href}
      aria-label={siteName}
      className={cn("inline-flex items-center gap-2", className)}
    >
      {inner}
    </Link>
  );
}
