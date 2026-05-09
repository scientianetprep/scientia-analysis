"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { format } from "date-fns";
import {
  Search,
  Plus,
  MoreVertical,
  Shield,
  UserCheck,
  Loader2,
  ChevronLeft,
  ChevronRight,
  X,
  Copy,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useConfirm } from "@/components/ui/confirm-dialog";

export function UsersClient({
  initialUsers,
  totalPages = 1,
  currentPage = 1,
  totalCount = 0,
  initialFilters,
  savedTiers: initialSavedTiers = ["Free tier"],
}: {
  initialUsers: any[];
  totalPages?: number;
  currentPage?: number;
  totalCount?: number;
  savedTiers?: string[];
  initialFilters?: { q?: string; status?: string; role?: string; mfa?: string };
}) {
  const router = useRouter();
  const confirm = useConfirm();
  const pathname = usePathname();
  const sp = useSearchParams();
  const [searchQuery, setSearchQuery] = useState(initialFilters?.q ?? "");
  const [statusFilter, setStatusFilter] = useState(initialFilters?.status ?? "all");
  const [roleFilter, setRoleFilter] = useState(initialFilters?.role ?? "all");
  const [mfaFilter, setMfaFilter] = useState(initialFilters?.mfa ?? "all");
  const [users, setUsers] = useState(initialUsers);
  const [savedTiers, setSavedTiers] = useState(initialSavedTiers);
  const [showAddModal, setShowAddModal] = useState(false);
  const [actionMenuUser, setActionMenuUser] = useState<string | null>(null);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [userDetails, setUserDetails] = useState<any>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [newUser, setNewUser] = useState({
    fullName: "",
    email: "",
    password: "",
    phone: "",
    role: "student",
  });

  // Sync state when props change (server-side refresh or search)
  useEffect(() => {
    setUsers(initialUsers);
  }, [initialUsers]);

  // Sync tiers as well
  useEffect(() => {
    setSavedTiers(initialSavedTiers);
  }, [initialSavedTiers]);

  const applyFilters = () => {
    const params = new URLSearchParams(sp.toString());
    params.set("page", "1");
    if (searchQuery.trim()) params.set("q", searchQuery.trim());
    else params.delete("q");
    if (statusFilter !== "all") params.set("status", statusFilter);
    else params.delete("status");
    if (roleFilter !== "all") params.set("role", roleFilter);
    else params.delete("role");
    if (mfaFilter !== "all") params.set("mfa", mfaFilter);
    else params.delete("mfa");
    router.push(`${pathname}?${params.toString()}`);
  };

  const resetFilters = () => {
    setSearchQuery("");
    setStatusFilter("all");
    setRoleFilter("all");
    setMfaFilter("all");
    router.push(pathname);
  };

  const paginationHref = (targetPage: number) => {
    const params = new URLSearchParams(sp.toString());
    params.set("page", String(targetPage));
    return `${pathname}?${params.toString()}`;
  };

  const hasActiveFilters = useMemo(
    () =>
      Boolean(searchQuery.trim()) ||
      statusFilter !== "all" ||
      roleFilter !== "all" ||
      mfaFilter !== "all",
    [searchQuery, statusFilter, roleFilter, mfaFilter]
  );

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsAdding(true);
    try {
      const res = await fetch("/api/admin/users/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newUser),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      toast.success("User created");
      setShowAddModal(false);
      setNewUser({ fullName: "", email: "", password: "", phone: "", role: "student" });
      router.refresh();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsAdding(false);
    }
  };

  const handleUpdateRole = async (userId: string, newRole: string) => {
    const oldUsers = [...users];
    setUsers((prev) =>
      prev.map((u) => (u.user_id === userId ? { ...u, role: newRole } : u))
    );
    try {
      const res = await fetch("/api/admin/users/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, role: newRole }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success("Role updated");
    } catch (err: any) {
      toast.error(err.message);
      setUsers(oldUsers);
    }
  };

  const handleUpdateStatus = async (userId: string, newStatus: string) => {
    const oldUsers = [...users];
    setUsers((prev) =>
      prev.map((u) => (u.user_id === userId ? { ...u, status: newStatus } : u))
    );
    setActionMenuUser(null);
    try {
      const res = await fetch("/api/admin/users/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, status: newStatus }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success("Status updated");
    } catch (err: any) {
      toast.error(err.message);
      setUsers(oldUsers);
    }
  };

  const handleApproveUser = async (userId: string) => {
    const oldUsers = [...users];
    setUsers((prev) =>
      prev.map((u) => (u.user_id === userId ? { ...u, status: "active" } : u))
    );
    setActionMenuUser(null);
    try {
      const res = await fetch("/api/admin/users/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, status: "active" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success("Approved");
    } catch (err: any) {
      toast.error(err.message);
      setUsers(oldUsers);
    }
  };

  const handleSuspendUser = async (userId: string) => {
    const oldUsers = [...users];
    setUsers((prev) =>
      prev.map((u) =>
        u.user_id === userId ? { ...u, status: "suspended" } : u
      )
    );
    setActionMenuUser(null);
    try {
      const res = await fetch("/api/admin/users/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, status: "suspended" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success("Suspended");
    } catch (err: any) {
      toast.error(err.message);
      setUsers(oldUsers);
    }
  };

  const handleUpdateTier = async (userId: string, newTier: string) => {
    const oldUsers = [...users];
    setUsers((prev) =>
      prev.map((u) => (u.user_id === userId ? { ...u, course_tier: newTier } : u))
    );
    try {
      const res = await fetch("/api/admin/users/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, courseTier: newTier }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      
      // Update local saved tiers if it's new
      if (newTier && !savedTiers.includes(newTier)) {
        setSavedTiers(prev => [...prev, newTier].sort());
      }
      
      toast.success("Tier updated");
      router.refresh();
    } catch (err: any) {
      toast.error(err.message);
      setUsers(oldUsers);
    }
  };

  const TierInput = ({ user }: { user: any }) => {
    const [val, setVal] = useState(user.course_tier || "Free tier");

    const commit = () => {
      if (val !== user.course_tier) {
        handleUpdateTier(user.user_id, val);
      }
    };

    return (
      <input
        list="tier-options"
        value={val}
        onChange={(e) => setVal(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => e.key === "Enter" && commit()}
        className="bg-transparent border-none text-[11px] font-medium focus:ring-0 p-0 text-on-surface w-24 hover:bg-surface-container-highest rounded px-1 transition-colors"
        placeholder="Set tier..."
      />
    );
  };

  const openUserProfile = async (user: any) => {
    setSelectedUser(user);
    setLoadingDetails(true);
    setUserDetails(null);
    try {
      const res = await fetch(`/api/admin/users/${user.user_id}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load user details");
      setUserDetails(data);
    } catch (e: any) {
      toast.error(e?.message || "Failed to load user details");
    } finally {
      setLoadingDetails(false);
    }
  };

  const statusColor = (s: string) =>
    s === "active"
      ? "text-green-600"
      : s === "pending"
      ? "text-amber-600"
      : "text-red-600";

  const statusBgColor = (s: string) =>
    s === "active"
      ? "bg-green-500/10 text-green-600"
      : s === "pending"
      ? "bg-amber-500/10 text-amber-600"
      : s === "suspended"
      ? "bg-red-500/10 text-red-600"
      : "bg-outline/10 text-outline";

  return (
    <div className="space-y-3">
      {/* Filter bar */}
      <div className="flex flex-col md:flex-row gap-2 items-stretch md:items-center justify-between">
        <div className="flex flex-col md:flex-row gap-2 flex-1">
          <div className="relative w-full md:w-64">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-outline" />
            <input
              type="text"
              placeholder="Search name, email, CNIC…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && applyFilters()}
              className="w-full h-8 pl-8 pr-8 rounded-md bg-surface-container-high border border-outline-variant/20 focus:border-tertiary focus:ring-1 focus:ring-tertiary outline-none text-sm"
            />
            {searchQuery && (
              <button
                onClick={() => {
                  setSearchQuery("");
                  const params = new URLSearchParams(sp.toString());
                  params.delete("q");
                  router.push(`${pathname}?${params.toString()}`);
                }}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded-full hover:bg-surface-container-highest transition-colors text-outline"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
          <SelectInput
            value={statusFilter}
            onChange={(v) => {
              setStatusFilter(v);
              const params = new URLSearchParams(sp.toString());
              params.set("page", "1");
              if (v !== "all") params.set("status", v);
              else params.delete("status");
              router.push(`${pathname}?${params.toString()}`);
            }}
            options={[
              ["all", "All status"],
              ["active", "Active"],
              ["pending", "Pending"],
              ["suspended", "Suspended"],
              ["rejected", "Rejected"],
              ["expired", "Expired"],
            ]}
          />
          <SelectInput
            value={roleFilter}
            onChange={(v) => {
              setRoleFilter(v);
              const params = new URLSearchParams(sp.toString());
              params.set("page", "1");
              if (v !== "all") params.set("role", v);
              else params.delete("role");
              router.push(`${pathname}?${params.toString()}`);
            }}
            options={[
              ["all", "All roles"],
              ["student", "Student"],
              ["examiner", "Examiner"],
              ["admin", "Admin"],
              ["super_admin", "Super admin"],
            ]}
          />
          <SelectInput
            value={mfaFilter}
            onChange={(v) => {
              setMfaFilter(v);
              const params = new URLSearchParams(sp.toString());
              params.set("page", "1");
              if (v !== "all") params.set("mfa", v);
              else params.delete("mfa");
              router.push(`${pathname}?${params.toString()}`);
            }}
            options={[
              ["all", "All MFA"],
              ["enabled", "MFA enabled"],
              ["disabled", "MFA disabled"],
            ]}
          />
          <button
            onClick={applyFilters}
            className="h-8 px-3 rounded-md bg-surface-container-high text-on-surface text-xs font-medium hover:bg-surface-container-highest transition-colors"
          >
            Apply
          </button>
          {hasActiveFilters && (
            <button
              onClick={resetFilters}
              className="h-8 px-3 rounded-md bg-surface-container text-on-surface-variant text-xs font-medium hover:bg-surface-container-high transition-colors"
            >
              Reset
            </button>
          )}
        </div>
          <button
            onClick={async () => {
              const ok = await confirm({
                title: "Clean up all malformed tiers?",
                description: "This will rebuild the list from currently active user tiers. Old and unused templates will be removed.",
                confirmLabel: "Clean up",
                variant: "warning"
              });
              if (!ok) return;
              try {
                const res = await fetch("/api/admin/users/update", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ userId: "cleanup-tiers" }),
                });
                if (res.ok) {
                  toast.success("Tiers cleaned up");
                  router.refresh();
                } else {
                  throw new Error("Failed to cleanup");
                }
              } catch (e: any) {
                toast.error(e.message);
              }
            }}
            className="h-8 px-3 rounded-md bg-surface-container-high text-on-surface text-xs font-medium hover:bg-surface-container-highest transition-colors"
          >
            Clean up tiers
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            className="h-8 px-3 rounded-md bg-tertiary text-white text-xs font-poppins font-medium inline-flex items-center justify-center gap-1.5 hover:bg-tertiary/90 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" /> Add user
          </button>
      </div>

      <div className="surface-card overflow-hidden">
        {/* Desktop table */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-surface-container-high/60 text-[11px] text-outline border-b border-outline-variant/10">
              <tr>
                <th className="px-3 h-9 font-medium">User</th>
                <th className="px-3 h-9 font-medium">Role</th>
                <th className="px-3 h-9 font-medium">Tier</th>
                <th className="px-3 h-9 font-medium">Status</th>
                <th className="px-3 h-9 font-medium">Joined</th>
                <th className="px-3 h-9 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/10">
              <AnimatePresence mode="popLayout">
                {users.map((user) => (
                  <motion.tr
                    layout
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    key={user.user_id}
                    className="hover:bg-surface-container-high/60 transition-colors"
                  >
                    <td className="px-3 h-11">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-full bg-tertiary/10 grid place-items-center text-tertiary text-xs font-poppins font-semibold shrink-0">
                          {user.full_name?.charAt(0) || "U"}
                        </div>
                        <div className="min-w-0">
                          <div className="text-sm font-medium text-on-surface truncate">
                            {user.full_name || "Unknown"}
                          </div>
                          <div className="text-[11px] text-outline truncate">
                            {user.email || user.username || "—"}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-3">
                      <select
                        value={user.role}
                        onChange={(e) =>
                          handleUpdateRole(user.user_id, e.target.value)
                        }
                        className="bg-transparent border-none text-xs font-medium cursor-pointer focus:ring-0 p-0 text-on-surface"
                      >
                        <option value="student">Student</option>
                        <option value="examiner">Examiner</option>
                        <option value="admin">Admin</option>
                      </select>
                    </td>
                    <td className="px-3">
                      <TierInput user={user} />
                    </td>
                    <td className="px-3">
                      <select
                        value={user.status}
                        onChange={(e) =>
                          handleUpdateStatus(user.user_id, e.target.value)
                        }
                        className={cn(
                          "bg-transparent border-none text-xs font-medium cursor-pointer focus:ring-0 p-0 capitalize",
                          statusColor(user.status)
                        )}
                      >
                        <option value="active">Active</option>
                        <option value="pending">Pending</option>
                        <option value="suspended">Suspended</option>
                      </select>
                    </td>
                    <td className="px-3 text-[11px] text-outline tabular-nums">
                      {user.created_at
                        ? format(new Date(user.created_at), "MMM d, yyyy")
                        : "—"}
                    </td>
                    <td className="px-3 text-right relative">
                      <Link
                        href={`/admin/users/${user.user_id}`}
                        className="mr-1 h-7 px-2 rounded-md text-[11px] font-medium bg-surface-container-high text-on-surface hover:bg-surface-container-highest transition-colors inline-flex items-center"
                      >
                        View
                      </Link>
                      <button
                        onClick={() =>
                          setActionMenuUser(
                            actionMenuUser === user.user_id
                              ? null
                              : user.user_id
                          )
                        }
                        className="p-1 rounded-md text-outline hover:bg-surface-container-high transition-colors inline-flex"
                      >
                        <MoreVertical className="w-3.5 h-3.5" />
                      </button>
                      {actionMenuUser === user.user_id && (
                        <div className="absolute right-3 top-9 w-44 bg-surface-container-low border border-outline-variant/20 rounded-md shadow-lg z-50 overflow-hidden py-1">
                          <MenuItem
                            icon={<UserCheck className="w-3 h-3" />}
                            onClick={() => handleApproveUser(user.user_id)}
                          >
                            Approve / activate
                          </MenuItem>
                          <MenuItem
                            icon={<Shield className="w-3 h-3" />}
                            onClick={() => handleSuspendUser(user.user_id)}
                            tone="warning"
                          >
                            Suspend
                          </MenuItem>
                          <MenuItem
                            icon={<Copy className="w-3 h-3" />}
                            onClick={() => {
                              navigator.clipboard.writeText(
                                user.username || user.email || user.user_id
                              );
                              toast.success("Copied");
                              setActionMenuUser(null);
                            }}
                          >
                            Copy ID
                          </MenuItem>
                        </div>
                      )}
                    </td>
                  </motion.tr>
                ))}
              </AnimatePresence>
            </tbody>
          </table>
        </div>

        {/* Mobile cards */}
        <div className="md:hidden p-2 space-y-2">
          <AnimatePresence mode="popLayout">
            {users.map((user) => (
              <motion.div
                layout
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                key={user.user_id}
                className="rounded-md bg-surface-container-low border border-outline-variant/15 p-2.5 space-y-2"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-7 h-7 rounded-full bg-tertiary/10 grid place-items-center text-tertiary text-xs font-poppins font-semibold shrink-0">
                      {user.full_name?.charAt(0) || "U"}
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-on-surface truncate">
                        {user.full_name || "Unknown"}
                      </div>
                      <div className="text-[11px] text-outline truncate">
                        {user.email || user.username}
                      </div>
                    </div>
                  </div>
                  <span
                    className={cn(
                      "text-[10px] px-1.5 h-5 rounded-full font-medium capitalize inline-flex items-center",
                      statusBgColor(user.status)
                    )}
                  >
                    {user.status}
                  </span>
                </div>

                <div className="grid grid-cols-[1fr_1fr_auto] gap-2 items-center">
                  <select
                    value={user.role}
                    onChange={(e) =>
                      handleUpdateRole(user.user_id, e.target.value)
                    }
                    className="h-8 rounded-md bg-surface-container-high border border-outline-variant/15 px-2 text-xs font-medium"
                  >
                    <option value="student">Student</option>
                    <option value="examiner">Examiner</option>
                    <option value="admin">Admin</option>
                  </select>
                  <select
                    value={user.status}
                    onChange={(e) =>
                      handleUpdateStatus(user.user_id, e.target.value)
                    }
                    className="h-8 rounded-md bg-surface-container-high border border-outline-variant/15 px-2 text-xs font-medium capitalize"
                  >
                    <option value="active">Active</option>
                    <option value="pending">Pending</option>
                    <option value="suspended">Suspended</option>
                  </select>
                  <Link
                    href={`/admin/users/${user.user_id}`}
                    className="h-8 px-3 rounded-md bg-tertiary text-white text-[11px] font-medium hover:bg-tertiary/90 transition-colors inline-flex items-center justify-center"
                  >
                    View
                  </Link>
                </div>

                <div className="flex items-center justify-between text-[11px] text-outline">
                  <span>Joined</span>
                  <span className="tabular-nums text-on-surface-variant">
                    {user.created_at
                      ? format(new Date(user.created_at), "MMM d, yyyy")
                      : "—"}
                  </span>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        {users.length === 0 && (
          <div className="p-8 text-center">
            <div className="w-10 h-10 rounded-md bg-surface-container-high grid place-items-center text-outline mx-auto mb-2">
              <Search className="w-4 h-4" />
            </div>
            <p className="text-sm text-outline">
              No users found for the current filters.
            </p>
          </div>
        )}

        {totalPages > 1 && (
          <div className="px-3 h-10 border-t border-outline-variant/10 flex items-center justify-between">
            <p className="text-[11px] text-outline">
              Page {currentPage} of {totalPages} • {totalCount} users
            </p>
            <div className="flex gap-1">
              {currentPage > 1 && (
                <Link
                  href={paginationHref(currentPage - 1)}
                  className="h-7 px-2 rounded-md bg-surface-container-high text-[11px] font-medium text-on-surface hover:bg-surface-container-highest inline-flex items-center gap-1 transition-colors"
                >
                  <ChevronLeft className="w-3 h-3" /> Prev
                </Link>
              )}
              {currentPage < totalPages && (
                <Link
                  href={paginationHref(currentPage + 1)}
                  className="h-7 px-2 rounded-md bg-tertiary text-white text-[11px] font-medium hover:bg-tertiary/90 inline-flex items-center gap-1 transition-colors"
                >
                  Next <ChevronRight className="w-3 h-3" />
                </Link>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Add User modal */}
      {showAddModal && (
        <Modal onClose={() => !isAdding && setShowAddModal(false)}>
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="text-base font-poppins font-semibold text-on-surface">
                Add user
              </h2>
              <p className="text-xs text-on-surface-variant">
                Create a user account manually.
              </p>
            </div>
            <button
              onClick={() => !isAdding && setShowAddModal(false)}
              className="p-1 rounded-md hover:bg-surface-container-high transition-colors"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <form onSubmit={handleCreateUser} className="space-y-2.5">
            <Field label="Full name">
              <input
                required
                type="text"
                value={newUser.fullName}
                onChange={(e) =>
                  setNewUser({ ...newUser, fullName: e.target.value })
                }
                className="premium-input"
              />
            </Field>
            <Field label="Email">
              <input
                required
                type="email"
                value={newUser.email}
                onChange={(e) =>
                  setNewUser({ ...newUser, email: e.target.value })
                }
                className="premium-input"
              />
            </Field>
            <Field label="Password">
              <input
                required
                type="password"
                minLength={8}
                value={newUser.password}
                onChange={(e) =>
                  setNewUser({ ...newUser, password: e.target.value })
                }
                className="premium-input"
              />
            </Field>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Phone">
                <input
                  type="tel"
                  value={newUser.phone}
                  onChange={(e) =>
                    setNewUser({ ...newUser, phone: e.target.value })
                  }
                  className="premium-input"
                />
              </Field>
              <Field label="Role">
                <select
                  required
                  value={newUser.role}
                  onChange={(e) =>
                    setNewUser({ ...newUser, role: e.target.value })
                  }
                  className="premium-input"
                >
                  <option value="student">Student</option>
                  <option value="examiner">Examiner</option>
                  <option value="admin">Admin</option>
                </select>
              </Field>
            </div>

            <div className="pt-2 flex items-center justify-end gap-2 border-t border-outline-variant/10 mt-3">
              <button
                type="button"
                disabled={isAdding}
                onClick={() => setShowAddModal(false)}
                className="h-8 px-3 rounded-md text-xs font-medium text-on-surface-variant hover:bg-surface-container-high disabled:opacity-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isAdding}
                className="h-8 px-3 rounded-md text-xs font-poppins font-medium bg-tertiary text-white hover:bg-tertiary/90 disabled:opacity-50 inline-flex items-center gap-1.5 transition-colors"
              >
                {isAdding && <Loader2 className="w-3 h-3 animate-spin" />}
                Create user
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* User detail modal */}
      {selectedUser && (
        <Modal
          wide
          onClose={() => setSelectedUser(null)}
        >
          <div className="flex items-center justify-between mb-3">
            <div className="min-w-0">
              <h2 className="text-base font-poppins font-semibold text-on-surface truncate">
                {selectedUser.full_name || "Unknown user"}
              </h2>
              <p className="text-xs text-outline truncate">
                {selectedUser.email || selectedUser.username}
              </p>
            </div>
            <button
              onClick={() => setSelectedUser(null)}
              className="p-1 rounded-md hover:bg-surface-container-high transition-colors shrink-0"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {loadingDetails ? (
            <div className="py-12 flex items-center justify-center">
              <Loader2 className="w-5 h-5 animate-spin text-tertiary" />
            </div>
          ) : userDetails ? (
            <div className="space-y-3">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                <Stat label="Role" value={userDetails.profile?.role} />
                <Stat
                  label="Status"
                  value={userDetails.profile?.status}
                  valueClass={statusColor(userDetails.profile?.status)}
                />
                <div className="surface-card p-2">
                  <p className="text-[10px] text-outline">Course Tier</p>
                  <TierInput user={users.find(u => u.user_id === selectedUser.user_id) || selectedUser} />
                </div>
                <Stat
                  label="Phone"
                  value={
                    userDetails.profile?.phone ||
                    userDetails.profile?.whatsapp_number
                  }
                />
                <Stat label="CNIC" value={userDetails.profile?.cnic} mono />
                <Stat label="City" value={userDetails.profile?.city} />
                <Stat
                  label="MFA"
                  value={userDetails.profile?.mfa_enrolled ? "Yes" : "No"}
                  valueClass={
                    userDetails.profile?.mfa_enrolled
                      ? "text-green-600"
                      : "text-red-600"
                  }
                />
                <Stat
                  label="Registered"
                  value={
                    userDetails.profile?.created_at
                      ? format(
                          new Date(userDetails.profile.created_at),
                          "MMM d, yyyy"
                        )
                      : "—"
                  }
                />
                <Stat
                  label="Reg stage"
                  value={
                    userDetails.profile?.registration_stage
                      ? `Stage ${userDetails.profile.registration_stage}`
                      : "—"
                  }
                />
              </div>

              {userDetails.academic && (
                <Section title="Academic record">
                  <div className="grid grid-cols-2 md:grid-cols-6 gap-2">
                    <Stat label="Matric marks" value={userDetails.academic.matric_marks} />
                    <Stat label="Matric board" value={userDetails.academic.matric_board} />
                    <Stat label="Matric year" value={userDetails.academic.matric_year} />
                    <Stat label="Inter marks" value={userDetails.academic.intermediate_marks} />
                    <Stat label="Inter board" value={userDetails.academic.intermediate_board} />
                    <Stat label="Inter year" value={userDetails.academic.intermediate_year} />
                  </div>
                </Section>
              )}

              {userDetails.scores?.length > 0 && (
                <Section title={`Test scores (${userDetails.scores.length})`}>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="text-[11px] text-outline border-b border-outline-variant/10">
                        <tr>
                          <th className="text-left h-8 font-medium">Test</th>
                          <th className="text-right h-8 font-medium">Score</th>
                          <th className="text-right h-8 font-medium">%</th>
                          <th className="text-right h-8 font-medium">Date</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-outline-variant/10">
                        {userDetails.scores.map((s: any) => (
                          <tr key={s.id}>
                            <td className="py-1.5 text-on-surface text-xs">
                              {s.tests?.name || "Unknown"}
                            </td>
                            <td className="py-1.5 text-right text-xs tabular-nums">
                              {s.correct_count}/{s.total_count}
                            </td>
                            <td className="py-1.5 text-right font-medium text-tertiary text-xs tabular-nums">
                              {s.percentage?.toFixed(1)}%
                            </td>
                            <td className="py-1.5 text-right text-outline text-xs tabular-nums">
                              {s.created_at
                                ? format(new Date(s.created_at), "MMM d")
                                : "—"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Section>
              )}

              {userDetails.recentSessions?.length > 0 && (
                <Section title="Recent sessions">
                  <ul className="space-y-1">
                    {userDetails.recentSessions.map((s: any) => (
                      <li
                        key={s.id}
                        className="flex items-center justify-between px-2 h-8 rounded-md bg-surface-container-high"
                      >
                        <span className="text-xs text-on-surface truncate">
                          {s.tests?.name || "Unknown"}
                        </span>
                        <span
                          className={cn(
                            "text-[10px] font-medium px-1.5 h-4 rounded-full inline-flex items-center",
                            s.status === "in_progress"
                              ? "bg-green-500/10 text-green-600"
                              : "bg-outline/10 text-outline"
                          )}
                        >
                          {s.status}
                        </span>
                      </li>
                    ))}
                  </ul>
                </Section>
              )}

              {userDetails.loginHistory?.length > 0 && (
                <Section title="Login history">
                  <ul className="space-y-1">
                    {userDetails.loginHistory.slice(0, 5).map((l: any) => (
                      <li
                        key={l.id}
                        className="flex items-center justify-between text-xs px-2 h-7"
                      >
                        <span className="text-on-surface-variant">
                          {l.login_method || "email"}
                        </span>
                        <span className="text-outline tabular-nums">
                          {l.created_at
                            ? format(new Date(l.created_at), "MMM d, HH:mm")
                            : "—"}
                        </span>
                      </li>
                    ))}
                  </ul>
                </Section>
              )}

              <Section title="All user DB records">
                {userDetails.authUser && (
                  <details className="rounded-md bg-surface-container-high p-2 mb-1.5">
                    <summary className="cursor-pointer text-xs font-medium text-on-surface">
                      Auth user
                    </summary>
                    <pre className="mt-2 text-[11px] text-on-surface-variant overflow-x-auto whitespace-pre-wrap break-words">
                      {JSON.stringify(userDetails.authUser, null, 2)}
                    </pre>
                  </details>
                )}
                <div className="space-y-1.5">
                  {Object.entries(userDetails.rawDbRecords || {}).map(
                    ([tableName, rows]: [string, any]) => (
                      <details
                        key={tableName}
                        className="rounded-md bg-surface-container-high p-2"
                      >
                        <summary className="cursor-pointer text-xs font-medium text-on-surface">
                          {tableName} ({rows?.length || 0})
                        </summary>
                        <pre className="mt-2 text-[11px] text-on-surface-variant overflow-x-auto whitespace-pre-wrap break-words">
                          {JSON.stringify(rows || [], null, 2)}
                        </pre>
                      </details>
                    )
                  )}
                </div>
              </Section>
            </div>
          ) : (
            <div className="py-12 text-center text-sm text-outline">
              Failed to load user details
            </div>
          )}
        </Modal>
      )}
      <datalist id="tier-options">
        {savedTiers.map(t => (
          <option key={t} value={t} />
        ))}
      </datalist>
    </div>
  );
}

function SelectInput({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: [string, string][];
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-8 px-2 rounded-md bg-surface-container-high border border-outline-variant/20 text-sm text-on-surface"
    >
      {options.map(([v, l]) => (
        <option key={v} value={v}>
          {l}
        </option>
      ))}
    </select>
  );
}

function MenuItem({
  icon,
  children,
  onClick,
  tone = "default",
}: {
  icon: React.ReactNode;
  children: React.ReactNode;
  onClick: () => void;
  tone?: "default" | "warning";
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full px-2.5 h-8 text-left text-xs hover:bg-surface-container-high transition-colors flex items-center gap-2",
        tone === "warning" ? "text-amber-600" : "text-on-surface"
      )}
    >
      {icon}
      {children}
    </button>
  );
}

function Modal({
  children,
  onClose,
  wide,
}: {
  children: React.ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-3"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.97 }}
        onClick={(e) => e.stopPropagation()}
        className={cn(
          "surface-card shadow-xl max-h-[90vh] overflow-y-auto p-4",
          wide ? "w-full max-w-3xl" : "w-full max-w-sm"
        )}
      >
        {children}
      </motion.div>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <label className="text-[11px] text-outline font-medium px-0.5 block">
        {label}
      </label>
      {children}
    </div>
  );
}

function Stat({
  label,
  value,
  mono,
  valueClass,
}: {
  label: string;
  value?: React.ReactNode;
  mono?: boolean;
  valueClass?: string;
}) {
  return (
    <div className="surface-card p-2">
      <p className="text-[10px] text-outline">{label}</p>
      <p
        className={cn(
          "text-xs font-medium text-on-surface mt-0.5 truncate capitalize",
          mono && "font-mono",
          valueClass
        )}
      >
        {value ?? "—"}
      </p>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="surface-card p-3">
      <h3 className="text-xs font-medium text-outline mb-2">{title}</h3>
      {children}
    </div>
  );
}
