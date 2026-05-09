"use client";

import { useEffect, useState } from "react";
import { getBrowserSupport, BrowserSupport } from "@/lib/browser-check";
import { Globe, Monitor, ShieldAlert } from "lucide-react";

export function BrowserWarningBanner() {
  const [support, setSupport] = useState<BrowserSupport>('chrome'); // Default to chrome for SSR matching
  const [show, setShow] = useState(false);

  useEffect(() => {
    const currentSupport = getBrowserSupport();
    setSupport(currentSupport);
    if (currentSupport === 'unsupported') {
      setShow(true);
    }
  }, []);

  if (!show) return null;

  return (
    <div className="mb-4 p-3 rounded-md bg-red-500/10 border border-red-500/25 flex items-start gap-3">
      <div className="w-8 h-8 rounded-md bg-red-500 flex items-center justify-center shrink-0">
        <ShieldAlert className="w-4 h-4 text-white" />
      </div>
      <div className="flex-1 min-w-0">
        <h3 className="text-sm font-poppins font-medium text-on-surface">
          Unsupported browser detected
        </h3>
        <p className="text-xs text-on-surface-variant mt-0.5 leading-relaxed">
          The proctoring engine requires <strong>Chrome</strong> or <strong>Edge</strong> for
          high-integrity testing. Other browsers may trigger violations.
        </p>
        <div className="flex flex-wrap gap-2 mt-2">
          <a
            href="https://www.google.com/chrome/"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md bg-surface-container-high border border-outline-variant/20 text-xs font-poppins font-medium text-on-surface hover:bg-surface-container-highest transition-colors"
          >
            <Globe className="w-3.5 h-3.5 text-[#4285F4]" /> Chrome
          </a>
          <a
            href="https://www.microsoft.com/edge"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md bg-surface-container-high border border-outline-variant/20 text-xs font-poppins font-medium text-on-surface hover:bg-surface-container-highest transition-colors"
          >
            <Monitor className="w-3.5 h-3.5 text-[#0078D7]" /> Edge
          </a>
        </div>
      </div>
    </div>
  );
}
