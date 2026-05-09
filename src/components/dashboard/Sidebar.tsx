"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  Home,
  BookOpen,
  PenTool,
  User,
  LogOut,
  Settings,
  MessageSquare,
  PieChart,
  ChevronLeft,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { CreditBalance } from "@/components/dashboard/CreditBalance";

const studentNavItems = [
  { name: "Home", href: "/dashboard", icon: Home },
  { name: "Courses", href: "/dashboard/courses", icon: BookOpen },
  { name: "Tests", href: "/dashboard/tests", icon: PenTool },
  { name: "Analytics", href: "/dashboard/analytics", icon: PieChart },
  { name: "Profile", href: "/dashboard/profile", icon: User },
  { name: "Feedback", href: "/dashboard/feedback", icon: MessageSquare },
];

const clearStudentView = () => {
  document.cookie = "force_student_view=; path=/; max-age=0";
};

export function Sidebar({
  role,
  siteName = "Scientia Prep",
  logoUrl,
}: {
  role?: string;
  siteName?: string;
  logoUrl?: string | null;
}) {
  const pathname = usePathname();
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  
  const [width, setWidth] = useState(224);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);

  // Load persistence
  useEffect(() => {
    const savedWidth = localStorage.getItem("sidebar-width");
    const savedCollapsed = localStorage.getItem("sidebar-collapsed");
    if (savedWidth) setWidth(parseInt(savedWidth, 10));
    if (savedCollapsed) setIsCollapsed(savedCollapsed === "true");
  }, []);

  // Sync width to CSS variable for layout
  useEffect(() => {
    const currentWidth = isCollapsed ? 64 : width;
    document.documentElement.style.setProperty("--sidebar-width", `${currentWidth}px`);
  }, [width, isCollapsed]);

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  };

  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      let newWidth = e.clientX;
      if (newWidth < 160) newWidth = 160;
      if (newWidth > 400) newWidth = 400;
      setWidth(newWidth);
      localStorage.setItem("sidebar-width", newWidth.toString());
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isResizing]);

  useEffect(() => {
    if (isResizing) {
      document.body.classList.add("is-resizing-sidebar");
    } else {
      document.body.classList.remove("is-resizing-sidebar");
    }
  }, [isResizing]);

  const toggleCollapse = () => {
    const next = !isCollapsed;
    setIsCollapsed(next);
    localStorage.setItem("sidebar-collapsed", next.toString());
  };

  const isAdmin = ["admin", "super_admin", "examiner"].includes(role || "");

  const performLogout = async () => {
    const { createBrowserClientFn } = await import("@/lib/supabase/client");
    const supabase = createBrowserClientFn();
    await supabase.auth.signOut();
    window.location.href = "/login?signed_out=true";
  };

  return (
    <>
      <aside
        ref={sidebarRef}
        style={{ width: isCollapsed ? 64 : width }}
        className={cn(
          "hidden lg:flex flex-col h-screen fixed left-0 top-0 bg-surface-container-low border-r border-outline-variant/15 z-40 transition-[width] duration-300 ease-in-out",
          isResizing && "transition-none"
        )}
      >
        {/* Brand */}
        <div className="px-3 py-4 border-b border-outline-variant/10 flex flex-col items-center gap-3 overflow-hidden shrink-0">
          <Link
            href="/dashboard"
            className={cn("flex items-center gap-2 min-w-0", isCollapsed && "hidden")}
          >
            <div className="w-20 h-20 rounded-sm bg-tertiary flex items-center justify-center overflow-hidden relative shrink-0 shadow-sm">
              {logoUrl ? (
                <Image src={logoUrl} alt={siteName} fill sizes="80px" className="object-contain" />
              ) : (
                <span className="text-white font-poppins font-bold text-2xl">
                  {siteName.slice(0, 1).toUpperCase()}
                </span>
              )}
            </div>
            <div className="flex flex-col items-center leading-tight min-w-0">
              <span className="text-on-surface font-poppins font-bold text-base truncate">
                {siteName}
              </span>
              <span className="text-outline text-[11px]">{isAdmin ? "Admin" : "Prep"}</span>
            </div>
          </Link>

          {isCollapsed && (
            <div className="mx-auto py-2">
               <div className="w-10 h-10 rounded-sm bg-tertiary flex items-center justify-center overflow-hidden relative shadow-sm">
                {logoUrl ? (
                  <Image src={logoUrl} alt={siteName} fill sizes="40px" className="object-contain" />
                ) : (
                  <span className="text-white font-poppins font-bold text-sm">
                    {siteName.slice(0, 1).toUpperCase()}
                  </span>
                )}
              </div>
            </div>
          )}

          <button
            onClick={toggleCollapse}
            className="p-1.5 rounded-md hover:bg-surface-container-high text-outline hover:text-on-surface transition-colors shrink-0"
            title={isCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
          >
            {isCollapsed ? <PanelLeftOpen className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto no-scrollbar">
          {studentNavItems.map((item) => {
            const isActive =
              pathname === item.href ||
              (item.href !== "/dashboard" && pathname.startsWith(item.href));
            return (
              <Link
                key={item.name}
                href={item.href}
                className={cn(
                  "relative flex items-center gap-2.5 h-9 rounded-md text-sm transition-colors",
                  isCollapsed ? "justify-center px-0" : "px-3",
                  isActive
                    ? "bg-surface-container-high text-on-surface font-medium shadow-sm"
                    : "text-on-surface-variant hover:bg-surface-container-high/60 hover:text-on-surface"
                )}
                title={isCollapsed ? item.name : undefined}
              >
                {isActive && !isCollapsed && (
                  <span className="absolute left-0 top-1.5 bottom-1.5 w-0.5 rounded-full bg-tertiary" />
                )}
                <item.icon
                  className={cn(
                    "w-4 h-4 shrink-0",
                    isActive ? "text-tertiary" : "text-outline"
                  )}
                />
                {!isCollapsed && <span className="truncate">{item.name}</span>}
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="p-2 border-t border-outline-variant/10 space-y-0.5 shrink-0">
          {/* Credit balance — only shown for students */}
          {!isAdmin && (
            <div className="mb-1">
              <CreditBalance collapsed={isCollapsed} />
            </div>
          )}
          <Link
            href="/dashboard/settings"
            className={cn(
              "flex items-center gap-2.5 h-9 rounded-md text-sm text-on-surface-variant hover:bg-surface-container-high/60 hover:text-on-surface transition-colors",
              isCollapsed ? "justify-center px-0" : "px-3"
            )}
            title="Settings"
          >
            <Settings className="w-4 h-4 text-outline" />
            {!isCollapsed && <span>Settings</span>}
          </Link>
          <button
            onClick={() => setShowLogoutModal(true)}
            className={cn(
              "w-full flex items-center gap-2.5 h-9 rounded-md text-sm text-brand-accent hover:bg-brand-accent/10 transition-colors",
              isCollapsed ? "justify-center px-0" : "px-3"
            )}
            title="Log out"
          >
            <LogOut className="w-4 h-4" />
            {!isCollapsed && <span>Log out</span>}
          </button>
          
          {isAdmin && (
            <Link
              href="/admin"
              onClick={clearStudentView}
              className={cn(
                "flex items-center justify-center h-9 rounded-md text-[10px] font-medium text-tertiary bg-tertiary/10 hover:bg-tertiary/20 transition-colors",
                isCollapsed ? "px-0" : "px-3"
              )}
              title="Return to Admin View"
            >
              {isCollapsed ? <ChevronLeft className="w-4 h-4" /> : "← Return to Admin View"}
            </Link>
          )}

          <Link
            href="/dashboard/profile"
            className={cn(
              "mt-1 flex items-center gap-2 h-11 rounded-md hover:bg-surface-container-high/60 transition-colors",
              isCollapsed ? "justify-center px-0" : "px-2"
            )}
            title="My Account"
          >
            <div className="w-7 h-7 rounded-full bg-surface-container-high border border-outline-variant/20 flex items-center justify-center shrink-0">
              <User className="w-3.5 h-3.5 text-tertiary" />
            </div>
            {!isCollapsed && (
              <div className="flex flex-col min-w-0 leading-tight">
                <span className="text-on-surface text-xs font-medium truncate">My Account</span>
                <span className="text-outline text-[11px] capitalize truncate">
                  {role?.replace("_", " ") ?? "Student"}
                </span>
              </div>
            )}
          </Link>
        </div>

        {/* Resize Handle */}
        {!isCollapsed && (
          <div
            onMouseDown={handleMouseDown}
            className="absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-tertiary/30 active:bg-tertiary/50 transition-colors z-40"
          />
        )}
      </aside>

      <AnimatePresence>
        {showLogoutModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowLogoutModal(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 8 }}
              className="relative w-full max-w-xs rounded-lg border border-outline-variant/15 bg-surface-container-low p-4 flex flex-col gap-4"
            >
              <div className="flex flex-col gap-1">
                <h3 className="text-base font-poppins font-semibold text-on-surface">Sign out?</h3>
                <p className="text-sm text-on-surface-variant">You will be returned to the login screen.</p>
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setShowLogoutModal(false)}>
                  Cancel
                </Button>
                <Button onClick={performLogout} className="bg-brand-accent hover:bg-brand-accent/90">
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
