"use client";

import React, { useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import rehypeRaw from 'rehype-raw';
import 'katex/dist/katex.min.css';

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

/**
 * A comprehensive Markdown renderer that supports:
 * - GitHub Flavored Markdown (GFM)
 * - LaTeX (via MathJax/KaTeX)
 * - Raw HTML & SVG (via rehype-raw)
 * - Script execution (e.g., for JSXGraph or other interactive content)
 */
export function MarkdownRenderer({ content, className }: MarkdownRendererProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    
    // We need to manually execute scripts because React's dangerouslySetInnerHTML 
    // (which react-markdown uses via rehype-raw) doesn't execute <script> tags.
    // Find our custom placeholders for scripts
    const scriptPlaceholders = containerRef.current.querySelectorAll('.markdown-script-source');
    scriptPlaceholders.forEach(placeholder => {
      const el = placeholder as HTMLElement;
      if (el.dataset.processed === 'true') return;
      el.dataset.processed = 'true';

      const newScript = document.createElement('script');
      
      // Copy content and wrap in an IIFE
      if (el.textContent) {
        newScript.textContent = `(function(){ \n${el.textContent}\n })();`;
      }
      
      // Copy attributes (excluding our internal ones)
      Array.from(el.attributes).forEach(attr => {
        if (attr.name !== 'class' && !attr.name.startsWith('data-processed')) {
          newScript.setAttribute(attr.name, attr.value);
        }
      });
      
      // Append the actual script to the parent of the placeholder
      el.parentNode?.appendChild(newScript);
    });
  }, [content]);

  // Custom rehype plugin to strip all "on*" attributes (onclick, onmouseover, etc.)
  // which causes React 19 to crash when they are strings.
  const rehypeStripHandlers = () => (tree: any) => {
    const visit = (node: any) => {
      if (node.type === 'element' && node.properties) {
        Object.keys(node.properties).forEach(key => {
          if (key.toLowerCase().startsWith('on')) {
            delete node.properties[key];
          }
        });
      }
      if (node.children) {
        node.children.forEach(visit);
      }
    };
    visit(tree);
  };

  return (
    <div ref={containerRef} className={className}>
      <ReactMarkdown
        remarkPlugins={[remarkMath, remarkGfm]}
        rehypePlugins={[rehypeRaw, rehypeStripHandlers, rehypeKatex]}
        components={{
          // Render script tags as hidden spans to silence React's "don't use script tags" warning.
          // Our useEffect above will find these and convert them into actual executing scripts.
          script: ({ node, children, ...props }) => {
            // Filter out any "on*" props (like onClick, onMouseOver) that might be strings 
            // from raw HTML, as React 19 will throw an error if they aren't functions.
            const filteredProps = Object.fromEntries(
              Object.entries(props).filter(([key]) => !key.toLowerCase().startsWith('on'))
            );

            return (
              <span className="hidden markdown-script-source" {...filteredProps}>
                {children}
              </span>
            );
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
