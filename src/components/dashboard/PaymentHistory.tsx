"use client";

import {
  CreditCard,
  Download,
  Receipt,
  ArrowUpRight,
  Loader2,
  Calendar,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";

interface Payment {
  id: string;
  amount: number;
  currency: string;
  status: "pending" | "completed" | "failed";
  receipt_id: string;
  // payment_method may be null for legacy rows created before the column
  // was required. Kept optional here so the dashboard profile card and the
  // admin payment tab can share this component without extra mapping.
  payment_method?: string | null;
  created_at: string;
}

interface PaymentHistoryProps {
  payments: Payment[];
}

export function PaymentHistory({ payments }: PaymentHistoryProps) {
  const [downloading, setDownloading] = useState(false);

  const handleDownload = () => {
    if (downloading) return;
    setDownloading(true);
    setTimeout(() => {
      const blob = new Blob(
        [
          "%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF",
        ],
        { type: "application/pdf" }
      );
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "Scientia_Financial_Statement.pdf";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      setDownloading(false);
    }, 1200);
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-3">
        <div>
          <h3 className="text-xl md:text-2xl font-poppins font-semibold tracking-tight text-on-surface">
            Financial records
          </h3>
          <p className="text-xs text-on-surface-variant mt-0.5">
            A comprehensive log of your subscription history.
          </p>
        </div>
        <button
          onClick={handleDownload}
          disabled={downloading}
          className="inline-flex items-center justify-center gap-1.5 h-9 px-3 rounded-md bg-on-surface text-surface text-xs font-poppins font-medium hover:bg-tertiary hover:text-white transition-colors disabled:opacity-50"
        >
          {downloading ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Download className="w-3.5 h-3.5" />
          )}
          Download statement
        </button>
      </div>

      {payments && payments.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {payments.map((payment) => (
            <div
              key={payment.id}
              className="surface-card p-4 flex flex-col gap-3"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-9 h-9 rounded-md bg-surface-container-high flex items-center justify-center shrink-0">
                    <CreditCard className="w-4 h-4 text-tertiary" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-poppins font-semibold text-on-surface truncate">
                      Elite Scholar Access
                    </p>
                    <p className="text-[11px] text-outline">
                      TRX:{" "}
                      <span className="text-on-surface-variant tabular-nums">
                        #{payment.id.substring(0, 8).toUpperCase()}
                      </span>
                    </p>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <div className="flex items-baseline justify-end gap-1">
                    <span className="text-[11px] font-medium text-outline">
                      {payment.currency}
                    </span>
                    <span className="text-base font-poppins font-semibold text-on-surface tabular-nums">
                      {payment.amount.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex items-center justify-end gap-1 mt-0.5">
                    <Calendar className="w-3 h-3 text-outline/50" />
                    <span className="text-[11px] text-outline tabular-nums">
                      {new Date(payment.created_at).toLocaleDateString(
                        undefined,
                        { dateStyle: "medium" }
                      )}
                    </span>
                  </div>
                </div>
              </div>

              <div className="pt-2.5 border-t border-dashed border-outline-variant/20 flex items-center justify-between">
                <div
                  className={cn(
                    "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-poppins font-medium capitalize",
                    payment.status === "completed"
                      ? "bg-green-500/10 text-green-600 border border-green-500/20"
                      : payment.status === "failed"
                      ? "bg-brand-accent/10 text-brand-accent border border-brand-accent/20"
                      : "bg-orange-500/10 text-orange-600 border border-orange-500/20"
                  )}
                >
                  <div
                    className={cn(
                      "w-1.5 h-1.5 rounded-full",
                      payment.status === "completed"
                        ? "bg-green-500"
                        : payment.status === "failed"
                        ? "bg-brand-accent"
                        : "bg-orange-500 animate-pulse"
                    )}
                  />
                  {payment.status}
                </div>

                <button className="inline-flex items-center gap-1 text-[11px] font-poppins font-medium text-tertiary hover:underline">
                  Details
                  <ArrowUpRight className="w-3 h-3" />
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="surface-card p-8 flex flex-col items-center justify-center text-center gap-3">
          <div className="w-12 h-12 rounded-full bg-surface-container-high flex items-center justify-center">
            <Receipt className="w-5 h-5 text-outline-variant" />
          </div>
          <div className="space-y-1 max-w-sm">
            <h4 className="text-sm font-poppins font-semibold text-on-surface">
              No records found
            </h4>
            <p className="text-xs text-on-surface-variant leading-relaxed">
              You haven&apos;t made any transactions yet. Your subscription details will appear here once active.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
