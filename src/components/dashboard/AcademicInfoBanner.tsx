"use client";

import { useEffect, useState } from "react";
import { createBrowserClient } from "@/lib/supabase/client";
import { GraduationCap, X } from "lucide-react";
import { toast } from "sonner";
import { AcademicUpdateModal } from "./AcademicUpdateModal";

/**
 * Non-blocking nudge shown on every dashboard page when the signed-in student
 * is missing academic_info. A one-time toast also fires once per session
 * (sessionStorage-gated) right after login/register so first-visit users
 * notice the banner without it being noisy on every navigation.
 */
export function AcademicInfoBanner({ userId }: { userId?: string }) {
  const [needsUpdate, setNeedsUpdate] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [initialData, setInitialData] = useState<Record<
    string,
    string | number | null
  > | null>(null);
 
  useEffect(() => {
    if (!userId) return;
    let alive = true;
    const supabase = createBrowserClient();
 
    (async () => {
      const { data: academic } = await supabase
        .from("academic_info")
        .select(
          "matric_board, matric_status, matric_marks, intermediate_board, intermediate_status, intermediate_marks"
        )
        .eq("user_id", userId)
        .maybeSingle();
 
      if (!alive) return;
 
      // Incomplete = no row at all, or missing board, or "Declared" without marks.
      const matricIncomplete =
        !academic?.matric_board ||
        (academic.matric_status === "Declared" && !academic.matric_marks);
      const interIncomplete =
        !academic?.intermediate_board ||
        (academic.intermediate_status === "Declared" &&
          !academic.intermediate_marks);
 
      const incomplete = !academic || matricIncomplete || interIncomplete;
 
      if (incomplete) {
        setInitialData(academic ?? null);
        setNeedsUpdate(true);
 
        // Fire the one-time toast at most once per browser session.
        try {
          if (!sessionStorage.getItem("academic_info_toast_shown")) {
            sessionStorage.setItem("academic_info_toast_shown", "1");
            toast.info("Complete your academic profile", {
              description:
                "Add your matric/intermediate boards and marks to unlock the full leaderboard.",
              duration: 6000,
            });
          }
        } catch {
          /* sessionStorage can throw in incognito — safe to ignore */
        }
      }
    })();
 
    return () => {
      alive = false;
    };
  }, [userId]);

  if (!needsUpdate || dismissed) return null;

  return (
    <>
      <div
        role="status"
        className="mb-4 rounded-md border border-amber-500/25 bg-amber-500/10 p-3 flex items-start gap-3"
      >
        <div className="w-8 h-8 rounded-md bg-amber-500/20 grid place-items-center shrink-0">
          <GraduationCap className="w-4 h-4 text-amber-600" />
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-poppins font-semibold text-on-surface">
            Add your academic details
          </h4>
          <p className="text-xs text-on-surface-variant leading-relaxed mt-0.5">
            We use your matric and intermediate records for the leaderboard and
            personalized study recommendations. Takes under a minute.
          </p>
          <button
            onClick={() => setShowModal(true)}
            className="mt-2 h-8 px-3 rounded-md bg-amber-500 text-white text-xs font-poppins font-medium hover:bg-amber-600 transition-colors"
          >
            Complete profile
          </button>
        </div>
        <button
          onClick={() => setDismissed(true)}
          className="text-outline hover:text-on-surface p-1 rounded-md transition-colors"
          aria-label="Dismiss"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {showModal && userId && (
        <AcademicUpdateModal
          onClose={() => setShowModal(false)}
          userId={userId}
          initialData={initialData ?? undefined}
        />
      )}
    </>
  );
}
