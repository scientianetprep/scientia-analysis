"use client";

import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { QuestionForm } from "./QuestionForm";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (id: string) => void;
  initialSubject?: string;
}

export function QuickQuestionDialog({ isOpen, onClose, onSuccess, initialSubject }: Props) {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            className="relative w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col surface-card"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-outline-variant/15 shrink-0">
              <h3 className="text-sm font-poppins font-semibold text-on-surface">
                Quick Create Question
              </h3>
              <button
                onClick={onClose}
                className="p-1.5 rounded-full hover:bg-surface-container-high text-outline hover:text-on-surface transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
              <QuestionForm 
                hideHeader 
                initial={{ subject: initialSubject }}
                onSuccess={onSuccess} 
                onCancel={onClose}
              />
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
