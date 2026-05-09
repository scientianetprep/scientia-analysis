"use client";

import {
  Trophy,
  BookOpen,
  ChevronRight,
  Zap,
  PenTool,
  ShieldAlert,
} from "lucide-react";
import { WeakAreaAnalysis } from "@/components/dashboard/WeakAreaAnalysis";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { dismissMfaPrompt } from "@/app/actions/user-preferences";
import { MfaEnrollmentModal } from "@/components/dashboard/MfaEnrollmentModal";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";

interface StudentDashboardProps {
  profile: any;
  showMfaPrompt?: boolean;
  activeSession?: any;
  stats: {
    totalAttempts: number;
    bestScore: number;
    lessonsCompleted: number;
    recentScores: any[];
    daysActive: number;
    currentStreak: number;
    totalLessons: number;
    recentCourse?: any;
  };
}

export function StudentDashboard({
  profile,
  showMfaPrompt,
  activeSession,
  stats,
}: StudentDashboardProps) {
  const {
    totalAttempts,
    bestScore,
    lessonsCompleted,
    recentScores,
    currentStreak,
    totalLessons,
    recentCourse,
  } = stats;
  const [isPromptVisible, setIsPromptVisible] = useState(false);
  const [showEnrollmentModal, setShowEnrollmentModal] = useState(false);

  useEffect(() => {
    if (showMfaPrompt) {
      const timer = setTimeout(() => setIsPromptVisible(true), 1000);
      return () => clearTimeout(timer);
    }
  }, [showMfaPrompt]);

  const handleDismissPrompt = async () => {
    setIsPromptVisible(false);
    await dismissMfaPrompt();
  };

  const coursePct = Math.round((lessonsCompleted / (totalLessons || 1)) * 100);

  const stats3 = [
    {
      href: "/dashboard/history",
      icon: PenTool,
      iconColor: "text-tertiary",
      iconBg: "bg-tertiary/10",
      value: totalAttempts,
      label: "Tests",
    },
    {
      href: "/dashboard/courses",
      icon: BookOpen,
      iconColor: "text-brand-primary",
      iconBg: "bg-brand-primary/10",
      value: lessonsCompleted,
      label: "Lessons",
    },
    {
      href: "#",
      icon: Zap,
      iconColor: currentStreak > 0 ? "text-orange-500" : "text-orange-500/50",
      iconBg: "bg-orange-500/10",
      value: currentStreak,
      label: "Day streak",
    },
  ];

  return (
    <div className="space-y-5 md:space-y-6 animate-fade-in">
      {/* Header */}
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl md:text-2xl font-poppins font-semibold tracking-tight text-on-surface">
            Hello,{" "}
            <span className="text-tertiary">
              {profile.full_name?.split(" ")[0] || "Scholar"}
            </span>
          </h1>
          <p className="text-sm text-on-surface-variant mt-0.5">
            Keep the momentum high.
          </p>
        </div>
        <div className="flex items-center gap-1.5 px-2.5 h-7 rounded-full bg-green-500/10 border border-green-500/20 shrink-0">
          <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
          <span className="text-[11px] font-medium text-green-500">Active</span>
        </div>
      </header>

      {/* Hero + Stats row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 md:gap-4">
        {/* Aggregate hero card */}
        <div className="lg:col-span-2 relative overflow-hidden rounded-lg p-5 bg-gradient-to-br from-tertiary to-tertiary/80 text-white">
          <div className="absolute top-0 right-0 w-40 h-40 bg-white/5 rounded-full -mr-20 -mt-20 blur-3xl" />
          <div className="relative flex items-start justify-between gap-3">
            <div className="flex items-center gap-2">
              <Trophy className="w-4 h-4" />
              <span className="text-xs font-medium opacity-90">
                Aggregate Rank
              </span>
            </div>
            <Link
              href="/dashboard/leaderboard"
              className="text-xs opacity-80 hover:opacity-100 transition-opacity"
            >
              Hall of Fame →
            </Link>
          </div>
          <div className="relative mt-3 flex items-baseline gap-2">
            <span className="text-2xl md:text-3xl font-poppins font-semibold tabular-nums leading-none">
              {Math.round(bestScore)}
              <span className="text-lg opacity-70">%</span>
            </span>
            <div className="flex flex-col leading-tight">
              <span className="text-xs font-medium">Best</span>
              <span className="text-[11px] opacity-70">Top 5%</span>
            </div>
          </div>
          <div className="relative mt-4 pt-3 border-t border-white/15 flex items-center justify-between gap-3">
            <div className="flex flex-col leading-tight">
              <span className="text-[11px] opacity-70">Target</span>
              <span className="text-sm font-semibold">160+ / 200</span>
            </div>
            <Link
              href={
                activeSession
                  ? `/dashboard/tests/session/${activeSession.id}`
                  : "/dashboard/tests"
              }
              className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-white/15 hover:bg-white/25 text-xs font-medium transition-colors"
            >
              {activeSession ? (
                <>
                  Resume <ChevronRight className="w-3.5 h-3.5" />
                </>
              ) : (
                <>
                  Practice <Zap className="w-3.5 h-3.5 fill-white" />
                </>
              )}
            </Link>
          </div>
        </div>

        {/* Stat strip */}
        <div className="grid grid-cols-3 gap-2.5 lg:grid-cols-1 lg:gap-2.5">
          {stats3.map(({ href, icon: Icon, iconColor, iconBg, value, label }) => {
            const isLink = href !== "#";
            const inner = (
              <>
                <div
                  className={cn(
                    "w-7 h-7 rounded-md flex items-center justify-center",
                    iconBg
                  )}
                >
                  <Icon className={cn("w-3.5 h-3.5", iconColor)} />
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="text-lg font-poppins font-semibold text-on-surface tabular-nums">
                    {value}
                  </span>
                </div>
                <span className="text-[11px] text-outline">{label}</span>
              </>
            );
            if (isLink) {
              return (
                <Link
                  key={label}
                  href={href}
                  className="flex flex-col gap-1.5 p-3 rounded-md border border-outline-variant/15 bg-surface-container-low hover:bg-surface-container-high/60 transition-colors"
                >
                  {inner}
                </Link>
              );
            }
            return (
              <div
                key={label}
                className="flex flex-col gap-1.5 p-3 rounded-md border border-outline-variant/15 bg-surface-container-low"
              >
                {inner}
              </div>
            );
          })}
        </div>
      </div>

      {/* Weak area analysis */}
      <WeakAreaAnalysis />

      {/* Recent Activity + Learning Journey */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 md:gap-4">
        {/* Recent Activity */}
        <section className="rounded-lg border border-outline-variant/15 bg-surface-container-low p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-on-surface">
              Recent Activity
            </h3>
            <Link
              href="/dashboard/history"
              className="text-xs text-tertiary hover:underline"
            >
              View all
            </Link>
          </div>
          <div className="space-y-1">
            {recentScores && recentScores.length > 0 ? (
              recentScores.map((score: any) => (
                <Link
                  key={score.id}
                  href={`/dashboard/history#${score.id}`}
                  className="flex items-center gap-2.5 h-11 px-2 rounded-md hover:bg-surface-container-high/60 transition-colors"
                >
                  <div className="w-8 h-8 rounded-md bg-surface-container-high flex items-center justify-center text-xs font-semibold text-tertiary shrink-0">
                    {Math.round(score.percentage)}%
                  </div>
                  <div className="flex flex-col min-w-0 flex-1 leading-tight">
                    <span className="text-sm font-medium text-on-surface truncate">
                      {score.tests?.name}
                    </span>
                    <span className="text-[11px] text-outline">
                      {format(new Date(score.created_at), "dd MMM yyyy")}
                    </span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-outline shrink-0" />
                </Link>
              ))
            ) : (
              <p className="text-sm text-on-surface-variant text-center py-6">
                No test activity yet.
              </p>
            )}
          </div>
        </section>

        {/* Learning Journey */}
        <section className="rounded-lg border border-outline-variant/15 bg-surface-container-low p-4 flex flex-col">
          <div className="flex items-center gap-2 mb-3">
            <BookOpen className="w-4 h-4 text-tertiary" />
            <h3 className="text-sm font-semibold text-on-surface">
              Learning Journey
            </h3>
          </div>
          <div className="flex-1">
            {recentCourse ? (
              <>
                <p className="text-base font-poppins font-semibold text-on-surface leading-snug">
                  {recentCourse.title}
                </p>
                <p className="text-xs text-on-surface-variant mt-0.5">
                  {recentCourse.subject || "Core Curriculum"}
                </p>
                <div className="mt-4 space-y-1.5">
                  <div className="flex justify-between text-[11px] text-outline">
                    <span>Total progress</span>
                    <span className="text-tertiary font-medium tabular-nums">
                      {coursePct}%
                    </span>
                  </div>
                  <div className="h-1.5 w-full bg-surface-container-high rounded-full overflow-hidden">
                    <div
                      className="h-full bg-tertiary rounded-full transition-all duration-700"
                      style={{ width: `${coursePct}%` }}
                    />
                  </div>
                </div>
              </>
            ) : (
              <>
                <p className="text-base font-poppins font-semibold text-on-surface leading-snug">
                  Start Learning
                </p>
                <p className="text-xs text-on-surface-variant mt-0.5">
                  Unlocking knowledge across all subjects.
                </p>
                <div className="mt-4 rounded-md border border-outline-variant/15 p-3 text-center">
                  <p className="text-[11px] text-outline">Lessons available</p>
                  <p className="text-sm font-poppins font-semibold text-tertiary">
                    {totalLessons === 0
                      ? "None yet"
                      : `${totalLessons} ${totalLessons === 1 ? "lesson" : "lessons"}`}
                  </p>
                </div>
              </>
            )}
          </div>
          <Button asChild className="mt-4">
            <Link href="/dashboard/courses">
              {recentCourse ? "Continue Course" : "Browse Courses"}
            </Link>
          </Button>
        </section>
      </div>

      {/* MFA Prompt */}
      <AnimatePresence>
        {isPromptVisible && !showEnrollmentModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 8 }}
              className="relative w-full max-w-sm rounded-lg border border-outline-variant/15 bg-surface p-5 flex flex-col gap-4 items-center text-center"
            >
              <div className="w-10 h-10 rounded-md bg-tertiary/10 flex items-center justify-center">
                <ShieldAlert className="w-5 h-5 text-tertiary" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-semibold text-on-surface">
                  Secure your account
                </h3>
                <p className="text-sm text-on-surface-variant">
                  Enable MFA to protect your progress and test scores. Takes a
                  minute.
                </p>
              </div>
              <div className="flex flex-col gap-2 w-full">
                <Button
                  onClick={() => setShowEnrollmentModal(true)}
                  className="w-full"
                >
                  Setup MFA now
                </Button>
                <Button
                  variant="ghost"
                  onClick={handleDismissPrompt}
                  className="w-full"
                >
                  {"Don't remind me again"}
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <MfaEnrollmentModal
        isOpen={showEnrollmentModal}
        onClose={() => {
          setShowEnrollmentModal(false);
          setIsPromptVisible(false);
        }}
        onSuccess={() => {
          setIsPromptVisible(false);
        }}
      />
    </div>
  );
}
