"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Save,
  Plus,
  FileText,
  Video,
  BookOpen,
  Loader2,
  Upload,
  ImageIcon,
  X as XIcon,
} from "lucide-react";
import Link from "next/link";
import { MarkdownEditor } from "@/components/ui/MarkdownEditor";
import { cn } from "@/lib/utils";
import { createBrowserClient } from "@supabase/ssr";
import { env } from "@/lib/env";

export function CourseDetailClient({ initialCourse }: { initialCourse: any }) {
  const router = useRouter();
  const [course, setCourse] = useState(initialCourse);
  const [lessons, setLessons] = useState<any[]>(initialCourse.lessons || []);
  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<
    "basic" | "access" | "gating" | "seo" | "analytics" | "danger" | "lessons"
  >("basic");
  const [activeLessonId, setActiveLessonId] = useState<string | null>(null);
  const [meta, setMeta] = useState<any>(() => {
    try {
      const notes = initialCourse.admin_notes || "";
      const marker = "[COURSE_META]";
      const idx = notes.indexOf(marker);
      if (idx < 0) return {};
      return JSON.parse(notes.slice(idx + marker.length).trim());
    } catch {
      return {};
    }
  });
  const [analytics, setAnalytics] = useState<any>(null);
  const [thumbUploading, setThumbUploading] = useState(false);
  const thumbInputRef = useRef<HTMLInputElement | null>(null);

  const activeLesson = lessons.find((l) => l.id === activeLessonId);

  // Uploads a thumbnail to the `course-thumbnails` public bucket and writes
  // the public URL back into the course row so the next save persists it.
  // Admin-only RLS is already enforced by migration 013.
  const handleThumbnailUpload = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("Pick an image file (jpg, png, webp, svg)");
      return;
    }
    if (file.size > 4 * 1024 * 1024) {
      toast.error("Image must be under 4 MB");
      return;
    }
    setThumbUploading(true);
    const tid = toast.loading("Uploading thumbnail…");
    try {
      const supabase = createBrowserClient(
        env.NEXT_PUBLIC_SUPABASE_URL,
        env.NEXT_PUBLIC_SUPABASE_ANON_KEY
      );
      const ext = file.name.split(".").pop() || "jpg";
      const path = `${course.id}/thumb-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("course-thumbnails")
        .upload(path, file, { upsert: false, cacheControl: "3600" });
      if (upErr) throw upErr;
      const { data } = supabase.storage.from("course-thumbnails").getPublicUrl(path);
      const publicUrl = data.publicUrl;
      setCourse({ ...course, thumbnail_url: publicUrl });
      // Persist immediately so a refresh after uploading but before clicking
      // Save doesn't lose the URL.
      await fetch(`/api/admin/courses/${course.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ thumbnail_url: publicUrl }),
      });
      toast.success("Thumbnail uploaded", { id: tid });
      router.refresh();
    } catch (err: any) {
      toast.error(err.message || "Upload failed", { id: tid });
    } finally {
      setThumbUploading(false);
      if (thumbInputRef.current) thumbInputRef.current.value = "";
    }
  };

  const handleThumbnailRemove = async () => {
    setCourse({ ...course, thumbnail_url: null });
    try {
      await fetch(`/api/admin/courses/${course.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ thumbnail_url: null }),
      });
      toast.success("Thumbnail removed");
      router.refresh();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleUpdateCourse = async () => {
    setIsSaving(true);
    try {
      const plainNotes = String(course.admin_notes || "").split("[COURSE_META]")[0].trim();
      const adminNotes = `${plainNotes}\n[COURSE_META]\n${JSON.stringify(meta)}`;
      const res = await fetch(`/api/admin/courses/${course.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: course.title,
          slug: course.slug,
          subject: course.subject,
          description: course.description,
          thumbnail_url: course.thumbnail_url,
          is_published: course.is_published,
          // Migration 021 access model. The PUT handler whitelists the
          // payload against the table schema so unknown fields are
          // rejected — the column must exist before this ships.
          visibility: course.visibility ?? "open",
          admin_notes: adminNotes,
        }),
      });
      if (!res.ok) throw new Error("Failed to update course");
      toast.success("Course updated");
      router.refresh();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const loadAnalytics = async () => {
    try {
      const res = await fetch(`/api/admin/courses/${course.id}/analytics`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load analytics");
      setAnalytics(data);
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleAddLesson = async () => {
    try {
      const title = `Lesson ${lessons.length + 1}`;
      const res = await fetch(`/api/admin/courses/${course.id}/lessons`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          content_type: "markdown",
          sequence_order: lessons.length + 1,
          is_published: false,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      toast.success("Lesson added");
      setLessons([...lessons, data]);
      setActiveLessonId(data.id);
      setActiveTab("lessons");
      router.refresh();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleUpdateLesson = async (lesson: any, overrides: any = {}) => {
    const nextLesson = { ...lesson, ...overrides };
    setLessons((prev) => prev.map((l) => (l.id === lesson.id ? nextLesson : l)));
    try {
      const res = await fetch(`/api/admin/lessons/${lesson.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(overrides),
      });
      if (!res.ok) throw new Error("Failed to save lesson");
      router.refresh();
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const input =
    "w-full h-9 px-2.5 rounded-md bg-surface-container-high border border-outline-variant/20 text-sm outline-none focus:border-tertiary focus:ring-1 focus:ring-tertiary transition-colors";
  const label = "text-[11px] font-medium text-on-surface-variant block mb-1";

  const tabs: [string, string][] = [
    ["basic", "Basic"],
    ["access", "Access"],
    ["gating", "Gating"],
    ["seo", "SEO"],
    ["lessons", "Lessons"],
    ["analytics", "Analytics"],
    ["danger", "Danger"],
  ];

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <Link
          href="/admin/courses"
          className="inline-flex items-center gap-1.5 text-sm text-on-surface-variant hover:text-on-surface transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Courses
        </Link>
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-outline">
            {course.is_published ? "Published" : "Draft"}
          </span>
          <button
            disabled={isSaving}
            onClick={handleUpdateCourse}
            className="h-9 px-3 rounded-md bg-tertiary text-white text-sm font-poppins font-medium hover:bg-tertiary/90 transition-colors flex items-center gap-1.5 disabled:opacity-60"
          >
            {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            Save
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-3">
        {/* Left rail */}
        <div className="space-y-3">
          {/* Tabs */}
          <div className="surface-card p-1.5 grid grid-cols-2 lg:grid-cols-1 gap-0.5">
            {tabs.map(([id, labelText]) => (
              <button
                key={id}
                onClick={() => {
                  setActiveTab(id as any);
                  if (id === "analytics") loadAnalytics();
                }}
                className={cn(
                  "h-8 px-2.5 rounded text-xs font-medium text-left flex items-center transition-colors",
                  activeTab === id
                    ? "bg-tertiary text-white"
                    : "text-on-surface-variant hover:bg-surface-container-high"
                )}
              >
                {labelText}
              </button>
            ))}
          </div>

          {/* Curriculum */}
          <div className="surface-card overflow-hidden">
            <div className="px-2.5 py-2 flex items-center justify-between border-b border-outline-variant/10">
              <div className="flex items-center gap-1.5 text-xs font-medium text-on-surface">
                <BookOpen className="w-3.5 h-3.5 text-tertiary" />
                Curriculum
              </div>
              <button
                onClick={handleAddLesson}
                className="w-6 h-6 rounded bg-tertiary/10 text-tertiary hover:bg-tertiary hover:text-white transition-colors grid place-items-center"
                aria-label="Add lesson"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="max-h-[420px] overflow-y-auto p-1.5 space-y-0.5">
              {lessons.map((lesson) => (
                <button
                  key={lesson.id}
                  onClick={() => {
                    setActiveLessonId(lesson.id);
                    setActiveTab("lessons");
                  }}
                  className={cn(
                    "w-full text-left px-2 py-1.5 rounded text-xs flex items-center gap-2 transition-colors",
                    activeLessonId === lesson.id
                      ? "bg-tertiary/10 text-tertiary"
                      : "text-on-surface-variant hover:bg-surface-container-high"
                  )}
                >
                  <span className="w-5 h-5 grid place-items-center rounded bg-surface text-outline text-[10px] border border-outline-variant/20 shrink-0">
                    {lesson.sequence_order}
                  </span>
                  <span className="truncate flex-1">{lesson.title}</span>
                  {lesson.is_published && <span className="w-1.5 h-1.5 rounded-full bg-green-500 shrink-0" />}
                </button>
              ))}
              {lessons.length === 0 && (
                <div className="text-center p-4 text-xs text-outline">No lessons yet.</div>
              )}
            </div>
          </div>
        </div>

        {/* Right panel */}
        <div className="surface-card overflow-hidden min-h-[480px]">
          {activeTab === "basic" && (
            <div className="p-3 space-y-3">
              <div className="text-[11px] font-medium text-on-surface-variant">Basic info</div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                <div>
                  <label className={label}>Title</label>
                  <input
                    type="text"
                    value={course.title || ""}
                    onChange={(e) => setCourse({ ...course, title: e.target.value })}
                    className={input}
                  />
                </div>
                <div>
                  <label className={label}>Slug</label>
                  <input
                    type="text"
                    value={course.slug || ""}
                    onChange={(e) => setCourse({ ...course, slug: e.target.value })}
                    placeholder="auto-generated"
                    className={input}
                  />
                </div>
                <div>
                  <label className={label}>Subject / category</label>
                  <input
                    type="text"
                    value={course.subject || ""}
                    onChange={(e) => setCourse({ ...course, subject: e.target.value })}
                    className={input}
                  />
                </div>
                <div>
                  <label className={label}>Difficulty</label>
                  <select
                    value={meta.difficulty || "Beginner"}
                    onChange={(e) => setMeta({ ...meta, difficulty: e.target.value })}
                    className={input}
                  >
                    <option>Beginner</option>
                    <option>Intermediate</option>
                    <option>Advanced</option>
                  </select>
                </div>
              </div>
              <div>
                <label className={label}>Short description (≤ 160 chars)</label>
                <textarea
                  value={course.description || ""}
                  onChange={(e) => setCourse({ ...course, description: e.target.value })}
                  rows={2}
                  className="w-full px-2.5 py-1.5 rounded-md bg-surface-container-high border border-outline-variant/20 text-sm outline-none focus:border-tertiary focus:ring-1 focus:ring-tertiary resize-none"
                />
              </div>
              <div>
                <label className={label}>Long description</label>
                <MarkdownEditor
                  value={meta.longDescription || ""}
                  onChange={(val) => setMeta({ ...meta, longDescription: val })}
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                <div className="space-y-1.5">
                  <label className={label}>Thumbnail</label>
                  <div className="flex items-start gap-2">
                    <div className="relative w-24 h-16 rounded-md overflow-hidden bg-surface-container-high border border-outline-variant/15 shrink-0 grid place-items-center">
                      {course.thumbnail_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={course.thumbnail_url}
                          alt="Course thumbnail preview"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <ImageIcon className="w-4 h-4 text-outline" />
                      )}
                      {course.thumbnail_url && (
                        <button
                          type="button"
                          onClick={handleThumbnailRemove}
                          className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-black/60 text-white grid place-items-center hover:bg-black/80"
                          title="Remove thumbnail"
                          aria-label="Remove thumbnail"
                        >
                          <XIcon className="w-2.5 h-2.5" />
                        </button>
                      )}
                    </div>
                    <div className="flex-1 space-y-1.5">
                      <button
                        type="button"
                        disabled={thumbUploading}
                        onClick={() => thumbInputRef.current?.click()}
                        className="h-8 px-2.5 rounded-md bg-tertiary text-white text-xs font-medium hover:bg-tertiary/90 disabled:opacity-50 inline-flex items-center gap-1.5"
                      >
                        {thumbUploading ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <Upload className="w-3 h-3" />
                        )}
                        {course.thumbnail_url ? "Replace" : "Upload"}
                      </button>
                      <input
                        ref={thumbInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) handleThumbnailUpload(f);
                        }}
                      />
                      <input
                        type="url"
                        value={course.thumbnail_url || ""}
                        onChange={(e) =>
                          setCourse({ ...course, thumbnail_url: e.target.value })
                        }
                        placeholder="Or paste image URL"
                        className={`${input} text-[11px]`}
                      />
                    </div>
                  </div>
                  <p className="text-[10px] text-outline">
                    Max 4 MB. JPG, PNG, WebP. Shows on the student course card.
                  </p>
                </div>
                <div>
                  <label className={label}>Estimated duration (hours)</label>
                  <input
                    type="number"
                    value={meta.estimatedHours || ""}
                    onChange={(e) => setMeta({ ...meta, estimatedHours: Number(e.target.value) })}
                    className={input}
                  />
                </div>
              </div>
            </div>
          )}

          {activeTab === "access" && (
            <div className="p-3 space-y-4">
              <div>
                <div className="text-[11px] font-medium text-on-surface-variant mb-2">
                  Student visibility
                </div>
                {/* Migration 021: courses.visibility drives the student
                    lesson gate. Before this, every course appeared
                    "Locked" because the gate only looked at
                    course_access_grants. The three options map 1:1 to
                    the DB CHECK constraint. */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {[
                    {
                      value: "open",
                      label: "Open",
                      desc: "Any signed-in student can read every lesson. No enrollment needed.",
                    },
                    {
                      value: "restricted",
                      label: "Restricted",
                      desc: "Visible in the library but locked until you grant a student access.",
                    },
                    {
                      value: "private",
                      label: "Private",
                      desc: "Hidden from the library unless the student has been granted access.",
                    },
                  ].map((opt) => {
                    const current = (course.visibility ?? "open") === opt.value;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() =>
                          setCourse({ ...course, visibility: opt.value })
                        }
                        className={cn(
                          "text-left rounded-md border p-2.5 transition-colors",
                          current
                            ? "border-tertiary bg-tertiary/10"
                            : "border-outline-variant/20 bg-surface-container-high hover:border-outline-variant/40"
                        )}
                      >
                        <div
                          className={cn(
                            "text-xs font-semibold mb-1",
                            current ? "text-tertiary" : "text-on-surface"
                          )}
                        >
                          {opt.label}
                        </div>
                        <p className="text-[11px] text-on-surface-variant leading-relaxed">
                          {opt.desc}
                        </p>
                      </button>
                    );
                  })}
                </div>
                <p className="mt-2 text-[11px] text-outline">
                  Manage per-student grants from{" "}
                  <Link
                    href="/admin/courses/access"
                    className="text-tertiary hover:underline"
                  >
                    Course access
                  </Link>
                  .
                </p>
              </div>

              <div className="h-px bg-outline-variant/15" />

              <div className="text-[11px] font-medium text-on-surface-variant">Access & enrollment</div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                <div>
                  <label className={label}>Payment mode</label>
                  <select
                    value={meta.paymentMode || "free"}
                    onChange={(e) => setMeta({ ...meta, paymentMode: e.target.value })}
                    className={input}
                  >
                    <option value="free">Free</option>
                    <option value="paid">Paid</option>
                  </select>
                </div>
                <div>
                  <label className={label}>Enrollment mode</label>
                  <select
                    value={meta.enrollmentMode || "open"}
                    onChange={(e) => setMeta({ ...meta, enrollmentMode: e.target.value })}
                    className={input}
                  >
                    <option value="open">Open</option>
                    <option value="batch">Batch-restricted</option>
                    <option value="admin">Admin-only</option>
                  </select>
                </div>
                <div>
                  <label className={label}>Enrollment cap</label>
                  <input
                    type="number"
                    value={meta.enrollmentCap || ""}
                    onChange={(e) => setMeta({ ...meta, enrollmentCap: Number(e.target.value) })}
                    className={input}
                  />
                </div>
                <label className="flex items-center gap-2 h-9 px-2 rounded-md bg-surface-container-high border border-outline-variant/20 text-sm">
                  <input
                    type="checkbox"
                    checked={Boolean(meta.waitlist)}
                    onChange={(e) => setMeta({ ...meta, waitlist: e.target.checked })}
                    className="accent-tertiary"
                  />
                  Enable waitlist
                </label>
                <div>
                  <label className={label}>Start date</label>
                  <input
                    type="datetime-local"
                    value={meta.startDate || ""}
                    onChange={(e) => setMeta({ ...meta, startDate: e.target.value })}
                    className={input}
                  />
                </div>
                <div>
                  <label className={label}>End date</label>
                  <input
                    type="datetime-local"
                    value={meta.endDate || ""}
                    onChange={(e) => setMeta({ ...meta, endDate: e.target.value })}
                    className={input}
                  />
                </div>
              </div>
            </div>
          )}

          {activeTab === "gating" && (
            <div className="p-3 space-y-3">
              <div className="text-[11px] font-medium text-on-surface-variant">Lesson gating</div>
              <label className="flex items-center gap-2 h-9 px-2 rounded-md bg-surface-container-high border border-outline-variant/20 text-sm w-fit">
                <input
                  type="checkbox"
                  checked={Boolean(meta.sequentialMode)}
                  onChange={(e) => setMeta({ ...meta, sequentialMode: e.target.checked })}
                  className="accent-tertiary"
                />
                Sequential mode
              </label>
              <div>
                <label className={label}>Completion threshold</label>
                <select
                  value={meta.completionThreshold || "video_80"}
                  onChange={(e) => setMeta({ ...meta, completionThreshold: e.target.value })}
                  className={input}
                >
                  <option value="video_80">Video watched to 80%</option>
                  <option value="doc_opened">Document opened</option>
                  <option value="quiz_passed">Quiz passed with minimum score</option>
                </select>
              </div>
              <div>
                <label className={label}>Time lock</label>
                <input
                  type="text"
                  value={meta.timeLock || ""}
                  onChange={(e) => setMeta({ ...meta, timeLock: e.target.value })}
                  placeholder="e.g. unlock every 3 days"
                  className={input}
                />
              </div>
            </div>
          )}

          {activeTab === "seo" && (
            <div className="p-3 space-y-3">
              <div className="text-[11px] font-medium text-on-surface-variant">SEO & metadata</div>
              <div>
                <label className={label}>Meta title</label>
                <input
                  type="text"
                  value={meta.metaTitle || ""}
                  onChange={(e) => setMeta({ ...meta, metaTitle: e.target.value })}
                  className={input}
                />
              </div>
              <div>
                <label className={label}>Meta description</label>
                <textarea
                  value={meta.metaDescription || ""}
                  onChange={(e) => setMeta({ ...meta, metaDescription: e.target.value })}
                  rows={3}
                  className="w-full px-2.5 py-1.5 rounded-md bg-surface-container-high border border-outline-variant/20 text-sm outline-none focus:border-tertiary focus:ring-1 focus:ring-tertiary resize-none"
                />
              </div>
              <div>
                <label className={label}>Keywords (comma separated)</label>
                <input
                  type="text"
                  value={meta.metaKeywords || ""}
                  onChange={(e) => setMeta({ ...meta, metaKeywords: e.target.value })}
                  className={input}
                />
              </div>
            </div>
          )}

          {activeTab === "analytics" && (
            <div className="p-3 space-y-3">
              <div className="text-[11px] font-medium text-on-surface-variant">Analytics</div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {[
                  ["Enrolled", analytics?.enrolled ?? 0],
                  ["Active (30d)", analytics?.activeStudents30d ?? 0],
                  ["Completion %", `${analytics?.completionRate ?? 0}%`],
                  ["Avg progress", `${analytics?.averageProgress ?? 0}%`],
                ].map(([labelText, value]) => (
                  <div key={String(labelText)} className="p-2.5 rounded-md bg-surface-container-high border border-outline-variant/15">
                    <p className="text-[11px] text-outline">{labelText}</p>
                    <p className="text-lg font-poppins font-semibold text-on-surface mt-0.5 tabular-nums">{value}</p>
                  </div>
                ))}
              </div>
              <p className="text-xs text-outline">Live analytics computed from enrollment and completion records.</p>
            </div>
          )}

          {activeTab === "danger" && (
            <div className="p-3 space-y-3">
              <div className="text-[11px] font-medium text-red-500">Danger zone</div>
              <div className="p-3 border border-red-500/30 rounded-md bg-red-500/5 space-y-2">
                <p className="text-sm text-on-surface">Archive or unpublish while preserving all data.</p>
                <div className="flex gap-1.5">
                  <button
                    onClick={() => setCourse({ ...course, is_published: false })}
                    className="h-8 px-2.5 rounded-md bg-surface-container-high border border-outline-variant/20 text-xs"
                  >
                    Unpublish
                  </button>
                  <button
                    onClick={() => setCourse({ ...course, admin_notes: `${course.admin_notes || ""}\n[ARCHIVED]` })}
                    className="h-8 px-2.5 rounded-md bg-surface-container-high border border-outline-variant/20 text-xs"
                  >
                    Archive
                  </button>
                </div>
              </div>
              <div className="p-3 border border-red-500/30 rounded-md bg-red-500/5 space-y-2">
                <p className="text-sm text-on-surface">Permanent delete requires typing course title.</p>
                <input
                  type="text"
                  value={meta.deleteConfirm || ""}
                  onChange={(e) => setMeta({ ...meta, deleteConfirm: e.target.value })}
                  placeholder={`Type "${course.title}" to confirm`}
                  className={input}
                />
                <button
                  disabled={meta.deleteConfirm !== course.title}
                  onClick={async () => {
                    const res = await fetch(`/api/admin/courses/${course.id}`, { method: "DELETE" });
                    if (!res.ok) return toast.error("Delete failed");
                    toast.success("Course deleted");
                    router.push("/admin/courses");
                  }}
                  className="h-8 px-3 rounded-md bg-red-500 text-white text-xs font-medium disabled:opacity-50"
                >
                  Delete permanently
                </button>
              </div>
            </div>
          )}

          {activeTab === "lessons" && activeLesson ? (
            <div className="flex flex-col h-full">
              <div className="px-3 py-2.5 border-b border-outline-variant/10 bg-surface-container-high/30 space-y-1.5">
                <input
                  type="text"
                  value={activeLesson.title}
                  onChange={(e) => handleUpdateLesson(activeLesson, { title: e.target.value })}
                  className="w-full text-base font-poppins font-semibold text-on-surface bg-transparent border-0 p-0 outline-none placeholder:text-outline-variant/50"
                  placeholder="Lesson title…"
                />
                <div className="flex flex-wrap items-center gap-3 text-[11px] text-outline">
                  <label className="flex items-center gap-1.5">
                    <span>Order</span>
                    <input
                      type="number"
                      value={activeLesson.sequence_order}
                      onChange={(e) =>
                        handleUpdateLesson(activeLesson, { sequence_order: parseInt(e.target.value) || 0 })
                      }
                      className="w-14 h-7 bg-surface-container-high rounded border border-outline-variant/20 px-1.5 text-center text-on-surface focus:border-tertiary outline-none"
                    />
                  </label>
                  <label className="flex items-center gap-1.5">
                    <span>Type</span>
                    <select
                      value={activeLesson.content_type}
                      onChange={(e) => handleUpdateLesson(activeLesson, { content_type: e.target.value })}
                      className="h-7 bg-surface-container-high rounded border border-outline-variant/20 px-1.5 text-on-surface focus:border-tertiary outline-none"
                    >
                      <option value="markdown">Markdown / LaTeX</option>
                      <option value="video">Video URL</option>
                      <option value="pdf">PDF link</option>
                    </select>
                  </label>
                  <label className="flex items-center gap-1.5 text-on-surface">
                    <input
                      type="checkbox"
                      checked={activeLesson.is_published}
                      onChange={(e) => handleUpdateLesson(activeLesson, { is_published: e.target.checked })}
                      className="accent-green-500"
                    />
                    Published
                  </label>
                </div>
              </div>

              <div className="flex-1 p-3 overflow-y-auto">
                {activeLesson.content_type === "markdown" || activeLesson.content_type === "latex" ? (
                  <MarkdownEditor
                    value={activeLesson.content_body || ""}
                    onChange={(val) => handleUpdateLesson(activeLesson, { content_body: val })}
                  />
                ) : (
                  <div className="max-w-xl">
                    <label className={label}>
                      {activeLesson.content_type === "video" ? "Video URL" : "PDF URL"}
                    </label>
                    <div className="relative">
                      {activeLesson.content_type === "video" ? (
                        <Video className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-outline" />
                      ) : (
                        <FileText className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-outline" />
                      )}
                      <input
                        type="url"
                        value={activeLesson.content_body || ""}
                        onChange={(e) => handleUpdateLesson(activeLesson, { content_body: e.target.value })}
                        placeholder="https://…"
                        className="w-full h-9 pl-8 pr-3 rounded-md bg-surface-container-high border border-outline-variant/20 text-sm outline-none focus:border-tertiary focus:ring-1 focus:ring-tertiary"
                      />
                    </div>
                    <p className="text-[11px] text-outline mt-1.5">
                      External URL for this content. Uploads are managed in Media Library.
                    </p>
                  </div>
                )}
              </div>
            </div>
          ) : activeTab === "lessons" ? (
              <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
              <div className="w-10 h-10 rounded-md bg-surface-container-high grid place-items-center mb-2">
                <FileText className="w-5 h-5 text-outline" />
              </div>
              <h3 className="text-sm font-poppins font-medium text-on-surface">No lesson selected</h3>
              <p className="text-xs text-on-surface-variant mt-0.5 max-w-sm">
                Pick a lesson from the curriculum, or add a new one.
              </p>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
