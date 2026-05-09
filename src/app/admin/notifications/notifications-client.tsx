"use client";

import { useState } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { Megaphone, Plus, Send, Clock, User, BellRing, Loader2, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useConfirm } from "@/components/ui/confirm-dialog";

export function NotificationsClient({ initialNotifications }: { initialNotifications: any[] }) {
  const router = useRouter();
  const confirm = useConfirm();
  const [notifications, setNotifications] = useState(initialNotifications);
  const [showModal, setShowModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleDelete = async (id: string) => {
    if (
      !(await confirm({
        title: "Delete announcement?",
        description: "Students will stop seeing this announcement immediately.",
        confirmLabel: "Delete",
        variant: "danger",
      }))
    ) {
      return;
    }

    setDeletingId(id);
    const tid = toast.loading("Deleting…");
    try {
      const res = await fetch(`/api/admin/notifications?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Failed to delete");
      setNotifications((prev) => prev.filter((n) => n.id !== id));
      toast.success("Announcement deleted", { id: tid });
      router.refresh();
    } catch (err: any) {
      toast.error(err.message, { id: tid });
    } finally {
      setDeletingId(null);
    }
  };

  const [formData, setFormData] = useState({
    title: "",
    message: "",
    type: "info",
    target_user_id: "",
    expires_at: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title || !formData.message) {
      toast.error("Please fill in the title and message");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch("/api/admin/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          target_user_id: formData.target_user_id || null,
          expires_at: formData.expires_at || null,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      toast.success("Notification broadcast");
      setShowModal(false);
      setNotifications([data, ...notifications]);
      setFormData({ title: "", message: "", type: "info", target_user_id: "", expires_at: "" });
      router.refresh();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const typeChip = (type: string) => {
    const map: Record<string, string> = {
      alert: "bg-red-500/10 text-red-500",
      warning: "bg-amber-500/10 text-amber-600",
      info: "bg-tertiary/10 text-tertiary",
      banner: "bg-blue-500/10 text-blue-500",
    };
    return (
      <span className={cn("inline-flex items-center h-5 px-1.5 rounded text-[10px] font-medium", map[type] || map.info)}>
        {type}
      </span>
    );
  };

  const input =
    "w-full h-9 px-2.5 rounded-md bg-surface-container-high border border-outline-variant/20 text-sm outline-none focus:border-tertiary focus:ring-1 focus:ring-tertiary transition-colors";

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-1.5 text-sm font-medium text-on-surface">
          <BellRing className="w-4 h-4 text-tertiary" />
          Active alerts
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="h-9 px-3 rounded-md bg-tertiary text-white text-sm font-poppins font-medium hover:bg-tertiary/90 transition-colors flex items-center gap-1.5"
        >
          <Plus className="w-3.5 h-3.5" />
          New announcement
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2.5">
        {notifications.map((n) => (
          <div key={n.id} className="surface-card p-3 flex flex-col">
            <div className="flex items-center justify-between gap-2 mb-1.5">
              {typeChip(n.type)}
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] text-outline">
                  {format(new Date(n.created_at), "MMM d, h:mm a")}
                </span>
                <button
                  type="button"
                  disabled={deletingId === n.id}
                  onClick={() => handleDelete(n.id)}
                  className="h-6 w-6 inline-flex items-center justify-center rounded-md text-outline hover:text-red-500 hover:bg-red-500/10 transition-colors disabled:opacity-50"
                  title="Delete announcement"
                  aria-label="Delete announcement"
                >
                  {deletingId === n.id ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <Trash2 className="w-3 h-3" />
                  )}
                </button>
              </div>
            </div>
            <h3 className="text-sm font-poppins font-semibold text-on-surface truncate">{n.title}</h3>
            <p className="mt-1 text-sm text-on-surface-variant line-clamp-3 flex-1">{n.message}</p>
            <div className="mt-2 pt-2 border-t border-outline-variant/10 flex items-center justify-between text-[11px] text-outline">
              <div className="flex items-center gap-1">
                {!n.target_user_id ? <Megaphone className="w-3 h-3" /> : <User className="w-3 h-3" />}
                {!n.target_user_id ? "Global" : "Targeted"}
              </div>
              {n.expires_at && (
                <div className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  Expires {format(new Date(n.expires_at), "MMM d")}
                </div>
              )}
            </div>
          </div>
        ))}

        {notifications.length === 0 && (
          <div className="col-span-full surface-card p-6 text-center text-sm text-outline">
            No active announcements.
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-3">
          <div className="bg-surface w-full max-w-lg rounded-xl border border-outline-variant/20 shadow-2xl overflow-hidden">
            <div className="px-4 py-3 border-b border-outline-variant/10">
              <h2 className="text-base font-poppins font-semibold text-on-surface">Compose broadcast</h2>
              <p className="text-xs text-on-surface-variant">Appears on student dashboards immediately.</p>
            </div>

            <form onSubmit={handleSubmit} className="p-4 space-y-3">
              <div>
                <label className="text-[11px] font-medium text-on-surface-variant block mb-1">Title *</label>
                <input
                  required
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className={input}
                  placeholder="e.g. Scheduled maintenance"
                />
              </div>

              <div>
                <label className="text-[11px] font-medium text-on-surface-variant block mb-1">Message *</label>
                <textarea
                  required
                  rows={4}
                  value={formData.message}
                  onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                  className="w-full px-2.5 py-1.5 rounded-md bg-surface-container-high border border-outline-variant/20 text-sm outline-none focus:border-tertiary focus:ring-1 focus:ring-tertiary resize-none font-lora"
                  placeholder="Announcement text…"
                />
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="text-[11px] font-medium text-on-surface-variant block mb-1">Level</label>
                  <select
                    value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                    className={input}
                  >
                    <option value="info">Info</option>
                    <option value="warning">Warning</option>
                    <option value="alert">Alert</option>
                    <option value="banner">Global banner</option>
                  </select>
                </div>
                <div>
                  <label className="text-[11px] font-medium text-on-surface-variant block mb-1">Expiry (optional)</label>
                  <input
                    type="date"
                    value={formData.expires_at}
                    onChange={(e) => setFormData({ ...formData, expires_at: e.target.value })}
                    className={input}
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-outline-variant/10 flex items-center justify-end gap-2">
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => setShowModal(false)}
                  className="h-9 px-3 rounded-md text-sm font-medium text-on-surface-variant hover:bg-surface-container-high transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="h-9 px-3 rounded-md bg-tertiary text-white text-sm font-medium hover:bg-tertiary/90 transition-colors flex items-center gap-1.5 disabled:opacity-60"
                >
                  {isSubmitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                  Broadcast
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
