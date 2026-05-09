"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  BookOpen,
  PenTool,
  User,
  MoreHorizontal,
  Settings,
  MessageSquare,
  LogOut,
  Shield,
  Layers,
  PieChart,
  CreditCard,
  FileImage,
  ClipboardList,
  Library,
  Trash2,
  Bell,
  ShieldAlert,
  Mail,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";

const studentTabs = [
  { name: "Home", href: "/dashboard", icon: Home },
  { name: "Courses", href: "/dashboard/courses", icon: BookOpen },
  { name: "Tests", href: "/dashboard/tests", icon: PenTool },
  { name: "Profile", href: "/dashboard/profile", icon: User },
];

const adminTabs = [
  { name: "Overview", href: "/admin", icon: Home },
  { name: "Users", href: "/admin/users", icon: User },
  { name: "Questions", href: "/admin/questions", icon: Library },
  { name: "Tests", href: "/admin/tests", icon: ClipboardList },
];

const studentMore = [
  { name: "Analytics", href: "/dashboard/analytics", icon: PieChart },
  { name: "Feedback", href: "/dashboard/feedback", icon: MessageSquare },
  { name: "Settings", href: "/dashboard/settings", icon: Settings },
];

const adminMore = [
  { name: "Courses", href: "/admin/courses", icon: BookOpen },
  { name: "Payments", href: "/admin/payments", icon: CreditCard },
  { name: "Media", href: "/admin/courses/media", icon: FileImage },
  { name: "Proctoring", href: "/admin/proctor", icon: ShieldAlert },
  { name: "Deletions", href: "/admin/deletions", icon: Trash2 },
  { name: "Feedback", href: "/admin/feedback", icon: MessageSquare },
  { name: "Announce", href: "/admin/notifications", icon: Bell },
  { name: "Mass Email", href: "/admin/email", icon: Mail },
  { name: "Settings", href: "/admin/settings", icon: Settings },
];

const enableStudentView = () => {
  document.cookie = "force_student_view=1; path=/; max-age=" + 60 * 60 * 24;
  window.location.href = "/dashboard";
};

const disableStudentView = () => {
  document.cookie = "force_student_view=; path=/; max-age=0";
  window.location.href = "/admin";
};

export function MobileNav({
  role,
  siteName = "Scientia Prep",
  logoUrl,
}: {
  role?: string;
  siteName?: string;
  logoUrl?: string | null;
}) {
  const pathname = usePathname();
  const [showMore, setShowMore] = useState(false);
  const [showLogout, setShowLogout] = useState(false);

  const isAdmin = ["admin", "super_admin", "examiner"].includes(role || "");
  const isCurrentlyInAdmin = pathname.startsWith("/admin");
  const primaryTabs = isCurrentlyInAdmin ? adminTabs : studentTabs;
  const moreItems = isCurrentlyInAdmin ? adminMore : studentMore;

  const performLogout = async () => {
    const { createBrowserClientFn } = await import("@/lib/supabase/client");
    const supabase = createBrowserClientFn();
    await supabase.auth.signOut();
    window.location.href = "/login?signed_out=true";
  };

  return (
    <>
      {/* Bottom Tab Bar */}
      <div className="lg:hidden fixed bottom-0 inset-x-0 z-50 h-14 bg-surface/95 backdrop-blur-xl border-t border-outline-variant/15 pb-[env(safe-area-inset-bottom)]">
        <nav className="flex h-14 items-stretch">
          {primaryTabs.map((tab) => {
            const isActive =
              pathname === tab.href ||
              (tab.href !== "/dashboard" && tab.href !== "/admin" && pathname.startsWith(tab.href));
            return (
              <Link
                key={tab.name}
                href={tab.href}
                className={cn(
                  "relative flex-1 flex flex-col items-center justify-center gap-0.5 transition-colors",
                  isActive
                    ? "text-tertiary"
                    : "text-outline-variant hover:text-on-surface-variant"
                )}
              >
                {isActive && (
                  <span className="absolute top-0 inset-x-6 h-0.5 bg-tertiary rounded-full" />
                )}
                <tab.icon className="w-5 h-5" />
                <span className="text-[11px] font-medium">{tab.name}</span>
              </Link>
            );
          })}
          <button
            onClick={() => setShowMore(true)}
            className="relative flex-1 flex flex-col items-center justify-center gap-0.5 text-outline-variant hover:text-on-surface-variant transition-colors"
          >
            <MoreHorizontal className="w-5 h-5" />
            <span className="text-[11px] font-medium">More</span>
          </button>
        </nav>
      </div>

      {/* More Sheet */}
      <AnimatePresence>
        {showMore && (
          <div className="lg:hidden fixed inset-0 z-[100] flex flex-col justify-end">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowMore(false)}
              className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            />
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 28, stiffness: 320 }}
              className="relative bg-surface border-t border-outline-variant/15 rounded-t-xl p-4 pb-[calc(env(safe-area-inset-bottom)+1rem)]"
            >
              <div className="w-10 h-1 bg-outline-variant/25 rounded-full mx-auto mb-4" />
              
              <div className="flex items-center gap-3 px-1 mb-5">
                <div className="w-10 h-10 rounded-lg bg-tertiary flex items-center justify-center overflow-hidden relative shrink-0 shadow-sm border border-outline-variant/10">
                  {logoUrl ? (
                    <img src={logoUrl} alt={siteName} className="w-full h-full object-contain p-1" />
                  ) : (
                    <span className="text-white font-poppins font-semibold text-lg">
                      {siteName.slice(0, 1).toUpperCase()}
                    </span>
                  )}
                </div>
                <div className="flex flex-col leading-tight min-w-0">
                  <span className="text-on-surface font-poppins font-semibold text-base truncate">
                    {siteName}
                  </span>
                  <span className="text-outline text-xs">{isAdmin ? "Administrator" : "Student View"}</span>
                </div>
              </div>

              <div className="grid grid-cols-4 gap-2 mb-3">
                {moreItems.map((item) => (
                  <Link
                    key={item.name}
                    href={item.href}
                    onClick={() => setShowMore(false)}
                    className="flex flex-col items-center gap-1.5 p-2.5 rounded-md border border-outline-variant/15 hover:bg-surface-container-high transition-colors active:scale-95"
                  >
                    <item.icon className="w-5 h-5 text-tertiary" />
                    <span className="text-[11px] font-medium text-on-surface text-center">
                      {item.name}
                    </span>
                  </Link>
                ))}
              </div>
              {isAdmin && isCurrentlyInAdmin && (
                <button
                  onClick={enableStudentView}
                  className="w-full h-9 flex items-center justify-center gap-2 text-tertiary text-sm font-medium hover:bg-tertiary/10 rounded-md transition-colors mb-1"
                >
                  <User className="w-4 h-4" /> Return to student view
                </button>
              )}
              {isAdmin && !isCurrentlyInAdmin && (
                <button
                  onClick={disableStudentView}
                  className="w-full h-9 flex items-center justify-center gap-2 text-tertiary text-sm font-medium hover:bg-tertiary/10 rounded-md transition-colors mb-1"
                >
                  <Shield className="w-4 h-4" /> Return to admin view
                </button>
              )}
              <button
                onClick={() => {
                  setShowMore(false);
                  setShowLogout(true);
                }}
                className="w-full h-9 flex items-center justify-center gap-2 text-red-500 text-sm font-medium hover:bg-red-500/10 rounded-md transition-colors"
              >
                <LogOut className="w-4 h-4" /> Log out
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Logout Confirm */}
      <AnimatePresence>
        {showLogout && (
          <div className="lg:hidden fixed inset-0 z-[110] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowLogout(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ scale: 0.96, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.96, opacity: 0 }}
              className="relative w-full max-w-xs rounded-lg border border-outline-variant/15 bg-surface p-4 text-center space-y-3"
            >
              <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center mx-auto">
                <LogOut className="w-5 h-5 text-red-500" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-semibold text-on-surface">Sign out?</h3>
                <p className="text-sm text-on-surface-variant">
                  You will be returned to the login screen.
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => setShowLogout(false)}
                  className="flex-1"
                >
                  Stay
                </Button>
                <Button
                  onClick={performLogout}
                  className="flex-1 bg-red-500 hover:bg-red-500/90"
                >
                  Sign out
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
