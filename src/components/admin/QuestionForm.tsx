"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ImagePlus, Loader2, Trash2 } from "lucide-react";
import {
  QuestionSchema,
  type QuestionInput,
  QUESTION_IMAGE_POSITIONS,
  type QuestionImagePosition,
} from "@/lib/schemas";
import { MarkdownEditor } from "@/components/ui/MarkdownEditor";
import { cn } from "@/lib/utils";
import { QuestionPreview } from "./QuestionPreview";

type Props = {
  initial?: Partial<QuestionInput> & { id?: string };
  onSuccess?: (id: string) => void;
  onCancel?: () => void;
  hideHeader?: boolean;
};

const POSITION_LABELS: Record<QuestionImagePosition, string> = {
  right: "Right of question (photograph panel)",
  top: "Above the question",
  bottom: "Below the question",
  inline: "Between question and options",
};

const SUBJECTS = ["Physics", "Chemistry", "Math", "English", "Biology"];
const BLOOM_LEVELS = [
  "remember",
  "understand",
  "apply",
  "analyze",
  "evaluate",
  "create",
] as const;

export function QuestionForm({ initial, onSuccess, onCancel, hideHeader }: Props) {
  const router = useRouter();
  const isEdit = !!initial?.id;

  // Supabase returns `null` for any unset nullable column. Zod's `.default()`
  // only fills in `undefined`, not `null`, so spreading a raw DB row with null
  // fields causes silent validation failures. Filter nulls out so the form
  // defaults below stay the single source of truth for unset fields.
  const normalisedInitial = initial
    ? (Object.fromEntries(
        Object.entries(initial).filter(([, v]) => v !== null)
      ) as Partial<QuestionInput>)
    : undefined;

  const [form, setForm] = useState<Partial<QuestionInput>>({
    subject: "Physics",
    difficulty: "medium",
    status: "draft",
    marks: 1,
    estimated_time: 60,
    tags: [],
    correct: "A",
    image_url: null,
    image_position: "right",
    ...normalisedInitial,
  });
  const [errs, setErrs] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function set(key: keyof QuestionInput, val: unknown) {
    setForm((f) => ({ ...f, [key]: val }));
    setErrs((e) => {
      const n = { ...e };
      delete n[key];
      return n;
    });
  }

  async function handleImagePick(file: File | null | undefined) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please choose an image file");
      return;
    }
    setUploading(true);
    const tid = toast.loading("Uploading image…");
    try {
      const body = new FormData();
      body.append("file", file);
      const res = await fetch("/api/admin/questions/upload-image", {
        method: "POST",
        body,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Upload failed");
      set("image_url", data.url);
      toast.success("Image uploaded", { id: tid });
    } catch (err: any) {
      toast.error(err?.message ?? "Upload failed", { id: tid });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  function removeImage() {
    set("image_url", null);
  }

  async function handleSave() {
    setSaving(true);
    const result = QuestionSchema.safeParse(form);
    if (!result.success) {
      const flat = result.error.flatten().fieldErrors;
      setErrs(
        Object.fromEntries(Object.entries(flat).map(([k, v]) => [k, v?.[0] ?? ""]))
      );
      setSaving(false);
      toast.error("Please fix the validation errors.");
      return;
    }

    const url = isEdit ? `/api/admin/questions/${initial!.id}` : "/api/admin/questions";
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

    toast.success(isEdit ? "Question updated" : "Question created");
    if (onSuccess) {
      onSuccess(data.id || initial?.id);
    } else {
      router.push("/admin/questions");
      router.refresh();
    }
  }

  const fieldLabel = "text-[11px] font-medium text-on-surface-variant block mb-1";
  const fieldInput =
    "w-full h-9 px-2.5 rounded-md bg-surface-container-high border border-outline-variant/20 text-sm outline-none focus:border-tertiary focus:ring-1 focus:ring-tertiary transition-colors";

  return (
    <div className="max-w-3xl mx-auto pb-20 space-y-4">
      {!hideHeader && (
        <div>
          <h1 className="text-xl md:text-2xl font-poppins font-semibold text-on-surface tracking-tight">
            {isEdit ? "Edit question" : "New question"}
          </h1>
          <p className="text-sm text-on-surface-variant">
            {isEdit ? "Update the question details." : "Add a question to the bank. LaTeX supported."}
          </p>
        </div>
      )}

      <div className="surface-card p-3 space-y-4">
        {/* Meta row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
          <div>
            <label className={fieldLabel}>Subject</label>
            <select
              value={form.subject ?? ""}
              onChange={(e) => set("subject", e.target.value)}
              className={fieldInput}
            >
              {SUBJECTS.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
            {errs.subject && <p className="text-red-500 text-[11px] mt-1">{errs.subject}</p>}
          </div>
          <div>
            <label className={fieldLabel}>Difficulty</label>
            <select
              value={form.difficulty ?? "medium"}
              onChange={(e) => set("difficulty", e.target.value as "easy" | "medium" | "hard")}
              className={fieldInput}
            >
              {["easy", "medium", "hard"].map((d) => (
                <option key={d} value={d} className="capitalize">{d}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={fieldLabel}>Topic</label>
            <input
              type="text"
              value={(form.topic ?? "") as string}
              onChange={(e) => set("topic", e.target.value)}
              className={fieldInput}
              placeholder="Optional"
            />
          </div>
          <div>
            <label className={fieldLabel}>Chapter</label>
            <input
              type="text"
              value={(form.chapter ?? "") as string}
              onChange={(e) => set("chapter", e.target.value)}
              className={fieldInput}
              placeholder="Optional"
            />
          </div>
        </div>

        {/* Question */}
        <div>
          <label className={fieldLabel}>Question * (LaTeX supported, e.g. $E = mc^2$)</label>
          <MarkdownEditor
            value={(form.text ?? "") as string}
            onChange={(val) => set("text", val)}
            placeholder="Question text. Use $…$ for LaTeX."
          />
          {errs.text && <p className="text-red-500 text-[11px] mt-1">{errs.text}</p>}
        </div>

        {/* Image / graph */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className={fieldLabel}>Illustration / graph (optional)</label>
            {form.image_url && (
              <span className="text-[10px] text-outline">PNG · JPG · WebP · GIF · max 5MB</span>
            )}
          </div>

          {!form.image_url ? (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className={cn(
                "w-full h-28 rounded-md border border-dashed border-outline-variant/30 bg-surface-container-high/40 flex flex-col items-center justify-center gap-1.5 text-sm text-on-surface-variant hover:border-tertiary hover:bg-tertiary/5 transition-colors disabled:opacity-50",
              )}
            >
              {uploading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <ImagePlus className="w-5 h-5 text-outline" />
              )}
              <span className="text-xs">
                {uploading ? "Uploading…" : "Click to upload an image or graph"}
              </span>
              <span className="text-[10px] text-outline">
                PNG · JPG · WebP · GIF · max 5MB
              </span>
            </button>
          ) : (
            <div className="flex gap-3 items-start">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={form.image_url}
                alt="Question illustration preview"
                className="w-32 h-32 object-contain rounded-md border border-outline-variant/20 bg-white"
              />
              <div className="flex-1 space-y-2">
                <div>
                  <label className={fieldLabel}>Placement</label>
                  <select
                    value={form.image_position ?? "right"}
                    onChange={(e) =>
                      set("image_position", e.target.value as QuestionImagePosition)
                    }
                    className={fieldInput}
                  >
                    {QUESTION_IMAGE_POSITIONS.map((p) => (
                      <option key={p} value={p}>
                        {POSITION_LABELS[p]}
                      </option>
                    ))}
                  </select>
                  <p className="text-[10px] text-outline mt-1">
                    Controls where the image appears inside the student
                    session card.
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-md bg-surface-container-high border border-outline-variant/20 text-xs font-medium text-on-surface hover:bg-surface-container-highest disabled:opacity-50"
                  >
                    {uploading ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <ImagePlus className="w-3.5 h-3.5" />
                    )}
                    Replace
                  </button>
                  <button
                    type="button"
                    onClick={removeImage}
                    className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-md bg-red-500/10 text-red-600 text-xs font-medium hover:bg-red-500/15"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Remove
                  </button>
                </div>
              </div>
            </div>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            className="sr-only"
            onChange={(e) => handleImagePick(e.target.files?.[0])}
            aria-hidden="true"
          />
        </div>

        {/* Answer options */}
        <div>
          <label className={fieldLabel}>Answers *</label>
          <div className="space-y-1.5">
            {(["option_a", "option_b", "option_c", "option_d"] as const).map((key, i) => {
              const letter = ["A", "B", "C", "D"][i];
              const isCorrect = form.correct === letter;
              return (
                <div key={key} className="flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => set("correct", letter)}
                      title={`Mark ${letter} correct`}
                      className={cn(
                        "shrink-0 w-7 h-7 rounded-md flex items-center justify-center text-xs font-semibold transition-colors",
                        isCorrect
                          ? "bg-green-500 text-white"
                          : "bg-surface-container-high text-outline hover:bg-surface-container-highest"
                      )}
                    >
                      {letter}
                    </button>
                    <input
                      type="text"
                      value={(form[key] ?? "") as string}
                      onChange={(e) => set(key, e.target.value)}
                      placeholder={`Option ${letter}`}
                      className="flex-1 h-9 px-2.5 rounded-md bg-surface-container-high border border-outline-variant/20 text-sm outline-none focus:border-tertiary focus:ring-1 focus:ring-tertiary transition-colors"
                    />
                  </div>
                  {errs[key] && <p className="text-red-500 text-[11px] ml-9">{errs[key]}</p>}
                </div>
              );
            })}
          </div>
          {errs.correct && <p className="text-red-500 text-[11px] mt-1">{errs.correct}</p>}
          <p className="text-[11px] text-outline mt-1.5">
            Click a letter to mark it as the correct answer.
          </p>
        </div>

        {/* Explanation */}
        <div>
          <label className={fieldLabel}>Explanation (shown after exam)</label>
          <MarkdownEditor
            value={(form.explanation ?? "") as string}
            onChange={(val) => set("explanation", val)}
            placeholder="Why is the correct answer right? LaTeX supported."
          />
        </div>

        {/* Meta 2 */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
          <div>
            <label className={fieldLabel}>Status</label>
            <select
              value={form.status ?? "draft"}
              onChange={(e) =>
                set("status", e.target.value as "draft" | "review" | "approved" | "retired")
              }
              className={fieldInput}
            >
              {["draft", "review", "approved", "retired"].map((s) => (
                <option key={s} value={s} className="capitalize">{s}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={fieldLabel}>Bloom level</label>
            <select
              value={form.bloom_level ?? ""}
              onChange={(e) =>
                set("bloom_level", (e.target.value as (typeof BLOOM_LEVELS)[number]) || undefined)
              }
              className={fieldInput}
            >
              <option value="">—</option>
              {BLOOM_LEVELS.map((b) => (
                <option key={b} value={b} className="capitalize">{b}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={fieldLabel}>Est. time (s)</label>
            <input
              type="number"
              min={10}
              max={600}
              value={form.estimated_time ?? 60}
              onChange={(e) => { const v = parseInt(e.target.value); if (!isNaN(v)) set("estimated_time", v); }}
              className={fieldInput}
            />
          </div>
          <div>
            <label className={fieldLabel}>Marks</label>
            <input
              type="number"
              min={1}
              max={10}
              value={form.marks ?? 1}
              onChange={(e) => { const v = parseInt(e.target.value); if (!isNaN(v)) set("marks", v); }}
              className={fieldInput}
            />
          </div>
        </div>
      </div>

      {/* Live Preview Section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-sm font-poppins font-semibold text-on-surface">
            Live Student View Preview
          </h2>
          <span className="text-[10px] text-outline uppercase tracking-wider font-medium">
            Standard Exam Interface
          </span>
        </div>
        <QuestionPreview
          text={form.text ?? ""}
          option_a={form.option_a ?? ""}
          option_b={form.option_b ?? ""}
          option_c={form.option_c ?? ""}
          option_d={form.option_d ?? ""}
          image_url={form.image_url}
          image_position={form.image_position}
          marks={form.marks}
        />
        <p className="text-[11px] text-outline text-center italic">
          This preview uses the same rendering engine as the student exam module.
        </p>
      </div>

      {/* Sticky save bar or Inline buttons */}
      <div className={cn(
        onSuccess ? "flex justify-end gap-2 pt-4" : "fixed bottom-16 lg:bottom-0 left-0 right-0 lg:pl-56 z-30 bg-surface/90 backdrop-blur border-t border-outline-variant/15"
      )}>
        <div className={cn(
          onSuccess ? "flex items-center gap-2" : "mx-auto w-full max-w-7xl px-4 md:px-6 py-2.5 flex items-center justify-end gap-2"
        )}>
          <button
            type="button"
            onClick={() => (onCancel ? onCancel() : router.back())}
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
            {saving ? "Saving…" : isEdit ? "Save changes" : "Create question"}
          </button>
        </div>
      </div>
    </div>
  );
}
