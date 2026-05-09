"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { Search, Plus, BookOpen, MoreHorizontal, ArrowUpDown } from "lucide-react";
import Link from "next/link";
import { useConfirm } from "@/components/ui/confirm-dialog";

export function CoursesClient({ initialCourses }: { initialCourses: any[] }) {
  const router = useRouter();
  const confirm = useConfirm();
  const [searchQuery, setSearchQuery] = useState("");
  // Bind directly to the prop instead of snapshotting into useState — after
  // router.refresh() the server component re-renders with the new list, and
  // we want that list to be what we render immediately. A local useState
  // initializer would freeze the first snapshot and make newly-added courses
  // invisible until a hard refresh.
  const courses = initialCourses;
  const [statusFilter, setStatusFilter] = useState("all");
  const [subjectFilter, setSubjectFilter] = useState("all");
  const [sortBy, setSortBy] = useState<"title" | "enrollment" | "created_at">("created_at");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const [isDuplicatingId, setIsDuplicatingId] = useState<string | null>(null);
  const [isArchivingId, setIsArchivingId] = useState<string | null>(null);
  const [isDeletingId, setIsDeletingId] = useState<string | null>(null);
  const [isTogglingId, setIsTogglingId] = useState<string | null>(null);

  // Derive the visible status. We check (1) hard soft-delete via `deleted_at`
  // (2) the DB `status` column (modern path used by the PUT/DELETE routes)
  // (3) a legacy `admin_notes` marker for rows created before migration 010
  // (4) `is_published` as the final fallback.
  const statusOf = (course: any) => {
    if (course.deleted_at) return "deleted";
    const notes = (course.admin_notes || "") as string;
    if (notes.includes("[DELETED]")) return "deleted";
    if (notes.includes("[ARCHIVED]") || course.status === "archived") return "archived";
    return course.is_published ? "published" : "draft";
  };

  const subjects = useMemo(
    () => Array.from(new Set(courses.map((c) => c.subject).filter(Boolean))).sort(),
    [courses]
  );

  const filteredCourses = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    const filtered = courses.filter((c) => {
      const status = statusOf(c);
      const matchesSearch = !q || c.title?.toLowerCase().includes(q) || c.slug?.toLowerCase().includes(q);
      const matchesStatus = statusFilter === "all" || status === statusFilter;
      const matchesSubject = subjectFilter === "all" || c.subject === subjectFilter;
      return matchesSearch && matchesStatus && matchesSubject;
    });
    const sorted = [...filtered].sort((a, b) => {
      const dir = sortOrder === "asc" ? 1 : -1;
      if (sortBy === "title") return dir * String(a.title || "").localeCompare(String(b.title || ""));
      if (sortBy === "enrollment") {
        const aCount = a.course_access_grants?.length || 0;
        const bCount = b.course_access_grants?.length || 0;
        return dir * (aCount - bCount);
      }
      return dir * (new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    });
    return sorted;
  }, [courses, searchQuery, statusFilter, subjectFilter, sortBy, sortOrder]);

  const handleDuplicate = async (course: any) => {
    setIsDuplicatingId(course.id);
    try {
      const res = await fetch("/api/admin/courses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: `${course.title} (Copy)`,
          subject: course.subject || "General",
          description: course.description || "",
          is_published: false,
        }),
      });
      const clonedCourse = await res.json();
      if (!res.ok) throw new Error(clonedCourse.error);
      const courseRes = await fetch(`/api/admin/courses/${course.id}`);
      const fullCourse = await courseRes.json();
      const lessons = fullCourse.lessons || [];
      for (const lesson of lessons) {
        await fetch(`/api/admin/courses/${clonedCourse.id}/lessons`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: lesson.title,
            content_type: lesson.content_type,
            content_body: lesson.content_body || "",
            sequence_order: lesson.sequence_order || 0,
            is_published: false,
          }),
        });
      }
      toast.success("Course duplicated as draft");
      router.refresh();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsDuplicatingId(null);
    }
  };

  const handleTogglePublish = async (course: any) => {
    const next = !course.is_published;
    // Ask for confirmation before moving a draft in front of students, and
    // before pulling a published course out from under them. Skipping the
    // confirm is tempting here but the destructive direction is non-obvious
    // ("Unpublish" immediately hides the card for every enrolled student).
    const label = next ? "Publish" : "Unpublish";
    if (
      !(await confirm({
        title: `${label} "${course.title}"?`,
        description: next
          ? "Students with access will immediately see this course in their dashboard."
          : "Students will no longer see this course. Their progress stays intact.",
        confirmLabel: label,
        variant: next ? "default" : "warning",
      }))
    ) {
      return;
    }
    setIsTogglingId(course.id);
    const tid = toast.loading(next ? "Publishing course…" : "Unpublishing course…");
    try {
      const res = await fetch(`/api/admin/courses/${course.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        // The PUT handler derives `status` from `is_published` if we don't
        // send one, so this single field keeps both columns consistent.
        body: JSON.stringify({ is_published: next }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success(next ? "Course published" : "Course unpublished", { id: tid });
      router.refresh();
    } catch (err: any) {
      toast.error(err.message || `${label} failed`, { id: tid });
    } finally {
      setIsTogglingId(null);
      setActiveMenu(null);
    }
  };

  const handleArchive = async (course: any) => {
    setIsArchivingId(course.id);
    try {
      const updatedNotes = `${course.admin_notes || ""}\n[ARCHIVED]`;
      const res = await fetch(`/api/admin/courses/${course.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_published: false, admin_notes: updatedNotes }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success("Course archived");
      router.refresh();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsArchivingId(null);
    }
  };

  const handleSoftDelete = async (course: any) => {
    const enrolledCount = course.course_access_grants?.length || 0;
    if (enrolledCount > 0) {
      toast.error("Cannot delete course with enrolled students. Unenroll or migrate first.");
      return;
    }
    if (!(await confirm({
      title: `Soft delete "${course.title}"?`,
      description: "The course will be archived and hidden from students. Enrollments stay intact.",
      confirmLabel: "Archive",
      variant: "warning",
    }))) return;
    setIsDeletingId(course.id);
    try {
      const updatedNotes = `${course.admin_notes || ""}\n[DELETED]`;
      const res = await fetch(`/api/admin/courses/${course.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_published: false, admin_notes: updatedNotes }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success("Course soft deleted");
      router.refresh();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsDeletingId(null);
    }
  };

  const runBulkAction = async (action: "publish" | "unpublish" | "archive" | "delete") => {
    if (selectedIds.length === 0) return toast.error("Select at least one course");
    try {
      const res = await fetch("/api/admin/courses/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, courseIds: selectedIds }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success(`Bulk ${action} completed`);
      setSelectedIds([]);
      router.refresh();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const statusChip = (status: string) => {
    const map: Record<string, string> = {
      published: "bg-green-500/10 text-green-600",
      archived: "bg-slate-500/10 text-slate-500",
      draft: "bg-amber-500/10 text-amber-600",
      deleted: "bg-red-500/10 text-red-500",
    };
    return (
      <span
        className={`inline-flex items-center h-5 px-2 rounded text-[10px] font-medium ${map[status] || map.draft}`}
      >
        {status}
      </span>
    );
  };

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="surface-card p-3 space-y-2.5">
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-outline" />
            <input
              type="text"
              placeholder="Search by title or slug..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-9 pl-8 pr-3 rounded-md bg-surface-container-high border border-outline-variant/20 focus:border-tertiary focus:ring-1 focus:ring-tertiary outline-none text-sm"
            />
          </div>
          <Link
            href="/admin/courses/new"
            className="h-9 px-3 rounded-md bg-tertiary text-white text-sm font-poppins font-medium hover:bg-tertiary/90 transition-colors flex items-center justify-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            New course
          </Link>
        </div>

        <div className="flex flex-wrap gap-2 items-center">
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="h-8 px-2 rounded-md bg-surface-container-high border border-outline-variant/20 text-xs">
            <option value="all">All status</option>
            <option value="draft">Draft</option>
            <option value="published">Published</option>
            <option value="archived">Archived</option>
            <option value="deleted">Deleted</option>
          </select>
          <select value={subjectFilter} onChange={(e) => setSubjectFilter(e.target.value)} className="h-8 px-2 rounded-md bg-surface-container-high border border-outline-variant/20 text-xs">
            <option value="all">All subjects</option>
            {subjects.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <button
            onClick={() => {
              setSortBy(sortBy === "title" ? "enrollment" : sortBy === "enrollment" ? "created_at" : "title");
            }}
            className="h-8 px-2.5 rounded-md bg-surface-container-high border border-outline-variant/20 text-xs flex items-center gap-1"
          >
            <ArrowUpDown className="w-3 h-3" />
            {sortBy === "created_at" ? "Created" : sortBy === "enrollment" ? "Enrolled" : "Title"}
          </button>
          <button
            onClick={() => setSortOrder(sortOrder === "asc" ? "desc" : "asc")}
            className="h-8 px-2.5 rounded-md bg-surface-container-high border border-outline-variant/20 text-xs"
          >
            {sortOrder === "asc" ? "↑" : "↓"}
          </button>
          {selectedIds.length > 0 && (
            <div className="flex gap-1.5 ml-auto items-center">
              <span className="text-xs text-outline">{selectedIds.length} selected</span>
              <button onClick={() => runBulkAction("publish")} className="h-8 px-2 rounded-md bg-surface-container-high border border-outline-variant/20 text-xs hover:bg-surface-container-highest">Publish</button>
              <button onClick={() => runBulkAction("unpublish")} className="h-8 px-2 rounded-md bg-surface-container-high border border-outline-variant/20 text-xs hover:bg-surface-container-highest">Unpublish</button>
              <button onClick={() => runBulkAction("archive")} className="h-8 px-2 rounded-md bg-surface-container-high border border-outline-variant/20 text-xs hover:bg-surface-container-highest">Archive</button>
              <button onClick={() => runBulkAction("delete")} className="h-8 px-2 rounded-md bg-red-500/10 text-red-500 text-xs hover:bg-red-500/20">Delete</button>
            </div>
          )}
        </div>
      </div>

      {/* Desktop table */}
      <div className={`hidden md:block surface-card overflow-x-auto transition-[padding] duration-200 ${activeMenu ? "pb-44" : ""}`}>
        <table className="w-full text-sm">
          <thead className="bg-surface-container-high/60 text-xs text-outline">
            <tr>
              <th className="w-10 px-3 py-2.5 text-left">
                <input
                  type="checkbox"
                  checked={filteredCourses.length > 0 && filteredCourses.every((c) => selectedIds.includes(c.id))}
                  onChange={(e) => setSelectedIds(e.target.checked ? filteredCourses.map((c) => c.id) : [])}
                  className="accent-tertiary"
                />
              </th>
              <th className="w-12 px-3 py-2.5 text-left font-medium">—</th>
              <th className="px-3 py-2.5 text-left font-medium">Title</th>
              <th className="px-3 py-2.5 text-left font-medium">Subject</th>
              <th className="px-3 py-2.5 text-left font-medium">Students</th>
              <th className="px-3 py-2.5 text-left font-medium">Lessons</th>
              <th className="px-3 py-2.5 text-left font-medium">Status</th>
              <th className="px-3 py-2.5 text-left font-medium">Created</th>
              <th className="w-10 px-3 py-2.5"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-outline-variant/10">
            {filteredCourses.map((course) => {
              const enrolledCount = course.course_access_grants?.length || 0;
              const lessonCount = course.lessons?.length || 0;
              const status = statusOf(course);
              return (
                <tr key={course.id} className="h-11 hover:bg-surface-container-high/40">
                  <td className="px-3">
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(course.id)}
                      onChange={(e) =>
                        setSelectedIds((prev) =>
                          e.target.checked ? [...prev, course.id] : prev.filter((id) => id !== course.id)
                        )
                      }
                      className="accent-tertiary"
                    />
                  </td>
                  <td className="px-3">
                    <div className="w-7 h-7 rounded bg-surface-container-high overflow-hidden border border-outline-variant/20">
                      {course.thumbnail_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={course.thumbnail_url} alt={course.title} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full grid place-items-center text-outline">
                          <BookOpen className="w-3.5 h-3.5" />
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-3">
                    <div className="font-medium text-on-surface truncate max-w-[240px]">{course.title}</div>
                    <div className="text-[11px] text-outline truncate max-w-[240px]">{course.slug || "—"}</div>
                  </td>
                  <td className="px-3 text-on-surface-variant">{course.subject || "General"}</td>
                  <td className="px-3 text-on-surface-variant tabular-nums">{enrolledCount}</td>
                  <td className="px-3 text-on-surface-variant tabular-nums">{lessonCount}</td>
                  <td className="px-3">{statusChip(status)}</td>
                  <td className="px-3 text-on-surface-variant text-xs">{format(new Date(course.created_at), "MMM d, yyyy")}</td>
                  <td className="px-3 text-right relative">
                    <button onClick={() => setActiveMenu(activeMenu === course.id ? null : course.id)} className="p-1 rounded hover:bg-surface-container-high">
                      <MoreHorizontal className="w-4 h-4" />
                    </button>
                    {activeMenu === course.id && (
                      <>
                        <div className="fixed inset-0 z-10" onClick={() => setActiveMenu(null)} />
                        <div className="absolute right-2 mt-1 w-44 rounded-md bg-surface-container border border-outline-variant/20 shadow-lg z-20 text-left overflow-hidden">
                          <Link href={`/admin/courses/${course.id}`} className="block px-3 py-1.5 text-xs hover:bg-surface-container-high">Edit</Link>
                          <a href={`/dashboard/courses/${course.id}`} target="_blank" rel="noreferrer" className="block px-3 py-1.5 text-xs hover:bg-surface-container-high">View as student</a>
                          <button
                            onClick={() => handleTogglePublish(course)}
                            disabled={isTogglingId === course.id}
                            className={`w-full px-3 py-1.5 text-xs hover:bg-surface-container-high text-left disabled:opacity-50 ${course.is_published ? "" : "text-green-600"}`}
                          >
                            {isTogglingId === course.id
                              ? course.is_published
                                ? "Unpublishing…"
                                : "Publishing…"
                              : course.is_published
                                ? "Unpublish"
                                : "Publish"}
                          </button>
                          <button
                            onClick={() => handleDuplicate(course)}
                            disabled={isDuplicatingId === course.id}
                            className="w-full px-3 py-1.5 text-xs hover:bg-surface-container-high text-left disabled:opacity-50"
                          >
                            {isDuplicatingId === course.id ? "Duplicating…" : "Duplicate"}
                          </button>
                          <button
                            onClick={() => handleArchive(course)}
                            disabled={isArchivingId === course.id}
                            className="w-full px-3 py-1.5 text-xs hover:bg-surface-container-high text-left disabled:opacity-50"
                          >
                            {isArchivingId === course.id ? "Archiving…" : "Archive"}
                          </button>
                          <button
                            onClick={() => handleSoftDelete(course)}
                            disabled={isDeletingId === course.id}
                            className="w-full px-3 py-1.5 text-xs hover:bg-surface-container-high text-left text-red-500 disabled:opacity-50"
                          >
                            {isDeletingId === course.id ? "Deleting…" : "Delete"}
                          </button>
                        </div>
                      </>
                    )}
                  </td>
                </tr>
              );
            })}
            {filteredCourses.length === 0 && (
              <tr>
                <td colSpan={9} className="px-3 py-8 text-center text-sm text-outline">
                  No courses found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="md:hidden space-y-2">
        {filteredCourses.map((course) => {
          const enrolledCount = course.course_access_grants?.length || 0;
          const lessonCount = course.lessons?.length || 0;
          const status = statusOf(course);
          return (
            <div key={course.id} className="surface-card p-3">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded bg-surface-container-high overflow-hidden border border-outline-variant/20 shrink-0">
                  {course.thumbnail_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={course.thumbnail_url} alt={course.title} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full grid place-items-center text-outline">
                      <BookOpen className="w-4 h-4" />
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <div className="font-medium text-on-surface truncate">{course.title}</div>
                    {statusChip(status)}
                  </div>
                  <div className="text-[11px] text-outline truncate">{course.slug || "—"}</div>
                  <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-on-surface-variant">
                    <span>{course.subject || "General"}</span>
                    <span>{enrolledCount} enrolled</span>
                    <span>{lessonCount} lessons</span>
                    <span>{format(new Date(course.created_at), "MMM d, yyyy")}</span>
                  </div>
                  <div className="mt-2 flex gap-1.5">
                    <Link href={`/admin/courses/${course.id}`} className="h-7 px-2 rounded-md bg-surface-container-high border border-outline-variant/20 text-xs flex items-center">Edit</Link>
                    <button
                      onClick={() => handleTogglePublish(course)}
                      disabled={isTogglingId === course.id}
                      className={`h-7 px-2 rounded-md border text-xs disabled:opacity-50 ${
                        course.is_published
                          ? "bg-surface-container-high border-outline-variant/20"
                          : "bg-green-500/10 border-green-500/20 text-green-600"
                      }`}
                    >
                      {isTogglingId === course.id
                        ? "…"
                        : course.is_published
                          ? "Unpublish"
                          : "Publish"}
                    </button>
                    <button
                      onClick={() => handleDuplicate(course)}
                      disabled={isDuplicatingId === course.id}
                      className="h-7 px-2 rounded-md bg-surface-container-high border border-outline-variant/20 text-xs disabled:opacity-50"
                    >
                      Duplicate
                    </button>
                    <button
                      onClick={() => handleArchive(course)}
                      disabled={isArchivingId === course.id}
                      className="h-7 px-2 rounded-md bg-surface-container-high border border-outline-variant/20 text-xs disabled:opacity-50"
                    >
                      Archive
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
        {filteredCourses.length === 0 && (
          <div className="surface-card p-6 text-center text-sm text-outline">No courses found.</div>
        )}
      </div>
    </div>
  );
}
