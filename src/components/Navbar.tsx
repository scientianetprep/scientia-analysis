"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

interface NavbarProps {
  user?: any;
  profile?: any;
}

export function Navbar({ user, profile }: NavbarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 8);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const isAuthPage =
    pathname.startsWith("/login") ||
    pathname.startsWith("/register") ||
    pathname.startsWith("/pending");

  const handleLogout = async () => {
    try {
      const res = await fetch("/api/auth/logout", { method: "POST" });
      if (res.ok) {
        toast.success("Signed out.");
        router.push("/login");
        router.refresh();
      }
    } catch {
      toast.error("Logout failed. Please try again.");
    }
  };

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-[100] h-12 transition-colors ${
        scrolled
          ? "bg-surface/90 backdrop-blur-xl border-b border-outline-variant/10"
          : "bg-transparent"
      }`}
    >
      <div className="max-w-7xl mx-auto h-12 px-4 md:px-6 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <div className="relative w-7 h-7 rounded-md bg-tertiary overflow-hidden">
            <Image
              src="/scientia_logo_premium_1776551349355.png"
              alt="Scientia Prep"
              fill
              sizes="28px"
              className="object-contain"
            />
          </div>
          <span className="text-on-surface font-poppins font-semibold text-sm">
            Scientia <span className="text-tertiary text-[10px] ml-0.5">PREP</span>
          </span>
        </Link>

        <div className="flex items-center gap-2">
          {user ? (
            <>
              {!isAuthPage && profile?.full_name && (
                <span className="hidden md:inline text-xs text-on-surface-variant mr-1">
                  {profile.full_name.split(" ")[0]}
                </span>
              )}
              <Button variant="outline" size="sm" onClick={handleLogout}>
                Sign out
              </Button>
            </>
          ) : (
            <>
              <Link
                href="/login"
                className="h-9 px-3 rounded-md text-sm text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high transition-colors flex items-center"
              >
                Log in
              </Link>
              <Button asChild size="default">
                <Link href="/register">Get started</Link>
              </Button>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
