"use client";

import { useState } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Search, Plus, Trash2, Edit2, Loader2, AlertCircle, Eye, X } from "lucide-react";
import { MarkdownEditor } from "@/components/ui/MarkdownEditor";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { MarkdownRenderer } from "@/components/ui/MarkdownRenderer";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { QuestionForm } from "@/components/admin/QuestionForm";

type Question = {
  id: string;
  text: string;
  subject: string;
  topic?: string;
  difficulty?: "easy" | "medium" | "hard";
  correct: "A" | "B" | "C" | "D";
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  explanation?: string;
  marks?: number;
  image_url?: string;
  image_position?: "top" | "right" | "bottom" | "inline";
  created_at: string;
};

export function QuestionsClient({
  initialQuestions,
  totalPages = 1,
  currentPage = 1,
  totalCount = 0,
}: {
  initialQuestions: Question[];
  totalPages?: number;
  currentPage?: number;
  totalCount?: number;
}) {
  const router = useRouter();
  const confirm = useConfirm();
  const [searchQuery, setSearchQuery] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [questions, setQuestions] = useState<Question[]>(initialQuestions);
  const [showFormModal, setShowFormModal] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null);
  const [showPreview, setShowPreview] = useState(false);

  const filteredQuestions = questions.filter(
    (q) =>
      q.text?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      q.subject?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      q.topic?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleOpenEdit = (q: Question) => {
    setEditingQuestion(q);
    setShowFormModal(true);
  };

  const handleFormSuccess = () => {
    setShowFormModal(false);
    setEditingQuestion(null);
    router.refresh();
  };

  const handleDelete = async (id: string) => {
    if (!(await confirm({
      title: "Delete this question?",
      description: "It will be removed from any test drafts. This cannot be undone.",
      confirmLabel: "Delete",
      variant: "danger",
    }))) return;

    try {
      const res = await fetch(`/api/admin/questions/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete question");

      toast.success("Question deleted");
      setQuestions(questions.filter((q) => q.id !== id));
      router.refresh();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const diffChip = (d: string) => {
    const map: Record<string, string> = {
      hard: "bg-red-500/10 text-red-500",
      medium: "bg-amber-500/10 text-amber-600",
      easy: "bg-green-500/10 text-green-600",
    };
    return (
      <span className={`inline-flex items-center h-5 px-1.5 rounded text-[10px] font-medium ${map[d] || map.medium}`}>
        {d}
      </span>
    );
  };

  const correctChip = (letter: string, q: Question) => (
    <span
      className={`inline-flex items-center justify-center w-5 h-5 rounded text-[10px] font-semibold ${
        q.correct === letter
          ? "bg-green-500/15 text-green-600"
          : "bg-surface-container-high text-outline"
      }`}
    >
      {letter}
    </span>
  );

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="surface-card p-3 flex flex-col sm:flex-row gap-2 items-stretch sm:items-center">
          <div className="relative flex-1 flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-outline" />
              <input
                type="text"
                placeholder="Search questions, subjects, topics…"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    setSearchQuery(searchInput);
                  }
                }}
                className="w-full h-9 pl-8 pr-3 rounded-md bg-surface-container-high border border-outline-variant/20 focus:border-tertiary focus:ring-1 focus:ring-tertiary outline-none text-sm transition-all"
              />
            </div>
            <button
              onClick={() => setSearchQuery(searchInput)}
              className="h-9 px-4 rounded-md bg-surface-container-highest border border-outline-variant/20 text-on-surface text-sm font-medium hover:bg-surface-container-high transition-colors flex items-center gap-2"
            >
              <Search className="w-3.5 h-3.5" />
              Search
            </button>
            {searchQuery && (
              <button
                onClick={() => {
                  setSearchInput("");
                  setSearchQuery("");
                }}
                className="h-9 px-3 rounded-md text-on-surface-variant hover:text-error text-sm font-medium transition-colors"
              >
                Clear
              </button>
            )}
          </div>
        <button
          onClick={() => {
            setEditingQuestion(null);
            setShowFormModal(true);
          }}
          className="h-9 px-3 rounded-md bg-tertiary text-white text-sm font-poppins font-medium hover:bg-tertiary/90 transition-colors flex items-center justify-center gap-1.5"
        >
          <Plus className="w-3.5 h-3.5" />
          Add question
        </button>
      </div>

      {/* Desktop table */}
      <div className="hidden md:block surface-card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-surface-container-high/60 text-xs text-outline">
            <tr>
              <th className="px-3 py-2.5 text-left font-medium">Question</th>
              <th className="px-3 py-2.5 text-left font-medium">Subject</th>
              <th className="px-3 py-2.5 text-left font-medium">Difficulty</th>
              <th className="px-3 py-2.5 text-right font-medium"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-outline-variant/10">
            <AnimatePresence mode="popLayout">
              {filteredQuestions.map((q) => (
                <motion.tr
                  layout
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  key={q.id}
                  className="hover:bg-surface-container-high/40"
                >
                  <td className="px-3 py-2.5 max-w-md overflow-hidden">
                    <div className="text-on-surface text-sm prose prose-sm max-w-none dark:prose-invert line-clamp-2">
                      <MarkdownRenderer content={q.text} />
                    </div>
                    <div className="flex gap-1 mt-1">
                      {["A", "B", "C", "D"].map((l) => (
                        <span key={l}>{correctChip(l, q)}</span>
                      ))}
                    </div>
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex flex-col">
                      <span className="text-on-surface text-xs">{q.subject}</span>
                      <span className="text-outline text-[11px]">{q.topic || "General"}</span>
                    </div>
                  </td>
                  <td className="px-3 py-2.5">{diffChip(q.difficulty || "medium")}</td>
                  <td className="px-3 py-2.5 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => handleOpenEdit(q)}
                        className="p-1.5 rounded text-on-surface-variant hover:bg-tertiary/10 hover:text-tertiary transition-colors"
                        aria-label="Edit"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDelete(q.id)}
                        className="p-1.5 rounded text-on-surface-variant hover:bg-error/10 hover:text-error transition-colors"
                        aria-label="Delete"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </motion.tr>
              ))}
            </AnimatePresence>
            {filteredQuestions.length === 0 && (
              <tr>
                <td colSpan={4} className="px-3 py-8 text-center text-sm text-outline">
                  No questions found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="md:hidden space-y-2">
        {filteredQuestions.map((q) => (
          <div key={q.id} className="surface-card p-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1 overflow-hidden">
                <div className="text-sm text-on-surface prose prose-sm max-w-none dark:prose-invert line-clamp-2">
                  <MarkdownRenderer content={q.text} />
                </div>
                <div className="mt-1.5 flex flex-wrap gap-x-2 gap-y-1 items-center text-[11px] text-on-surface-variant">
                  <span>{q.subject}</span>
                  {q.topic && <span>· {q.topic}</span>}
                  {diffChip(q.difficulty || "medium")}
                </div>
                <div className="flex gap-1 mt-1.5">
                  {["A", "B", "C", "D"].map((l) => (
                    <span key={l}>{correctChip(l, q)}</span>
                  ))}
                </div>
              </div>
              <div className="flex gap-1 shrink-0">
                <button
                  onClick={() => handleOpenEdit(q)}
                  className="p-1.5 rounded text-on-surface-variant hover:bg-tertiary/10 hover:text-tertiary"
                  aria-label="Edit"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => handleDelete(q.id)}
                  className="p-1.5 rounded text-on-surface-variant hover:bg-error/10 hover:text-error"
                  aria-label="Delete"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        ))}
        {filteredQuestions.length === 0 && (
          <div className="surface-card p-6 text-center text-sm text-outline">No questions found.</div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-xs">
          <p className="text-outline">
            Page {currentPage} of {totalPages} · {totalCount} questions
          </p>
          <div className="flex gap-1.5">
            {currentPage > 1 && (
              <Link
                href={`/admin/questions?page=${currentPage - 1}`}
                className="h-8 px-2.5 rounded-md bg-surface-container-high border border-outline-variant/20 text-on-surface flex items-center"
              >
                Prev
              </Link>
            )}
            {currentPage < totalPages && (
              <Link
                href={`/admin/questions?page=${currentPage + 1}`}
                className="h-8 px-2.5 rounded-md bg-tertiary text-white flex items-center"
              >
                Next
              </Link>
            )}
          </div>
        </div>
      )}      {/* Modal */}
      {showFormModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-3">
          <div className="bg-surface w-full max-w-4xl max-h-[92vh] rounded-xl border border-outline-variant/20 shadow-2xl overflow-hidden flex flex-col">
            <div className="px-4 py-3 border-b border-outline-variant/10 flex items-center justify-between shrink-0">
              <h2 className="text-base font-poppins font-semibold text-on-surface">
                {editingQuestion ? "Edit question" : "New question"}
              </h2>
              <button
                type="button"
                onClick={() => setShowFormModal(false)}
                className="p-1.5 rounded-full hover:bg-surface-container-high text-outline transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
              <QuestionForm
                hideHeader
                initial={editingQuestion || undefined}
                onSuccess={handleFormSuccess}
                onCancel={() => setShowFormModal(false)}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
