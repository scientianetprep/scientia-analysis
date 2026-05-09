"use client";

import { useState } from "react";
import { LifeBuoy, Loader2, X, Send, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

/**
 * Compact "Need help?" trigger + inline modal form used on the login and
 * register screens. Submits to POST /api/support, which emails the
 * configured support inbox and sends the user a confirmation.
 */
export function SupportForm() {
  const [open, setOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");

  const reset = () => {
    setName("");
    setEmail("");
    setSubject("");
    setMessage("");
    setSent(false);
  };

  const close = () => {
    setOpen(false);
    // Delay reset so the closing animation doesn't flash the empty state.
    setTimeout(reset, 200);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (sending) return;
    setSending(true);
    try {
      const res = await fetch("/api/support", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, subject, message }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to send");
      setSent(true);
      toast.success("Message sent", {
        description: "We'll reply within one business day.",
      });
    } catch (err: any) {
      toast.error(err?.message ?? "Could not send your message");
    } finally {
      setSending(false);
    }
  };

  const inputClass =
    "w-full h-9 px-2.5 rounded-md bg-surface-container-high border border-outline-variant/20 text-sm outline-none focus:border-tertiary focus:ring-1 focus:ring-tertiary transition-colors";

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 text-[11px] font-medium text-on-surface-variant hover:text-on-surface transition-colors"
      >
        <LifeBuoy className="w-3 h-3" />
        Need help?
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-start md:items-center justify-center p-3 md:p-4 bg-black/50 backdrop-blur-sm overflow-y-auto"
          onClick={close}
          role="dialog"
          aria-modal="true"
          aria-labelledby="support-form-title"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md surface-card shadow-xl overflow-hidden my-4"
          >
            <div className="px-4 py-3 border-b border-outline-variant/15 flex items-center justify-between">
              <div>
                <h2
                  id="support-form-title"
                  className="text-base font-poppins font-semibold text-on-surface"
                >
                  Contact support
                </h2>
                <p className="text-[11px] text-on-surface-variant">
                  We&apos;ll reply by email within one business day.
                </p>
              </div>
              <button
                onClick={close}
                className="h-8 w-8 rounded-md grid place-items-center text-outline hover:bg-surface-container-high transition-colors"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {sent ? (
              <div className="p-5 text-center space-y-2.5">
                <div className="mx-auto w-10 h-10 rounded-full bg-green-500/10 grid place-items-center">
                  <CheckCircle2 className="w-5 h-5 text-green-500" />
                </div>
                <h3 className="text-sm font-poppins font-semibold text-on-surface">
                  Thanks, we&apos;ve received your message.
                </h3>
                <p className="text-xs text-on-surface-variant">
                  A confirmation is on its way to{" "}
                  <span className="font-medium text-on-surface">{email}</span>.
                </p>
                <button
                  onClick={close}
                  className="mt-2 h-9 px-4 rounded-md bg-tertiary text-white text-xs font-poppins font-medium hover:bg-tertiary/90 transition-colors"
                >
                  Close
                </button>
              </div>
            ) : (
              <form onSubmit={submit} className="px-4 py-4 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div className="space-y-1">
                    <label className="text-[11px] font-medium text-on-surface-variant">
                      Your name
                    </label>
                    <input
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className={inputClass}
                      maxLength={120}
                      autoComplete="name"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] font-medium text-on-surface-variant">
                      Email
                    </label>
                    <input
                      required
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className={inputClass}
                      maxLength={200}
                      autoComplete="email"
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-medium text-on-surface-variant">
                    Subject
                  </label>
                  <input
                    required
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    className={inputClass}
                    maxLength={160}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-medium text-on-surface-variant">
                    Message
                  </label>
                  <textarea
                    required
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    rows={5}
                    minLength={10}
                    maxLength={4000}
                    className="w-full px-2.5 py-2 rounded-md bg-surface-container-high border border-outline-variant/20 text-sm outline-none focus:border-tertiary focus:ring-1 focus:ring-tertiary transition-colors resize-y"
                  />
                  <p className="text-[10px] text-outline">
                    {message.length}/4000
                  </p>
                </div>
                <button
                  type="submit"
                  disabled={sending}
                  className="w-full h-10 rounded-md bg-tertiary text-white text-sm font-poppins font-medium hover:bg-tertiary/90 disabled:opacity-60 inline-flex items-center justify-center gap-1.5 transition-colors"
                >
                  {sending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                  Send message
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}
