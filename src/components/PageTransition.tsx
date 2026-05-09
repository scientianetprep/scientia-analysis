"use client";

import { LazyMotion, m, AnimatePresence } from "framer-motion";
import { usePathname } from "next/navigation";
import { loadMotionFeatures } from "@/lib/motion-features";

export function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <LazyMotion features={loadMotionFeatures} strict>
      <AnimatePresence mode="wait">
        <m.div
          key={pathname}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.3, ease: "easeInOut" }}
          className="flex-1 flex flex-col"
        >
          {children}
        </m.div>
      </AnimatePresence>
    </LazyMotion>
  );
}
