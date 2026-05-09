"use client";

import { createContext, useCallback, useContext, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Root-cause replacement for every window.confirm / window.alert / window.prompt
 * call in the app. Provides a single themed, accessible confirm modal via the
 * `useConfirm()` hook. Usage:
 *
 *   const confirm = useConfirm();
 *   const ok = await confirm({ title: "Delete?", description: "...", variant: "danger" });
 *   if (!ok) return;
 */

type Variant = "danger" | "warning" | "default";

type ConfirmOptions = {
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: Variant;
};

type Pending = ConfirmOptions & { resolve: (ok: boolean) => void; mode: "confirm" | "alert" };

type AlertOptions = Omit<ConfirmOptions, "cancelLabel">;

type Ctx = {
  confirm: (opts: ConfirmOptions) => Promise<boolean>;
  alert: (opts: AlertOptions) => Promise<void>;
};

const ConfirmCtx = createContext<Ctx | null>(null);

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [pending, setPending] = useState<Pending | null>(null);

  const confirm = useCallback(
    (opts: ConfirmOptions) =>
      new Promise<boolean>((resolve) => {
        setPending({ ...opts, resolve, mode: "confirm" });
      }),
    []
  );

  const alertFn = useCallback(
    (opts: AlertOptions) =>
      new Promise<void>((resolve) => {
        setPending({
          ...opts,
          resolve: () => resolve(),
          mode: "alert",
        });
      }),
    []
  );

  const close = useCallback(
    (ok: boolean) => {
      pending?.resolve(ok);
      setPending(null);
    },
    [pending]
  );

  const variant: Variant = pending?.variant ?? "default";
  const accent =
    variant === "danger"
      ? "text-red-500 bg-red-500/10"
      : variant === "warning"
        ? "text-amber-500 bg-amber-500/10"
        : "text-tertiary bg-tertiary/10";
  const confirmBtn =
    variant === "danger"
      ? "bg-red-500 hover:bg-red-500/90 text-white"
      : variant === "warning"
        ? "bg-amber-500 hover:bg-amber-500/90 text-white"
        : "bg-tertiary hover:bg-tertiary/90 text-white";

  return (
    <ConfirmCtx.Provider value={{ confirm, alert: alertFn }}>
      {children}
      <AnimatePresence>
        {pending && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => close(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div
              role="alertdialog"
              aria-modal="true"
              aria-labelledby="confirm-title"
              initial={{ opacity: 0, scale: 0.96, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 4 }}
              transition={{ type: "spring", damping: 26, stiffness: 320 }}
              className="relative w-full max-w-sm surface-card p-4 space-y-3"
            >
              <div className="flex items-start gap-3">
                <div className={cn("w-9 h-9 rounded-md grid place-items-center shrink-0", accent)}>
                  <AlertTriangle className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 id="confirm-title" className="text-sm font-poppins font-semibold text-on-surface">
                    {pending.title}
                  </h3>
                  {pending.description && (
                    <p className="mt-1 text-xs text-on-surface-variant leading-relaxed">
                      {pending.description}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-1">
                {pending.mode === "confirm" && (
                  <button
                    type="button"
                    onClick={() => close(false)}
                    className="h-8 px-3 rounded-md text-xs font-medium text-on-surface-variant hover:bg-surface-container-high transition-colors"
                  >
                    {pending.cancelLabel ?? "Cancel"}
                  </button>
                )}
                <button
                  type="button"
                  autoFocus
                  onClick={() => close(true)}
                  className={cn(
                    "h-8 px-3 rounded-md text-xs font-poppins font-medium inline-flex items-center gap-1.5 transition-colors",
                    confirmBtn
                  )}
                >
                  {pending.confirmLabel ?? "Confirm"}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </ConfirmCtx.Provider>
  );
}

export function useConfirm() {
  const ctx = useContext(ConfirmCtx);
  if (!ctx) {
    // Fallback so places outside the provider keep working; logs a warning.
    if (typeof window !== "undefined") {
      console.warn("[v0] useConfirm() used outside ConfirmProvider — falling back to window.confirm");
      return async (opts: ConfirmOptions) =>
        window.confirm(`${opts.title}${opts.description ? "\n\n" + opts.description : ""}`);
    }
    return async () => false;
  }
  return ctx.confirm;
}

export function useAlert() {
  const ctx = useContext(ConfirmCtx);
  if (!ctx) {
    if (typeof window !== "undefined") {
      console.warn("[v0] useAlert() used outside ConfirmProvider — falling back to window.alert");
      return async (opts: AlertOptions) => {
        window.alert(`${opts.title}${opts.description ? "\n\n" + opts.description : ""}`);
      };
    }
    return async () => {};
  }
  return ctx.alert;
}

// Convenience: a non-hook helper still returns a boolean via an event bus.
// Kept for rare server-boundary call-sites; prefer useConfirm() in components.
export { Loader2 as ConfirmSpinner };
