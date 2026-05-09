"use client";
import { useState, useCallback, useMemo } from "react";
import { toast } from "sonner";
import {
  Plus, Trash2, Loader2, BookOpen, PenTool, GraduationCap,
  ChevronDown, Coins, Tag,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

type Price = {
  id: string;
  content_type: string;
  content_id: string;
  credit_cost: number;
  is_free: boolean;
  updated_at: string;
};

type Lesson = {
  id: string;
  title: string;
  course_id: string;
  sequence_order: number;
  courses: { title: string; subject: string } | null;
};

type Test = {
  id: string;
  name: string;
  subject: string | null;
  is_mock?: boolean;
};

type Course = {
  id: string;
  title: string;
  subject: string | null;
};

const TYPE_META: Record<
  string,
  { label: string; Icon: React.ElementType; color: string; bg: string }
> = {
  lesson: { label: "Lesson", Icon: BookOpen, color: "text-blue-600", bg: "bg-blue-500/10" },
  test: { label: "Test", Icon: PenTool, color: "text-amber-600", bg: "bg-amber-500/10" },
  course: { label: "Course", Icon: GraduationCap, color: "text-green-600", bg: "bg-green-500/10" },
};

export function PricesClient({
  initialPrices,
  lessons,
  tests,
  courses,
}: {
  initialPrices: Price[];
  lessons: Lesson[];
  tests: Test[];
  courses: Course[];
}) {
  const [prices, setPrices] = useState(initialPrices);
  const [form, setForm] = useState({
    contentType: "lesson",
    contentId: "",
    creditCost: "",
    isFree: false,
  });
  const [adding, setAdding] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [activeTab, setActiveTab] = useState<"lesson" | "test" | "course">("lesson");

  // Grouped content options for the dropdown in the form
  const lessonsByCourseName = lessons.reduce<Record<string, Lesson[]>>(
    (acc, l) => {
      const key = l.courses?.title ?? "Uncategorized";
      if (!acc[key]) acc[key] = [];
      acc[key].push(l);
      return acc;
    },
    {}
  );

  const testsBySubject = tests.reduce<Record<string, Test[]>>((acc, t) => {
    const key = t.subject ?? "General";
    if (!acc[key]) acc[key] = [];
    acc[key].push(t);
    return acc;
  }, {});

  const coursesBySubject = courses.reduce<Record<string, Course[]>>((acc, c) => {
    const key = c.subject ?? "General";
    if (!acc[key]) acc[key] = [];
    acc[key].push(c);
    return acc;
  }, {});

  // Mutual exclusion check:
  // If admin is trying to set a lesson price, check if parent course already has a price.
  // If setting a course price, check if any lesson in that course already has a price.
  const pricesByContentId = useMemo(
    () => new Map(prices.map((p) => [`${p.content_type}:${p.content_id}`, p])),
    [prices]
  );

  const mutualExclusionWarning = useMemo((): string | null => {
    if (form.contentType === "lesson" && form.contentId) {
      const lesson = lessons.find((l) => l.id === form.contentId);
      const courseId = (lesson as any)?.course_id ?? null;
      if (courseId && pricesByContentId.has(`course:${courseId}`)) {
        const c = courses.find((c) => c.id === courseId);
        return `"${c?.title ?? "This course"}" already has a course-level price. Lesson prices are ignored when a course price is active.`;
      }
    }
    if (form.contentType === "course" && form.contentId) {
      const courseLessons = lessons.filter((l) => (l as any).course_id === form.contentId);
      const conflicting = courseLessons.filter((l) => pricesByContentId.has(`lesson:${l.id}`));
      if (conflicting.length > 0) {
        return `${conflicting.length} lesson${conflicting.length > 1 ? "s" : ""} in this course already have individual prices. Those will be superseded by the course-level price.`;
      }
    }
    return null;
  }, [form.contentType, form.contentId, pricesByContentId, lessons, courses]);

  // Resolve display label for a price row
  const getLabel = (p: Price): { primary: string; secondary: string } => {
    if (p.content_type === "lesson") {
      const l = lessons.find((i) => i.id === p.content_id);
      return {
        primary: l?.title ?? p.content_id.slice(0, 8),
        secondary: l?.courses?.title
          ? `${l.courses.subject ?? ""} › ${l.courses.title}`
          : "Unknown course",
      };
    }
    if (p.content_type === "test") {
      const t = tests.find((i) => i.id === p.content_id);
      return {
        primary: t?.name ?? p.content_id.slice(0, 8),
        secondary: [t?.subject, t?.is_mock ? "Mock" : null]
          .filter(Boolean)
          .join(" · "),
      };
    }
    const c = courses.find((i) => i.id === p.content_id);
    return {
      primary: c?.title ?? p.content_id.slice(0, 8),
      secondary: c?.subject ?? "",
    };
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.contentId) { toast.error("Select a content item"); return; }
    setAdding(true);
    try {
      const res = await fetch("/api/admin/content-prices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contentType: form.contentType,
          contentId: form.contentId,
          creditCost: parseInt(form.creditCost, 10) || 0,
          isFree: form.isFree,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setPrices((prev) => [data, ...prev.filter((p) => p.id !== data.id)]);
      toast.success("Price saved");
      setShowForm(false);
      setForm({ contentType: "lesson", contentId: "", creditCost: "", isFree: false });
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setAdding(false);
    }
  };

  const handleDelete = useCallback(async (id: string) => {
    const toastId = toast.loading("Deleting…");
    try {
      const res = await fetch(`/api/admin/content-prices/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error((await res.json()).error);
      setPrices((prev) => prev.filter((p) => p.id !== id));
      toast.success("Price removed", { id: toastId });
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Unknown error", { id: toastId });
    }
  }, []);

  const handleToggleFree = useCallback(async (price: Price) => {
    const newFree = !price.is_free;
    setPrices((prev) => prev.map((p) => (p.id === price.id ? { ...p, is_free: newFree } : p)));
    const res = await fetch(`/api/admin/content-prices/${price.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_free: newFree }),
    });
    if (!res.ok) {
      setPrices((prev) => prev.map((p) => (p.id === price.id ? { ...p, is_free: price.is_free } : p)));
      toast.error("Update failed");
    } else {
      toast.success(newFree ? "Marked free" : "Marked paid");
    }
  }, []);

  const handleCostUpdate = useCallback(async (price: Price, newCost: number) => {
    if (isNaN(newCost) || newCost < 0) return;
    setPrices((prev) => prev.map((p) => (p.id === price.id ? { ...p, credit_cost: newCost } : p)));
    const res = await fetch(`/api/admin/content-prices/${price.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ credit_cost: newCost }),
    });
    if (!res.ok) {
      setPrices((prev) => prev.map((p) => (p.id === price.id ? { ...p, credit_cost: price.credit_cost } : p)));
      toast.error("Update failed");
    } else {
      toast.success("Cost updated");
    }
  }, []);

  // Group prices by content type for tab display
  const byType = {
    lesson: prices.filter((p) => p.content_type === "lesson"),
    test: prices.filter((p) => p.content_type === "test"),
    course: prices.filter((p) => p.content_type === "course"),
  };

  const tabs = (["lesson", "test", "course"] as const).map((t) => ({
    id: t,
    ...TYPE_META[t],
    count: byType[t].length,
  }));

  return (
    <div className="space-y-4">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <div className="flex gap-1 p-1 rounded-lg bg-surface-container-high/60">
          {tabs.map(({ id, label, Icon, color, bg, count }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={cn(
                "flex items-center gap-1.5 h-8 px-3 rounded-md text-xs font-medium transition-colors",
                activeTab === id
                  ? "bg-surface text-on-surface shadow-sm"
                  : "text-on-surface-variant hover:text-on-surface"
              )}
            >
              <Icon className={cn("w-3.5 h-3.5", activeTab === id ? color : "")} />
              {label}
              {count > 0 && (
                <span
                  className={cn(
                    "h-4 min-w-4 px-1 rounded-full text-[10px] font-poppins font-semibold",
                    activeTab === id ? cn(bg, color) : "bg-outline/10 text-outline"
                  )}
                >
                  {count}
                </span>
              )}
            </button>
          ))}
        </div>
        <button
          onClick={() => { setShowForm((v) => !v); setForm((f) => ({ ...f, contentType: activeTab })); }}
          className="h-9 px-3 rounded-md bg-tertiary text-white text-sm font-medium inline-flex items-center gap-1.5 hover:bg-tertiary/90"
        >
          <Plus className="w-4 h-4" />
          Set price
        </button>
      </div>

      {/* Add form */}
      {showForm && (
        <form onSubmit={handleAdd} className="surface-card p-4 space-y-4 border border-tertiary/20">
          <h3 className="text-sm font-poppins font-semibold text-on-surface flex items-center gap-2">
            <Tag className="w-4 h-4 text-tertiary" />
            Set credit price
          </h3>

          {/* Mutual exclusion warning */}
          {mutualExclusionWarning && (
            <div className="flex items-start gap-2 px-3 py-2.5 rounded-md bg-amber-500/10 border border-amber-500/20 text-xs text-amber-700">
              <span className="shrink-0 mt-0.5">⚠</span>
              <span>{mutualExclusionWarning}</span>
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Type */}
            <div>
              <label className="text-[11px] text-outline mb-1 block font-medium">Content type</label>
              <div className="flex gap-1">
                {(["lesson", "test", "course"] as const).map((t) => {
                  const m = TYPE_META[t];
                  return (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setForm({ ...form, contentType: t, contentId: "" })}
                      className={cn(
                        "flex-1 h-9 rounded-md text-xs font-medium flex items-center justify-center gap-1 transition-colors",
                        form.contentType === t
                          ? cn(m.bg, m.color, "ring-1 ring-current")
                          : "bg-surface-container-high text-on-surface-variant hover:text-on-surface"
                      )}
                    >
                      <m.Icon className="w-3.5 h-3.5" />
                      {m.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Content item - grouped select */}
            <div>
              <label className="text-[11px] text-outline mb-1 block font-medium">Item</label>
              <div className="relative">
                <select
                  required
                  value={form.contentId}
                  onChange={(e) => setForm({ ...form, contentId: e.target.value })}
                  className="w-full pl-3 pr-8 h-9 rounded-md bg-surface-container-high border border-outline-variant/20 text-sm outline-none appearance-none"
                >
                  <option value="">Select item…</option>
                  {form.contentType === "lesson" &&
                    Object.entries(lessonsByCourseName).map(([courseName, cls]) => (
                      <optgroup key={courseName} label={courseName}>
                        {cls.map((l) => (
                          <option key={l.id} value={l.id}>
                            #{l.sequence_order} {l.title}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  {form.contentType === "test" &&
                    Object.entries(testsBySubject).map(([subject, ts]) => (
                      <optgroup key={subject} label={subject}>
                        {ts.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.name}{t.is_mock ? " [Mock]" : ""}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  {form.contentType === "course" &&
                    Object.entries(coursesBySubject).map(([subject, cs]) => (
                      <optgroup key={subject} label={subject}>
                        {cs.map((c) => (
                          <option key={c.id} value={c.id}>{c.title}</option>
                        ))}
                      </optgroup>
                    ))}
                </select>
                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-outline pointer-events-none" />
              </div>
            </div>

            {/* Credits */}
            <div>
              <label className="text-[11px] text-outline mb-1 block font-medium">
                Credit cost <span className="text-outline/60">(0 = free)</span>
              </label>
              <div className="relative">
                <Coins className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-outline" />
                <input
                  type="number"
                  min="0"
                  value={form.creditCost}
                  onChange={(e) => setForm({ ...form, creditCost: e.target.value })}
                  placeholder="e.g. 50"
                  className="w-full pl-8 pr-3 h-9 rounded-md bg-surface-container-high border border-outline-variant/20 text-sm outline-none [appearance:textfield]"
                />
              </div>
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm text-on-surface cursor-pointer select-none">
            <input
              type="checkbox"
              checked={form.isFree}
              onChange={(e) => setForm({ ...form, isFree: e.target.checked })}
              className="rounded"
            />
            <span>Always free — override any credit cost</span>
          </label>

          <div className="flex gap-2 justify-end">
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="h-9 px-3 rounded-md text-sm text-on-surface-variant hover:bg-surface-container-high"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={adding}
              className="h-9 px-4 rounded-md bg-tertiary text-white text-sm font-medium inline-flex items-center gap-1.5 disabled:opacity-50"
            >
              {adding && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Save price
            </button>
          </div>
        </form>
      )}

      {/* Prices table for active tab */}
      <div className="surface-card overflow-hidden">
        {byType[activeTab].length === 0 ? (
          <div className="py-12 flex flex-col items-center gap-3 text-center">
            {(() => { const m = TYPE_META[activeTab]; return <m.Icon className={cn("w-8 h-8", m.color, "opacity-30")} />; })()}
            <p className="text-sm text-outline">
              No {TYPE_META[activeTab].label.toLowerCase()} prices set yet.
            </p>
            <button
              onClick={() => { setShowForm(true); setForm((f) => ({ ...f, contentType: activeTab })); }}
              className="text-xs text-tertiary font-medium hover:underline"
            >
              + Add one
            </button>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-surface-container-high/60 text-[11px] text-outline">
              <tr>
                <th className="px-4 py-2.5 text-left font-medium">Item</th>
                {activeTab === "lesson" && (
                  <th className="px-4 py-2.5 text-left font-medium hidden sm:table-cell">Course</th>
                )}
                {activeTab === "test" && (
                  <th className="px-4 py-2.5 text-left font-medium hidden sm:table-cell">Subject</th>
                )}
                {activeTab === "course" && (
                  <th className="px-4 py-2.5 text-left font-medium hidden sm:table-cell">Subject</th>
                )}
                <th className="px-4 py-2.5 text-left font-medium">Credits</th>
                <th className="px-4 py-2.5 text-left font-medium">Status</th>
                <th className="px-4 py-2.5 text-right font-medium hidden sm:table-cell">Updated</th>
                <th className="px-4 py-2.5 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/10">
              {byType[activeTab].map((p) => {
                const { primary, secondary } = getLabel(p);
                return (
                  <tr key={p.id} className="hover:bg-surface-container-high/30 transition-colors">
                    <td className="px-4 py-2.5">
                      <p className="font-medium text-on-surface text-sm leading-tight">{primary}</p>
                      {secondary && (
                        <p className="text-[11px] text-outline mt-0.5">{secondary}</p>
                      )}
                    </td>
                    {(activeTab === "lesson" || activeTab === "test" || activeTab === "course") && (
                      <td className="px-4 py-2.5 text-xs text-on-surface-variant hidden sm:table-cell">
                        {secondary || "—"}
                      </td>
                    )}
                    {/* Inline editable cost */}
                    <td className="px-4 py-2.5">
                      <div className="relative w-24">
                        <Coins className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-tertiary" />
                        <input
                          type="number"
                          min="0"
                          defaultValue={p.credit_cost}
                          onBlur={(e) => handleCostUpdate(p, parseInt(e.target.value, 10))}
                          className="w-full pl-6 pr-2 h-7 rounded-md bg-surface-container-high border border-outline-variant/20 text-sm font-poppins font-semibold text-tertiary outline-none focus:border-tertiary/50 [appearance:textfield]"
                        />
                      </div>
                    </td>
                    <td className="px-4 py-2.5">
                      <button
                        onClick={() => handleToggleFree(p)}
                        className={cn(
                          "h-5 px-2 rounded-md text-[10px] font-medium transition-colors",
                          p.is_free
                            ? "bg-green-500/10 text-green-600 hover:bg-green-500/20"
                            : "bg-red-500/10 text-red-600 hover:bg-red-500/20"
                        )}
                      >
                        {p.is_free ? "Free" : "Paid"}
                      </button>
                    </td>
                    <td className="px-4 py-2.5 text-[11px] text-outline hidden sm:table-cell text-right">
                      {format(new Date(p.updated_at), "MMM d, yyyy")}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <button
                        onClick={() => handleDelete(p.id)}
                        className="h-7 w-7 inline-flex items-center justify-center rounded-md text-red-500/60 hover:text-red-500 hover:bg-red-500/10 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
