"use client";

import { LazyMotion } from "framer-motion";
import { ReactNode } from "react";

/**
 * Lazy-loads Framer Motion features on demand.
 * 
 * Using `strict` mode throws an error if `motion` is accidentally imported
 * instead of `m` in any child component, ensuring tree-shaking works.
 * 
 * Initial bundle: ~4.6KB vs 34KB with regular `motion` imports.
 */
export function MotionProvider({ children }: { children: ReactNode }) {
  return (
    <LazyMotion
      features={() => import("@/lib/motion-features").then((mod) => mod.default)}
      strict
    >
      {children}
    </LazyMotion>
  );
}
