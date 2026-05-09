"use client";

import { useState, useCallback } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import {
  Search,
  Plus,
  CheckCircle2,
  Clock,
  XCircle,
  Loader2,
  Receipt,
  Banknote,
  X,
  ChevronDown,
  Ban,
  AlertTriangle,
  Coins,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { useConfirm } from "@/components/ui/confirm-dialog";

type Payment = {
  id: string;
  user_id: string;
  amount: number;
  currency: string;
  status: string;
  receipt_id: string | null;
  payment_method: string | null;
  notes: string | null;
  marked_paid_at: string | null;
  created_at: string;
  updated_at: string;
  is_converted: boolean;
  profiles: { full_name: string | null; username: string | null; cnic: string | null } | null;
};

type User = { user_id: string; full_name: string | null; username: string | null };

const STATUS_CONFIG: Record<string, { label: string; icon: React.ElementType; color: string; bg: string }> = {
  paid: { label: "Paid", icon: CheckCircle2, color: "text-green-600", bg: "bg-green-500/10" },
  pending: { label: "Pending", icon: Clock, color: "text-amber-600", bg: "bg-amber-500/10" },
  failed: { label: "Failed", icon: XCircle, color: "text-red-600", bg: "bg-red-500/10" },
  rejected: { label: "Rejected", icon: Ban, color: "text-red-600", bg: "bg-red-500/10" },
  refunded: { label: "Refunded", icon: XCircle, color: "text-blue-600", bg: "bg-blue-500/10" },
};

const METHOD_LABELS: Record<string, string> = {
  manual: "Manual",
  bank_transfer: "Bank Transfer",
  cash: "Cash",
  safepay: "Safepay",
  other: "Other",
};

export function PaymentsClient({
  initialPayments,
  users,
}: {
  initialPayments: Payment[];
  users: User[];
}) {
  const router = useRouter();
  const confirm = useConfirm();
  const [payments, setPayments] = useState<Payment[]>(initialPayments);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [showAddModal, setShowAddModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [rejectTarget, setRejectTarget] = useState<Payment | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [rejectLoading, setRejectLoading] = useState(false);

  const [form, setForm] = useState({
    user_id: "",
    amount: "",
    currency: "PKR",
    receipt_id: "",
    payment_method: "manual",
    notes: "",
  });

  const filtered = payments.filter((p) => {
    const name = p.profiles?.full_name?.toLowerCase() || "";
    const username = p.profiles?.username?.toLowerCase() || "";
    const cnic = p.profiles?.cnic || "";
    const receipt = p.receipt_id?.toLowerCase() || "";
    const matchSearch =
      !search ||
      name.includes(search.toLowerCase()) ||
      username.includes(search.toLowerCase()) ||
      cnic.includes(search) ||
      receipt.includes(search.toLowerCase());
    const matchStatus = statusFilter === "all" || p.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const totalRevenue = payments
    .filter((p) => p.status === "paid")
    .reduce((sum, p) => sum + (p.amount || 0), 0);

  const pendingCount = payments.filter((p) => p.status === "pending").length;

  const handleAddPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.user_id || !form.amount) {
      toast.error("User and amount are required");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/admin/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      toast.success("Payment recorded");
      setShowAddModal(false);
      setForm({ user_id: "", amount: "", currency: "PKR", receipt_id: "", payment_method: "manual", notes: "" });
      router.refresh();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = useCallback(async (paymentId: string, newStatus: string) => {
    const prev = payments.map((p) => ({ ...p }));
    setPayments((ps) => ps.map((p) => (p.id === paymentId ? { ...p, status: newStatus } : p)));

    try {
      const res = await fetch(`/api/admin/payments/${paymentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success(`Marked ${newStatus}`);
    } catch (err: any) {
      setPayments(prev);
      toast.error(err.message);
    }
  }, [payments]);

  const submitReject = async () => {
    if (!rejectTarget) return;
    const reason = rejectReason.trim();
    if (reason.length < 3) {
      toast.error("Please enter a reason (at least 3 characters)");
      return;
    }
    setRejectLoading(true);
    const paymentId = rejectTarget.id;
    const prev = payments.map((p) => ({ ...p }));
    // Optimistic update
    setPayments((ps) =>
      ps.map((p) =>
        p.id === paymentId
          ? {
              ...p,
              status: "rejected",
              notes: [p.notes, `Rejected: ${reason}`].filter(Boolean).join("\n"),
            }
          : p
      )
    );
    try {
      const existingNotes = rejectTarget.notes ? `${rejectTarget.notes}\n` : "";
      const nextNotes = `${existingNotes}Rejected: ${reason}`;
      const res = await fetch(`/api/admin/payments/${paymentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "rejected", notes: nextNotes }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to reject");
      toast.success("Payment rejected");
      setRejectTarget(null);
      setRejectReason("");
    } catch (err: any) {
      setPayments(prev);
      toast.error(err.message);
    } finally {
      setRejectLoading(false);
    }
  };

  const handleDelete = useCallback(async (paymentId: string) => {
    if (!(await confirm({
      title: "Delete payment record?",
      description: "This removes entry permanently. This cannot be undone.",
      confirmLabel: "Delete",
      variant: "danger",
    }))) return;
    const id = toast.loading("Deleting…");
    try {
      const res = await fetch(`/api/admin/payments/${paymentId}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setPayments((ps) => ps.filter((p) => p.id !== paymentId));
      toast.success("Payment deleted", { id });
    } catch (err: any) {
      toast.error(err.message, { id });
    }
  }, []);

  const handleConvertToCredits = useCallback(async (payment: Payment) => {
    if (!(await confirm({
      title: "Convert payment to credits?",
      description: `This will issue credits to the student based on the current exchange rate${payment.status !== "paid" ? " and mark the payment as paid" : ""}.`,
      confirmLabel: "Convert",
      variant: "default",
    }))) return;
    const toastId = toast.loading("Converting…");
    try {
      const res = await fetch(`/api/admin/payments/${payment.id}/convert-credits`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success(`${data.credits_issued} credits issued`, { id: toastId });
      router.refresh();
    } catch (err: any) {
      toast.error(err.message, { id: toastId });
    }
  }, [confirm, router]);

  const kpis: Array<{ label: string; value: string; Icon: any; color: string; bg: string }> = [
    { label: "Revenue (PKR)", value: totalRevenue.toLocaleString(), Icon: Banknote, color: "text-green-600", bg: "bg-green-500/10" },
    { label: "Pending", value: String(pendingCount), Icon: Clock, color: "text-amber-600", bg: "bg-amber-500/10" },
    { label: "Records", value: String(payments.length), Icon: Receipt, color: "text-tertiary", bg: "bg-tertiary/10" },
    { label: "Paid count", value: String(payments.filter(p => p.status === "paid").length), Icon: CheckCircle2, color: "text-blue-600", bg: "bg-blue-500/10" },
  ];

  return (
    <div className="space-y-3">
      {/* KPI row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
        {kpis.map(({ label, value, Icon, color, bg }) => (
          <div key={label} className="surface-card p-3 flex items-center gap-2.5">
            <div className={cn("h-8 w-8 rounded-md grid place-items-center shrink-0", bg)}>
              <Icon className={cn("w-4 h-4", color)} />
            </div>
            <div className="min-w-0">
              <p className="text-base font-poppins font-semibold text-on-surface leading-tight truncate">{value}</p>
              <p className="text-[11px] text-outline">{label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Filter bar */}
      <div className="flex flex-col md:flex-row gap-2 items-stretch md:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-outline" />
          <input
            type="text"
            placeholder="Search name, CNIC, or receipt ID"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 h-9 rounded-md bg-surface-container-high border border-outline-variant/20 focus:border-tertiary focus:ring-1 focus:ring-tertiary outline-none text-sm"
          />
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="appearance-none pl-3 pr-8 h-9 rounded-md bg-surface-container-high border border-outline-variant/20 text-sm outline-none focus:border-tertiary focus:ring-1 focus:ring-tertiary"
            >
              <option value="all">All statuses</option>
              <option value="paid">Paid</option>
              <option value="pending">Pending</option>
              <option value="rejected">Rejected</option>
              <option value="failed">Failed</option>
              <option value="refunded">Refunded</option>
            </select>
            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-outline pointer-events-none" />
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            className="h-9 px-3 rounded-md bg-tertiary text-white text-sm font-medium hover:bg-tertiary/90 inline-flex items-center gap-1.5 shrink-0"
          >
            <Plus className="w-4 h-4" />
            Record
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="surface-card overflow-hidden">
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-surface-container-high/60 text-xs text-outline">
              <tr>
                <th className="px-3 py-2 text-left font-medium">Student</th>
                <th className="px-3 py-2 text-left font-medium">Amount</th>
                <th className="px-3 py-2 text-left font-medium">Method</th>
                <th className="px-3 py-2 text-left font-medium">Receipt</th>
                <th className="px-3 py-2 text-left font-medium">Status</th>
                <th className="px-3 py-2 text-left font-medium">Date</th>
                <th className="px-3 py-2 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/10">
              <AnimatePresence mode="popLayout">
                {filtered.map((payment) => {
                  const cfg = STATUS_CONFIG[payment.status] || STATUS_CONFIG.pending;
                  const StatusIcon = cfg.icon;
                  return (
                    <motion.tr
                      layout
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      key={payment.id}
                      className="hover:bg-surface-container-high/40 h-11"
                    >
                      <td className="px-3 py-2">
                        <div className="font-medium text-on-surface truncate">{payment.profiles?.full_name || "Unknown"}</div>
                        <div className="text-[11px] text-outline truncate">
                          {payment.profiles?.cnic || payment.profiles?.username || payment.user_id.slice(0, 8)}
                        </div>
                      </td>
                      <td className="px-3 py-2 font-poppins font-semibold text-on-surface whitespace-nowrap">
                        {payment.currency || "PKR"} {(payment.amount || 0).toLocaleString()}
                      </td>
                      <td className="px-3 py-2 text-xs text-on-surface-variant">
                        {METHOD_LABELS[payment.payment_method || "manual"] || payment.payment_method}
                      </td>
                      <td className="px-3 py-2 text-[11px] text-outline font-mono">
                        {payment.receipt_id || "—"}
                      </td>
                      <td className="px-3 py-2">
                        <span className={cn("inline-flex items-center gap-1 h-5 px-2 rounded-md text-[10px] font-medium", cfg.bg, cfg.color)}>
                          <StatusIcon className="w-2.5 h-2.5" />
                          {cfg.label}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-[11px] text-outline whitespace-nowrap">
                        {format(new Date(payment.created_at), "MMM d")}
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex items-center justify-end gap-1">
                          {payment.status !== "paid" && payment.status !== "rejected" && (
                            <button
                              onClick={() => handleStatusChange(payment.id, "paid")}
                              className="h-7 px-2.5 rounded-md bg-green-500/10 text-green-600 text-[11px] font-medium hover:bg-green-500/20"
                            >
                              Mark paid
                            </button>
                          )}
                          {payment.status !== "paid" && payment.status !== "rejected" && (
                            <button
                              onClick={() => {
                                setRejectTarget(payment);
                                setRejectReason("");
                              }}
                              className="h-7 px-2.5 rounded-md bg-red-500/10 text-red-600 text-[11px] font-medium hover:bg-red-500/20 inline-flex items-center gap-1"
                              title="Reject with reason"
                            >
                              <Ban className="w-3 h-3" />
                              Reject
                            </button>
                          )}
                          {payment.status === "paid" && (
                            <button
                              onClick={() => handleStatusChange(payment.id, "pending")}
                              className="h-7 px-2.5 rounded-md bg-amber-500/10 text-amber-600 text-[11px] font-medium hover:bg-amber-500/20"
                            >
                              Revert
                            </button>
                          )}
                          {payment.status === "rejected" && (
                            <button
                              onClick={() => handleStatusChange(payment.id, "pending")}
                              className="h-7 px-2.5 rounded-md bg-amber-500/10 text-amber-600 text-[11px] font-medium hover:bg-amber-500/20"
                            >
                              Restore
                            </button>
                          )}
                          <button
                            onClick={() => handleDelete(payment.id)}
                            className="h-7 w-7 inline-flex items-center justify-center rounded-md text-red-500/70 hover:text-red-500 hover:bg-red-500/10"
                            title="Delete record"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                          {payment.status !== "refunded" && (
                            <button
                              onClick={() => handleConvertToCredits(payment)}
                              disabled={payment.is_converted}
                              className={cn(
                                "h-7 px-2.5 rounded-md text-[11px] font-medium inline-flex items-center gap-1 transition-colors",
                                payment.is_converted
                                  ? "bg-green-500/10 text-green-600 cursor-default"
                                  : "bg-tertiary/10 text-tertiary hover:bg-tertiary/20"
                              )}
                              title={payment.is_converted ? "Credits already issued" : "Convert to credits"}
                            >
                              {payment.is_converted ? (
                                <CheckCircle2 className="w-3 h-3" />
                              ) : (
                                <Coins className="w-3 h-3" />
                              )}
                              {payment.is_converted ? "Issued" : "Credits"}
                            </button>
                          )}
                        </div>
                      </td>
                    </motion.tr>
                  );
                })}
              </AnimatePresence>
            </tbody>
          </table>
        </div>

        {/* Mobile list */}
        <div className="md:hidden divide-y divide-outline-variant/10">
          <AnimatePresence mode="popLayout">
            {filtered.map((payment) => {
              const cfg = STATUS_CONFIG[payment.status] || STATUS_CONFIG.pending;
              const StatusIcon = cfg.icon;
              return (
                <motion.div
                  layout
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  key={payment.id}
                  className="p-3 flex items-start gap-3"
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm text-on-surface truncate">{payment.profiles?.full_name || "Unknown"}</p>
                    <p className="text-[11px] text-outline truncate">{payment.profiles?.cnic || payment.user_id.slice(0, 8)}</p>
                    <div className="mt-1 text-sm font-poppins font-semibold text-on-surface">
                      {payment.currency} {(payment.amount || 0).toLocaleString()}
                    </div>
                    <div className="mt-1 flex items-center flex-wrap gap-1.5">
                      <span className={cn("inline-flex items-center gap-1 h-5 px-2 rounded-md text-[10px] font-medium", cfg.bg, cfg.color)}>
                        <StatusIcon className="w-2.5 h-2.5" />
                        {cfg.label}
                      </span>
                      <span className="text-[10px] text-outline">{METHOD_LABELS[payment.payment_method || "manual"]}</span>
                      <span className="text-[10px] text-outline">{format(new Date(payment.created_at), "MMM d")}</span>
                    </div>
                  </div>
                  <div className="shrink-0 flex flex-col gap-1.5">
                    {payment.status !== "paid" && payment.status !== "rejected" && (
                      <>
                        <button
                          onClick={() => handleStatusChange(payment.id, "paid")}
                          className="h-7 px-2 rounded-md bg-green-500/10 text-green-600 text-[11px] font-medium"
                        >
                          Paid
                        </button>
                        <button
                          onClick={() => {
                            setRejectTarget(payment);
                            setRejectReason("");
                          }}
                          className="h-7 px-2 rounded-md bg-red-500/10 text-red-600 text-[11px] font-medium"
                        >
                          Reject
                        </button>
                      </>
                    )}
                    <button
                      onClick={() => handleDelete(payment.id)}
                      className="h-7 w-7 inline-flex items-center justify-center rounded-md text-red-500 bg-red-500/10"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                    {payment.status !== "refunded" && (
                      <button
                        onClick={() => handleConvertToCredits(payment)}
                        disabled={payment.is_converted}
                        className={cn(
                          "h-7 w-7 inline-flex items-center justify-center rounded-md transition-colors",
                          payment.is_converted
                            ? "bg-green-500/10 text-green-600 cursor-default"
                            : "bg-tertiary/10 text-tertiary hover:bg-tertiary/20"
                        )}
                        title={payment.is_converted ? "Issued" : "Credits"}
                      >
                        {payment.is_converted ? (
                          <CheckCircle2 className="w-3.5 h-3.5" />
                        ) : (
                          <Coins className="w-3.5 h-3.5" />
                        )}
                      </button>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>

        {filtered.length === 0 && (
          <div className="py-10 text-center">
            <Receipt className="w-6 h-6 text-outline mx-auto mb-2 opacity-60" />
            <p className="text-sm text-outline">No payments match your filters.</p>
          </div>
        )}
      </div>

      {/* Reject-with-reason modal */}
      <AnimatePresence>
        {rejectTarget && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => !rejectLoading && setRejectTarget(null)}
            role="presentation"
          >
            <motion.div
              initial={{ scale: 0.96, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.96, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              role="dialog"
              aria-modal="true"
              aria-labelledby="reject-payment-title"
              className="bg-surface w-full max-w-md rounded-lg border border-red-500/20 shadow-xl p-4 space-y-3"
            >
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-md bg-red-500/10 grid place-items-center shrink-0">
                  <AlertTriangle className="w-4 h-4 text-red-500" />
                </div>
                <div className="min-w-0">
                  <h2
                    id="reject-payment-title"
                    className="text-sm font-poppins font-semibold text-on-surface"
                  >
                    Reject payment
                  </h2>
                  <p className="text-[11px] text-on-surface-variant">
                    Marks the payment as rejected and appends the reason to its notes. Visible
                    to the student.
                  </p>
                </div>
              </div>

              <div className="rounded-md bg-surface-container-high border border-outline-variant/15 p-2 text-xs">
                <p className="font-medium text-on-surface truncate">
                  {rejectTarget.profiles?.full_name || "Unknown"}
                </p>
                <p className="text-outline">
                  {rejectTarget.currency || "PKR"} {(rejectTarget.amount || 0).toLocaleString()} &middot;{" "}
                  {METHOD_LABELS[rejectTarget.payment_method || "manual"] || rejectTarget.payment_method || "Manual"}
                  {rejectTarget.receipt_id ? ` · ${rejectTarget.receipt_id}` : ""}
                </p>
              </div>

              <div>
                <label
                  htmlFor="reject-reason"
                  className="text-[11px] font-medium text-on-surface-variant block mb-1"
                >
                  Reason <span className="text-red-500">*</span>
                </label>
                <textarea
                  id="reject-reason"
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  rows={3}
                  autoFocus
                  placeholder="e.g. receipt unreadable, amount doesn't match invoice…"
                  className="w-full px-2.5 py-1.5 rounded-md bg-surface-container-high border border-outline-variant/20 text-sm outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  disabled={rejectLoading}
                  onClick={() => setRejectTarget(null)}
                  className="h-8 px-3 rounded-md text-xs font-medium text-on-surface-variant hover:bg-surface-container-high"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={rejectLoading || rejectReason.trim().length < 3}
                  onClick={submitReject}
                  className="h-8 px-3 rounded-md text-xs font-poppins font-medium bg-red-500 text-white hover:bg-red-500/90 disabled:opacity-50 inline-flex items-center gap-1.5"
                >
                  {rejectLoading ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <Ban className="w-3 h-3" />
                  )}
                  Reject payment
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Add payment modal */}
      <AnimatePresence>
        {showAddModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => !loading && setShowAddModal(false)}
          >
            <motion.div
              initial={{ scale: 0.96, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.96, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-surface w-full max-w-md rounded-lg border border-outline-variant/20 shadow-xl"
            >
              <div className="flex items-center justify-between px-4 h-11 border-b border-outline-variant/10">
                <h2 className="text-sm font-poppins font-semibold text-on-surface">Record payment</h2>
                <button
                  onClick={() => !loading && setShowAddModal(false)}
                  className="h-7 w-7 inline-flex items-center justify-center rounded-md text-outline hover:bg-surface-container-high"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleAddPayment} className="p-4 space-y-3">
                <div>
                  <label className="text-[11px] text-outline mb-1 block">Student *</label>
                  <select
                    required
                    value={form.user_id}
                    onChange={(e) => setForm({ ...form, user_id: e.target.value })}
                    className="w-full px-3 h-9 rounded-md bg-surface-container-high border border-outline-variant/20 focus:border-tertiary focus:ring-1 focus:ring-tertiary outline-none text-sm"
                  >
                    <option value="">Select a student…</option>
                    {users.map((u) => (
                      <option key={u.user_id} value={u.user_id}>
                        {u.full_name || u.username || u.user_id.slice(0, 8)}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[11px] text-outline mb-1 block">Amount (PKR) *</label>
                    <input
                      required
                      type="number"
                      min="1"
                      step="0.01"
                      value={form.amount}
                      onChange={(e) => setForm({ ...form, amount: e.target.value })}
                      placeholder="25000"
                      className="w-full px-3 h-9 rounded-md bg-surface-container-high border border-outline-variant/20 focus:border-tertiary focus:ring-1 focus:ring-tertiary outline-none text-sm [appearance:textfield]"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-outline mb-1 block">Method</label>
                    <select
                      value={form.payment_method}
                      onChange={(e) => setForm({ ...form, payment_method: e.target.value })}
                      className="w-full px-3 h-9 rounded-md bg-surface-container-high border border-outline-variant/20 focus:border-tertiary focus:ring-1 focus:ring-tertiary outline-none text-sm"
                    >
                      <option value="manual">Manual / Admin</option>
                      <option value="cash">Cash</option>
                      <option value="bank_transfer">Bank Transfer</option>
                      <option value="safepay">Safepay</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="text-[11px] text-outline mb-1 block">Receipt / Transaction ID</label>
                  <input
                    type="text"
                    value={form.receipt_id}
                    onChange={(e) => setForm({ ...form, receipt_id: e.target.value })}
                    placeholder="TXN-2024-001"
                    className="w-full px-3 h-9 rounded-md bg-surface-container-high border border-outline-variant/20 focus:border-tertiary focus:ring-1 focus:ring-tertiary outline-none text-sm"
                  />
                </div>

                <div>
                  <label className="text-[11px] text-outline mb-1 block">Notes</label>
                  <textarea
                    value={form.notes}
                    onChange={(e) => setForm({ ...form, notes: e.target.value })}
                    rows={2}
                    placeholder="Optional: batch, installment…"
                    className="w-full px-3 py-2 rounded-md bg-surface-container-high border border-outline-variant/20 focus:border-tertiary focus:ring-1 focus:ring-tertiary outline-none text-sm resize-none"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-outline-variant/10">
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    disabled={loading}
                    className="h-9 px-3 rounded-md text-sm font-medium text-on-surface-variant hover:bg-surface-container-high disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="inline-flex items-center gap-1.5 h-9 px-3 rounded-md text-sm font-medium bg-tertiary text-white hover:bg-tertiary/90 disabled:opacity-50"
                  >
                    {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    Record
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
