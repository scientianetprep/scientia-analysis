"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "./ui/button";

interface BannerData {
  userId: string;
  stage: number;
}

export function ResumeBanner() {
  const router = useRouter();
  const [data, setData] = useState<BannerData | null>(null);

  useEffect(() => {
    async function checkRegistration() {
      try {
        const res = await fetch("/api/auth/profile-status", {
          cache: "no-store",
        });
        if (res.ok) {
          const json = await res.json();
          // Only surface the banner when there's an actual in-progress
          // registration to resume. The probe returns `{stage: 1,
          // userId: null}` for anonymous visitors (the "nothing to
          // resume, render Stage 1 fresh" path) — showing the banner
          // then would push every logged-out landing-page visitor into
          // a registration flow they never started. Since stage-1
          // verify-and-create bumps a profile to stage 2 before it has
          // a userId we can point at, a legit resume is always stage
          // 2 or 3 with a concrete userId.
          if (
            json.userId &&
            typeof json.stage === "number" &&
            json.stage >= 2 &&
            json.stage < 4
          ) {
            setData({ userId: json.userId, stage: json.stage });
          }
        }
      } catch {
        // Ignore - not logged in or error
      }
    }
    checkRegistration();
  }, []);

  const getMessage = () => {
    if (!data) return "";
    switch (data.stage) {
      case 1:
        return "Complete your profile details to continue";
      case 2:
        return "Verify your WhatsApp number to complete registration";
      case 3:
        return "Your application is pending admin approval";
      default:
        return "Complete your registration";
    }
  };

  const getResumePath = () => {
    if (!data) return "/register";
    switch (data.stage) {
      case 1:
        return `/register?resume=stage-2&uid=${data.userId}`;
      case 2:
        return `/register?resume=stage-3&uid=${data.userId}`;
      case 3:
        return "/pending";
      default:
        return "/register";
    }
  };

  if (!data || data.stage >= 4) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-surface-container/95 backdrop-blur-md border-t border-outline-variant/10 p-4 z-50 safe-area-inset">
      <div className="flex items-center justify-between max-w-7xl mx-auto">
        <p className="text-sm text-on-surface-variant">{getMessage()}</p>
        <Button
          onClick={() => router.push(getResumePath())}
          className="bg-tertiary text-on-tertiary-fixed hover:opacity-90 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-tertiary"
          aria-label="Continue registration"
        >
          Continue
        </Button>
      </div>
    </div>
  );
}
