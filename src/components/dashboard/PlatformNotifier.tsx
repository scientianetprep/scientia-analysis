"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { AlertCircle, Megaphone, Bell, X } from "lucide-react";
import { format } from "date-fns";

export function PlatformNotifier({ userId }: { userId?: string }) {
  const [notifications, setNotifications] = useState<any[]>([]);
  const [dismissedIds, setDismissedIds] = useState<string[]>([]);
  const supabase = createClient();

  useEffect(() => {
    if (!userId) return;
    async function fetchNotifications() {
      const { data } = await supabase
        .from("admin_notifications")
        .select("*")
        .or(`target_user_id.is.null,target_user_id.eq.${userId}`)
        .order("created_at", { ascending: false });

      if (data) {
        const now = new Date();
        const active = data.filter(
          (n) => !n.expires_at || new Date(n.expires_at) > now
        );
        setNotifications(active);
      }
    }

    fetchNotifications();

    const channel = supabase
      .channel("admin_notifications")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "admin_notifications" },
        (payload) => {
          setNotifications((prev) => [payload.new, ...prev]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const visibleNotifications = notifications.filter(
    (n) => !dismissedIds.includes(n.id)
  );

  if (visibleNotifications.length === 0) return null;

  return (
    <div className="space-y-2 mb-4">
      {visibleNotifications.map((n) => (
        <div
          key={n.id}
          className={`relative overflow-hidden rounded-md border p-3 ${
            n.type === "alert"
              ? "bg-red-500/10 border-red-500/25"
              : n.type === "warning"
              ? "bg-amber-500/10 border-amber-500/25"
              : "bg-tertiary/10 border-tertiary/25"
          }`}
        >
          <div className="flex gap-2.5">
            <div
              className={`mt-0.5 p-1.5 rounded-md h-fit shrink-0 ${
                n.type === "alert"
                  ? "bg-red-500 text-white"
                  : n.type === "warning"
                  ? "bg-amber-500 text-white"
                  : "bg-tertiary text-white"
              }`}
            >
              {n.type === "alert" ? (
                <AlertCircle className="w-3.5 h-3.5" />
              ) : n.type === "banner" || n.type === "info" ? (
                <Megaphone className="w-3.5 h-3.5" />
              ) : (
                <Bell className="w-3.5 h-3.5" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="text-sm font-poppins font-semibold text-on-surface mb-0.5 flex items-center gap-1.5 flex-wrap">
                {n.title}
                {n.type === "banner" && (
                  <span className="bg-tertiary/20 text-tertiary text-[11px] font-poppins font-medium px-1.5 py-0.5 rounded-full">
                    Global
                  </span>
                )}
              </h4>
              <p className="text-xs text-on-surface-variant leading-relaxed">
                {n.message}
              </p>
              <div className="mt-1 text-[11px] font-poppins font-medium text-outline-variant">
                Announced {format(new Date(n.created_at), "MMM d, yyyy")}
              </div>
            </div>
            <button
              onClick={() => setDismissedIds([...dismissedIds, n.id])}
              className="p-1 rounded-md hover:bg-surface-container-highest transition-colors text-outline hover:text-on-surface shrink-0"
              aria-label="Dismiss"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
