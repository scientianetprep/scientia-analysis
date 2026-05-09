"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Send, Users, User, Mail, Loader2, RefreshCcw, Check, Search, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

type UserOption = { user_id: string; full_name: string | null; email: string | null };

export function EmailComposerClient({ users }: { users: UserOption[] }) {
  const [isSending, setIsSending] = useState(false);
  const [search, setSearch] = useState("");
  const [showUserSelect, setShowUserSelect] = useState(false);
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [formData, setFormData] = useState({
    targetType: "all_students",
    to: "",
    subject: "",
    message: ""
  });

  const filteredUsers = users.filter(u =>
    !search ||
    u.full_name?.toLowerCase().includes(search.toLowerCase()) ||
    u.email?.toLowerCase().includes(search.toLowerCase())
  );

  const toggleUser = (userId: string) => {
    setSelectedUsers(prev =>
      prev.includes(userId)
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.subject || !formData.message) {
      toast.error("Please fill in subject and message");
      return;
    }

    if (formData.targetType === "single" && !formData.to) {
      toast.error("Please enter recipient email");
      return;
    }

    if (formData.targetType === "selected" && selectedUsers.length === 0) {
      toast.error("Please select at least one recipient");
      return;
    }

    setIsSending(true);
    try {
      const payload = {
        ...formData,
        selectedUserIds: formData.targetType === "selected" ? selectedUsers : undefined
      };

      const res = await fetch("/api/admin/email/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      toast.success(data.message);
      if (data.failed > 0) {
        toast.warning(`${data.failed} emails could not be sent.`);
      }

      setFormData(prev => ({ ...prev, message: "" }));
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsSending(false);
    }
  };

  const targets: Array<{ key: string; label: string; Icon: any }> = [
    { key: "all_students", label: "All", Icon: Users },
    { key: "selected", label: "Selected", Icon: Check },
    { key: "single", label: "Single", Icon: User },
  ];

  return (
    <div className="max-w-4xl">
      <form onSubmit={handleSubmit} className="grid gap-3 md:grid-cols-5">
        {/* Left column: controls */}
        <div className="surface-card p-3 space-y-3 md:col-span-3">
          <div>
            <label className="text-[11px] text-outline mb-1.5 block">Recipients</label>
            <div className="grid grid-cols-3 gap-1.5">
              {targets.map(({ key, label, Icon }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => {
                    setFormData({ ...formData, targetType: key });
                    if (key === "selected") setShowUserSelect(true);
                    else setSelectedUsers([]);
                  }}
                  className={`flex items-center justify-center gap-1.5 h-9 rounded-md border text-xs font-medium transition-colors ${
                    formData.targetType === key
                      ? 'bg-tertiary text-white border-tertiary'
                      : 'bg-surface-container-high text-on-surface-variant border-outline-variant/20 hover:border-outline-variant/40'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" /> {label}
                </button>
              ))}
            </div>
          </div>

          {formData.targetType === "selected" && selectedUsers.length > 0 && (
            <div className="flex items-center gap-2 px-2.5 h-8 rounded-md bg-tertiary/10 border border-tertiary/20 text-xs">
              <Check className="w-3.5 h-3.5 text-tertiary" />
              <span className="text-tertiary font-medium">
                {selectedUsers.length} student{selectedUsers.length !== 1 ? 's' : ''} selected
              </span>
              <button
                type="button"
                onClick={() => setSelectedUsers([])}
                className="ml-auto p-1 rounded hover:bg-tertiary/20"
              >
                <X className="w-3 h-3" />
              </button>
              <button
                type="button"
                onClick={() => setShowUserSelect(true)}
                className="px-2 h-6 rounded bg-tertiary text-white text-[11px] font-medium"
              >
                Edit
              </button>
            </div>
          )}

          {formData.targetType === "single" && (
            <div>
              <label className="text-[11px] text-outline mb-1 block">Recipient email</label>
              <div className="relative">
                <Mail className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-outline" />
                <input
                  required
                  type="email"
                  value={formData.to}
                  onChange={e => setFormData({ ...formData, to: e.target.value })}
                  className="w-full pl-8 pr-3 h-9 rounded-md bg-surface-container-high border border-outline-variant/20 focus:border-tertiary focus:ring-1 focus:ring-tertiary outline-none text-sm"
                  placeholder="student@example.com"
                />
              </div>
            </div>
          )}

          <div>
            <label className="text-[11px] text-outline mb-1 block">Subject</label>
            <input
              required
              type="text"
              value={formData.subject}
              onChange={e => setFormData({ ...formData, subject: e.target.value })}
              className="w-full px-3 h-9 rounded-md bg-surface-container-high border border-outline-variant/20 focus:border-tertiary focus:ring-1 focus:ring-tertiary outline-none text-sm"
              placeholder="e.g., Weekly performance report"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-[11px] text-outline">Message</label>
              <span className="text-[11px] text-outline">
                Tokens:{" "}
                <code className="text-on-surface-variant">{"{{full_name}}"}</code>{" "}
                <code className="text-on-surface-variant">{"{{first_name}}"}</code>{" "}
                <code className="text-on-surface-variant">{"{{email}}"}</code>
              </span>
            </div>
            <textarea
              required
              rows={10}
              value={formData.message}
              onChange={e => setFormData({ ...formData, message: e.target.value })}
              className="w-full px-3 py-2 rounded-md bg-surface-container-high border border-outline-variant/20 focus:border-tertiary focus:ring-1 focus:ring-tertiary outline-none text-sm leading-relaxed resize-y"
              placeholder="Hi {{first_name}}, ..."
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-outline-variant/10">
            <button
              type="button"
              onClick={() => setFormData({ targetType: "all_students", to: "", subject: "", message: "" })}
              className="flex items-center gap-1.5 h-9 px-3 rounded-md text-xs font-medium text-on-surface-variant hover:bg-surface-container-high"
            >
              <RefreshCcw className="w-3.5 h-3.5" /> Reset
            </button>
            <button
              disabled={isSending}
              type="submit"
              className="flex items-center gap-1.5 h-9 px-4 rounded-md text-xs font-medium bg-tertiary text-white hover:bg-tertiary/90 disabled:opacity-50"
            >
              {isSending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
              Send
            </button>
          </div>
        </div>

        {/* Right column: preview */}
        <div className="surface-card p-3 md:col-span-2">
          <div className="text-[11px] text-outline pb-1.5 border-b border-outline-variant/10 mb-2">
            Preview
          </div>
          <div className="text-sm font-poppins font-semibold text-on-surface pb-1.5 border-b border-outline-variant/10 mb-2 min-h-[1.5rem]">
            {formData.subject || <span className="text-outline font-normal">Subject preview</span>}
          </div>
          <div className="text-sm text-on-surface-variant whitespace-pre-wrap leading-relaxed min-h-[140px]">
            {formData.message || <span className="text-outline">Message preview will appear here</span>}
          </div>
        </div>
      </form>

      {/* User selection modal */}
      <AnimatePresence>
        {showUserSelect && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => setShowUserSelect(false)}
          >
            <motion.div
              initial={{ scale: 0.96, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.96, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-surface w-full max-w-lg rounded-lg border border-outline-variant/20 shadow-xl max-h-[80vh] flex flex-col"
            >
              <div className="flex items-center justify-between px-4 h-11 border-b border-outline-variant/10">
                <h3 className="text-sm font-poppins font-semibold text-on-surface">Select recipients</h3>
                <button
                  onClick={() => setShowUserSelect(false)}
                  className="inline-flex items-center justify-center h-7 w-7 rounded-md hover:bg-surface-container-high"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-3 border-b border-outline-variant/10">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-outline" />
                  <input
                    type="text"
                    placeholder="Search name or email"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    className="w-full pl-8 pr-3 h-9 rounded-md bg-surface-container-high border border-outline-variant/20 focus:border-tertiary focus:ring-1 focus:ring-tertiary outline-none text-sm"
                  />
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-2 space-y-1">
                {filteredUsers.slice(0, 150).map(user => {
                  const selected = selectedUsers.includes(user.user_id);
                  return (
                    <button
                      key={user.user_id}
                      type="button"
                      onClick={() => toggleUser(user.user_id)}
                      className={`w-full flex items-center gap-2.5 px-2.5 h-11 rounded-md text-left transition-colors ${
                        selected
                          ? 'bg-tertiary/10 border border-tertiary/30'
                          : 'border border-transparent hover:bg-surface-container-high'
                      }`}
                    >
                      <div className={`w-4 h-4 rounded border grid place-items-center ${
                        selected ? 'bg-tertiary border-tertiary' : 'border-outline-variant'
                      }`}>
                        {selected && <Check className="w-3 h-3 text-white" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-on-surface truncate">{user.full_name || "Unknown"}</p>
                        <p className="text-[11px] text-outline truncate">{user.email}</p>
                      </div>
                    </button>
                  );
                })}
                {filteredUsers.length === 0 && (
                  <div className="text-center py-8 text-sm text-outline">No users found</div>
                )}
              </div>

              <div className="flex items-center justify-between px-3 h-11 border-t border-outline-variant/10">
                <p className="text-xs text-outline">{selectedUsers.length} selected</p>
                <button
                  onClick={() => setShowUserSelect(false)}
                  className="h-8 px-3 rounded-md bg-tertiary text-white text-xs font-medium"
                >
                  Done
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
