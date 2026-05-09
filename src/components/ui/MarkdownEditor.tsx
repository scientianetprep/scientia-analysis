import React, { useState } from 'react';
import { MarkdownRenderer } from './MarkdownRenderer';

interface MarkdownEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export function MarkdownEditor({ value, onChange, placeholder = "Enter content using Markdown and LaTeX... (e.g., $E = mc^2$)" }: MarkdownEditorProps) {
  const [tab, setTab] = useState<'edit' | 'preview'>('edit');

  return (
    <div className="border border-outline-variant/30 rounded-xl overflow-hidden bg-surface-container flex flex-col">
      <div className="flex border-b border-outline-variant/20 bg-surface-container-high/30 px-2 py-2 gap-2">
        <button
          type="button"
          onClick={() => setTab('edit')}
          className={`px-4 py-1.5 rounded-lg text-sm font-poppins font-bold transition-colors ${tab === 'edit' ? 'bg-tertiary text-white shadow-sm' : 'text-outline-variant hover:text-on-surface hover:bg-surface-container-highest'}`}
        >
          Edit
        </button>
        <button
          type="button"
          onClick={() => setTab('preview')}
          className={`px-4 py-1.5 rounded-lg text-sm font-poppins font-bold transition-colors ${tab === 'preview' ? 'bg-tertiary text-white shadow-sm' : 'text-outline-variant hover:text-on-surface hover:bg-surface-container-highest'}`}
        >
          Preview
        </button>
      </div>
      
      <div className="p-4 flex-1 min-h-[300px]">
        {tab === 'edit' ? (
          <textarea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            className="w-full h-full min-h-[300px] resize-y outline-none bg-transparent font-mono text-sm text-on-surface placeholder:text-outline-variant/50"
          />
        ) : (
          <div className="prose prose-invert prose-sm max-w-none prose-p:text-on-surface-variant font-lora h-full min-h-[300px] overflow-auto">
            {value.trim() ? (
              <MarkdownRenderer content={value} />
            ) : (
              <p className="text-outline-variant italic">Nothing to preview...</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
