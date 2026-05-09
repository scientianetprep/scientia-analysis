import { requireAdmin } from "@/lib/supabase/require-admin";
import { createServerClientFn } from "@/lib/supabase/server";
import { NotificationsClient } from "./notifications-client";

export const metadata = { title: "Notifications — Admin" };

export default async function AdminNotificationsPage() {
  await requireAdmin();
  const supabase = await createServerClientFn();

  const { data: notifications, error } = await supabase
    .from("admin_notifications")
    .select("*")
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl md:text-2xl font-poppins font-semibold text-on-surface tracking-tight">
          Notifications
        </h1>
        <p className="text-sm text-on-surface-variant">
          Broadcast announcements or send targeted alerts to students.
        </p>
      </div>

      <NotificationsClient initialNotifications={notifications || []} />
    </div>
  );
}
