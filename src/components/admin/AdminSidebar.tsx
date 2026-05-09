"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useState } from "react";
import {
  LayoutDashboard,
  Users,
  BookOpen,
  ClipboardList,
  Library,
  ShieldAlert,
  Trash2,
  MessageSquare,
  Bell,
  Mail,
  Settings,
  CreditCard,
  Coins,
  FileImage,
  LogOut,
  Loader2,
  ChevronLeft,
  ChevronRight,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";
import { useEffect, useRef } from "react";

const forceStudentView = () => {
  document.cookie = "force_student_view=1; path=/; max-age=" + (60 * 60 * 24);
};

const navGroups = [
  {
    heading: "Core",
    items: [
      { href: "/admin", label: "Overview", icon: LayoutDashboard },
      { href: "/admin/users", label: "Users", icon: Users },
      { href: "/admin/payments", label: "Payments", icon: CreditCard },
      { href: "/admin/credits", label: "Credits", icon: Coins },
    ],
  },
  {
    heading: "Content",
    items: [
      { href: "/admin/courses", label: "Courses", icon: BookOpen },
      { href: "/admin/courses/media", label: "Media", icon: FileImage },
      { href: "/admin/tests", label: "Tests", icon: ClipboardList },
      { href: "/admin/questions", label: "Questions", icon: Library },
    ],
  },
  {
    heading: "Ops",
    items: [
      { href: "/admin/proctor", label: "Proctoring", icon: ShieldAlert },
      { href: "/admin/deletions", label: "Deletions", icon: Trash2 },
      { href: "/admin/feedback", label: "Feedback", icon: MessageSquare },
      { href: "/admin/notifications", label: "Announcements", icon: Bell },
      { href: "/admin/email", label: "Mass Email", icon: Mail },
      { href: "/admin/settings", label: "Settings", icon: Settings },
    ],
  },
];

type AdminSidebarProps = {
  siteName?: string;
  logoUrl?: string | null;
};

export function AdminSidebar({
  siteName = "Scientia Prep",
  logoUrl = null,
}: AdminSidebarProps) {
  const pathname = usePathname();
  const [signingOut, setSigningOut] = useState(false);
  
  const [width, setWidth] = useState(224);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);

  // Load persistence
  useEffect(() => {
    const savedWidth = localStorage.getItem("admin-sidebar-width");
    const savedCollapsed = localStorage.getItem("admin-sidebar-collapsed");
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
      localStorage.setItem("admin-sidebar-width", newWidth.toString());
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
    localStorage.setItem("admin-sidebar-collapsed", next.toString());
  };

  const handleSignOut = async () => {
    if (signingOut) return;
    setSigningOut(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {
      document.cookie = "force_student_view=; path=/; max-age=0";
    } finally {
      window.location.href = "/login";
    }
  };

  return (
    <aside 
      ref={sidebarRef}
      style={{ width: isCollapsed ? 64 : width }}
      className={cn(
        "hidden lg:flex shrink-0 flex-col bg-surface-container-low border-r border-outline-variant/15 fixed top-0 left-0 h-screen z-30 transition-[width] duration-300 ease-in-out",
        isResizing && "transition-none"
      )}
    >
      <div className="h-14 px-3 border-b border-outline-variant/10 flex items-center justify-between overflow-hidden">
        <div className={cn("flex items-center gap-2 min-w-0", isCollapsed && "hidden")}>
          {logoUrl ? (
            <img
              src={logoUrl}
              alt={`${siteName} logo`}
              width={20}
              height={20}
              className="w-5 h-5 rounded-md object-contain"
            />
          ) : (
            <span
              aria-hidden
              className="w-5 h-5 rounded-md bg-tertiary text-white font-poppins font-semibold grid place-items-center text-[11px]"
            >
              {siteName.slice(0, 1).toUpperCase()}
            </span>
          )}
          <span className="font-poppins font-semibold text-sm text-on-surface truncate">
            {siteName} <span className="text-outline font-normal">Admin</span>
          </span>
        </div>
        
        {isCollapsed && (
          <div className="mx-auto">
             <span
              aria-hidden
              className="w-6 h-6 rounded-md bg-tertiary text-white font-poppins font-semibold grid place-items-center text-[12px]"
            >
              {siteName.slice(0, 1).toUpperCase()}
            </span>
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

      <nav className="flex-1 p-2 overflow-y-auto no-scrollbar">
        {navGroups.map((group) => (
          <div key={group.heading} className="mb-3">
            {!isCollapsed && (
              <div className="px-3 py-1 text-[11px] font-medium text-outline uppercase tracking-wider">
                {group.heading}
              </div>
            )}
            <div className="space-y-0.5">
              {group.items.map(({ href, label, icon: Icon }) => {
                const isActive =
                  href === "/admin" ? pathname === href : pathname.startsWith(href);
                return (
                  <Link
                    key={href}
                    href={href}
                    className={cn(
                      "relative flex items-center gap-2.5 h-9 rounded-md text-sm transition-colors",
                      isCollapsed ? "justify-center px-0" : "px-3",
                      isActive
                        ? "bg-surface-container-high text-on-surface font-medium shadow-sm"
                        : "text-on-surface-variant hover:bg-surface-container-high/60 hover:text-on-surface"
                    )}
                    title={isCollapsed ? label : undefined}
                  >
                    {isActive && !isCollapsed && (
                      <span className="absolute left-0 top-1.5 bottom-1.5 w-0.5 rounded-full bg-tertiary" />
                    )}
                    <Icon
                      className={cn(
                        "w-4 h-4 shrink-0",
                        isActive ? "text-tertiary" : "text-outline"
                      )}
                    />
                    {!isCollapsed && <span className="truncate">{label}</span>}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="p-2 border-t border-outline-variant/10 space-y-1">
        <Link
          href="/dashboard"
          onClick={forceStudentView}
          className={cn(
            "flex items-center h-9 rounded-md text-xs text-on-surface-variant hover:bg-surface-container-high/60 hover:text-on-surface transition-colors",
            isCollapsed ? "justify-center px-0" : "px-3"
          )}
          title="Return to Student View"
        >
          {isCollapsed ? <ChevronLeft className="w-4 h-4" /> : "← Return to Student View"}
        </Link>
        <button
          type="button"
          onClick={handleSignOut}
          disabled={signingOut}
          className={cn(
            "w-full flex items-center gap-1.5 h-9 rounded-md text-xs text-red-500 hover:bg-red-500/10 transition-colors disabled:opacity-60",
            isCollapsed ? "justify-center px-0" : "px-3 justify-center"
          )}
          title="Sign out"
        >
          {signingOut ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <LogOut className="w-3.5 h-3.5" />
          )}
          {!isCollapsed && (signingOut ? "Signing out…" : "Sign out")}
        </button>
      </div>

      {/* Resize Handle */}
      {!isCollapsed && (
        <div
          onMouseDown={handleMouseDown}
          className="absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-tertiary/30 active:bg-tertiary/50 transition-colors z-40"
        />
      )}
    </aside>
  );
}
