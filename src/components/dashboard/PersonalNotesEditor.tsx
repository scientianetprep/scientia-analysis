"use client";

import { useEffect, useState, useRef } from "react";
import { createBrowserClientFn } from "@/lib/supabase/client";
import { StickyNote, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface PersonalNotesEditorProps {
  lessonId: string;
  userId: string;
  initialContent: string;
}

export function PersonalNotesEditor({
  lessonId,
  userId,
  initialContent,
}: PersonalNotesEditorProps) {
  const [content, setContent] = useState(initialContent || "");
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);

  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const supabase = createBrowserClientFn();

  useEffect(() => {
    setContent(initialContent || "");
  }, [initialContent, lessonId]);

  const saveNote = async (textToSave: string) => {
    if (!lessonId || !userId) return;
    setIsSaving(true);

    try {
      const { error } = await supabase
        .from("personal_notes")
        .upsert(
          {
            user_id: userId,
            lesson_id: lessonId,
            content: textToSave,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "user_id, lesson_id" }
        );

      if (error) throw error;
      setLastSaved(new Date());
    } catch (e: unknown) {
      console.error("Failed to save note", e);
      toast.error("Failed to sync notes", {
        description: "Please check your connection.",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newVal = e.target.value;
    setContent(newVal);

    if (timeoutRef.current) clearTimeout(timeoutRef.current);

    timeoutRef.current = setTimeout(() => {
      saveNote(newVal);
    }, 1000);
  };

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  return (
    <div className="flex-1 flex flex-col p-4 space-y-3 h-full">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-md bg-brand-primary/10 flex items-center justify-center shrink-0">
            <StickyNote className="w-4 h-4 text-brand-primary" />
          </div>
          <div>
            <h3 className="text-sm font-poppins font-semibold text-on-surface">
              Personal study notes
            </h3>
            <p className="text-[11px] text-outline">
              Private, autosaved while you type
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 text-[11px] text-on-surface-variant shrink-0">
          {isSaving ? (
            <>
              <Loader2 className="w-3 h-3 animate-spin" />
              <span>Saving…</span>
            </>
          ) : lastSaved ? (
            <span>Autosaved {lastSaved.toLocaleTimeString()}</span>
          ) : (
            <span>Ready</span>
          )}
        </div>
      </div>

      <textarea
        value={content}
        onChange={handleChange}
        placeholder="Start typing your notes for this lesson…"
        className="flex-1 w-full p-3 rounded-md bg-surface-container-high border border-outline-variant/20 focus:border-brand-primary focus:ring-1 focus:ring-brand-primary outline-none transition-colors text-sm text-on-surface leading-relaxed resize-none custom-scrollbar"
      />
    </div>
  );
}
