"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  TestConfigSchema,
  type TestConfigInput,
  type TestSection,
} from "@/lib/schemas";
import { Search, X, BookOpen, Layers, Plus, Image as ImageIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { QuickQuestionDialog } from "./QuickQuestionDialog";
import { MarkdownRenderer } from "@/components/ui/MarkdownRenderer";

type Question = {
  id: string;
  text: string;
  subject: string;
  difficulty?: string;
  topic?: string;
  status?: "draft" | "review" | "approved" | "retired";
  image_url?: string | null;
};

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-slate-500/10 text-slate-600",
  review: "bg-amber-500/10 text-amber-600",
  approved: "bg-green-500/10 text-green-600",
};

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: "", label: "All statuses" },
  { value: "approved", label: "Approved only" },
  { value: "review", label: "In review" },
  { value: "draft", label: "Draft" },
];

type Props = {
  initial?: Partial<TestConfigInput> & { id?: string };
};

const SUBJECTS = ["Physics", "Chemistry", "Math", "English", "Biology"];

const DIFFICULTY_COLORS: Record<string, string> = {
  easy: "bg-green-500/10 text-green-600",
  medium: "bg-amber-500/10 text-amber-600",
  hard: "bg-red-500/10 text-red-500",
};

export function TestBuilderForm({ initial }: Props) {
  const router = useRouter();
  const isEdit = !!initial?.id;

  // Supabase returns `null` for any unset nullable column (e.g. an
  // existing test with no access_password / description / instructions).
  // Zod's `.optional()` does NOT accept `null`, so spreading the raw row
  // straight into form state lands us with `form.access_password === null`
  // and a silent validation failure on Save ("Please fix validation
  // errors" toast with no visible per-field hint). We normalise those
  // nulls to `undefined` here so the default-driven useState seed below
  // stays the single source of truth.
  const normalisedInitial = initial
    ? (Object.fromEntries(
        Object.entries(initial).filter(([, v]) => v !== null)
      ) as Partial<TestConfigInput>)
    : undefined;

  const [form, setForm] = useState<Partial<TestConfigInput>>({
    subject: "Physics",
    time_limit: 30,
    negative_marking: 0,
    shuffle_questions: false,
    shuffle_options: false,
    max_attempts: undefined,
    pass_percentage: 50,
    is_published: false,
    is_mock: false,
    show_results: true,
    show_explanations: true,
    question_ids: [],
    is_full_length: false,
    sections: [],
    ...normalisedInitial,
  });

  // When the admin browses the bank we also cache questions that are
  // already selected but not present in the visible page — so we can
  // group them by subject for the section preview without re-fetching.
  const [selectedMeta, setSelectedMeta] = useState<Record<string, Question>>({});
  const [errs, setErrs] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const [pickerSubject, setPickerSubject] = useState(form.subject ?? "");
  const [pickerStatus, setPickerStatus] = useState<string>("");
  const [bankQuestions, setBankQuestions] = useState<Question[]>([]);
  const [loadingBank, setLoadingBank] = useState(false);
  const [isQuickCreateOpen, setIsQuickCreateOpen] = useState(false);
  
  // Pagination & Search
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [searchInput, setSearchInput] = useState("");
  const [pickerSearch, setPickerSearch] = useState("");

  function setField<K extends keyof TestConfigInput>(key: K, val: TestConfigInput[K]) {
    setForm((f) => ({ ...f, [key]: val }));
    setErrs((e) => {
      const n = { ...e };
      delete n[key];
      return n;
    });
  }

  const fetchBank = useCallback(async () => {
    setLoadingBank(true);
    // When `is_full_length` is on the picker shows questions across
    // subjects (so the admin can assemble a multi-subject test). The
    // per-question `subject` badge still makes origin clear.
    const subjectQuery = (form.is_full_length || !pickerSubject) ? "" : `subject=${pickerSubject}&`;
    const statusQuery = pickerStatus ? `status=${pickerStatus}&` : "";
    const apiRes = await fetch(
      `/api/admin/questions/search?${subjectQuery}${statusQuery}page=${page}&q=${encodeURIComponent(pickerSearch)}`
    );
    if (apiRes.ok) {
      const data = await apiRes.json();
      const list: Question[] = data.questions ?? [];
      setBankQuestions(list);
      setTotalPages(data.totalPages ?? 1);
      setTotalCount(data.count ?? 0);
      // Remember metadata for every question we've ever seen so the
      // section preview (which needs per-question `subject`) still works
      // after the search filter changes.
      setSelectedMeta((m) => {
        const next = { ...m };
        for (const q of list) next[q.id] = q;
        return next;
      });
    }
    setLoadingBank(false);
  }, [pickerSubject, pickerSearch, pickerStatus, form.is_full_length, page]);

  const handleSearch = () => {
    setPickerSearch(searchInput);
    setPage(1); // Reset to page 1 on new search
  };

  const handleQuickQuestionSuccess = async (id: string) => {
    setIsQuickCreateOpen(false);
    // Add to selection
    const current = form.question_ids ?? [];
    if (!current.includes(id)) {
      setField("question_ids", [...current, id]);
    }
    // Refresh bank to show the new question
    await fetchBank();
    toast.success("Question created and added to test");
  };

  useEffect(() => {
    setPage(1);
  }, [pickerSubject, pickerStatus]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchBank();
  }, [fetchBank]);

  function toggleQuestion(id: string) {
    const current = form.question_ids ?? [];
    if (current.includes(id)) {
      setField(
        "question_ids",
        current.filter((q) => q !== id)
      );
    } else {
      setField("question_ids", [...current, id]);
    }
  }

  const selectedIds = new Set(form.question_ids ?? []);

  /**
   * Auto-derived sections for full-length tests. Groups the currently
   * selected questions by their subject, preserving the order they were
   * added in. The admin can't manually edit section contents — instead
   * they curate the single selection set and we keep sections in lock-
   * step. This keeps the schema/API simple (sections are always a view
   * of `question_ids`) while still giving the student session useful
   * Next Section / Prev Section targets.
   */
  const derivedSections: TestSection[] = useMemo(() => {
    if (!form.is_full_length) return [];
    const ids = form.question_ids ?? [];
    if (ids.length === 0) return [];

    const bySubject = new Map<string, string[]>();
    for (const id of ids) {
      const subj = selectedMeta[id]?.subject ?? "Uncategorised";
      const bucket = bySubject.get(subj) ?? [];
      bucket.push(id);
      bySubject.set(subj, bucket);
    }
    return Array.from(bySubject.entries()).map(([subject, question_ids]) => ({
      subject,
      name: subject,
      question_ids,
    }));
  }, [form.is_full_length, form.question_ids, selectedMeta]);

  // Keep `form.sections` in sync with the derived view so the final
  // payload is always consistent — the sticky `form.sections` handles
  // the rare case where the admin disables `is_full_length` (sections
  // clear automatically).
  useEffect(() => {
    setForm((f) =>
      f.is_full_length
        ? { ...f, sections: derivedSections }
        : f.sections && f.sections.length > 0
        ? { ...f, sections: [] }
        : f
    );
  }, [derivedSections, form.is_full_length]);

  async function handleSave() {
    setSaving(true);
    const result = TestConfigSchema.safeParse(form);
    if (!result.success) {
      const flat = result.error.flatten().fieldErrors;
      const flatMap = Object.fromEntries(
        Object.entries(flat).map(([k, v]) => [k, v?.[0] ?? ""])
      );
      setErrs(flatMap);
      setSaving(false);
      // Include the failing field names in the toast so admins can spot
      // the culprit even when the input itself is collapsed under a
      // scroll or sits in a card the user has to scroll to find.
      const bad = Object.keys(flatMap).join(", ");
      toast.error("Please fix validation errors.", {
        description: bad ? `Fields: ${bad}` : undefined,
      });
      return;
    }

    const url = isEdit ? `/api/admin/tests/${initial!.id}` : "/api/admin/tests";
    const method = isEdit ? "PUT" : "POST";

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(result.data),
    });
    const data = await res.json();
    setSaving(false);

    if (!res.ok) {
      toast.error("Save failed", { description: data.error });
      return;
    }

    toast.success(isEdit ? "Test updated" : "Test created");
    router.push("/admin/tests");
    router.refresh();
  }

  const fieldLabel = "text-[11px] font-medium text-on-surface-variant block mb-1";
  const fieldInput =
    "w-full h-9 px-2.5 rounded-md bg-surface-container-high border border-outline-variant/20 text-sm outline-none focus:border-tertiary focus:ring-1 focus:ring-tertiary transition-colors";
  const fieldInputErr = "!border-red-500 focus:!ring-red-500";

  return (
    <div className="pb-20 space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl md:text-2xl font-poppins font-semibold text-on-surface tracking-tight">
            {isEdit ? "Edit test" : "New test"}
          </h1>
          <p className="text-sm text-on-surface-variant">
            Configure settings and pick questions from the bank.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_1fr] gap-3">
        {/* Settings — grouped cards */}
        <div className="space-y-3">
          {/* Basics */}
          <div className="surface-card p-3 space-y-3">
            <div className="text-[11px] font-medium text-on-surface-variant">Basics</div>
            <div>
              <label className={fieldLabel}>Name *</label>
              <input
                type="text"
                value={form.name ?? ""}
                onChange={(e) => setField("name", e.target.value)}
                placeholder="Physics Mock Test 1"
                className={cn(fieldInput, errs.name && fieldInputErr)}
              />
              {errs.name && <p className="text-red-500 text-[11px] mt-1">{errs.name}</p>}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className={fieldLabel}>Subject *</label>
                <select
                  value={form.subject ?? "Physics"}
                  onChange={(e) => {
                    setField("subject", e.target.value);
                    setPickerSubject(e.target.value);
                  }}
                  className={fieldInput}
                >
                  {SUBJECTS.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={fieldLabel}>Access password</label>
                <input
                  type="text"
                  value={form.access_password ?? ""}
                  onChange={(e) => setField("access_password", e.target.value || null)}
                  placeholder="Leave empty for free access"
                  className={cn(fieldInput, errs.access_password && fieldInputErr)}
                />
                {errs.access_password ? (
                  <p className="text-red-500 text-[11px] mt-1">{errs.access_password}</p>
                ) : (
                  <p className="text-outline text-[10px] mt-1">
                    Students will be prompted once per day when set.
                  </p>
                )}
              </div>
            </div>
            <div>
              <label className={fieldLabel}>Description</label>
              <textarea
                value={form.description ?? ""}
                onChange={(e) => setField("description", e.target.value || null)}
                rows={2}
                className="w-full px-2.5 py-1.5 rounded-md bg-surface-container-high border border-outline-variant/20 text-sm outline-none focus:border-tertiary focus:ring-1 focus:ring-tertiary resize-none"
              />
            </div>
            <div>
              <label className={fieldLabel}>Instructions (shown before exam)</label>
              <textarea
                value={form.instructions ?? ""}
                onChange={(e) => setField("instructions", e.target.value || null)}
                rows={2}
                className="w-full px-2.5 py-1.5 rounded-md bg-surface-container-high border border-outline-variant/20 text-sm outline-none focus:border-tertiary focus:ring-1 focus:ring-tertiary resize-none"
              />
            </div>
          </div>

          {/* Scoring */}
          <div className="surface-card p-3 space-y-3">
            <div className="text-[11px] font-medium text-on-surface-variant">Scoring & timing</div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className={fieldLabel}>Time limit (min) *</label>
                <input
                  type="number"
                  min={1}
                  max={360}
                  value={form.time_limit ?? 30}
                  onChange={(e) => { const v = parseInt(e.target.value); if (!isNaN(v)) setField("time_limit", v); }}
                  className={fieldInput}
                />
                {errs.time_limit && <p className="text-red-500 text-[11px] mt-1">{errs.time_limit}</p>}
              </div>
              <div>
                <label className={fieldLabel}>Pass % *</label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={form.pass_percentage ?? 50}
                  onChange={(e) => { const v = parseFloat(e.target.value); if (!isNaN(v)) setField("pass_percentage", v); }}
                  className={fieldInput}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className={fieldLabel}>Negative marking</label>
                <input
                  type="number"
                  min={0}
                  max={2}
                  step={0.25}
                  value={form.negative_marking ?? 0}
                  onChange={(e) => setField("negative_marking", parseFloat(e.target.value) || 0)}
                  className={fieldInput}
                />
              </div>
              <div>
                <label className={fieldLabel}>Max attempts</label>
                <input
                  type="number"
                  min={1}
                  max={100}
                  value={form.max_attempts ?? ""}
                  onChange={(e) => {
                    const v = e.target.value === "" ? null : parseInt(e.target.value);
                    setField("max_attempts", v);
                  }}
                  placeholder="No limit"
                  className={fieldInput}
                />
              </div>
            </div>
          </div>

          {/* Options */}
          <div className="surface-card p-3 space-y-1.5">
            <div className="text-[11px] font-medium text-on-surface-variant mb-1">Options</div>
            {(
              [
                ["is_full_length", "Full-length test (multi-subject, section navigation)"],
                ["shuffle_questions", "Shuffle questions"],
                ["shuffle_options", "Shuffle answer options"],
                ["show_results", "Show results after submission"],
                ["show_explanations", "Show explanations after submission"],
                ["is_mock", "Mark as mock / practice test"],
                ["is_published", "Publish (visible to candidates)"],
              ] as [keyof TestConfigInput, string][]
            ).map(([key, label]) => (
              <label
                key={key}
                className="flex items-center gap-2.5 h-8 px-1 rounded cursor-pointer hover:bg-surface-container-high transition-colors"
              >
                <button
                  type="button"
                  onClick={() => setField(key, !form[key])}
                  className={cn(
                    "w-8 h-4 rounded-full transition-colors relative shrink-0",
                    form[key] ? "bg-tertiary" : "bg-surface-container-highest"
                  )}
                >
                  <div
                    className={cn(
                      "absolute top-0.5 w-3 h-3 rounded-full bg-white shadow transition-transform",
                      form[key] ? "translate-x-4" : "translate-x-0.5"
                    )}
                  />
                </button>
                <span className="text-sm text-on-surface">{label}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Question picker */}
        <div className="space-y-3">
          <div className="surface-card p-3 space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="text-[11px] font-medium text-on-surface-variant">Question bank</div>
              <span className="inline-flex items-center h-5 px-2 rounded text-[10px] font-medium bg-tertiary/10 text-tertiary">
                {selectedIds.size} selected
              </span>
            </div>

            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-outline" />
                <input
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                  placeholder={
                    form.is_full_length
                      ? "Search across all subjects…"
                      : "Search…"
                  }
                  className="w-full h-8 pl-8 pr-2.5 rounded-md bg-surface-container-high border border-outline-variant/20 text-xs outline-none focus:border-tertiary"
                />
              </div>
              <button
                type="button"
                onClick={handleSearch}
                className="shrink-0 h-8 px-3 rounded-md bg-surface-container-high border border-outline-variant/20 text-[11px] font-medium hover:bg-surface-container-highest transition-colors"
              >
                Search
              </button>
              <button
                type="button"
                onClick={() => setIsQuickCreateOpen(true)}
                className="shrink-0 h-8 px-3 rounded-md bg-tertiary/10 text-tertiary border border-tertiary/20 text-[11px] font-poppins font-medium hover:bg-tertiary/20 transition-colors flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                Add New
              </button>
              {/* Subject filter only makes sense for single-subject tests —
                  for full-length we browse the whole bank. */}
              {!form.is_full_length && (
                <select
                  value={pickerSubject}
                  onChange={(e) => setPickerSubject(e.target.value)}
                  className="h-8 px-2 rounded-md bg-surface-container-high border border-outline-variant/20 text-xs outline-none focus:border-tertiary"
                >
                  <option value="">All Subjects</option>
                  {SUBJECTS.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              )}
              {/* Status filter — defaults to every non-retired row so
                  draft imports are visible by default. */}
              <select
                value={pickerStatus}
                onChange={(e) => setPickerStatus(e.target.value)}
                className="h-8 px-2 rounded-md bg-surface-container-high border border-outline-variant/20 text-xs outline-none focus:border-tertiary"
                title="Filter by review status"
              >
                {STATUS_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-1 py-1 border-y border-outline-variant/10">
                <span className="text-[10px] text-outline tabular-nums">
                  Page {page} / {totalPages} ({totalCount} total)
                </span>
                <div className="flex gap-1">
                  <button
                    type="button"
                    disabled={page <= 1 || loadingBank}
                    onClick={() => setPage(p => p - 1)}
                    className="h-6 px-2 rounded bg-surface-container-high text-[10px] font-medium hover:bg-surface-container-highest disabled:opacity-40 transition-colors"
                  >
                    Prev
                  </button>
                  <button
                    type="button"
                    disabled={page >= totalPages || loadingBank}
                    onClick={() => setPage(p => p + 1)}
                    className="h-6 px-2 rounded bg-surface-container-high text-[10px] font-medium hover:bg-surface-container-highest disabled:opacity-40 transition-colors"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}

            {errs.question_ids && (
              <p className="text-red-500 text-[11px]">{errs.question_ids}</p>
            )}

            <div className="space-y-1 max-h-[420px] overflow-y-auto custom-scrollbar pr-0.5">
              {loadingBank ? (
                <div className="py-6 text-center text-xs text-outline">Loading bank…</div>
              ) : bankQuestions.length === 0 ? (
                <div className="py-6 text-center text-xs text-outline">
                  <BookOpen className="w-5 h-5 mx-auto mb-1.5 opacity-40" />
                  No questions match these filters.
                </div>
              ) : (
                bankQuestions.map((q) => {
                  const selected = selectedIds.has(q.id);
                  return (
                    <button
                      key={q.id}
                      type="button"
                      onClick={() => toggleQuestion(q.id)}
                      className={cn(
                        "w-full text-left p-2 rounded-md border transition-colors",
                        selected
                          ? "border-tertiary/50 bg-tertiary/5"
                          : "border-outline-variant/15 hover:border-outline-variant/30 bg-surface-container-high/50"
                      )}
                    >
                      <div className="flex items-start gap-2">
                        <div
                          className={cn(
                            "shrink-0 mt-0.5 w-4 h-4 rounded border-2 flex items-center justify-center transition-colors",
                            selected ? "border-tertiary bg-tertiary" : "border-outline-variant/40"
                          )}
                        >
                          {selected && (
                            <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-xs text-on-surface prose prose-sm max-w-none dark:prose-invert line-clamp-2">
                            <MarkdownRenderer content={q.text} />
                          </div>
                          <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                            {form.is_full_length && q.subject && (
                              <span className="text-[10px] px-1.5 h-4 inline-flex items-center rounded font-medium bg-tertiary/10 text-tertiary">
                                {q.subject}
                              </span>
                            )}
                            {/* Options Preview */}
                            <div className="mt-1.5 flex flex-wrap gap-1.5">
                              {(["a", "b", "c", "d"] as const).map(l => (
                                <div key={l} className="flex items-center gap-1 bg-surface-container-highest/30 px-1 py-0.5 rounded text-[9px] border border-outline-variant/10">
                                  <span className="font-bold text-outline uppercase">{l}.</span>
                                  <div className="text-on-surface-variant prose prose-sm max-w-none dark:prose-invert line-clamp-1">
                                    <MarkdownRenderer content={(q as any)[`option_${l}`] || ""} />
                                  </div>
                                </div>
                              ))}
                            </div>
                            {q.status && q.status !== "approved" && (
                              <span
                                className={cn(
                                  "text-[10px] px-1.5 h-4 inline-flex items-center rounded font-medium capitalize",
                                  STATUS_COLORS[q.status] ?? "bg-outline/10 text-outline"
                                )}
                                title="Review status"
                              >
                                {q.status}
                              </span>
                            )}
                            {q.difficulty && (
                              <span
                                className={cn(
                                  "text-[10px] px-1.5 h-4 inline-flex items-center rounded font-medium capitalize",
                                  DIFFICULTY_COLORS[q.difficulty] ?? "bg-outline/10 text-outline"
                                )}
                              >
                                {q.difficulty}
                              </span>
                            )}
                            {q.image_url && (
                              <span className="text-[10px] px-1.5 h-4 inline-flex items-center gap-1 rounded font-medium bg-blue-500/10 text-blue-600">
                                <ImageIcon className="w-2.5 h-2.5" />
                                Illustration
                              </span>
                            )}
                            {q.topic && <span className="text-[10px] text-outline">{q.topic}</span>}
                          </div>
                        </div>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {selectedIds.size > 0 && (
            <div className="surface-card p-3">
              <div className="text-[11px] font-medium text-on-surface-variant mb-1.5">
                Selected ({selectedIds.size})
              </div>
              <div className="flex flex-wrap gap-1">
                {Array.from(selectedIds).map((id) => {
                  const q =
                    bankQuestions.find((bq) => bq.id === id) ??
                    selectedMeta[id];
                  return (
                    <span
                      key={id}
                      className="inline-flex items-center gap-1 text-[10px] bg-tertiary/10 text-tertiary px-1.5 h-5 rounded"
                    >
                      <span className="truncate max-w-[140px]">
                        {q?.text?.slice(0, 24) ?? id.slice(0, 8)}…
                      </span>
                      <button
                        type="button"
                        onClick={() => toggleQuestion(id)}
                        className="hover:text-red-500"
                        aria-label="Remove"
                      >
                        <X className="w-2.5 h-2.5" />
                      </button>
                    </span>
                  );
                })}
              </div>
            </div>
          )}

          {form.is_full_length && derivedSections.length > 0 && (
            <div className="surface-card p-3 space-y-2">
              <div className="flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-tertiary" />
                <div className="text-[11px] font-medium text-on-surface-variant">
                  Sections preview ({derivedSections.length})
                </div>
              </div>
              <p className="text-[10px] text-outline leading-relaxed">
                Sections are auto-grouped by subject from your selection.
                Students can jump between them with the Next Section /
                Prev Section buttons in the test UI.
              </p>
              <ol className="space-y-1">
                {derivedSections.map((s, idx) => (
                  <li
                    key={`${s.subject}-${idx}`}
                    className="flex items-center justify-between gap-2 h-8 px-2 rounded-md bg-surface-container-high/60 border border-outline-variant/15"
                  >
                    <span className="flex items-center gap-2 min-w-0">
                      <span className="shrink-0 inline-flex items-center justify-center w-4 h-4 rounded-full bg-tertiary text-white text-[10px] font-semibold">
                        {idx + 1}
                      </span>
                      <span className="truncate text-xs font-medium text-on-surface">
                        {s.name}
                      </span>
                    </span>
                    <span className="shrink-0 text-[10px] text-outline tabular-nums">
                      {s.question_ids.length} Q
                    </span>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </div>
      </div>

      {/* Sticky save bar */}
      <div className="fixed bottom-16 lg:bottom-0 left-0 right-0 lg:pl-56 z-30 bg-surface/90 backdrop-blur border-t border-outline-variant/15">
        <div className="mx-auto w-full max-w-7xl px-4 md:px-6 py-2.5 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={() => router.back()}
            className="h-9 px-3 rounded-md bg-surface-container-high border border-outline-variant/20 text-on-surface text-sm font-medium hover:bg-surface-container-highest transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="h-9 px-4 rounded-md bg-tertiary text-white text-sm font-poppins font-medium hover:bg-tertiary/90 transition-colors disabled:opacity-60"
          >
            {saving ? "Saving…" : isEdit ? "Save changes" : "Create test"}
          </button>
        </div>
      </div>
      <QuickQuestionDialog
        isOpen={isQuickCreateOpen}
        onClose={() => setIsQuickCreateOpen(false)}
        onSuccess={handleQuickQuestionSuccess}
        initialSubject={form.subject}
      />
    </div>
  );
}
