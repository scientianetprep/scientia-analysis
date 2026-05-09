"use client";

import { createBrowserClient } from "@/lib/supabase/client";
import {
  Shield,
  CreditCard,
  Edit3,
  CheckCircle2,
  BarChart3,
  Award,
  Loader2,
  Save,
  X,
  Lock,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { cn } from "@/lib/utils";
import { PerformanceAnalytics } from "@/components/dashboard/PerformanceAnalytics";
import { PaymentHistory } from "@/components/dashboard/PaymentHistory";
import { CreditHistory } from "@/components/dashboard/CreditHistory";
import { AvatarUpload } from "@/components/dashboard/AvatarUpload";
import { AcademicUpdateModal } from "@/components/dashboard/AcademicUpdateModal";
import { toast } from "sonner";
import { ProfileSkeleton } from "@/components/dashboard/Skeletons";

interface UserProfile {
  user_id: string;
  full_name: string;
  username: string;
  avatar_url: string;
  is_academic_locked: boolean;
  role: string;
  status: string;
}

interface AcademicInfo {
  matric_board: string | null;
  matric_marks: string | number | null;
  matric_total: string | number | null;
  intermediate_board: string | null;
  intermediate_marks: string | number | null;
  intermediate_total: string | number | null;
}

interface UserScore {
  [key: string]: unknown;
  id: string;
  test_id: string;
  correct_count: number;
  total_count: number;
  percentage: number;
  created_at: string;
}

interface UserPayment {
  id: string;
  amount: number;
  currency: string;
  status: "pending" | "completed" | "failed";
  receipt_id: string;
  payment_method: string | null;
  created_at: string;
}

export default function ProfilePage() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [academicInfo, setAcademicInfo] = useState<AcademicInfo | null>(null);
  const [scores, setScores] = useState<UserScore[]>([]);
  const [payments, setPayments] = useState<UserPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [showAcademicModal, setShowAcademicModal] = useState(false);
  const [activeTab, setActiveTab] = useState<"identity" | "academic" | "analytics">("identity");
  const [isUpdating, startUpdate] = useTransition();

  const supabase = createBrowserClient();

  useEffect(() => {
    async function fetchData() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const [p, ai, s, pay] = await Promise.all([
        supabase.from("profiles").select("user_id, full_name, username, avatar_url, is_academic_locked, role, status").eq("user_id", user.id).single(),
        supabase.from("academic_info").select("matric_board, matric_marks, matric_total, intermediate_board, intermediate_marks, intermediate_total").eq("user_id", user.id).single(),
        supabase.from("scores").select("id, test_id, correct_count, total_count, percentage, created_at").eq("user_id", user.id).order("created_at", { ascending: false }),
        supabase.from("payments").select("id, amount, status, payment_method, created_at, currency, receipt_id").eq("user_id", user.id).order("created_at", { ascending: false })
      ]);

      setProfile(p.data);
      setAcademicInfo(ai.data);
      setScores(s.data || []);
      setPayments(pay.data || []);
      setLoading(false);
    }
    fetchData();
  }, [supabase]);

  const handleUpdateProfile = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const fullName = formData.get("full_name") as string;
    const username = formData.get("username") as string;

    startUpdate(async () => {
      if (!profile) return;
      const { error } = await supabase
        .from("profiles")
        .update({ full_name: fullName, username })
        .eq("user_id", profile.user_id);

      if (error) toast.error(error.message);
      else {
        toast.success("Identity updated");
        setProfile({ ...profile, full_name: fullName, username });
        setIsEditing(false);
      }
    });
  };

  if (loading) return <ProfileSkeleton />;

  const isLocked = profile?.is_academic_locked;

  const calcPercent = (
    obtained: string | number | null | undefined,
    total: string | number | null | undefined
  ) => {
    const ob = parseFloat(String(obtained || "0"));
    const tot = parseFloat(String(total || "1100"));
    if (!isNaN(ob) && !isNaN(tot) && tot > 0) {
      return ((ob / tot) * 100).toFixed(1) + "%";
    }
    return "—";
  };

  const tabs: { id: typeof activeTab; label: string }[] = [
    { id: "identity", label: "Identity" },
    { id: "academic", label: "Transcript" },
    { id: "analytics", label: "Performance" },
  ];

  return (
    <div className="space-y-4">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl md:text-2xl font-poppins font-semibold text-on-surface tracking-tight">
            Profile
          </h1>
          <p className="text-sm text-on-surface-variant">
            Your credentials, records, and performance.
          </p>
        </div>

        <div className="inline-flex rounded-md bg-surface-container-high border border-outline-variant/15 p-0.5 self-start sm:self-center">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={cn(
                "h-8 px-3 rounded-[5px] text-xs font-medium transition-colors",
                activeTab === t.id
                  ? "bg-tertiary text-white"
                  : "text-outline hover:text-on-surface"
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Identity column */}
        <aside
          className={cn(
            "lg:col-span-4 space-y-3",
            activeTab !== "identity" && "hidden lg:block"
          )}
        >
          <section className="surface-card p-4 flex flex-col items-center text-center">
            <AvatarUpload
              userId={profile?.user_id || ""}
              currentUrl={profile?.avatar_url || ""}
            />
            <div className="mt-3 space-y-1">
              <h2 className="text-base font-poppins font-semibold text-on-surface">
                {profile?.full_name}
              </h2>
              <div className="flex items-center justify-center gap-1.5 text-xs text-outline">
                <span>@{profile?.username || "scholar"}</span>
                <span className="w-1 h-1 rounded-full bg-green-500" />
                <span className="text-green-600">Active</span>
              </div>
            </div>

            <div className="w-full mt-3 space-y-2 text-left">
              <div className="px-3 h-9 flex items-center justify-between rounded-md bg-surface-container-low border border-outline-variant/15">
                <span className="text-[11px] text-outline">Reference</span>
                <span className="text-xs font-poppins font-medium text-on-surface">
                  #{profile?.user_id?.substring(0, 8).toUpperCase() || "PENDING"}
                </span>
              </div>

              {isEditing ? (
                <form onSubmit={handleUpdateProfile} className="space-y-2">
                  <div className="space-y-1">
                    <label className="text-[11px] text-outline px-0.5">
                      Full name
                    </label>
                    <input
                      name="full_name"
                      defaultValue={profile?.full_name || ""}
                      required
                      className="w-full h-9 px-3 rounded-md bg-surface-container-high border border-outline-variant/20 focus:border-tertiary focus:ring-1 focus:ring-tertiary outline-none text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] text-outline px-0.5">
                      Username
                    </label>
                    <input
                      name="username"
                      defaultValue={profile?.username || ""}
                      required
                      minLength={4}
                      maxLength={12}
                      pattern="^[a-zA-Z0-9_.]+$"
                      className="w-full h-9 px-3 rounded-md bg-surface-container-high border border-outline-variant/20 focus:border-tertiary focus:ring-1 focus:ring-tertiary outline-none text-sm"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="submit"
                      disabled={isUpdating}
                      className="flex-1 h-9 rounded-md bg-tertiary text-white text-xs font-poppins font-medium inline-flex items-center justify-center gap-1.5 hover:bg-tertiary/90 disabled:opacity-50 transition-colors"
                    >
                      {isUpdating ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Save className="w-3.5 h-3.5" />
                      )}
                      Save
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsEditing(false)}
                      className="h-9 px-3 rounded-md bg-surface-container-high border border-outline-variant/20 text-xs font-medium text-on-surface hover:bg-surface-container-highest transition-colors"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </form>
              ) : (
                <button
                  onClick={() => setIsEditing(true)}
                  className="w-full h-9 rounded-md bg-tertiary text-white text-xs font-poppins font-medium inline-flex items-center justify-center gap-1.5 hover:bg-tertiary/90 transition-colors"
                >
                  <Edit3 className="w-3.5 h-3.5" /> Edit identity
                </button>
              )}

              <Link
                href="/dashboard/settings"
                className="w-full h-9 rounded-md border border-outline-variant/20 text-xs font-medium text-on-surface hover:bg-surface-container-high inline-flex items-center justify-center gap-1.5 transition-colors"
              >
                <Shield className="w-3.5 h-3.5" /> Security
              </Link>
            </div>
          </section>

          <section
            className={cn(
              "surface-card p-3 border-l-2",
              isLocked ? "border-l-orange-500" : "border-l-green-500"
            )}
          >
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-medium text-outline">
                Verification status
              </span>
              {isLocked ? (
                <Lock className="w-3.5 h-3.5 text-orange-500" />
              ) : (
                <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
              )}
            </div>
            <p className="text-xs text-on-surface-variant leading-relaxed">
              {isLocked
                ? "Academic records are locked & verified. Contact support to correct discrepancies."
                : "Records are self-reported. Ensure marks and boards are accurate."}
            </p>
          </section>
        </aside>

        {/* Main column */}
        <main
          className={cn(
            "lg:col-span-8 space-y-4",
            activeTab === "identity" && "hidden lg:block"
          )}
        >
          {/* Transcript */}
          <section
            className={cn("space-y-3", activeTab === "analytics" && "hidden")}
          >
            <div className="surface-card p-4">
              <div className="flex items-center justify-between mb-3 pb-3 border-b border-outline-variant/10">
                <div>
                  <h3 className="text-base font-poppins font-semibold text-on-surface">
                    Academic transcript
                  </h3>
                  <p className="text-xs text-outline">
                    Official records · {new Date().getFullYear()} session
                  </p>
                </div>
                <div className="w-8 h-8 rounded-md bg-surface-container-high grid place-items-center">
                  <Award className="w-4 h-4 text-tertiary" />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <TranscriptCard
                  title="Matriculation (SSC)"
                  board={academicInfo?.matric_board}
                  marks={academicInfo?.matric_marks}
                  percent={calcPercent(
                    academicInfo?.matric_marks,
                    academicInfo?.matric_total
                  )}
                  accent="bg-tertiary/10 text-tertiary"
                />
                <TranscriptCard
                  title="Intermediate (HSSC)"
                  board={academicInfo?.intermediate_board}
                  marks={academicInfo?.intermediate_marks}
                  percent={calcPercent(
                    academicInfo?.intermediate_marks,
                    academicInfo?.intermediate_total
                  )}
                  accent="bg-brand-primary/10 text-brand-primary"
                />
              </div>

              {!isLocked && (
                <div className="mt-4 flex justify-end">
                  {showAcademicModal && profile && (
                    <AcademicUpdateModal
                      onClose={() => setShowAcademicModal(false)}
                      userId={profile.user_id}
                      initialData={academicInfo as any}
                    />
                  )}
                  <button
                    onClick={() => setShowAcademicModal(true)}
                    className="h-9 px-4 rounded-md bg-on-surface text-surface text-xs font-poppins font-medium hover:bg-tertiary transition-colors"
                  >
                    Update transcript
                  </button>
                </div>
              )}
            </div>
          </section>

          {/* Analytics + Payments */}
          <section
            className={cn("space-y-3", activeTab === "academic" && "hidden")}
          >
            <div className="surface-card p-4">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-7 h-7 rounded-md bg-tertiary/10 grid place-items-center">
                  <BarChart3 className="w-3.5 h-3.5 text-tertiary" />
                </div>
                <div>
                  <h3 className="text-base font-poppins font-semibold text-on-surface">
                    Growth analytics
                  </h3>
                  <p className="text-xs text-outline">
                    Academic trajectory
                  </p>
                </div>
              </div>
              <div className="-mx-4 -mb-4">
                <PerformanceAnalytics data={scores || []} />
              </div>
            </div>

            <div className="surface-card p-4">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-7 h-7 rounded-md bg-brand-primary/10 grid place-items-center">
                  <CreditCard className="w-3.5 h-3.5 text-brand-primary" />
                </div>
                <div>
                  <h3 className="text-base font-poppins font-semibold text-on-surface">
                    Financial records
                  </h3>
                  <p className="text-xs text-outline">
                    Subscription & invoices
                  </p>
                </div>
              </div>
              <PaymentHistory payments={payments || []} />
            </div>

            {/* Credit transaction history */}
            <CreditHistory />
          </section>
        </main>
      </div>
    </div>
  );
}

function TranscriptCard({
  title,
  board,
  marks,
  percent,
  accent,
}: {
  title: string;
  board?: string | null;
  marks?: string | number | null;
  percent: string;
  accent: string;
}) {
  return (
    <div className="surface-card p-3 space-y-2.5">
      <div className="flex items-center gap-2">
        <div className={cn("w-6 h-6 rounded-md grid place-items-center", accent)}>
          <Award className="w-3.5 h-3.5" />
        </div>
        <span className="text-xs font-medium text-on-surface">{title}</span>
      </div>

      <div className="space-y-1.5">
        <div className="grid grid-cols-[96px_1fr] gap-2 text-xs">
          <span className="text-outline">Board</span>
          <span className="text-on-surface font-medium">{board || "N/A"}</span>
        </div>
        <div className="grid grid-cols-[96px_1fr] gap-2 text-xs">
          <span className="text-outline">Marks</span>
          <span className="text-on-surface font-medium tabular-nums">
            {marks || "N/A"}
          </span>
        </div>
        <div className="grid grid-cols-[96px_1fr] gap-2 text-xs">
          <span className="text-outline">Percentage</span>
          <span className="text-on-surface font-poppins font-semibold tabular-nums">
            {percent}
          </span>
        </div>
      </div>
    </div>
  );
}
