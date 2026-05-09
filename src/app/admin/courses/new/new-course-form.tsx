"use client";

import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";

export function NewCourseForm() {
  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);

  const fieldInput =
    "w-full h-9 px-2.5 rounded-md bg-surface-container-high border border-outline-variant/20 text-sm outline-none focus:border-tertiary focus:ring-1 focus:ring-tertiary transition-colors";

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl md:text-2xl font-poppins font-semibold text-on-surface tracking-tight">
            New course
          </h1>
          <p className="text-sm text-on-surface-variant">
            Create a draft course. You can configure lessons and media in the editor next.
          </p>
        </div>
        <Link
          href="/admin/courses"
          className="h-8 px-2.5 rounded-md text-sm text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high transition-colors flex items-center"
        >
          Back
        </Link>
      </div>

      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setSaving(true);
          try {
            const res = await fetch("/api/admin/courses", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ title, subject, description, is_published: false }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Failed to create course");
            toast.success("Draft created");
            // Hard-navigate instead of router.push — the router.push soft
            // navigation keeps the Next 16 Router Cache entry for
            // /admin/courses warm, so a later sidebar click back to the
            // list would still show yesterday's data even though the POST
            // called revalidatePath. window.location guarantees a fresh
            // request on the next load (bug reported: "Courses say course
            // added but never show up").
            window.location.href = `/admin/courses/${data.id}`;
          } catch (err: any) {
            toast.error(err.message);
          } finally {
            setSaving(false);
          }
        }}
        className="surface-card p-3 space-y-3 max-w-xl"
      >
        <div>
          <label className="text-[11px] font-medium text-on-surface-variant block mb-1">Title</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            className={fieldInput}
          />
        </div>
        <div>
          <label className="text-[11px] font-medium text-on-surface-variant block mb-1">Subject / category</label>
          <input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            required
            className={fieldInput}
          />
        </div>
        <div>
          <label className="text-[11px] font-medium text-on-surface-variant block mb-1">Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            className="w-full px-2.5 py-1.5 rounded-md bg-surface-container-high border border-outline-variant/20 text-sm outline-none focus:border-tertiary focus:ring-1 focus:ring-tertiary resize-none"
          />
        </div>
        <div className="flex justify-end">
          <button
            disabled={saving}
            type="submit"
            className="h-9 px-4 rounded-md bg-tertiary text-white text-sm font-poppins font-medium hover:bg-tertiary/90 transition-colors disabled:opacity-60"
          >
            {saving ? "Creating…" : "Create draft"}
          </button>
        </div>
      </form>
    </div>
  );
}
