"use client";

import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { toast } from "sonner";
import {
  ShieldCheck,
  ShieldOff,
  Search,
  Loader2,
  Plus,
  X as XIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@/lib/supabase/client";

const TIER_OPTIONS = [
  { value: "free", label: "Free" },
  { value: "basic", label: "Basic" },
  { value: "premium", label: "Premium" },
  { value: "all", label: "All content" },
] as const;

export function AccessGrantsClient({ initialGrants }: { initialGrants: any[] }) {
  const router = useRouter();
  const [grants, setGrants] = useState(initialGrants);
  const [search, setSearch] = useState("");
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [tierSavingId, setTierSavingId] = useState<string | null>(null);

  // "Grant access" modal state. Populated lazily on first open so we don't
  // eagerly pull every student/course on pages where nobody opens it.
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [students, setStudents] = useState<
    { user_id: string; full_name: string | null; email: string | null }[]
  >([]);
  const [courses, setCourses] = useState<
    { id: string; title: string; visibility: string | null }[]
  >([]);
  const [loadingLookup, setLoadingLookup] = useState(false);
  const [form, setForm] = useState({
    user_id: "",
    course_id: "",
    access_tier: "all",
    studentSearch: "",
    courseSearch: "",
  });

  useEffect(() => {
    if (!showCreate) return;
    if (students.length > 0 && courses.length > 0) return;
    // The browser client inherits the admin's session cookie. RLS on
    // profiles/courses already allows admins to read everything, so we
    // don't need to go through a bespoke API route for lookups.
    const supabase = createBrowserClient();
    setLoadingLookup(true);
    Promise.all([
      supabase
        .from("profiles")
        .select("user_id, full_name, email")
        .eq("role", "student")
        .eq("status", "active")
        .order("full_name", { ascending: true })
        .limit(500),
      supabase
        .from("courses")
        .select("id, title, visibility")
        .is("deleted_at", null)
        .order("title", { ascending: true }),
    ])
      .then(([s, c]) => {
        setStudents((s.data as any) ?? []);
        setCourses((c.data as any) ?? []);
      })
      .finally(() => setLoadingLookup(false));
  }, [showCreate, students.length, courses.length]);

  const filteredStudents = useMemo(
    () =>
      students.filter((p) => {
        const q = form.studentSearch.trim().toLowerCase();
        if (!q) return true;
        return (
          (p.full_name ?? "").toLowerCase().includes(q) ||
          (p.email ?? "").toLowerCase().includes(q)
        );
      }),
    [students, form.studentSearch]
  );

  const filteredCourseOpts = useMemo(
    () =>
      courses.filter((c) => {
        const q = form.courseSearch.trim().toLowerCase();
        if (!q) return true;
        return c.title.toLowerCase().includes(q);
      }),
    [courses, form.courseSearch]
  );

  const closeCreate = () => {
    setShowCreate(false);
    setForm({
      user_id: "",
      course_id: "",
      access_tier: "all",
      studentSearch: "",
      courseSearch: "",
    });
  };

  const submitCreate = async () => {
    if (!form.user_id || !form.course_id) {
      toast.error("Pick a student and a course");
      return;
    }
    setCreating(true);
    try {
      const res = await fetch("/api/admin/courses/access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: form.user_id,
          course_id: form.course_id,
          access_tier: form.access_tier,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create grant");

      // Upsert into the local list — either prepend new or replace the
      // reactivated row so it jumps to the top without a full refresh.
      setGrants((prev) => {
        const idx = prev.findIndex((g) => g.id === data.id);
        if (idx === -1) return [data, ...prev];
        const next = prev.slice();
        next[idx] = data;
        return next;
      });
      toast.success("Access granted");
      closeCreate();
      router.refresh();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setCreating(false);
    }
  };

  const filtered = grants.filter(g =>
    g.profiles?.full_name?.toLowerCase().includes(search.toLowerCase()) ||
    g.profiles?.email?.toLowerCase().includes(search.toLowerCase()) ||
    g.courses?.title?.toLowerCase().includes(search.toLowerCase())
  );

  const toggleAccess = async (id: string, currentlyActive: boolean) => {
    setLoadingId(id);
    try {
      const res = await fetch(`/api/admin/courses/access/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: !currentlyActive })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      toast.success(currentlyActive ? "Access revoked" : "Access restored");
      setGrants(grants.map(g => g.id === id ? data : g));
      router.refresh();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoadingId(null);
    }
  };

  const updateTier = async (id: string, tier: string) => {
    const previous = grants;
    setTierSavingId(id);
    // Optimistic update.
    setGrants((prev) => prev.map((g) => (g.id === id ? { ...g, access_tier: tier } : g)));
    try {
      const res = await fetch(`/api/admin/courses/access/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ access_tier: tier }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update tier");
      setGrants((prev) => prev.map((g) => (g.id === id ? { ...g, ...data } : g)));
      toast.success("Tier updated");
    } catch (err: any) {
      setGrants(previous);
      toast.error(err.message);
    } finally {
      setTierSavingId(null);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:justify-between">
        <div className="relative w-full sm:max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-outline" />
          <input
            type="text"
            placeholder="Search student or course"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 h-9 rounded-md bg-surface-container-high border border-outline-variant/20 focus:border-tertiary focus:ring-1 focus:ring-tertiary outline-none text-sm"
          />
        </div>
        <button
          type="button"
          onClick={() => setShowCreate(true)}
          className="inline-flex items-center justify-center gap-1.5 h-9 px-3 rounded-md bg-tertiary text-white text-sm font-medium hover:bg-tertiary/90 transition-colors"
        >
          <Plus className="w-4 h-4" /> Grant access
        </button>
      </div>

      <div className="surface-card overflow-hidden">
        {/* Desktop table */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-surface-container-high/60 text-xs text-outline">
              <tr>
                <th className="px-3 py-2 text-left font-medium">Student</th>
                <th className="px-3 py-2 text-left font-medium">Course</th>
                <th className="px-3 py-2 text-left font-medium">Tier</th>
                <th className="px-3 py-2 text-left font-medium">Status</th>
                <th className="px-3 py-2 text-left font-medium">Granted</th>
                <th className="px-3 py-2 text-right font-medium w-16">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/10">
              {filtered.map((g) => (
                <tr key={g.id} className="hover:bg-surface-container-high/40 h-11">
                  <td className="px-3 py-2">
                    <div className="font-medium text-on-surface truncate">{g.profiles?.full_name}</div>
                    <div className="text-[11px] text-outline truncate">{g.profiles?.email}</div>
                  </td>
                  <td className="px-3 py-2 text-on-surface-variant truncate max-w-[240px]">{g.courses?.title}</td>
                  <td className="px-3 py-2">
                    <div className="relative inline-flex items-center">
                      <select
                        value={g.access_tier ?? "all"}
                        onChange={(e) => updateTier(g.id, e.target.value)}
                        disabled={tierSavingId === g.id}
                        aria-label="Access tier"
                        className="h-7 pl-2 pr-6 rounded-md bg-surface-container-high border border-outline-variant/20 text-[11px] outline-none focus:border-tertiary focus:ring-1 focus:ring-tertiary disabled:opacity-50"
                      >
                        {TIER_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                      {tierSavingId === g.id && (
                        <Loader2 className="absolute right-1 w-3 h-3 animate-spin text-outline pointer-events-none" />
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    <span className={`inline-flex h-5 items-center px-2 rounded-md text-[10px] font-medium ${g.is_active ? 'bg-green-500/10 text-green-600' : 'bg-red-500/10 text-red-600'}`}>
                      {g.is_active ? 'Active' : 'Revoked'}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-[11px] text-outline">
                    {format(new Date(g.granted_at), "MMM d, yyyy")}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <button
                      onClick={() => toggleAccess(g.id, g.is_active)}
                      disabled={loadingId === g.id}
                      className={`inline-flex items-center justify-center h-7 w-7 rounded-md transition-colors ${g.is_active ? 'hover:bg-red-500/10 text-red-500' : 'hover:bg-green-500/10 text-green-500'} disabled:opacity-50`}
                      title={g.is_active ? 'Revoke access' : 'Restore access'}
                    >
                      {loadingId === g.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : (
                        g.is_active ? <ShieldOff className="w-3.5 h-3.5" /> : <ShieldCheck className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile list */}
        <div className="md:hidden divide-y divide-outline-variant/10">
          {filtered.map((g) => (
            <div key={g.id} className="p-3 flex items-start gap-3">
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm text-on-surface truncate">{g.profiles?.full_name}</div>
                <div className="text-[11px] text-outline truncate">{g.profiles?.email}</div>
                <div className="mt-1 text-xs text-on-surface-variant truncate">{g.courses?.title}</div>
                <div className="mt-1.5 flex items-center gap-2 flex-wrap">
                  <span className={`inline-flex h-5 items-center px-2 rounded-md text-[10px] font-medium ${g.is_active ? 'bg-green-500/10 text-green-600' : 'bg-red-500/10 text-red-600'}`}>
                    {g.is_active ? 'Active' : 'Revoked'}
                  </span>
                  <select
                    value={g.access_tier ?? "all"}
                    onChange={(e) => updateTier(g.id, e.target.value)}
                    disabled={tierSavingId === g.id}
                    aria-label="Access tier"
                    className="h-6 pl-1.5 pr-5 rounded-md bg-surface-container-high border border-outline-variant/20 text-[10px] outline-none focus:border-tertiary focus:ring-1 focus:ring-tertiary disabled:opacity-50"
                  >
                    {TIER_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                  <span className="text-[10px] text-outline">{format(new Date(g.granted_at), "MMM d, yyyy")}</span>
                </div>
              </div>
              <button
                onClick={() => toggleAccess(g.id, g.is_active)}
                disabled={loadingId === g.id}
                className={`shrink-0 inline-flex items-center justify-center h-8 w-8 rounded-md border border-outline-variant/20 ${g.is_active ? 'text-red-500 hover:bg-red-500/10' : 'text-green-500 hover:bg-green-500/10'} disabled:opacity-50`}
              >
                {loadingId === g.id ? <Loader2 className="w-4 h-4 animate-spin" /> : (
                  g.is_active ? <ShieldOff className="w-4 h-4" /> : <ShieldCheck className="w-4 h-4" />
                )}
              </button>
            </div>
          ))}
        </div>

        {filtered.length === 0 && (
          <div className="p-8 text-center text-sm text-outline">No access grants match your search.</div>
        )}
      </div>

      {showCreate && (
        <div
          className="fixed inset-0 z-50 grid place-items-center p-4 bg-black/50 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="grant-access-title"
        >
          <div className="w-full max-w-lg rounded-lg bg-surface border border-outline-variant/20 shadow-xl">
            <div className="flex items-center justify-between px-4 h-12 border-b border-outline-variant/15">
              <h2
                id="grant-access-title"
                className="text-sm font-poppins font-semibold text-on-surface"
              >
                Grant course access
              </h2>
              <button
                type="button"
                onClick={closeCreate}
                className="w-7 h-7 rounded-md text-on-surface-variant hover:bg-surface-container-high grid place-items-center"
                aria-label="Close dialog"
              >
                <XIcon className="w-4 h-4" />
              </button>
            </div>
            <div className="p-4 space-y-3">
              {loadingLookup ? (
                <div className="flex items-center gap-2 text-sm text-on-surface-variant py-8 justify-center">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Loading students & courses…
                </div>
              ) : (
                <>
                  <div>
                    <label className="text-[11px] text-outline block mb-1">
                      Student
                    </label>
                    <input
                      type="text"
                      value={form.studentSearch}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, studentSearch: e.target.value }))
                      }
                      placeholder="Filter by name or email"
                      className="w-full h-9 px-2.5 rounded-md bg-surface-container-high border border-outline-variant/20 text-sm outline-none focus:border-tertiary focus:ring-1 focus:ring-tertiary"
                    />
                    <div className="mt-1 max-h-40 overflow-y-auto rounded-md border border-outline-variant/15 divide-y divide-outline-variant/10">
                      {filteredStudents.slice(0, 60).map((p) => (
                        <button
                          key={p.user_id}
                          type="button"
                          onClick={() =>
                            setForm((f) => ({ ...f, user_id: p.user_id }))
                          }
                          className={`w-full text-left px-2.5 py-1.5 text-xs hover:bg-surface-container-high ${
                            form.user_id === p.user_id
                              ? "bg-tertiary/10 text-tertiary"
                              : "text-on-surface-variant"
                          }`}
                        >
                          <div className="font-medium text-on-surface truncate">
                            {p.full_name ?? "(no name)"}
                          </div>
                          <div className="text-[11px] text-outline truncate">
                            {p.email}
                          </div>
                        </button>
                      ))}
                      {filteredStudents.length === 0 && (
                        <div className="p-3 text-[11px] text-outline text-center">
                          No matching students.
                        </div>
                      )}
                    </div>
                  </div>
                  <div>
                    <label className="text-[11px] text-outline block mb-1">
                      Course
                    </label>
                    <input
                      type="text"
                      value={form.courseSearch}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, courseSearch: e.target.value }))
                      }
                      placeholder="Filter by title"
                      className="w-full h-9 px-2.5 rounded-md bg-surface-container-high border border-outline-variant/20 text-sm outline-none focus:border-tertiary focus:ring-1 focus:ring-tertiary"
                    />
                    <div className="mt-1 max-h-40 overflow-y-auto rounded-md border border-outline-variant/15 divide-y divide-outline-variant/10">
                      {filteredCourseOpts.slice(0, 60).map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() =>
                            setForm((f) => ({ ...f, course_id: c.id }))
                          }
                          className={`w-full text-left px-2.5 py-1.5 text-xs hover:bg-surface-container-high flex items-center justify-between gap-2 ${
                            form.course_id === c.id
                              ? "bg-tertiary/10 text-tertiary"
                              : "text-on-surface-variant"
                          }`}
                        >
                          <span className="truncate">{c.title}</span>
                          <span className="text-[10px] uppercase tracking-wide text-outline shrink-0">
                            {c.visibility ?? "open"}
                          </span>
                        </button>
                      ))}
                      {filteredCourseOpts.length === 0 && (
                        <div className="p-3 text-[11px] text-outline text-center">
                          No matching courses.
                        </div>
                      )}
                    </div>
                  </div>
                  <div>
                    <label className="text-[11px] text-outline block mb-1">
                      Access tier
                    </label>
                    <select
                      value={form.access_tier}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, access_tier: e.target.value }))
                      }
                      className="w-full h-9 px-2.5 rounded-md bg-surface-container-high border border-outline-variant/20 text-sm outline-none focus:border-tertiary focus:ring-1 focus:ring-tertiary"
                    >
                      {TIER_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </>
              )}
            </div>
            <div className="flex items-center justify-end gap-2 px-4 h-12 border-t border-outline-variant/15">
              <button
                type="button"
                onClick={closeCreate}
                className="h-8 px-3 rounded-md text-xs font-medium text-on-surface-variant hover:bg-surface-container-high"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={submitCreate}
                disabled={creating || !form.user_id || !form.course_id}
                className="h-8 px-3 rounded-md bg-tertiary text-white text-xs font-medium hover:bg-tertiary/90 disabled:opacity-50 inline-flex items-center gap-1.5"
              >
                {creating && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Grant access
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
