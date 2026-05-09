"use client";

import { createBrowserClient } from "@/lib/supabase/client";
import {
  Shield,
  Lock,
  User,
  Trash2,
  ShieldCheck,
  ShieldAlert,
  Save,
  Loader2,
  Eye,
  EyeOff,
} from "lucide-react";
import { useEffect, useState, useTransition } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { SettingsSkeleton } from "@/components/dashboard/Skeletons";
import { MfaEnrollmentModal } from "@/components/dashboard/MfaEnrollmentModal";
import { useConfirm } from "@/components/ui/confirm-dialog";

export default function SettingsPage() {
  const [profile, setProfile] = useState<any>(null);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isUpdating, startUpdate] = useTransition();
  const [mfaEnabled, setMfaEnabled] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showMfaModal, setShowMfaModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [pendingDeletionId, setPendingDeletionId] = useState<string | null>(null);

  const confirm = useConfirm();
  const supabase = createBrowserClient();

  useEffect(() => {
    async function fetchSettings() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      setCurrentUser(user);

      const { data: profileData } = await supabase
        .from("profiles")
        .select("id, full_name, phone, whatsapp_number, role, status, course_tier")
        .eq("user_id", user.id)
        .single();

      const { data: factors } = await supabase.auth.mfa.listFactors();
      const isEnrolled = factors?.all?.some((f: { status: string }) => f.status === "verified");

      const { data: deletionReq } = await supabase
        .from("account_deletion_requests")
        .select("id")
        .eq("user_id", user.id)
        .in("status", ["pending", "scheduled"])
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      setProfile(profileData);
      setMfaEnabled(isEnrolled || false);
      setPendingDeletionId(deletionReq?.id || null);
      setLoading(false);
    }
    fetchSettings();
  }, [supabase]);

  const handleUpdatePassword = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const password = formData.get("password") as string;
    const confirm = formData.get("confirm") as string;

    if (!/[A-Z]/.test(password)) {
      toast.error("Password must contain at least 1 uppercase letter.");
      return;
    }
    if (password !== confirm) {
      toast.error("Passwords do not match");
      return;
    }

    startUpdate(async () => {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) toast.error(error.message);
      else {
        toast.success("Password updated");
        (e.target as HTMLFormElement).reset();
      }
    });
  };

  const handleDisableMfa = async () => {
    startUpdate(async () => {
      try {
        const { data: factors, error: listError } = await supabase.auth.mfa.listFactors();
        if (listError) throw listError;

        const verifiedFactor = factors.all.find((f) => f.status === "verified");
        if (!verifiedFactor) {
          // If no verified factor, just update profile state
          await supabase
            .from("profiles")
            .update({
              mfa_enrolled: false,
              mfa_totp_enabled: false,
              mfa_email_enabled: false,
            })
            .eq("user_id", currentUser.id);
          setMfaEnabled(false);
          return;
        }

        const { error: unenrollError } = await supabase.auth.mfa.unenroll({
          factorId: verifiedFactor.id,
        });
        if (unenrollError) throw unenrollError;

        await supabase
          .from("profiles")
          .update({
            mfa_enrolled: false,
            mfa_totp_enabled: false,
            mfa_email_enabled: false,
          })
          .eq("user_id", currentUser.id);
        setMfaEnabled(false);
        toast.success("MFA disabled successfully");
      } catch (err: any) {
        toast.error("Failed to disable MFA", { description: err.message });
      }
    });
  };

  const handleMfaAction = async () => {
    if (mfaEnabled) {
      const ok = await confirm({
        title: "Disable 2FA?",
        description: "Are you sure you want to disable Multi-factor authentication? This will reduce your account security significantly.",
        variant: "danger",
        confirmLabel: "Disable",
        cancelLabel: "Stay Secure",
      });
      if (ok) {
        handleDisableMfa();
      }
    } else {
      setShowMfaModal(true);
    }
  };

  const handleDeleteAccount = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const password = formData.get("delete_password") as string;
    const phone = formData.get("delete_phone") as string;
    const reason = formData.get("delete_reason") as string;

    if (!currentUser?.email) return;
    setIsDeleting(true);

    try {
      const strippedPhone = phone.replace(/\D/g, "");
      const strippedProfilePhone = (profile?.phone || "").replace(/\D/g, "");
      const strippedWhatsapp = (profile?.whatsapp_number || "").replace(/\D/g, "");
      
      const dbPhones = [strippedProfilePhone, strippedWhatsapp].filter(Boolean);
      
      if (dbPhones.length > 0) {
        // Compare last 10 digits to handle 03xx vs 923xx differences
        const matchesPhone = dbPhones.some(dbP => {
          const inputTail = strippedPhone.slice(-10);
          const dbTail = dbP.slice(-10);
          return inputTail === dbTail && inputTail.length >= 7; // Require at least 7 matching digits to be safe
        });
        
        if (!matchesPhone) {
          toast.error("Phone verification failed.");
          return;
        }
      }

      const { error: authError } = await supabase.auth.signInWithPassword({
        email: currentUser.email,
        password,
      });
      if (authError) {
        toast.error("Password verification failed.");
        return;
      }

      const { error: insertError } = await supabase
        .from("account_deletion_requests")
        .insert({
          user_id: currentUser.id,
          reason: reason || "User requested via Settings panel",
          status: "pending",
        });
      if (insertError) {
        toast.error("Failed to submit request.", { description: insertError.message });
        return;
      }

      toast.success("Account deletion requested", {
        description: "You will be signed out. The request will be processed within 48 hours.",
      });
      setShowDeleteModal(false);
      await supabase.auth.signOut();
      window.location.href = "/login?info=account_deleted";
    } catch (err: any) {
      toast.error("An unexpected error occurred", { description: err.message });
    } finally {
      setIsDeleting(false);
    }
  };

  const handleRevokeDeletion = async () => {
    if (!pendingDeletionId) return;
    setIsDeleting(true);
    try {
      // Hit the server route so profile.deletion_scheduled_at + status are
      // also cleared atomically and the confirmation email fires.
      const res = await fetch("/api/user/deletion/revoke", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Failed to cancel");
      toast.success("Deletion request cancelled");
      setPendingDeletionId(null);
    } catch (err: any) {
      toast.error("Failed to cancel", { description: err.message });
    } finally {
      setIsDeleting(false);
    }
  };

  if (loading) return <SettingsSkeleton />;

  return (
    <div className="max-w-3xl space-y-4">
      <header>
        <h1 className="text-xl md:text-2xl font-poppins font-semibold text-on-surface tracking-tight">
          Settings
        </h1>
        <p className="text-sm text-on-surface-variant">
          Manage your identity, security, and portal experience.
        </p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {/* Security */}
        <section className="surface-card p-4 space-y-3">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-md bg-tertiary/10 grid place-items-center">
              <Shield className="w-3.5 h-3.5 text-tertiary" />
            </div>
            <h3 className="text-base font-poppins font-semibold text-on-surface">
              Security
            </h3>
          </div>

          {/* MFA */}
          <div className="h-11 rounded-md border border-outline-variant/15 px-3 flex items-center justify-between">
            <div className="flex items-center gap-2 min-w-0">
              {mfaEnabled ? (
                <ShieldCheck className="w-4 h-4 text-green-500 shrink-0" />
              ) : (
                <ShieldAlert className="w-4 h-4 text-orange-500 shrink-0" />
              )}
              <div className="min-w-0">
                <div className="text-xs font-medium text-on-surface">
                  Multi-factor auth
                </div>
                <div
                  className={cn(
                    "text-[11px]",
                    mfaEnabled ? "text-green-600" : "text-orange-600"
                  )}
                >
                  {mfaEnabled ? "Active" : "Not enabled"}
                </div>
              </div>
            </div>
            <button
              onClick={handleMfaAction}
              disabled={isUpdating}
              className={cn(
                "h-7 px-2.5 rounded-md text-[11px] font-medium transition-colors disabled:opacity-50",
                mfaEnabled
                  ? "bg-red-500/10 text-red-600 hover:bg-red-500 hover:text-white"
                  : "bg-surface-container-highest text-on-surface hover:bg-tertiary hover:text-white"
              )}
            >
              {isUpdating ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : mfaEnabled ? (
                "Disable"
              ) : (
                "Enable"
              )}
            </button>
          </div>

          {/* Password */}
          <form onSubmit={handleUpdatePassword} className="space-y-2">
            <div className="space-y-1">
              <label
                htmlFor="settings-password"
                className="text-[11px] text-outline px-0.5"
              >
                New password
              </label>
              <div className="relative">
                <Lock className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-outline" />
                <input
                  id="settings-password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  className="w-full h-9 pl-8 pr-8 rounded-md bg-surface-container-high border border-outline-variant/20 focus:border-tertiary focus:ring-1 focus:ring-tertiary outline-none text-sm"
                  aria-required="true"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-outline hover:text-on-surface transition-colors"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>
            <div className="space-y-1">
              <label
                htmlFor="settings-confirm"
                className="text-[11px] text-outline px-0.5"
              >
                Confirm password
              </label>
              <div className="relative">
                <Lock className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-outline" />
                <input
                  id="settings-confirm"
                  name="confirm"
                  type={showConfirmPassword ? "text" : "password"}
                  placeholder="••••••••"
                  className="w-full h-9 pl-8 pr-8 rounded-md bg-surface-container-high border border-outline-variant/20 focus:border-tertiary focus:ring-1 focus:ring-tertiary outline-none text-sm"
                  aria-required="true"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-outline hover:text-on-surface transition-colors"
                  aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                >
                  {showConfirmPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>
            <button
              type="submit"
              disabled={isUpdating}
              className="w-full h-9 rounded-md bg-tertiary text-white text-xs font-poppins font-medium inline-flex items-center justify-center gap-1.5 hover:bg-tertiary/90 disabled:opacity-50 transition-colors"
            >
              {isUpdating ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Save className="w-3.5 h-3.5" />
              )}
              Change password
            </button>
          </form>
        </section>

        {/* Account */}
        <section className="surface-card p-4 space-y-3">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-md bg-brand-primary/10 grid place-items-center">
              <User className="w-3.5 h-3.5 text-brand-primary" />
            </div>
            <h3 className="text-base font-poppins font-semibold text-on-surface">
              Account
            </h3>
          </div>

          <div className="space-y-1.5">
            <InfoRow label="Full name" value={profile?.full_name} />
            <InfoRow
              label="Student ID"
              value={`SC-${profile?.id?.split("-")[0]?.toUpperCase() ?? ""}`}
            />
            <InfoRow label="Course tier" value={profile?.course_tier || "Free tier"} />
          </div>

          <div className="pt-2 border-t border-outline-variant/10">
            {pendingDeletionId ? (
              <div className="surface-card !bg-amber-500/10 !border-amber-500/30 p-3 text-center space-y-2">
                <p className="text-amber-600 text-xs font-medium">
                  Account scheduled for deletion.
                </p>
                <button
                  onClick={handleRevokeDeletion}
                  disabled={isDeleting}
                  className="w-full h-9 rounded-md bg-amber-500 text-white text-xs font-poppins font-medium hover:bg-amber-600 disabled:opacity-50 transition-colors"
                >
                  {isDeleting ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin mx-auto" />
                  ) : (
                    "Cancel deletion request"
                  )}
                </button>
              </div>
            ) : (
              <>
                <button
                  onClick={() => setShowDeleteModal(true)}
                  className="w-full h-9 rounded-md border border-red-500/30 text-red-500 text-xs font-poppins font-medium inline-flex items-center justify-center gap-1.5 hover:bg-red-500/5 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Delete account
                </button>
                <p className="text-[11px] text-outline text-center mt-1.5">
                  This action is permanent.
                </p>
              </>
            )}
          </div>
        </section>
      </div>

      {/* Delete modal */}
      <AnimatePresence>
        {showDeleteModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => !isDeleting && setShowDeleteModal(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.97, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.97, y: 8 }}
              className="relative w-full max-w-md surface-card p-4 shadow-xl flex flex-col gap-3"
            >
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-md bg-red-500/10 grid place-items-center shrink-0">
                  <ShieldAlert className="w-4 h-4 text-red-500" />
                </div>
                <div>
                  <h3 className="text-base font-poppins font-semibold text-on-surface">
                    Delete account
                  </h3>
                  <p className="text-[11px] text-red-500">Danger zone</p>
                </div>
              </div>

              <p className="text-xs text-on-surface-variant bg-surface-container-high p-2.5 rounded-md border border-outline-variant/10 leading-relaxed">
                Permanent deletion. All data, certificates, and scores will be
                purged within 48 hours.{" "}
                <span className="font-medium text-on-surface">
                  Cannot be reversed.
                </span>
              </p>

              <form onSubmit={handleDeleteAccount} className="space-y-2">
                <FieldLabel>Verify password</FieldLabel>
                <input
                  required
                  name="delete_password"
                  type="password"
                  placeholder="Current password"
                  className="w-full h-9 px-3 rounded-md bg-surface-container-high border border-outline-variant/20 focus:border-red-500 focus:ring-1 focus:ring-red-500 outline-none text-sm"
                />
                <FieldLabel>Verify mobile</FieldLabel>
                <input
                  required
                  name="delete_phone"
                  type="tel"
                  placeholder="Verified mobile number"
                  className="w-full h-9 px-3 rounded-md bg-surface-container-high border border-outline-variant/20 focus:border-red-500 focus:ring-1 focus:ring-red-500 outline-none text-sm"
                />
                <FieldLabel>Reason (optional)</FieldLabel>
                <textarea
                  name="delete_reason"
                  rows={2}
                  placeholder="Why are you leaving?"
                  className="w-full p-2.5 rounded-md bg-surface-container-high border border-outline-variant/20 focus:border-red-500 focus:ring-1 focus:ring-red-500 outline-none text-sm resize-none"
                />

                <div className="flex gap-2 pt-1">
                  <button
                    type="button"
                    disabled={isDeleting}
                    onClick={() => setShowDeleteModal(false)}
                    className="flex-1 h-9 rounded-md border border-outline-variant/20 text-xs font-medium text-on-surface-variant hover:bg-surface-container-high disabled:opacity-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isDeleting}
                    className="flex-[2] h-9 rounded-md bg-red-500/10 text-red-600 border border-red-500/20 text-xs font-poppins font-medium hover:bg-red-500/20 inline-flex items-center justify-center gap-1.5 disabled:opacity-50 transition-colors"
                  >
                    {isDeleting ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="w-3.5 h-3.5" />
                    )}
                    Submit deletion request
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <MfaEnrollmentModal
        isOpen={showMfaModal}
        onClose={() => setShowMfaModal(false)}
        onSuccess={() => setMfaEnabled(true)}
      />
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value?: string }) {
  return (
    <div className="px-3 h-11 rounded-md bg-surface-container-low border border-outline-variant/15 flex items-center justify-between">
      <span className="text-[11px] text-outline">{label}</span>
      <span className="text-xs font-poppins font-medium text-on-surface truncate ml-2">
        {value || "—"}
      </span>
    </div>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label className="text-[11px] text-outline px-0.5 block">{children}</label>
  );
}
